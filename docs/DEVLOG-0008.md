# DEVLOG-0008 — Strong-Style Template Set Customization

## Goal

Make workout templates useful as actual training plans instead of only storing an exercise list and one shared set count.

## Work completed

- Added an **Edit Template** workflow from template preview.
- New templates now open directly in the detailed editor after creation.
- Added per-exercise template cards with each planned set shown separately.
- Added editable target weight and reps for every set.
- Added optional effort targets for every set:
  - RPE
  - RIR
  - None
- Added per-exercise **Add Set** controls.
- Added individual set removal while preventing the final set from being removed accidentally.
- Added exercise removal from an existing template.
- Added exercises from the saved exercise library to an existing template.
- Updated template previews to show weight, reps, and RPE/RIR for every planned set.
- Carried RPE and RIR targets into the active workout and displayed them beneath the related set.
- Added template update support in `ActiveWorkoutContext`.

## Data-safety work

- Increased the local-state schema to version 3 without changing the existing storage key.
- Kept the stored exercise array intact during migration so custom exercises are not replaced.
- Accepted versions 1, 2, and 3 when loading existing data.
- Added a one-generation local backup snapshot before each state write.
- Added fallback recovery from the backup snapshot if the primary state cannot be parsed.

## Important behavior

Existing custom exercises, templates, active workouts, and completed history are migrated in place. This batch does not clear local storage and does not require reinstalling Expo Go.

## Validation

- TypeScript syntax checked for every changed file.
- Changed files passed a strict local semantic type check using SDK-compatible interface stubs.
- Final `npm run typecheck`, Expo Doctor, and iPhone testing must still be run in the real project environment.
