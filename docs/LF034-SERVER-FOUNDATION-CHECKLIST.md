# LF-034 Server Foundation Checklist

LF-034 proves the private server foundation only. It must not import the real LiftFlow backup or expose the API outside the development computer.

## 1. Validate the existing mobile app

```bash
nvm use
npm ci
npm run check
npx expo-doctor
```

- [ ] Mobile TypeScript passes.
- [ ] All mobile and server-foundation configuration tests pass.
- [ ] Expo Doctor passes.

## 2. Prepare local server configuration

```bash
cp .env.example .env
```

- [ ] Docker Desktop, OrbStack, or an equivalent Docker Compose runtime is running.
- [ ] `.env` exists locally and `git status --short` does not list it.
- [ ] `LIFTFLOW_POSTGRES_PASSWORD` is changed before any non-local exposure.

## 3. Start and inspect the stack

```bash
docker compose up --build -d --wait
docker compose ps
docker compose logs api
docker compose logs postgres
```

- [ ] PostgreSQL becomes healthy.
- [ ] The API migration reaches `0001_server_foundation`.
- [ ] The API becomes healthy.
- [ ] PostgreSQL has no published host port.
- [ ] The API is available only on host loopback port 8080 unless `.env` changes it.

## 4. Verify the API contract

```bash
curl http://localhost:8080/api/v1/health/live
curl http://localhost:8080/api/v1/health
curl http://localhost:8080/api/v1/server-info
open http://localhost:8080/docs
```

- [ ] Liveness reports `database: not_checked`.
- [ ] Readiness reports `database: connected`.
- [ ] Server info returns a UUID, server version 0.1.0, API version v1, minimum client 0.7.0, and storage version 12.
- [ ] Capability flags for authentication, backup import, sync, and web remain false.
- [ ] Repeating server info after restart returns the same server UUID.

## 5. Run backend verification

```bash
npm run server:test
npm run server:verify
```

- [ ] All backend tests pass inside the pinned container.
- [ ] The full verification script passes.

## 6. Persistence and safe shutdown

```bash
docker compose down
docker compose up -d --wait
curl http://localhost:8080/api/v1/server-info
```

- [ ] PostgreSQL data survives normal `docker compose down` and restart.
- [ ] The stable server UUID remains unchanged.
- [ ] No real workout backup has been imported.
- [ ] `.env`, PostgreSQL data, and credentials are not staged in Git.

Do not run `docker compose down --volumes` unless the LF-034 test database is intentionally being destroyed. After this checklist passes, LF-034 is ready for its devlog commit and LF-035 authentication work.
