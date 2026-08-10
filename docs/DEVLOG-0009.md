# DEVLOG-0009 — Template Exercise Reordering

## Goal

Allow workout-template exercises to be arranged in the exact order they should appear during a workout.

## Work completed

- Added **Move Up** and **Move Down** controls to every exercise card in the template editor.
- Disabled the upward control for the first exercise and the downward control for the last exercise.
- Preserved each exercise's sets, weight, reps, RPE, and RIR while changing its position.
- Saved the reordered exercise array through the existing template update flow.
- Confirmed template preview and newly started workouts naturally use the saved exercise order.
- Added accessibility labels and disabled-state metadata for the reorder controls.

## Data safety

- No storage key or schema change was required.
- Existing custom exercises, templates, active workouts, and workout history are not cleared or replaced.
- Reordering changes only the selected template's exercise-array order after **Save Template** is tapped.

## Validation

- Verified the patch does not introduce new dependencies.
- Final `npm run typecheck`, Expo Doctor, and iPhone testing must be completed in the real SDK 54 project.
