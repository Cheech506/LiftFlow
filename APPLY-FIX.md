# LiftFlow Batch 0003 Web Storage Fix

This patch separates persistence by platform:

- Web uses the browser's built-in `localStorage`.
- iPhone and Android install Expo SQLite's `localStorage` adapter.

Before copying the patch, remove the original universal storage module:

```bash
rm -f ~/LiftFlow/src/storage/liftflowStorage.ts
```

Then copy this patch into the LiftFlow project and restart Expo with a cleared cache.
