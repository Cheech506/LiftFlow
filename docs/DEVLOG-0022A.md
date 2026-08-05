# DEVLOG-0022A — Folder Restore Hotfix

## Fix

- Passed restored workout folders into `restoreState` during JSON backup restore.
- Resolved the TypeScript error introduced when folders became part of the required LiftFlow state snapshot in Batch 0022.
- No storage keys, migrations, exercises, templates, active workouts, or history data were changed.
