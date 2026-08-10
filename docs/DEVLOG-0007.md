# DEVLOG-0007 — Create Exercises While Building a Template

## What I changed

I updated the New Template workflow so I do not have to leave the template screen when an exercise is missing from the library.

- Added a **Create New Exercise** control directly inside the New Template screen.
- Added fields for exercise name, primary muscle, equipment, tracking type, default weight, and default reps.
- New exercises are saved to the main LiftFlow exercise library.
- A newly created exercise is automatically selected for the template being built.
- The current template name, folder, set count, search, and selected exercises remain intact while creating the exercise.
- Added duplicate-name protection so an existing exercise is not accidentally recreated.
- Improved the template modal layout so the full exercise list and bottom buttons stay inside a properly scrolling card on a phone.

## Why I changed it

The previous workflow allowed existing exercises to be selected, but creating a missing exercise required leaving the template process. That was too easy to misunderstand and interrupted the main task of building a workout. This keeps exercise creation and template creation in one continuous workflow.

## Current behavior

1. Open Workouts and tap **New Template**.
2. Tap an existing exercise row to select or deselect it.
3. Tap **Create New Exercise** when the movement is not already listed.
4. Save the exercise.
5. LiftFlow adds it to My Exercises and selects it in the current template automatically.
6. Finish selecting exercises and create the template.

## Testing completed locally

- TypeScript syntax/transpile check passed for the updated Workouts screen.
- Duplicate exercise validation remains connected to the shared exercise library.
- No dependency or Expo SDK changes were made.

## Manual mobile tests still required

- Create a custom exercise from inside New Template.
- Confirm it is automatically checked after saving.
- Confirm template draft fields are not reset.
- Create the template and start it.
- Confirm the new exercise appears in the active workout.
- Close and reopen LiftFlow and confirm both the exercise and template persist.
- Confirm the template modal scrolls correctly on iPhone and the Create Template and Cancel buttons remain reachable.
