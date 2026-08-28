# Start Here

LiftFlow now contains an installed Expo development client and the LF-036 self-hosted data server. Each Docker installation supports exactly one owner and one owner-scoped workout dataset.

## Mobile app

```bash
cd LiftFlow
nvm use
npm ci
npm run check
npm run prebuild:clean -- --platform ios
npm run ios
```

LF-036 changes only TypeScript server contracts and the Docker backend. If the LF-035 development client is already installed, do not prebuild or reinstall it. Use the installed LiftFlow app or an iOS/Android simulator; do not switch Metro to Expo Go.

## Self-hosted server

Install Docker Desktop or another Docker Compose-compatible runtime, then run:

```bash
cd LiftFlow
cp .env.example .env
docker compose up --build -d --wait
curl http://localhost:8080/api/v1/health
curl http://localhost:8080/api/v1/auth/status
```

The API documentation is at `http://localhost:8080/docs`. In the simulator, enter `http://127.0.0.1:8080`, then create the server's one owner account or sign in if setup is already complete.

Alembic revision `0003_workout_data` creates relational PostgreSQL tables plus protected snapshot endpoints. It does not migrate workouts by itself. The simulator's local SQLite data stays unchanged and usable offline until LF-037 performs the guarded initial migration.

## Before continuing

- Follow `docs/V0.7-DEV-BUILD-CHECKLIST.md` for the installed mobile app.
- Follow `docs/LF035-SINGLE-OWNER-CHECKLIST.md` for Docker, owner setup, and simulator testing.
- Follow `docs/LF036-WORKOUT-DATA-CHECKLIST.md` for the relational migration and protected API checks.
- Never commit `.env`, Apple signing credentials, generated `ios`/`android` projects, or database contents.
