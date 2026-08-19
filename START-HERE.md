# Start Here

LiftFlow now contains two independently testable pieces: the installed Expo development client and the LF-034 self-hosted server foundation.

## Mobile app

```bash
cd LiftFlow
nvm use
npm ci
npm run check
npm start
```

Use the installed LiftFlow development client or an iOS/Android simulator. Expo Go remains useful only for exporting the final migration backup; the installed app owns a separate data sandbox.

## Self-hosted server

Install Docker Desktop or another Docker Compose-compatible runtime, then run:

```bash
cd LiftFlow
cp .env.example .env
docker compose up --build -d --wait
curl http://localhost:8080/api/v1/health
```

The API documentation is at `http://localhost:8080/docs`. LF-034 proves the API, database, migration, and server identity foundation. It intentionally does not expose authentication or workout synchronization yet.

## Before continuing

- Follow `docs/V0.7-DEV-BUILD-CHECKLIST.md` for the installed mobile app.
- Follow `docs/LF034-SERVER-FOUNDATION-CHECKLIST.md` for Docker and API testing.
- Never commit `.env`, Apple signing credentials, generated `ios`/`android` projects, or database contents.
