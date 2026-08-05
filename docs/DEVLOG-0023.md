# DEVLOG-0023 — Rest Timer Completion

## Goal

Finish LiftFlow's rest-timer workflow so it can be configured globally, customized per exercise, controlled during a workout, recovered after app restarts, and announced while the phone is locked.

## Delivered

- Added persistent rest-timer settings:
  - Global default duration
  - Automatic start after completing a set
  - Lock-screen local notifications with sound
  - Haptic completion feedback
- Added per-exercise rest defaults to custom exercises.
- Added per-exercise rest controls to the template editor.
- Added per-exercise rest controls to active workout exercise actions.
- Added a complete rest-timer control modal:
  - Start
  - Add or subtract 15 seconds
  - Pause and resume
  - Restart
  - Skip
- Preserved the original timer duration when pausing, resuming, or adjusting the remaining time.
- Moved timer completion handling into the shared workout provider so the timer continues while navigating between tabs.
- Persisted active timer state for app close/reopen recovery.
- Added notification scheduling and cancellation protection to prevent stale alerts after timer changes, workout finish, discard, restore, or notification disablement.
- Added storage migration from version 6 to version 7.
- Added rest-timer settings and timer state to JSON backup/restore while excluding device-specific notification identifiers from exported snapshots.

## Data safety

- Existing exercises, folders, templates, active workouts, and completed history are migrated in place.
- Older exercises and workout entries receive a safe 120-second rest fallback.
- Older backups without rest-timer settings receive stable defaults.
- Rest durations are clamped to supported values during migration.
- Pending local alerts are cancelled when a workout is finished, discarded, or replaced by a restored backup.

## Dependencies

- `expo-notifications`
- `expo-haptics`

Install them with Expo's SDK-aware installer before running the project checks.

## Validation performed

- TypeScript source validation passed against the reconstructed project with compatibility declarations for native Expo modules.
- All modified TypeScript and TSX files passed syntax transpilation.
- The real SDK 54 `npm run typecheck`, Expo Doctor, and iPhone tests remain the release authority.
