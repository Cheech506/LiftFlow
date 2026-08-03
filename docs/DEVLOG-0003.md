# DEVLOG-0003 — Local Persistence and Workout History

## Summary

This batch replaces LiftFlow's temporary in-memory-only state with persistent local storage. Active workouts, edited templates, and completed workout history now survive browser refreshes and application restarts.

## Changes

- Added `expo-sqlite` for persistent on-device storage.
- Added a versioned LiftFlow storage layer.
- Uses SQLite-backed `localStorage` on iPhone and Android through `expo-sqlite/localStorage/install`.
- Uses the browser's native `localStorage` during web development so browser testing remains simple and stable.
- Restores saved templates, the active workout, and completed workout history when LiftFlow starts.
- Debounces local writes while entering workout values to avoid unnecessary repeated saves.
- Added visible local-save states: loading, saving, saved, and error.
- Finishing a workout now creates a permanent completed-workout snapshot.
- History now displays completed workouts with duration, completed sets, volume, folder, and exercise summaries.
- Home and Progress now calculate real weekly and 12-week totals from completed workouts.
- Settings now shows local storage status and saved item counts.
- Preserved the option to finish with or without updating the source template.

## Storage architecture

The first persistence version stores a versioned application snapshot. This is intentionally isolated behind platform-specific `src/storage/liftflowStorage.web.ts` and `src/storage/liftflowStorage.native.ts` modules so the UI and workout logic do not depend on a specific storage implementation. Normalized SQLite tables and server synchronization can replace or migrate this layer later without rewriting the screens.

## Testing focus

1. Start a template workout and edit values.
2. Refresh the browser while the workout is active.
3. Confirm the active workout and edited values return.
4. Finish and update the template.
5. Refresh again and start the same template.
6. Confirm the updated values remain.
7. Confirm the completed session appears in History and updates Home/Progress totals.
