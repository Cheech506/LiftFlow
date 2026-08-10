import 'expo-sqlite/localStorage/install';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import type { LiftFlowStateSnapshot } from '@/context/ActiveWorkoutContext';
import {
  getProjectionCounts,
  hydrateLiftFlowProjection,
  LOCAL_OWNER_ID,
  type NormalizedProjection,
  type NormalizedRow,
  type NormalizedTableName,
  projectLiftFlowState,
  projectionIdentity,
  projectionsMatch,
} from './normalizedState';
import {
  normalizeLiftFlowState,
  parseLiftFlowBackup,
  parseStoredState,
  STORAGE_VERSION,
  type PersistedLiftFlowState,
} from './liftflowStorageCore';

const DATABASE_NAME = 'liftflow-v0.5.db';
const LEGACY_STORAGE_KEY = 'liftflow.local-state';
const LEGACY_BACKUP_STORAGE_KEY = 'liftflow.local-state.backup';
const TABLES: NormalizedTableName[] = [
  'preferences',
  'exercises',
  'workout_folders',
  'workout_templates',
  'workout_sessions',
  'workout_exercises',
  'workout_sets',
];

type StoredRow = {
  row_key: string;
  sync_id: string;
  app_id: string;
  parent_id: string | null;
  position: number;
  status: string | null;
  searchable_name: string | null;
  data_json: string;
  record_hash: string;
  deleted_at: number | null;
  sync_version: number;
};

let databasePromise: Promise<SQLiteDatabase> | null = null;
let operationQueue: Promise<void> = Promise.resolve();
const versions = new Map<NormalizedTableName, Map<string, number>>();

function serializeOperation<T>(operation: () => Promise<T>): Promise<T> {
  const result = operationQueue.then(operation, operation);
  operationQueue = result.then(() => undefined, () => undefined);
  return result;
}

function getDatabase() {
  databasePromise ??= openDatabaseAsync(DATABASE_NAME);
  return databasePromise;
}

async function ensureSchema(database: SQLiteDatabase) {
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS owner_accounts (
      id TEXT PRIMARY KEY NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS app_metadata (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS migration_backups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_version INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      snapshot_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS migration_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      migration_name TEXT NOT NULL,
      completed_at INTEGER NOT NULL,
      identity_hash TEXT NOT NULL,
      counts_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS entity_tombstones (
      sync_id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      entity_table TEXT NOT NULL,
      app_id TEXT NOT NULL,
      deleted_at INTEGER NOT NULL,
      sync_version INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS sync_outbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sync_id TEXT NOT NULL,
      entity_table TEXT NOT NULL,
      operation TEXT NOT NULL,
      queued_at INTEGER NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_sync_outbox_queued_at ON sync_outbox(queued_at);
  `);
  for (const table of TABLES) {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS ${table} (
        row_key TEXT PRIMARY KEY NOT NULL,
        sync_id TEXT NOT NULL UNIQUE,
        user_id TEXT NOT NULL,
        app_id TEXT NOT NULL,
        parent_id TEXT,
        position INTEGER NOT NULL DEFAULT 0,
        status TEXT,
        searchable_name TEXT,
        data_json TEXT NOT NULL,
        record_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        sync_version INTEGER NOT NULL DEFAULT 1,
        deleted_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_${table}_parent_position ON ${table}(parent_id, position);
      CREATE INDEX IF NOT EXISTS idx_${table}_status ON ${table}(status);
      CREATE INDEX IF NOT EXISTS idx_${table}_search_name ON ${table}(searchable_name);
    `);
  }
  await database.runAsync(
    'INSERT OR IGNORE INTO owner_accounts (id, created_at) VALUES (?, ?)',
    LOCAL_OWNER_ID,
    Date.now(),
  );
  await database.runAsync(
    "INSERT OR REPLACE INTO app_metadata (key, value) VALUES ('schema_version', '5')",
  );
}

async function readProjection(database: SQLiteDatabase): Promise<NormalizedProjection> {
  const projection = {} as NormalizedProjection;
  for (const table of TABLES) {
    const storedRows = await database.getAllAsync<StoredRow>(`SELECT row_key, sync_id, app_id, parent_id, position, status, searchable_name, data_json, record_hash, deleted_at, sync_version FROM ${table}`);
    versions.set(table, new Map(storedRows.map((item) => [item.row_key, item.sync_version])));
    projection[table] = storedRows.map((item): NormalizedRow => ({
      rowKey: item.row_key,
      syncId: item.sync_id,
      appId: item.app_id,
      parentId: item.parent_id,
      position: item.position,
      status: item.status,
      searchableName: item.searchable_name,
      dataJson: item.data_json,
      recordHash: item.record_hash,
      deletedAt: item.deleted_at,
    }));
  }
  return projection;
}

async function writeProjection(database: SQLiteDatabase, projection: NormalizedProjection) {
  const existing = await readProjection(database);
  const now = Date.now();
  await database.withExclusiveTransactionAsync(async (transaction) => {
    for (const table of TABLES) {
      const existingRows = new Map(existing[table].map((item) => [item.rowKey, item]));
      const incomingRows = new Map(projection[table].map((item) => [item.rowKey, item]));
      const tableVersions = versions.get(table) ?? new Map<string, number>();
      const upsert = await transaction.prepareAsync(`
        INSERT INTO ${table} (
          row_key, sync_id, user_id, app_id, parent_id, position, status,
          searchable_name, data_json, record_hash, created_at, updated_at,
          sync_version, deleted_at
        ) VALUES (
          $rowKey, $syncId, $userId, $appId, $parentId, $position, $status,
          $searchableName, $dataJson, $recordHash, $createdAt, $updatedAt,
          $syncVersion, $deletedAt
        )
        ON CONFLICT(row_key) DO UPDATE SET
          sync_id = excluded.sync_id,
          app_id = excluded.app_id,
          parent_id = excluded.parent_id,
          position = excluded.position,
          status = excluded.status,
          searchable_name = excluded.searchable_name,
          data_json = excluded.data_json,
          record_hash = excluded.record_hash,
          updated_at = excluded.updated_at,
          sync_version = excluded.sync_version,
          deleted_at = excluded.deleted_at
      `);
      try {
        for (const incoming of projection[table]) {
          const previous = existingRows.get(incoming.rowKey);
          if (previous?.recordHash === incoming.recordHash) continue;
          const nextVersion = (tableVersions.get(incoming.rowKey) ?? 0) + 1;
          await upsert.executeAsync({
            $rowKey: incoming.rowKey,
            $syncId: incoming.syncId,
            $userId: LOCAL_OWNER_ID,
            $appId: incoming.appId,
            $parentId: incoming.parentId,
            $position: incoming.position,
            $status: incoming.status,
            $searchableName: incoming.searchableName,
            $dataJson: incoming.dataJson,
            $recordHash: incoming.recordHash,
            $createdAt: now,
            $updatedAt: now,
            $syncVersion: nextVersion,
            $deletedAt: incoming.deletedAt,
          });
        }
      } finally {
        await upsert.finalizeAsync();
      }

      const remove = await transaction.prepareAsync(`DELETE FROM ${table} WHERE row_key = ?`);
      const tombstone = await transaction.prepareAsync(`
        INSERT INTO entity_tombstones (sync_id, user_id, entity_table, app_id, deleted_at, sync_version)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(sync_id) DO UPDATE SET deleted_at = excluded.deleted_at, sync_version = excluded.sync_version
      `);
      try {
        for (const previous of existing[table]) {
          if (incomingRows.has(previous.rowKey)) continue;
          const nextVersion = (tableVersions.get(previous.rowKey) ?? 0) + 1;
          await tombstone.executeAsync(previous.syncId, LOCAL_OWNER_ID, table, previous.appId, now, nextVersion);
          await remove.executeAsync(previous.rowKey);
        }
      } finally {
        await remove.finalizeAsync();
        await tombstone.finalizeAsync();
      }
    }
    await transaction.runAsync(
      "INSERT OR REPLACE INTO app_metadata (key, value) VALUES ('state_initialized', ?)",
      String(now),
    );
    await transaction.runAsync(
      "INSERT OR REPLACE INTO app_metadata (key, value) VALUES ('storage_version', ?)",
      String(STORAGE_VERSION),
    );
  });
  await readProjection(database);
}

function getLegacyStorage() {
  return globalThis.localStorage;
}

async function migrateLegacySnapshot(database: SQLiteDatabase, snapshot: PersistedLiftFlowState, sourceText: string) {
  const projection = projectLiftFlowState(snapshot);
  await database.runAsync(
    'INSERT INTO migration_backups (source_version, created_at, snapshot_json) VALUES (?, ?, ?)',
    snapshot.version,
    Date.now(),
    sourceText,
  );
  await writeProjection(database, projection);
  const storedProjection = await readProjection(database);
  if (!projectionsMatch(projection, storedProjection)) {
    await clearNormalizedTables(database);
    throw new Error('The v0.5 database migration did not pass identity verification. The legacy snapshot was preserved.');
  }
  await database.runAsync(
    'INSERT INTO migration_audit (migration_name, completed_at, identity_hash, counts_json) VALUES (?, ?, ?, ?)',
    'legacy-snapshot-to-normalized-v0.5',
    Date.now(),
    projectionIdentity(projection),
    JSON.stringify(getProjectionCounts(projection)),
  );
}

async function clearNormalizedTables(database: SQLiteDatabase) {
  await database.withExclusiveTransactionAsync(async (transaction) => {
    for (const table of [...TABLES].reverse()) await transaction.execAsync(`DELETE FROM ${table}`);
    await transaction.execAsync('DELETE FROM entity_tombstones; DELETE FROM sync_outbox;');
    await transaction.runAsync("DELETE FROM app_metadata WHERE key IN ('state_initialized', 'storage_version')");
  });
  versions.clear();
}

export async function loadLiftFlowState(): Promise<PersistedLiftFlowState | null> {
  const database = await getDatabase();
  await ensureSchema(database);
  const initialized = await database.getFirstAsync<{ value: string }>(
    "SELECT value FROM app_metadata WHERE key = 'state_initialized'",
  );
  if (initialized) {
    const projection = await readProjection(database);
    const snapshot = hydrateLiftFlowProjection(projection);
    return snapshot ? normalizeLiftFlowState({ version: STORAGE_VERSION, app: 'LiftFlow', ...snapshot }) : null;
  }

  const legacyStorage = getLegacyStorage();
  const primaryText = legacyStorage?.getItem(LEGACY_STORAGE_KEY) ?? null;
  const backupText = legacyStorage?.getItem(LEGACY_BACKUP_STORAGE_KEY) ?? null;
  const legacy = parseStoredState(primaryText) ?? parseStoredState(backupText);
  const sourceText = parseStoredState(primaryText) ? primaryText : backupText;
  if (!legacy || !sourceText) return null;
  try {
    await migrateLegacySnapshot(database, legacy, sourceText);
  } catch (error) {
    console.error('LiftFlow preserved the legacy snapshot because normalized migration verification failed.', error);
    return legacy;
  }
  const stored = hydrateLiftFlowProjection(await readProjection(database));
  return stored ? normalizeLiftFlowState({ version: STORAGE_VERSION, app: 'LiftFlow', ...stored }) : null;
}

export async function saveLiftFlowState(state: LiftFlowStateSnapshot): Promise<void> {
  await serializeOperation(async () => {
    const database = await getDatabase();
    await ensureSchema(database);
    const initialized = await database.getFirstAsync<{ value: string }>(
      "SELECT value FROM app_metadata WHERE key = 'state_initialized'",
    );
    const legacyStorage = getLegacyStorage();
    const primaryText = legacyStorage?.getItem(LEGACY_STORAGE_KEY) ?? null;
    const backupText = legacyStorage?.getItem(LEGACY_BACKUP_STORAGE_KEY) ?? null;
    const legacy = parseStoredState(primaryText) ?? parseStoredState(backupText);
    const sourceText = parseStoredState(primaryText) ? primaryText : backupText;
    if (!initialized && legacy && sourceText) {
      await migrateLegacySnapshot(database, legacy, sourceText);
      return;
    }
    await writeProjection(database, projectLiftFlowState(state));
  });
}

export async function saveLiftFlowSafetyBackup(state: LiftFlowStateSnapshot): Promise<void> {
  await serializeOperation(async () => {
    const database = await getDatabase();
    await ensureSchema(database);
    const payload: PersistedLiftFlowState = { version: STORAGE_VERSION, app: 'LiftFlow', ...state };
    await database.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.runAsync(
        'INSERT INTO migration_backups (source_version, created_at, snapshot_json) VALUES (?, ?, ?)',
        STORAGE_VERSION,
        Date.now(),
        JSON.stringify(payload),
      );
      await transaction.runAsync(`DELETE FROM migration_backups WHERE id NOT IN (SELECT id FROM migration_backups ORDER BY id DESC LIMIT 5)`);
    });
  });
}

export async function clearLiftFlowState(): Promise<void> {
  await serializeOperation(async () => {
    const database = await getDatabase();
    await ensureSchema(database);
    await clearNormalizedTables(database);
    await database.execAsync('DELETE FROM migration_backups; DELETE FROM migration_audit;');
    const storage = getLegacyStorage();
    storage?.removeItem(LEGACY_STORAGE_KEY);
    storage?.removeItem(LEGACY_BACKUP_STORAGE_KEY);
  });
}

export { parseLiftFlowBackup, type PersistedLiftFlowState };
