# LF-036 PostgreSQL Workout Data Checklist

LF-036 creates the protected server-side destination for LiftFlow data. It must not automatically upload or replace the current local workout database.

## 1. Install and verify source

```bash
cd ~/LiftFlow
nvm use
npm ci
npm run check
npx expo-doctor
```

- [ ] TypeScript passes.
- [ ] All Node tests pass.
- [ ] Expo Doctor passes.
- [ ] `.env` remains ignored.

## 2. Upgrade Docker without deleting the volume

```bash
docker compose up --build -d --wait
npm run server:verify
docker compose ps
```

- [ ] PostgreSQL and API are healthy.
- [ ] Alembic reports `0003_workout_data (head)`.
- [ ] Backend tests pass in the pinned container.
- [ ] `/api/v1/server-info` reports server version `0.3.0`, `authentication: true`, `backupImport: true`, and `sync: false`.
- [ ] The server UUID and existing owner are unchanged from LF-035.

Do not run `docker compose down --volumes`. The normal command `docker compose down` preserves PostgreSQL.

## 3. Inspect the API contract

Open `http://127.0.0.1:8080/docs` and confirm:

- [ ] `GET /api/v1/data/summary` exists.
- [ ] `GET /api/v1/data/snapshot` exists.
- [ ] `PUT /api/v1/data/snapshot` exists.
- [ ] All three routes require bearer authentication.
- [ ] Calling a protected data route without a token returns HTTP 401.

## 4. Confirm relational storage

The migration must create:

- [ ] `owner_data_states`
- [ ] `owner_preferences`
- [ ] `exercise_definitions`
- [ ] `workout_folders`
- [ ] `workout_templates`
- [ ] `workout_sessions`
- [ ] `workout_exercises`
- [ ] `workout_sets`

Foreign keys must preserve folder/template/session/exercise/set relationships. Each workout exercise must belong to exactly one template or session.

## 5. Confirm local safety boundary

- [ ] Open the installed iOS development client normally with `npm start`.
- [ ] Existing exercises, templates, completed workouts, PRs, and Progress totals are unchanged.
- [ ] No migration prompt appears in LF-036.
- [ ] PostgreSQL data summary remains uninitialized until LF-037 deliberately uploads the first snapshot.
- [ ] No native rebuild is required after LF-035.

## 6. Verify version and conflict guards

Automated backend coverage must confirm:

- [ ] Unsupported mobile storage versions are rejected.
- [ ] Duplicate sync identities are rejected.
- [ ] Orphaned workout exercises and sets are rejected.
- [ ] More than one active workout is rejected.
- [ ] A stale `baseRevision` returns a conflict instead of overwriting newer server data.
- [ ] Snapshot replacement is transactional.

LF-037 is the first batch authorized to move the user's existing local snapshot into these tables.
