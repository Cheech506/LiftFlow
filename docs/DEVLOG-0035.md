# DEVLOG-0035 — Single-Owner Server Connection

## Goal

Add the Immich-style connection and authentication vertical slice without moving or rewriting any workout data. Every Docker installation has exactly one owner, while each authorized phone, simulator, or browser receives its own revocable session.

## Server ownership

- Added the `0002_single_owner_auth` Alembic migration.
- Added an `owner_accounts` table with a database-enforced singleton key, making a second owner impossible even under concurrent setup requests.
- Added device-aware sessions with independent access and refresh expirations.
- Added one-time setup, login, rotating refresh, authenticated owner identity, logout, and public setup-status endpoints.
- Changed the authentication capability flag to true while leaving backup import, synchronization, and the web app honestly disabled.

## Credential security

- Owner passwords use Argon2id through `argon2-cffi` and are never stored or logged in plaintext.
- Access and refresh tokens use cryptographically secure random values with distinct LiftFlow prefixes.
- PostgreSQL stores only SHA-256 token digests, so a database read cannot recover a usable device token.
- Refresh rotates both tokens and immediately invalidates the prior pair.
- Logout revokes only the current device session.
- Invalid usernames and invalid passwords return the same response.

## Installed app connection

- Added a dedicated first-launch server connection screen.
- Server addresses accept host/IP plus port, normalize the URL, reject embedded credentials, and verify server ID, API version, minimum client version, and authentication capability.
- A server without an owner opens one-time owner setup; an initialized server opens login.
- Native session credentials use Expo SecureStore and therefore the iOS Keychain or Android Keystore.
- Web development uses isolated browser storage until the Docker-hosted web app is implemented.
- Web tabs reserve enough height and pin their labels inside each tab item, without changing the native safe-area layout.
- A saved authenticated device can still enter the local app while the server is offline.
- Settings shows server identity, connection state, owner, connection recheck, and device sign-out.

## Data safety

- LF-035 does not upload, import, delete, reconcile, or synchronize exercises, templates, workouts, sets, preferences, or history.
- Existing simulator SQLite data remains the authoritative copy until the guarded migration batch.
- Signing out removes only server credentials and preserves local workout data.

## Exercise rep records

- Added Strong-style 1–12 rep max records to Weight & Reps and Bodyweight + Added Weight exercise details.
- Each row shows the highest actual working-set weight completed for at least that many reps, plus its achievement date and workout name.
- A higher-rep set fills or improves every lower supported rep row: for example, 205 lb × 5 establishes 205 lb for rows 1–5 unless a heavier qualifying set already owns one of those rows.
- Missing rep counts remain visible as `No record`; warm-ups, failed zero-rep attempts, and non-integer reps cannot become rep max records. Sets above 12 reps may support rows 1–12, while the table remains capped at 12.
- Rep maxes are derived from complete workout history and therefore update automatically after imports, workout edits, deletions, restores, and progress recalculation without creating another stored record table.

## Quality coverage

- Added tests for the single-owner constraint, Argon2id hashes, one-way token digests, authentication routes, password validation, protected endpoints, URL normalization, client compatibility, encrypted native storage configuration, protected navigation, cross-platform tab-bar sizing, and monotonic 1–12 rep max rebuilding.
- Updated server verification to confirm the authentication status endpoint and `0002_single_owner_auth` migration head.
- Confirmed TypeScript compilation, Node regression tests, backend pytest coverage, Python bytecode compilation, offline Alembic SQL generation, and Expo web export.

## Next batch

LF-036 adds the PostgreSQL workout schema and protected server-side data contract. LF-037 will then perform a previewed, transactional initial migration while preserving the complete local backup.
