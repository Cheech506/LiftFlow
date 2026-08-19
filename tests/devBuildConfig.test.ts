import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

type JsonObject = Record<string, any>;

function readJson(path: string): JsonObject {
  return JSON.parse(readFileSync(path, 'utf8')) as JsonObject;
}

test('keeps native application identity and release versions aligned', () => {
  const packageJson = readJson('package.json');
  const appJson = readJson('app.json');

  assert.equal(packageJson.version, '0.7.0');
  assert.equal(appJson.expo.version, packageJson.version);
  assert.equal(appJson.expo.scheme, 'liftflow');
  assert.equal(appJson.expo.ios.bundleIdentifier, 'com.cheech.liftflow');
  assert.equal(appJson.expo.android.package, 'com.cheech.liftflow');
  assert.equal(appJson.expo.ios.buildNumber, '1');
  assert.equal(appJson.expo.android.versionCode, 1);
});

test('configures the Expo development client and native build scripts', () => {
  const packageJson = readJson('package.json');
  const appJson = readJson('app.json');

  assert.equal(packageJson.dependencies['expo-dev-client'], '~6.0.21');
  assert.match(packageJson.scripts.start, /--dev-client/);
  assert.equal(packageJson.scripts['ios:device'], 'expo run:ios --device');
  assert.equal(packageJson.scripts['android:device'], 'expo run:android --device');
});

test('defines development, preview, and production build profiles', () => {
  const easJson = readJson('eas.json');

  assert.equal(easJson.build.development.developmentClient, true);
  assert.equal(easJson.build.development.distribution, 'internal');
  assert.equal(easJson.build.preview.distribution, 'internal');
  assert.deepEqual(easJson.build.production, {});
  assert.deepEqual(easJson.submit.production, {});
});
