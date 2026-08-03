# DEVLOG-0002 — Editable Sets and Reliable Workout Actions

## Summary

This batch fixes the first active-workout issues found during browser testing and makes template workouts behave more like Strong.

## Changes

- Replaced platform-dependent `Alert.alert` workout confirmations with LiftFlow-owned modal dialogs so Finish and Discard work consistently on web, iPhone, and Android.
- Added editable weight and repetition inputs to every active workout set.
- Added tap-to-copy behavior for previous set values.
- Added an explicit finish choice:
  - Finish without updating the source template.
  - Finish and save the current exercise/set values back to the source template.
- Moved demo templates into shared app state so template updates are reflected the next time the workout starts.
- Preserved one active workout at a time and the persistent Resume bar.
- Replaced deprecated web shadow properties on the active-workout bar with `boxShadow` while keeping native iOS and Android shadows.

## Current limitation

Template and workout changes are still stored in app memory only. SQLite persistence is the next major batch, so reloading the app currently resets demo data.
