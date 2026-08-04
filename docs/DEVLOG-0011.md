# DEVLOG-0011 — Keyboard and Modal Stability

## Goal

Fix the iPhone form bug where the number keyboard covered the lower portion of the Create Exercise screen and made the save controls difficult to reach.

## Work completed

- Added a shared `KeyboardAwareModal` component for form-heavy screens.
- Rebuilt Create Exercise, New Template, and Edit Template around a constrained modal card with one dedicated scroll area.
- Enabled automatic iOS keyboard inset adjustment.
- Enabled drag-to-dismiss keyboard behavior while preserving taps on form controls.
- Added an iOS numeric-keyboard toolbar with a visible **Done** action.
- Connected the numeric keyboard toolbar to exercise defaults, template set values, RPE/RIR values, and active-workout weight/reps fields.
- Added keyboard inset handling to the active workout logger.
- Kept all existing exercise, template, active-workout, and history storage untouched.

## Data safety

This batch does not change:

- the storage key
- the persisted data schema
- custom exercise records
- workout templates
- active workouts
- workout history

Applying the patch should not remove any existing LiftFlow data.

## Verification performed

- Parsed all TypeScript and TSX files in `src/` with the TypeScript compiler API.
- Confirmed there are no TypeScript syntax errors.
- Full Expo typechecking and device behavior still need to be verified in the real SDK 54 project environment.

## Device test focus

1. Open Create Exercise on iPhone.
2. Tap Default Weight and Default Reps.
3. Confirm the form remains scrollable while the keyboard is open.
4. Confirm the green Create Exercise button remains reachable.
5. Confirm the numeric keyboard shows a Done action.
6. Repeat the test inside New Template and Edit Template.
7. Start a workout and confirm weight/reps fields also show Done and remain usable.
8. Confirm existing custom exercises and templates are still present.
