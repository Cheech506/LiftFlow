# DEVLOG-0034 — Docker, FastAPI, and PostgreSQL Foundation

## Goal

Create the first real self-hosted LiftFlow server vertical slice without changing the proven v0.7 mobile data model or presenting unfinished server controls in the app.

## Container foundation

- Added a Docker Compose stack with an API service and an internal PostgreSQL service.
- PostgreSQL data lives in a named persistent volume and is not published directly to the host.
- The unauthenticated LF-034 API binds to host loopback by default and is not reachable from the LAN.
- The API waits for PostgreSQL health before starting, applies Alembic migrations, and then starts Uvicorn.
- The API container runs as an unprivileged user with a read-only filesystem, dropped Linux capabilities, and no-new-privileges protection.
- Added a separate container target and Compose profile for deterministic backend tests.

## FastAPI contract

- Added `/api/v1/health/live` for process liveness without a database dependency.
- Added `/api/v1/health` for PostgreSQL-backed readiness and a hidden `/api/v1/health/ready` alias for infrastructure.
- Added `/api/v1/server-info` with a stable server UUID, server/API/client/storage versions, environment, and honest capability flags.
- Authentication, backup import, synchronization, and the web app are explicitly reported as unavailable until their own completed batches.
- FastAPI generates OpenAPI documentation at `/docs`, `/redoc`, and `/openapi.json`.

## Database and migrations

- Added SQLAlchemy 2 asynchronous database infrastructure using asyncpg.
- Added Alembic configuration and the initial `0001_server_foundation` migration.
- The migration creates exactly one durable `server_instances` identity used to distinguish self-hosted servers.
- Database passwords are assembled with SQLAlchemy URL handling so reserved characters are escaped safely.
- Production configuration refuses to boot with the documented development password.

## Configuration and operations

- Added `.env.example` for local configuration while excluding the real `.env` and generated backend files from Git.
- Added a production-shaped multi-stage Python 3.12 Dockerfile with pinned direct dependencies.
- Added `npm run server:test` and `npm run server:verify` workflows.
- Updated the README and start guide with safe startup, health, log, shutdown, and data-volume behavior.

## Quality coverage

- Added backend tests for liveness, readiness, database failure, server identity, capability flags, OpenAPI routes, credential escaping, and production secret validation.
- Added Node regression checks so the normal LiftFlow test suite verifies the server/Compose/migration foundation even before Docker runs.
- Kept mobile package version 0.7.0 and storage version 12 unchanged.

Package validation completed with 20 Node tests, 8 backend tests, TypeScript compilation, Python bytecode compilation, dependency consistency checks, Compose structure validation, and offline rendering of the initial Alembic migration. The Docker startup and persistent-volume checklist remains the final Mac-side acceptance test because the packaging environment does not provide a Docker daemon.

## Next batch

LF-035 adds first-owner bootstrap, password hashing, login, refreshable sessions, and device-aware authentication on top of this working foundation.
