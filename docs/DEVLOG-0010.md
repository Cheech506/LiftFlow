# DEVLOG-0010 — Warm-Up Set Support

## Goal

Add Strong-style warm-up sets to template planning and active workout logging without risking any existing custom exercises or saved workout data.

## Work completed

- Added a set type to workout sets with two current values:
  - Working set
  - Warm-up set
- Made the **SET** label tappable inside the template editor.
- Warm-up sets display as **W**, while working sets are numbered independently.
  - Example: `W`, `W`, `1`, `2`, `3`
- Preserved each warm-up set's planned weight, reps, RPE, and RIR.
- Updated template preview to label warm-up sets clearly.
- Carried warm-up set types from templates into active workouts.
- Made the active-workout set label tappable so a set can be switched between working and warm-up during the session.
- Preserved set types when using **Finish & Update Template**.
- Preserved warm-up labels in completed workout History.
- Kept warm-up sets in workout completion counts and workout history.
- Excluded warm-up sets from entered workout-volume calculations so they do not inflate working-set analytics.
- Made newly added sets default to normal working sets to prevent accidental warm-up tagging.

## Data safety

- The existing LiftFlow storage key is unchanged.
- No destructive storage migration is required.
- The new `setType` field is optional for older saved data; any set without it is treated as a normal working set.
- Existing custom exercises, templates, active workouts, and completed workout history are not cleared or replaced.

## Validation

- All changed files passed the strict local TypeScript validation configuration.
- No dependencies were added or changed.
- Final `npm run typecheck`, Expo Doctor, persistence testing, and iPhone testing must be completed in the real SDK 54 project before committing.
