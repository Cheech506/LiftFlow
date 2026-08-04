import type { LiftFlowStateSnapshot } from '@/context/ActiveWorkoutContext';
import {
  parseLiftFlowBackup,
  parseStoredState,
  STORAGE_VERSION,
  type PersistedLiftFlowState,
} from './liftflowStorageCore';

const STORAGE_KEY = 'liftflow.local-state';
const BACKUP_STORAGE_KEY = 'liftflow.local-state.backup';

function getStorage() {
  if (!globalThis.localStorage) throw new Error('Persistent local storage is unavailable in this browser.');
  return globalThis.localStorage;
}

export async function loadLiftFlowState(): Promise<PersistedLiftFlowState | null> {
  const storage = getStorage();
  return parseStoredState(storage.getItem(STORAGE_KEY)) ?? parseStoredState(storage.getItem(BACKUP_STORAGE_KEY));
}

export async function saveLiftFlowState(state: LiftFlowStateSnapshot): Promise<void> {
  const storage = getStorage();
  const existing = storage.getItem(STORAGE_KEY);
  if (existing) storage.setItem(BACKUP_STORAGE_KEY, existing);
  const payload: PersistedLiftFlowState = {
    version: STORAGE_VERSION,
    app: 'LiftFlow',
    ...state,
  };
  storage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export async function clearLiftFlowState(): Promise<void> {
  const storage = getStorage();
  storage.removeItem(STORAGE_KEY);
  storage.removeItem(BACKUP_STORAGE_KEY);
}

export { parseLiftFlowBackup, type PersistedLiftFlowState };
