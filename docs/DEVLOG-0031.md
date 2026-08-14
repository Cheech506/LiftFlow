# DEVLOG-0031 — Strong Records, History, and Exercise Charts

## Goal

Carry the user's complete Strong training history into LiftFlow's derived exercise records, PR timelines, workout history, and charts without storing a second copy of analytics data.

## Completed

- Added a reusable per-exercise progress chart to the Progress tab and every exercise detail page.
- Added 4W, 12W, 6M, and ALL controls to exercise pages; ALL displays every recorded Strong and LiftFlow session instead of truncating the trend to 16 points.
- Added expandable all-time PR and workout-history lists for each exercise.
- Kept raw Strong rows in History while excluding zero-rep attempts, zero duration/distance values, and warm-up sets from records and trends.
- Added Settings → Recalculate Progress & PRs to repair missing legacy exercise links, rescan qualifying sets, and rebuild derived analytics with an automatic safety backup.
- Updated the Strong import copy so it is clear that exercise histories and calculated records are imported from workout sets.

## Real-data verification

The supplied backup was processed through the v0.5.1 recalculation path:

- 379 total completed workouts scanned.
- 378 Strong workouts retained.
- 56 exercises with qualifying history.
- 5,902 qualifying working sets.
- 919 historical record events.
- Zero unmatched exercise names and zero exercise-link repairs required.
- Bench Press rebuilt 99 sessions and 533 completed sets. Its valid max-weight record is 245 lb; the Strong `295 lb × 0 reps` row remains in History but is excluded from records.

## Regression coverage

- Strong-derived records and complete charts.
- Zero-rep invalid-record exclusion.
- ALL-range trends with more than 16 sessions.
- Manual missing-link repair and recalculation reporting.
