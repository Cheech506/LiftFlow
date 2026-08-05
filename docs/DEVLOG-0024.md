# DEVLOG 0024 — Exercise History and Personal Records

## Goal

Turn each exercise into a useful performance page without changing LiftFlow's saved-data format.

## Completed

- Added type-aware exercise performance calculations derived from completed workout history.
- Added records for supported metrics:
  - heaviest weight or added weight
  - most reps
  - estimated one-rep max
  - best set volume
  - lightest assistance
  - longest duration
  - farthest distance
  - fastest pace
- Added recent exercise-session history to the exercise details modal.
- Added a recent personal-record timeline.
- Added live PR badges to completed working sets during an active workout.
- Excluded warm-up sets from record calculations while retaining them in workout history.
- Matched renamed custom exercises through their stored definition ID and previous names.
- Kept all calculations derived from existing history, so no storage migration was required.

## Data behavior

- No storage key or storage version change.
- No completed workout is modified.
- Editing or deleting workout history automatically recalculates exercise records the next time the UI renders.
- Restoring a backup automatically rebuilds the same records from the restored history.

## Validation

- Strict TypeScript compatibility check passed for the full source tree.
- Targeted record calculations were reviewed for every supported exercise tracking type.
- Final validation remains the project `npm run typecheck`, Expo Doctor, and iPhone workflow test.
