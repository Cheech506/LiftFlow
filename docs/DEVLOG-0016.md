# DEVLOG-0016 — Workout Recovery

## Goal
Make an in-progress workout safe to resume after closing or reloading LiftFlow.

## Completed
- Continued persisting the entire active workout after every change.
- Persisted exercise notes, set types, effort values, and set order.
- Persisted the rest-timer end timestamp so it resumes accurately.
- Prevented a new workout from overwriting an existing active workout.
- Preserved workout start time so elapsed duration resumes correctly.
