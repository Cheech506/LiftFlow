# LiftFlow Batch 0030 — Local Product and Normalized Storage (v0.5)

## Goal

Complete the approved local workout product through v0.4 and move the native app from a single persisted snapshot to a verified normalized SQLite foundation for v0.5.

## Delivered

- Added active-workout supersets with group merging, removal, visible labels, and persistence.
- Added template supersets and preserved groups when starting, repeating, finishing, importing, backing up, and restoring workouts.
- Added Save for Later, multiple incomplete workout records, pause-time-aware resume behavior, and deliberate deletion.
- Added manual past-workout entry with local date/time, duration, notes, dynamic exercise metrics, set types, RPE/RIR, and automatic Progress recalculation.
- Added template-specific history links and a clearable History filter.
- Added an immediate background checkpoint when the app leaves the foreground.
- Added RFC 4122-shaped IDs for newly created entities and deterministic sync UUIDs for legacy records.
- Added normalized native tables for owner data, preferences, exercises, folders, templates, workout sessions, workout exercises, and workout sets.
- Added incremental record-hash writes so editing one set does not rewrite a full Strong history.
- Added version metadata, timestamps, sync versions, deletion tombstones, an outbox foundation, migration audits, and protected safety backups.
- Added a verified v0.3 snapshot migration that preserves the legacy source until row counts and identity hashes match.
- Expanded JSON and CSV exports to include v0.5 state and superset membership.

## Compatibility

- Native iPhone and Android builds use `liftflow-v0.5.db` through Expo SQLite.
- Existing v0.3 local data is detected and migrated automatically on first launch.
- The original v0.3 snapshot and up to five explicit restore safety snapshots are retained as recovery material.
- Web continues using compatible versioned browser-local storage until the server-backed web phase.
- Strong imports remain deduplicated and rollback-compatible.

## Automated coverage

- Legacy defaults and retention migration.
- Incomplete workout and superset normalization.
- Normalized row counts and permanent sync IDs.
- Full normalized projection round trip.
- Previous-performance lookup.
- Strong CSV preview, import, deduplication, and rollback.

## Deferred to v0.6+

- FastAPI service and PostgreSQL schema.
- Owner authentication and server onboarding.
- Phone-to-server offline synchronization.
- Shared server-backed browser application.
- Standalone production phone builds.

