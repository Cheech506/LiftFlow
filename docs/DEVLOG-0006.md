# DEVLOG-0006 — Custom Exercises and Template Creation

## Goal

I wanted the current LiftFlow build to support the two things I need before serious workout testing: adding my own exercises and building my own reusable workout templates. This batch replaces both remaining placeholder controls with local-first features that save on the device.

## What I changed

- Added a real **Create Exercise** flow in the Exercises tab.
- Added fields for exercise name, primary muscle, equipment, tracking type, default weight, and default reps.
- Added duplicate-name protection so I do not accidentally split history between exercises with the same name.
- Added a dedicated **My Exercises** section for custom exercises.
- Made custom exercises available immediately in:
  - the Exercises library
  - the active-workout Add Exercises picker
  - the new-template exercise picker
- Replaced the New Template placeholder with a working template builder.
- Added template name and folder/split fields.
- Added searchable multi-select exercise selection.
- Added a sets-per-exercise control from 1 through 10.
- Made a typed folder name create that folder automatically when the template is saved.
- Made newly created templates open in the existing preview screen and start like the built-in templates.
- Added persistence for custom exercises and user-created templates.
- Added a storage migration so existing Version 1 local workout data is preserved while the exercise library is added to Version 2.

## Current scope

The custom-exercise form currently supports the two tracking layouts already implemented by the active workout screen:

- Weight & Reps
- Bodyweight

The remaining planned exercise types will be added when their active-workout input rows are implemented, so the app does not allow creating an exercise type it cannot log correctly yet.

## Testing checklist

1. Create a custom Weight & Reps exercise.
2. Confirm it appears under My Exercises.
3. Close and reopen LiftFlow and confirm the exercise remains.
4. Start a workout and add the custom exercise through Add Exercises.
5. Create a custom Bodyweight exercise.
6. Create a new template with a new folder name.
7. Select built-in and custom exercises for the template.
8. Change the sets-per-exercise value.
9. Save the template and confirm its preview counts are correct.
10. Start the new template and confirm all selected exercises and set rows appear.
11. Close and reopen LiftFlow and confirm the template and folder remain.

## Next step

After this batch passes on the iPhone SDK 54 build, the next work should continue the current-app completion pass rather than starting unrelated features.
