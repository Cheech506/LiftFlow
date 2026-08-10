# LiftFlow

LiftFlow is a local-first workout tracker for iPhone, Android, and the web. It is built with React Native, Expo Router, and Expo SQLite, and is designed to remain useful without an account or network connection.

## What works in v0.5.1

- Exactly five primary tabs: Home, Exercises, Workouts, History, and Progress.
- A protected full-screen active workout with a persistent Resume bar.
- Seven tracking types: weight and reps, bodyweight and reps, added-weight bodyweight, assisted bodyweight, reps only, duration, and distance plus duration.
- Warm-up, working, drop, failure, and AMRAP sets, plus optional RPE or RIR.
- Supersets in templates and active workouts, including multi-exercise groups.
- Previous-performance values and one-tap copying into the active set.
- Custom exercises, favorites, history-driven recents, archive/restore, and usage-safe deletion.
- Workout folders and templates with create, edit, duplicate, reorder, archive, and move actions.
- Template-specific workout history with a direct filtered History view.
- Rest timers with pause/resume, per-exercise durations, haptics, and optional lock-screen notifications.
- Searchable workout history, source filters, month navigation, completed-workout editing, repeat, and save-as-template.
- Recently Deleted recovery for 30 days before automatic cleanup.
- Manual entry for past workouts with type-aware fields and effort values.
- Multiple incomplete workouts that can be saved, resumed later, or deliberately deleted.
- Progress summaries, weekly activity and volume, muscle-group distribution, and complete per-exercise trends.
- All-time exercise pages with metric/date-range charts, verified records, expandable PR timelines, and complete workout history.
- Strong CSV preview/import with exercise matching, deduplication, safety backup, suspicious-duration handling, calculated PR rebuilding, and full-batch rollback.
- CSV export and complete JSON backup/restore.
- Native v0.5 storage normalized into relational SQLite tables for exercises, folders, templates, sessions, workout exercises, and sets.
- Automatic verified migration from the v0.3 snapshot, permanent sync UUIDs, tombstones, migration audit records, and protected safety backups.

All workout data is stored locally and remains usable offline. On iPhone and Android, v0.5 uses normalized SQLite tables. The browser fallback remains local until the shared server-backed web application is built. The planned FastAPI/PostgreSQL server and synchronization layer begin after this release.

## Run the app

Requirements: Node.js 20 or newer and the Expo Go app on a phone.

```bash
npm install
npm start
```

Scan the QR code with Expo Go. The phone and development computer should be on the same network. You can also use `npm run ios`, `npm run android`, or `npm run web`.

## Bring in Strong history

In LiftFlow, open Settings → Import Strong CSV and choose the export from Strong. LiftFlow previews the workout count, matched/new exercises, duplicates, invalid rows, and warnings before changing any data. It opens a full JSON safety backup first and keeps a one-tap rollback action in Settings. Imported working sets automatically rebuild each exercise's records, PR history, workout history, and charts. A **Recalculate Progress & PRs** safety action is also available in Settings.

For a command-line dry-run against an export:

```bash
npm run audit:strong -- /path/to/strong_workouts.csv
```

## Quality checks

```bash
npm run check
npx expo-doctor
npx expo export --platform web
```

The automated suite covers previous-performance matching, legacy migration, normalized projection round trips, incomplete workout recovery, supersets, Recently Deleted retention, Strong import, complete trend history, invalid-PR exclusion, recalculation, duplicate prevention, and rollback. See [docs/V0.5-RELEASE-CHECKLIST.md](docs/V0.5-RELEASE-CHECKLIST.md) for final phone checks.

## Project structure

- `src/app` — Expo Router screens.
- `src/context` — local application state and workout actions.
- `src/lib` — tracking, history, analytics, import, export, timers, and previous-performance logic.
- `src/storage` — versioned local persistence and backup validation.
- `tests` — regression tests.
- `docs` — chronological development logs and manual release checklists.
