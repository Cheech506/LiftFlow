import assert from 'node:assert/strict';
import test from 'node:test';

import { getTabBarLayout, webTabLabelLayout } from '../src/lib/tabBarLayout';

test('gives web tabs enough height to display both icons and labels', () => {
  assert.deepEqual(getTabBarLayout('web', 0), {
    height: 72,
    paddingBottom: 10,
  });
  assert.deepEqual(webTabLabelLayout, {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 4,
    lineHeight: 14,
    textAlign: 'center',
  });
});

test('preserves the compact native tab bar and safe-area inset', () => {
  assert.deepEqual(getTabBarLayout('native', 0), {
    height: 56,
    paddingBottom: 7,
  });
  assert.deepEqual(getTabBarLayout('native', 34), {
    height: 90,
    paddingBottom: 34,
  });
});
