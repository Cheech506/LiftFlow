# DEVLOG-0026 — Strong CSV Import

## Goal

Import historical workout data exported by Strong without replacing existing LiftFlow data.

## Source format validated

The importer was built against the supplied Strong CSV export. The file contains:

- 9,534 CSV rows
- 378 workouts
- 56 distinct exercise names after trimming whitespace
- 8,160 workout-set rows
- 1,374 Strong rest-timer rows
- Workout dates, names, durations, exercise names, set order, weight, reps, distance, seconds, exercise notes, workout notes, and RPE

Strong set-order values found in the supplied file:

- Numeric values for working sets
- `W` for warm-up sets
- `D` for drop sets
- `F` for failure sets
- `Rest Timer` for timer-only rows

## Implemented

- Added a real **Import Strong CSV** action under Settings.
- Added a preview before any data changes.
- Added a standards-compliant CSV parser supporting commas, quotes, escaped quotes, and multiline notes.
- Added conservative exercise matching using normalized names and compatible equipment.
- Added creation of missing custom exercises.
- Added type inference for weight/reps, bodyweight, assisted bodyweight, reps-only, duration, and distance/duration exercises.
- Added muscle and equipment inference for newly created exercises.
- Added per-exercise default rest-time inference from Strong rest-timer rows.
- Added import of original workout date, duration, name, workout notes, exercise notes, set type, weight, reps, distance, duration, and RPE.
- Added duplicate-workout detection using original start time/name plus a Strong row fingerprint.
- Added Strong import metadata and a visible Strong badge in History.
- Added a full JSON safety-backup share step before import.
- Added one-tap rollback of the most recent Strong import.
- Added protection that retains an imported exercise during rollback if it is now used by a template, an active workout, or non-rolled-back history.
- Added Strong as an Import Source column in LiftFlow CSV exports.
- Upgraded local storage from version 7 to version 8 while preserving older backups.

## Intentional limitations

- Strong CSV exports do not contain Strong workout templates, so no templates are invented during import.
- Strong rest-timer rows are not imported as workout sets. They are used to infer exercise rest defaults.
- Notes are preserved at LiftFlow's exercise-note and workout-note levels. Strong does not provide a separate LiftFlow-compatible note field for every individual set.
- Assisted-bodyweight exercises are identified, but an assistance amount can only be imported when Strong provides one in the Weight column.
- Distance values are preserved exactly as exported because the CSV does not independently identify the user's distance unit.

## Validation completed

The supplied CSV was parsed in a local test harness and produced:

- 378 importable workouts
- 8,160 completed sets
- 1,280 warm-up sets
- 764 drop sets
- 11 failure sets
- 4,499 sets with RPE
- 159 exercise-note groups
- 215 workout notes

A second import of the same file detected all 378 workouts as duplicates and prepared zero new workouts. A rollback test removed the imported workouts and only the exercises created by that import.
