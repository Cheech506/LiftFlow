import assert from 'node:assert/strict';
import test from 'node:test';

import { isClientVersionCompatible, normalizeServerUrl, ServerApiError } from '../src/lib/serverApi';

test('normalizes Immich-style server addresses without accepting embedded credentials', () => {
  assert.equal(normalizeServerUrl('192.168.1.50:8080/'), 'http://192.168.1.50:8080');
  assert.equal(normalizeServerUrl('https://liftflow.example.com/api/v1'), 'https://liftflow.example.com');
  assert.throws(
    () => normalizeServerUrl('https://owner:password@liftflow.example.com'),
    (error) => error instanceof ServerApiError && error.code === 'invalid_server_url',
  );
});

test('enforces the minimum compatible LiftFlow client version', () => {
  assert.equal(isClientVersionCompatible('0.7.0', '0.7.0'), true);
  assert.equal(isClientVersionCompatible('0.7.1', '0.7.0'), true);
  assert.equal(isClientVersionCompatible('0.6.9', '0.7.0'), false);
  assert.equal(isClientVersionCompatible('1.0.0', '0.9.9'), true);
});
