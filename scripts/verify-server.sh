#!/usr/bin/env bash
set -euo pipefail

docker compose config >/dev/null
docker compose up --build --detach --wait --wait-timeout 120

published_address="$(docker compose port api 8000 | tail -n 1)"
published_port="${published_address##*:}"
server_url="http://127.0.0.1:${published_port}"

printf 'Checking LiftFlow liveness at %s\n' "$server_url"
curl --fail --silent --show-error "$server_url/api/v1/health/live"
printf '\nChecking PostgreSQL-backed readiness\n'
curl --fail --silent --show-error "$server_url/api/v1/health"
printf '\nChecking stable server identity\n'
curl --fail --silent --show-error "$server_url/api/v1/server-info"
printf '\nChecking single-owner authentication status\n'
curl --fail --silent --show-error "$server_url/api/v1/auth/status"
printf '\nChecking protected workout-data API contract\n'
curl --fail --silent --show-error "$server_url/openapi.json" | grep -q '"/api/v1/data/snapshot"'
printf '\nChecking the active Alembic revision\n'
docker compose exec -T api alembic current | grep '0003_workout_data (head)'
printf 'Running backend tests in the pinned container\n'
docker compose --profile test run --rm --build api-test
printf 'LF-036 server verification passed.\n'
