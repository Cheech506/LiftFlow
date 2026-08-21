# Start Here

LiftFlow now contains an installed Expo development client and the authenticated LF-035 self-hosted server. Each Docker installation supports exactly one owner.

## Mobile app

```bash
cd LiftFlow
nvm use
npm ci
npm run check
npm run prebuild:clean -- --platform ios
npm run ios
```

LF-035 adds encrypted native credential storage, so the development client needs one native rebuild. Use the installed LiftFlow app or an iOS/Android simulator; do not switch Metro to Expo Go.

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

Authentication does not migrate workouts. The simulator's local SQLite data stays unchanged and usable offline until the separate guarded migration batch.

## Before continuing

- Follow `docs/V0.7-DEV-BUILD-CHECKLIST.md` for the installed mobile app.
- Follow `docs/LF035-SINGLE-OWNER-CHECKLIST.md` for Docker, owner setup, and simulator testing.
- Never commit `.env`, Apple signing credentials, generated `ios`/`android` projects, or database contents.
