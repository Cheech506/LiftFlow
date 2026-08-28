# LiftFlow

LiftFlow is a local-first workout tracker for iPhone, Android, and the web. It is built with React Native, Expo Router, and Expo SQLite, and is designed to remain useful without an account or network connection.

## What works in v0.7.0

- Exactly five primary tabs: Home, Exercises, Workouts, History, and Progress.
- A protected full-screen active workout with a persistent Resume bar.
- Seven tracking types: weight and reps, bodyweight and reps, added-weight bodyweight, assisted bodyweight, reps only, duration, and distance plus duration.
- Warm-up, working, drop, failure, and AMRAP sets, plus optional RPE or RIR.
- Supersets in templates and active workouts, including multi-exercise groups.
- Previous-performance values and one-tap copying into the active set.
- Custom exercises, favorites, history-driven recents, archive/restore, and usage-safe deletion.
- Workout folders and templates with create, edit, duplicate, reorder, archive, and move actions.
- Searchable templates, true Unfiled Templates, and archive/restore for complete training-split folders.
- Editable active-workout names and a clean first run with no fake routines or analytics.
- Template-specific workout history with a direct filtered History view.
- Rest timers with pause/resume, per-exercise durations, haptics, and optional lock-screen notifications.
- Searchable workout history, source filters, month navigation, completed-workout editing, repeat, and save-as-template.
- Date-range and exercise filters, filtered CSV export, and complete historical editing of dates, duration, exercises, and sets.
- Recently Deleted recovery for 30 days before automatic cleanup.
- Manual entry for past workouts with type-aware fields and effort values.
- Multiple incomplete workouts that can be saved, resumed later, or deliberately deleted.
- Progress summaries, weekly activity and volume, muscle-group distribution, and complete per-exercise trends.
- All-time exercise pages with metric/date-range charts, verified records, Strong-style 1–12 rep max tables, expandable PR timelines, and complete workout history.
- Strong CSV preview/import with exercise matching, deduplication, safety backup, suspicious-duration handling, calculated PR rebuilding, and full-batch rollback.
- CSV export and complete JSON backup/restore.
- Persistent custom-exercise instructions plus weight, distance, and effort preferences.
- Native v0.5 storage normalized into relational SQLite tables for exercises, folders, templates, sessions, workout exercises, and sets.
- Automatic verified migration from the v0.3 snapshot, permanent sync UUIDs, tombstones, migration audit records, and protected safety backups.
- A project-owned Expo development client for locally installed iPhone and Android builds.
- Permanent native application identifiers, development/preview/production build profiles, and separate native build numbers.
- An in-app migration prompt that distinguishes Expo Go from the installed LiftFlow app and restores the portable JSON backup into the new app sandbox.
- A Docker Compose server foundation with FastAPI, PostgreSQL, Alembic migrations, stable server identity, and versioned health/server-information endpoints.
- An Immich-style server connection screen with exactly one owner account per Docker installation.
- Argon2id password hashing, hashed rotating device tokens, protected owner endpoints, and encrypted native credential storage.
- Owner-scoped PostgreSQL workout tables for preferences, exercise definitions, folders, templates, sessions, workout exercises, and sets.
- Protected snapshot summary/read/replace endpoints with storage-version checks, relationship validation, transaction boundaries, and revision conflicts.

All workout data remains local and usable offline. On iPhone and Android, LiftFlow uses normalized SQLite tables. LF-036 creates the protected PostgreSQL destination and data contract but does not automatically upload or replace local data. The guarded initial migration, continuous synchronization, and Docker-hosted web application remain later isolated batches.

## Install dependencies

Requirements: Node.js 20 or newer. Native iPhone builds require macOS and Xcode; native Android builds require Android Studio and the Android SDK.

```bash
nvm use
npm ci
```

The committed lockfile pins the Expo SDK 54-compatible development client and its native support packages. Run the quality checks before generating native projects.

## LF-036 self-hosted data server

Requirements: Docker Desktop, OrbStack, or another Docker Compose-compatible runtime.

```bash
cp .env.example .env
docker compose up --build -d --wait
curl http://localhost:8080/api/v1/health/live
curl http://localhost:8080/api/v1/health
curl http://localhost:8080/api/v1/server-info
curl http://localhost:8080/api/v1/auth/status
```

Open `http://localhost:8080/docs` for the generated API documentation. The first start creates the PostgreSQL volume, applies Alembic migrations, creates one stable server identity, and waits for the owner to finish setup from LiftFlow. The database enforces exactly one owner account. Existing LF-035 installations upgrade in place to Alembic revision `0003_workout_data` without replacing the server UUID, owner, sessions, or PostgreSQL volume.

The API remains bound to `127.0.0.1` by default. That works with the iOS simulator on the same Mac. For a physical phone on a trusted LAN, set `LIFTFLOW_API_HOST=0.0.0.0`, restart Compose, and connect using the Docker computer's LAN address. HTTP is for trusted development networks only; production exposure waits for LF-040 HTTPS.

LF-035 authentication provides:

- `GET /api/v1/auth/status` — first-owner setup state.
- `POST /api/v1/auth/setup` — one-time owner creation.
- `POST /api/v1/auth/login` — device-aware owner login.
- `POST /api/v1/auth/refresh` — rotating access and refresh tokens.
- `GET /api/v1/auth/me` — authenticated owner identity.
- `POST /api/v1/auth/logout` — revoke the current device session.

LF-036 adds authenticated workout-data contracts:

- `GET /api/v1/data/summary` — initialization state, revision, storage version, projection hash, and entity counts.
- `GET /api/v1/data/snapshot` — complete owner snapshot with stable normalized relationships.
- `PUT /api/v1/data/snapshot` — validated all-or-nothing snapshot replacement with optional revision protection.

The snapshot is stored in relational PostgreSQL tables. Foreign keys connect folders to templates, templates to source workouts, templates/sessions to workout exercises, and workout exercises to sets. Stable app IDs and sync UUIDs are stored separately, while the exact normalized JSON payload is retained for lossless client round trips. The API rejects orphaned sets/exercises, multiple active workouts, unsupported storage versions, duplicate identities, and stale base revisions.

The app does not call snapshot replacement automatically in LF-036. LF-037 will add a preview, safety backup, upload, count comparison, and restore test before PostgreSQL becomes authoritative.

Passwords are stored only as Argon2id hashes. Usable access and refresh tokens are returned once to the app; PostgreSQL stores only SHA-256 token digests. Native credentials use Expo SecureStore, backed by the iOS Keychain or Android Keystore.

Run the backend tests in the same pinned container environment:

```bash
npm run server:test
```

Run the complete startup, migration, endpoint, and backend-test verification:

```bash
npm run server:verify
```

Useful operational commands:

```bash
docker compose ps
docker compose logs -f api
docker compose logs -f postgres
docker compose down
```

`docker compose down` keeps the PostgreSQL volume. Do not add `--volumes` unless the database is intentionally being destroyed. Replace the example password before exposing LiftFlow beyond the development Mac.

## First iPhone development build

Export a current JSON backup from the Expo Go copy before starting. The installed LiftFlow app has a separate iOS data sandbox, so Expo Go data does not appear automatically.

```bash
npm run check
npm run prebuild:clean -- --platform ios
open ios/LiftFlow.xcworkspace
```

In Xcode, select the LiftFlow target, open **Signing & Capabilities**, enable automatic signing, and choose your Apple development team. Connect and trust the iPhone, choose it as the run destination, and press Run. A free Personal Team works for local testing but expires after seven days; a paid Apple Developer team removes that Personal Team limitation and supports EAS/internal distribution.

After LiftFlow installs, enter `http://127.0.0.1:8080` in the simulator, create or sign in to the one server owner, and verify the local exercise, template, workout, History, and Progress totals are unchanged. LF-036 is server/API-only and does not require another native rebuild after LF-035.

LF-035 adds the native `expo-secure-store` module. Rebuild the development client once after applying this batch:

```bash
npm run prebuild:clean -- --platform ios
npm run ios
```

## Daily development after installation

JavaScript and TypeScript changes do not require another native build. Start Metro and open the installed LiftFlow app:

```bash
npm start
```

For a remote phone connection, use:

```bash
npm run start:tunnel -- --port 8082
```

Rebuild with `npm run ios:device` or `npm run android:device` only after installing or changing a native library, modifying native build configuration, or when signing expires.

## EAS build profiles

`eas.json` includes development, preview, and production profiles. After Apple Developer enrollment and EAS project initialization, an internal iPhone development build can be created with:

```bash
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest device:create
npx eas-cli@latest build --platform ios --profile development
```

Credentials must stay in Apple, Xcode, or EAS tooling and must never be committed to the repository.

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

The automated suite additionally covers the single-owner database constraint, password/token hashing, protected routes, server-address normalization, compatibility checks, encrypted native session configuration, relational workout migration, snapshot relationships, exact normalized round trips, revision conflicts, and storage-version enforcement. See [docs/LF036-WORKOUT-DATA-CHECKLIST.md](docs/LF036-WORKOUT-DATA-CHECKLIST.md) for the complete Docker and API acceptance test.

## Project structure

- `src/app` — Expo Router screens.
- `src/context` — local application state and workout actions.
- `src/lib` — tracking, history, analytics, import, export, timers, and previous-performance logic.
- `src/storage` — versioned local persistence and backup validation.
- `server/app` — versioned FastAPI application and database access.
- `server/migrations` — Alembic-managed PostgreSQL schema history.
- `server/tests` — backend endpoint, configuration, and failure-mode tests.
- `compose.yaml` — local self-hosted API and PostgreSQL stack.
- `tests` — regression tests.
- `docs` — chronological development logs and manual release checklists.
