# DEVLOG-0036 — PostgreSQL Workout Data Contract

## Goal

Create the durable, owner-scoped PostgreSQL destination for every LiftFlow workout entity without moving the user's current simulator data or enabling background synchronization early.

## Relational storage

- Added Alembic revision `0003_workout_data` on top of the existing server identity and single-owner authentication schema.
- Added one owner data-state row containing the current revision, mobile storage version, projection hash, row count, and update timestamp.
- Added relational tables for owner preferences, exercise definitions, workout folders, templates, sessions, workout exercises, and sets.
- Added foreign keys from templates to folders, sessions to source templates, exercises to either a template or session, exercises to stable definitions, and sets to workout exercises.
- Added a database check guaranteeing each workout exercise belongs to exactly one template or workout session.
- Added queryable workout status, timestamps, Strong import metadata, deletion timestamps, exercise types, superset keys, set metrics, completion flags, archive flags, and ordering.
- Scoped every row to the authenticated owner and preserved both stable client sync UUIDs and client app IDs.
- Stored the exact normalized JSON text for lossless client round trips while also storing JSONB and relational columns for server-side queries and future migrations.

## Protected API

- Added `GET /api/v1/data/summary` for revision and entity counts.
- Added `GET /api/v1/data/snapshot` for complete normalized reads.
- Added `PUT /api/v1/data/snapshot` for an all-or-nothing owner snapshot replacement.
- Required the existing bearer-token authentication dependency on every data endpoint.
- Added mobile storage-version enforcement and optional base-revision conflict detection.
- Added request limits, JSON-object validation, duplicate identity detection, session-state validation, one-active-workout enforcement, and parent checks for workout exercises and sets.
- Kept continuous sync capability disabled. Snapshot transport is available for the guarded LF-037 migration, not invoked automatically by LF-036.

## Client contract

- Added typed client functions for server data summary, snapshot read, and snapshot replacement.
- Reused the existing normalized SQLite projection shape instead of creating a second migration format.
- Kept the current local SQLite state authoritative and fully usable offline.
- No native dependency changed, so the installed LF-035 development client does not need to be rebuilt.

## Quality coverage

- Added route tests for authentication, summary, snapshot round trips, and replacement.
- Added relationship validation coverage for orphaned data.
- Added source-level contract tests for all relational tables, protected routes, transaction use, storage-version enforcement, and revision conflicts.
- Updated OpenAPI expectations to server version `0.3.0` and added the protected data routes.
- Updated Docker verification to require Alembic head `0003_workout_data`.

## Safety boundary

LF-036 does not upload, merge, delete, or reconcile the simulator's current workouts. LF-037 will create a fresh local safety backup, preview counts, perform the initial upload, download the stored snapshot, verify identity/counts, and only then mark the server copy as initialized.

## Next batch

LF-037 implements the guarded initial migration from local SQLite to PostgreSQL. LF-038 will then add normal ongoing synchronization and conflict behavior.
