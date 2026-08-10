# DEVLOG-0026A — Strong Import Analytics Sanity Hotfix

## Problem

The first real Strong import exposed several analytics issues:

- Strong reported implausible workout durations, including 49h 2m and 18h 45m.
- Imported `completedAt` values were calculated by adding those durations to the workout date, which shifted an August 1 workout into the week beginning August 3.
- Training-time totals included those implausible durations.
- Epley estimated 1RM was calculated for extremely high-rep sets, producing meaningless values such as a 1,620 lb e1RM from a 150-rep set.
- The Home screen's weekday dots and recent-PR panel were still placeholders.

## Changes

- Added storage version 9 migration.
- Imported Strong workouts over 6 hours are preserved but marked with unknown duration.
- Existing imported workouts over 6 hours are repaired automatically during migration.
- Unknown durations contribute 0 seconds to training-time totals and display as `Unknown` in History.
- Calendar, weekly, range, trend, and PR dates now use workout start time.
- Current-week filtering now has both a start and end boundary.
- Epley e1RM is limited to sets of 1–12 reps.
- High-rep sets still count for rep and volume records; they simply do not create misleading e1RM records.
- Home weekday dots now reflect completed workout days.
- Home recent personal records now uses the same PR engine as Progress.

## Data safety

No exercises, templates, folders, sets, workout history, or Strong import metadata are removed. The migration only repairs implausible imported durations and recalculates derived analytics.
