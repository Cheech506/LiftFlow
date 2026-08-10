# LiftFlow v0.1 Stable Local — Test Checklist

## Existing data first
- Confirm every previously created custom exercise still exists.
- Confirm every existing template still exists and retains order, weights, reps, RPE/RIR, and warm-up sets.
- Confirm old completed workouts still open.

## Exercises and templates
- Create, edit, archive, restore, and safely delete an unused custom exercise.
- Create a template and add saved exercises.
- Edit each set's weight, reps, RPE/RIR, and warm-up state.
- Reorder exercises and save.
- Delete only a disposable template.

## Active workout
- Start a template and confirm planned values.
- Add, remove, replace, and reorder exercises.
- Add, delete, and reorder sets.
- Test Working, Warm-up, Drop, Failure, and AMRAP set types.
- Record RPE and RIR.
- Add workout and exercise notes.
- Complete and uncomplete sets.
- Close Expo Go, reopen, and resume with all data intact.
- Confirm elapsed time and a running rest timer resume.
- Finish without updating the template.
- Repeat and finish once with template update enabled.

## History
- Open full workout details.
- Edit a deliberate weight/reps mistake and save.
- Edit RPE/RIR and set type.
- Repeat a completed workout.
- Save a completed workout as a template.
- Cancel deletion once, then delete only a disposable workout.

## Export and restore
- Export CSV and open it in Excel or Numbers.
- Confirm one row exists for each recorded set.
- Export a full JSON backup and save it somewhere outside Expo Go.
- Create a disposable exercise/template/workout after the backup.
- Restore the JSON backup.
- Confirm the disposable post-backup data disappears and backed-up data returns.
- Try selecting an unrelated or damaged JSON file and confirm LiftFlow rejects it.

## Final checks
- Force-close and reopen Expo Go three times.
- Confirm no modal or keyboard hides required buttons.
- Confirm no visible control silently does nothing.
- Run `npm run typecheck`.
- Run `npx expo-doctor` and require 18/18 checks.
