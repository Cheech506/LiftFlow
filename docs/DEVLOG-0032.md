# DEVLOG-0032 — Complete Local Mobile Batches 1 & 2 (v0.6)

## Goal

Close the remaining gaps in the complete local workout and mobile-app systems before replacing Expo Go and beginning the self-hosted backend.

## Workout system completion

- Added search across template names, folder names, and included exercises.
- Added true Unfiled Templates support; folders are now optional when creating, editing, or moving a template.
- Added complete folder archive and restore actions without deleting templates or history.
- Kept archived folders separate from active training splits and made active-folder reordering stable.
- Made active workout names editable while preserving automatic local saves.
- Changed new installs to start without sample templates or fake training splits. Existing SQLite data continues to hydrate unchanged.

## Exercise and settings completion

- Added persistent instructions/notes to custom exercises and preserved them through normalized storage and backup/restore.
- Added weight-unit, distance-unit, and preferred-effort settings.
- Applied the preferred effort when opening a set without a recorded RPE/RIR value.
- Added Settings links to archived templates, archived exercises, and Recently Deleted workouts.

## History and Home completion

- Added All Time, 4 Weeks, 12 Weeks, and 6 Months History filters.
- Added a searchable exercise-specific History filter that combines with text, source, template, and date filters.
- Added CSV export for the exact currently filtered workout result set.
- Expanded completed-workout editing to include workout date, start time, duration, exercise addition/removal/reordering, and set addition/removal.
- Added a clean first-run Home experience with direct template-building and Strong-import paths.
- Added recent completed-workout activity to Home.

## Storage and data safety

- Upgraded the portable state format to version 12.
- Older states receive safe defaults for the new preferences.
- Unfiled templates, archived folders, and exercise instructions survive JSON and normalized SQLite round trips.
- The supplied real backup passed a v12 round trip with 75 exercises, 2 folders, 5 templates, 379 completed workouts, 1,955 workout exercises, and 8,261 sets preserved.

## Automated validation

- TypeScript strict typecheck: passed.
- Automated regression tests: 13 passed.
- Expo Doctor: 18/18 passed.
- Expo Router static export: passed; 14 routes generated.
