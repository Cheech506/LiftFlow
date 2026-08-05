# DEVLOG-0021 — Complete Exercise Tracking Types

## Goal
Expand LiftFlow beyond weight-and-reps logging while preserving every exercise, template, active workout, and completed workout already stored by Stable Local v0.1.

## Completed
- Added seven supported exercise tracking types:
  - Weight & Reps
  - Bodyweight & Reps
  - Bodyweight + Added Weight
  - Assisted Bodyweight
  - Reps Only
  - Duration
  - Distance & Duration
- Added tracking-type-specific defaults when creating or editing custom exercises.
- Added dynamic template fields so each exercise shows only the values it records.
- Added dynamic active-workout inputs and previous-set copying for weight, reps, duration, and distance.
- Added tracking-type-aware template previews and completed-workout details.
- Added completed-workout editing for every supported metric.
- Expanded CSV exports with exercise type, duration, and distance columns.
- Limited workout-volume calculations to meaningful external-load exercise types.
- Added storage version 5 normalization and migration.

## Data migration
- The existing LiftFlow storage key is unchanged.
- Stable Local v0.1 data is migrated in place rather than reset.
- The former `Bodyweight` type automatically becomes `Bodyweight & Reps`.
- Old template and workout exercises infer their tracking type from their saved exercise definition or name.
- Metrics that do not belong to the inferred tracking type are removed during normalization without deleting the set itself.
- Existing custom exercise IDs, names, templates, active workouts, completed workouts, notes, RPE/RIR values, and set types are retained.

## Verification performed
- Syntax-transpiled all TypeScript and TSX source files successfully.
- Tested all seven tracking-type field layouts.
- Tested migration of a version 4 custom bodyweight exercise together with its template and workout history into version 5.
- Confirmed irrelevant legacy weight values are removed from bodyweight-reps sets while reps remain intact.

## Final verification required
Run the project’s full TypeScript check and Expo Doctor on the development Mac, then complete the iPhone checklist before committing or updating the WeekFlow PC.
