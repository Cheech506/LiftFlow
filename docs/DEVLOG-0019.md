# DEVLOG-0019 — Restore and Migration Safety

## Goal
Restore backups without silently replacing data with invalid content.

## Completed
- Added JSON backup file selection.
- Added schema validation and normalization before restore.
- Added a restore summary and deliberate confirmation.
- Preserved the current primary state as the automatic backup snapshot before replacement.
- Added storage migration support through version 4.
- Added fallback recovery from the prior complete local snapshot.
