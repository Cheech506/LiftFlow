import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

test('defines isolated PostgreSQL, API, and containerized backend test services', () => {
  const compose = read('compose.yaml');

  assert.match(compose, /postgres:\n\s+image: postgres:16-alpine/);
  assert.match(compose, /api:\n\s+build:/);
  assert.match(compose, /condition: service_healthy/);
  assert.match(compose, /api-test:/);
  assert.match(compose, /no-new-privileges:true/);
  assert.match(compose, /LIFTFLOW_API_HOST:-127\.0\.0\.1/);
});

test('keeps server secrets and generated backend artifacts out of source control', () => {
  const gitignore = read('.gitignore');

  assert.match(gitignore, /^\.env$/m);
  assert.match(gitignore, /server\/\.venv\//);
  assert.match(gitignore, /server\/\.pytest_cache\//);
  assert.ok(existsSync('.env.example'));
});

test('declares the versioned health and server-information API contract', () => {
  const health = read('server/app/api/routes/health.py');
  const serverInfo = read('server/app/api/routes/server_info.py');

  assert.match(health, /@router\.get\("\/health"/);
  assert.match(health, /@router\.get\("\/health\/live"/);
  assert.match(serverInfo, /@router\.get\("\/server-info"/);
  assert.match(serverInfo, /authentication=False/);
  assert.match(serverInfo, /sync=False/);
});

test('initializes one durable server identity through Alembic', () => {
  const migration = read('server/migrations/versions/0001_server_foundation.py');

  assert.match(migration, /op\.create_table\(\n\s+"server_instances"/);
  assert.match(migration, /gen_random_uuid\(\)/);
  assert.match(migration, /INSERT INTO server_instances/);
});
