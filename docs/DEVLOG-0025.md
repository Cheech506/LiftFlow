# DEVLOG-0025 — Progress Dashboard

## Goal

Replace the placeholder Progress tab with useful local analytics calculated from completed LiftFlow workouts.

## Implemented

- Added 4-week, 12-week, 6-month, and all-time date ranges.
- Added range-aware totals for workouts, working sets, training time, weight-based volume, personal records, and average sets per workout.
- Added a weekly workout-frequency chart and current-week goal status.
- Added a weekly training-volume chart.
- Added a primary-muscle breakdown based on completed non-warm-up sets.
- Added an exercise selector that only lists exercises with recorded working sets.
- Added exercise-type-aware trend metrics:
  - Weight & Reps / Bodyweight + Added Weight: e1RM, weight, reps, and session volume.
  - Assisted Bodyweight: assistance and reps.
  - Bodyweight & Reps / Reps Only: reps.
  - Duration: duration.
  - Distance & Duration: distance, pace, and duration.
- Added latest, best, and range-change summaries for exercise trends.
- Added a recent personal-record feed across all exercises.
- Exported the full per-exercise PR timeline so the Progress tab can calculate range-aware record totals without storing duplicate analytics data.

## Data behavior

- All analytics are derived from completed workout history.
- Warm-up sets remain in History but are excluded from working-set, volume, muscle-group, trend, and PR calculations.
- Editing or deleting a completed workout automatically changes the Progress tab because no analytics are separately persisted.
- No storage migration or new dependency is required.

## Validation

- Full project compatibility typecheck passed with the local strict validation configuration.
- Targeted analytics tests covered workout totals, warm-up exclusion, training volume, muscle grouping, weekly buckets, e1RM trends, metric options, and PR aggregation.
