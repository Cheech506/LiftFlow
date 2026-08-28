import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

test('creates owner-scoped relational workout tables at Alembic revision 0003', () => {
  const migration = read('server/migrations/versions/0003_workout_data.py');

  for (const table of [
    'owner_data_states',
    'owner_preferences',
    'exercise_definitions',
    'workout_folders',
    'workout_templates',
    'workout_sessions',
    'workout_exercises',
    'workout_sets',
  ]) {
    assert.match(migration, new RegExp(`"${table}"`));
  }
  assert.match(migration, /num_nonnulls\(template_id, session_id\) = 1/);
  assert.match(migration, /ondelete="CASCADE"/);
});

test('protects versioned snapshot summary, read, and transactional replace routes', () => {
  const route = read('server/app/api/routes/workout_data.py');
  const service = read('server/app/services/workout_data.py');

  assert.match(route, /Depends\(require_authenticated_owner\)/);
  assert.match(route, /@router\.get\("\/summary"/);
  assert.match(route, /@router\.get\("\/snapshot"/);
  assert.match(route, /@router\.put\("\/snapshot"/);
  assert.match(service, /async with self\.session\.begin\(\)/);
  assert.match(service, /snapshot_revision_conflict/);
  assert.match(service, /storage_version_mismatch/);
});

test('declares client contracts without enabling continuous sync early', () => {
  const api = read('src/lib/serverApi.ts');
  const serverInfo = read('server/app/api/routes/server_info.py');

  assert.match(api, /getServerDataSummary/);
  assert.match(api, /getServerSnapshot/);
  assert.match(api, /replaceServerSnapshot/);
  assert.match(serverInfo, /backup_import=True/);
  assert.match(serverInfo, /sync=False/);
});
