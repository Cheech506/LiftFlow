# DEVLOG-0005 — Interaction and Button Hardening

## Goal

Before adding more LiftFlow features, I audited every screen for controls that looked interactive but did nothing. The purpose of this batch is to make the current prototype honest and testable on a real phone: a visible control must perform an action, open useful information, or clearly explain that its full feature is not implemented yet.

## What I changed

- Wired exercise search so results update while typing.
- Made the Muscle, Equipment, and Type filter chips cycle through real filter values.
- Made exercise rows open a detail modal.
- Added the ability to add an exercise from the Exercises tab to an active workout.
- Made workout template rows open a preview modal.
- Protected active workouts from being silently overwritten when another Start button is pressed.
- Wired the History Timeline and Calendar controls.
- Made completed workout cards open detailed set history.
- Made every Settings row respond instead of displaying a dead chevron.
- Replaced the dead Active Workout “Add Exercises” button with a working exercise picker.
- Made the exercise three-dot menu open actions and support removing an exercise.
- Changed workout notes from placeholder text into a saved text field.
- Kept unfinished folder/template/settings features honest by showing a clear notice instead of silently doing nothing.
- Corrected prototype template summary counts so they match the exercises currently included.

## Data behavior

Workout notes and added/removed exercises are stored through the existing local-first persistence layer. They should survive app reloads in the same way as active sets, templates, and completed history.

## Testing checklist

- Home Start Empty, Choose Workout, template Start, and Resume work.
- Starting another workout while one is active resumes the existing workout instead of overwriting it.
- Exercise search and all three filters change the visible list.
- Exercise rows open details.
- Exercises can be added to an active workout from the library.
- Workout template rows open previews and can start from the preview.
- New Folder and New Template show an intentional notice rather than failing silently.
- Timeline and Calendar switch correctly.
- Completed history cards open full set details.
- Every Settings chevron responds.
- Workout notes save after leaving and reopening the workout.
- Add Exercises, exercise menu, Remove Exercise, Add Set, Previous, set completion, Rest Timer, Finish, and Discard all work.

## Next step

No new feature batch should begin until this interaction checklist passes on the iPhone SDK 54 build.
