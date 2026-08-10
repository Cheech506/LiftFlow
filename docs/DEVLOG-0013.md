# DEVLOG-0013 — Template management and exercise-detail polish

## Goal

Make the existing local LiftFlow build easier to manage before adding more workout-recording features. This batch focuses on two problems found during iPhone testing:

1. Exercise details were displayed in an oversized modal with a misleading green “Start a Workout First” button.
2. Saved workout templates could be edited only after opening their preview and could not be deleted from the Workouts tab.

## What I changed

### Exercise details

- Rebuilt the exercise-detail modal as a bounded card with its own scroll area.
- Reduced the modal height and outer padding so it stays farther away from the iPhone status bar and tab bar.
- Changed the detail fields to a compact wrapping grid instead of one full-width card per field.
- Removed the green “Start a Workout First” pseudo-action.
- Added a neutral “No active workout” explanation when no workout is running.
- Kept “Add to Active Workout” as a real primary action only when an active workout exists.
- Grouped edit/archive/delete controls for custom exercises.
- Preserved the existing safe archive and protected permanent-delete behavior.

### Workout-template management

- Added a visible `•••` management button to every template row in the Workouts tab, including the Recent section.
- Added a template action sheet with Preview, Edit, Delete, and Cancel.
- Kept the existing detailed template editor for renaming, moving folders, changing exercises, reordering exercises, and editing sets.
- Added Delete Template to the template preview as well.
- Added a native/web confirmation before deleting a template.
- Added `deleteTemplate` to the central LiftFlow context so deletion persists through the existing local save process.

## Data-safety behavior

Deleting a template removes only that saved template. It does not delete:

- custom exercises
- archived exercises
- an active workout already started from the template
- completed workout history

This batch does not change the local storage key or storage schema.

## Files changed

- `src/app/(tabs)/exercises.tsx`
- `src/app/(tabs)/workouts.tsx`
- `src/context/ActiveWorkoutContext.tsx`

## Validation performed

- Parsed/transpiled all 22 TypeScript and TSX source files with the TypeScript compiler.
- Confirmed the patch contains no storage-key or schema changes.
- Full Expo SDK 54 typechecking and iPhone interaction testing should be run on the development Mac before committing.
