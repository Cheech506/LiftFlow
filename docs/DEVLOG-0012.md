# DEVLOG-0012 — Custom Exercise Management and Data Safety

**Date:** 2026-08-04  
**Branch:** `sdk54-mobile`

## Goal

Make custom exercises maintainable without risking templates, active workouts, or completed workout history.

## Completed

- Added editing for custom exercise name, primary muscle, equipment, tracking type, default weight, and default reps.
- Renaming a custom exercise now updates matching exercises in saved templates and the current active workout.
- Completed workout history keeps the name that was recorded at the time of the workout.
- Added archived exercise support.
- Archived exercises are hidden from:
  - the normal Exercises library
  - new template exercise pickers
  - active workout exercise pickers
- Added an Archived Exercises section with restore support.
- Added usage checks across templates, the active workout, and completed workouts.
- Permanent deletion is allowed only when:
  - the exercise is custom
  - the exercise has already been archived
  - it is not referenced by a template
  - it is not present in the active workout
  - it has never been used in completed workout history
- Previous exercise names are retained internally so renaming cannot bypass the history-protection check.
- Added confirmation prompts for archive and permanent delete actions.

## Data safety

- No storage key was changed.
- No storage reset or clear operation was added.
- `archived` and `previousNames` are optional fields, so existing stored exercises remain compatible.
- Existing templates and completed workouts are never deleted when an exercise is archived.
- Exercises used by recorded data cannot be permanently deleted.

## Validation performed

- Reconstructed the project through Batch 0011 before applying these changes.
- Ran TypeScript transpile diagnostics across all source files with no syntax errors.
- Ran a targeted strict TypeScript check using local dependency stubs; only expected React Native stub limitations remained around `Pressable` callback typing.
- Full `npm run typecheck`, Expo Doctor, and physical iPhone testing remain required on the SDK 54 development machine.
