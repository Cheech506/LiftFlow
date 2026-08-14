# Development Batch 0027 — Polished Local Release

## Goal

Turn the reconstructed v0.2 project and its design references into a coherent v0.3 release that is safe to use with real workout history. This batch keeps the locked five-tab information architecture and local-first scope.

## Functional changes

- Replaced hardcoded Home and Workouts recents with history-driven template ordering.
- Added Strong-style previous-performance values to template starts, added exercises, replacements, repeats, and one-tap copy behavior.
- Made exercise recents derive from completed history and built muscle/equipment filters from the complete active library, including imported values.
- Added favorite toggling for every active exercise.
- Added searchable History with LiftFlow/Strong source filters.
- Reworked Calendar into a navigable month view with selectable days and support for multiple workouts per day.
- Changed workout deletion into a 30-day Recently Deleted flow with restore and explicit permanent deletion.
- Added a version-10 storage migration for preferences and Recently Deleted data.
- Added an editable weekly workout goal shared by Home and Progress.
- Removed nonfunctional Settings controls and kept future self-hosted sync as clearly labeled information only.
- Preserved the pre-restore local safety snapshot instead of allowing the next automatic save to overwrite it.

## Visual and platform polish

- Replaced Unicode navigation glyphs with Ionicons.
- Made the tab bar and active-workout Resume bar safe-area aware.
- Added a LiftFlow application icon, Android adaptive foreground, and web favicon.
- Locked the app to the dark theme used throughout the project references.
- Updated the release version to 0.3.0 and added the required Expo notification/font plugins.

## Verification

- TypeScript strict typecheck: passed.
- Automated regression tests: 5 passed.
- Expo Doctor: 18/18 checks passed.
- Expo Router static web export: passed, 14 routes generated.
- Full provided Strong CSV dry-run: 9,534 source rows; 8,160 set rows; 1,374 rest-timer rows; 378 workouts ready; 0 invalid rows; 4 exercise matches and 52 new exercises against the starter library.
- Re-import verification: 0 new workouts and 378 duplicates, as expected.
- Rollback verification: all 378 imported workouts and 52 unused imported exercises removed.

The importer flagged 89 Strong workouts with durations over six hours. LiftFlow retains their dates and sets but marks the durations unknown so training-time analytics stay credible.
