import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

test('enforces exactly one owner per Docker installation', () => {
  const migration = read('server/migrations/versions/0002_single_owner_auth.py');

  assert.match(migration, /"owner_accounts"/);
  assert.match(migration, /singleton_key = 1/);
  assert.match(migration, /uq_owner_accounts_singleton_key/);
  assert.match(migration, /"device_sessions"/);
});

test('stores password and device tokens as one-way hashes', () => {
  const auth = read('server/app/core/auth.py');
  const requirements = read('server/requirements.txt');

  assert.match(requirements, /argon2-cffi==25\.1\.0/);
  assert.match(auth, /PasswordHasher/);
  assert.match(auth, /hashlib\.sha256/);
  assert.match(auth, /access_token_digest/);
  assert.match(auth, /refresh_token_digest/);
});

test('configures encrypted native session storage and protected routes', () => {
  const packageJson = JSON.parse(read('package.json')) as { dependencies: Record<string, string> };
  const appJson = JSON.parse(read('app.json')) as { expo: { plugins: unknown[] } };
  const rootLayout = read('src/app/_layout.tsx');

  assert.equal(packageJson.dependencies['expo-secure-store'], '~15.0.8');
  assert.ok(appJson.expo.plugins.includes('expo-secure-store'));
  assert.match(rootLayout, /Stack\.Protected guard=\{!session\}/);
  assert.match(rootLayout, /Stack\.Protected guard=\{Boolean\(session\)\}/);
});
