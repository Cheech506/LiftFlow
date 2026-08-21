# LF-035 Single-Owner Checklist

LF-035 connects LiftFlow to one authenticated Docker owner. It must not move or delete any existing workout data.

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
- [ ] `git status --short` does not list `.env`.

## 2. Upgrade the Docker server

```bash
docker compose up --build -d --wait
npm run server:verify
docker compose ps
```

- [ ] PostgreSQL and API are healthy.
- [ ] Alembic reports `0002_single_owner_auth (head)`.
- [ ] `/api/v1/server-info` reports `authentication: true` and `sync: false`.
- [ ] `/api/v1/auth/status` reports `setupRequired: true` before first setup or `false` afterward.
- [ ] The server UUID matches the LF-034 UUID; the existing PostgreSQL volume was upgraded, not replaced.

## 3. Rebuild the installed development client once

LF-035 adds Expo SecureStore, a native module unavailable in the older installed binary.

```bash
npm run prebuild:clean -- --platform ios
npm run ios
```

- [ ] The native build succeeds without Expo Go.
- [ ] LiftFlow opens to its own server connection screen.
- [ ] The simulator can connect to `http://127.0.0.1:8080`.

After this native rebuild, normal JavaScript development returns to `npm start` and the installed LiftFlow development client.

## 4. Create the only owner

- [ ] Server name, owner display name, username, and a 12+ character password are required.
- [ ] Owner creation opens the five-tab LiftFlow app.
- [ ] Settings shows the server name, URL, owner, and connected state.
- [ ] `/api/v1/auth/status` now reports `setupRequired: false`.
- [ ] Reinstalling/reopening the connection flow cannot create a second owner.
- [ ] A wrong password returns a generic invalid-credentials message.

## 5. Prove session and offline behavior

- [ ] Fully close and reopen LiftFlow; the saved Keychain session reconnects automatically.
- [ ] Stop Docker and reopen LiftFlow; local workouts remain available and Settings reports offline.
- [ ] Restart Docker and use Settings → Check server connection.
- [ ] Sign out; LiftFlow returns to server login and retains all local SQLite data.
- [ ] Sign back in successfully.

## 6. Verify local data was untouched

Record counts before and after owner setup:

- [ ] Custom exercises match.
- [ ] Workout templates match.
- [ ] Completed workouts match.
- [ ] Incomplete workouts match.
- [ ] History and Progress still render.
- [ ] A weighted exercise shows 1–12 rep records where each row is the heaviest weight completed for at least that many reps; empty thresholds show `No record`.
- [ ] No workout records exist in PostgreSQL yet.

## 7. Physical phone option

For trusted-LAN testing only, set this in `.env`:

```text
LIFTFLOW_API_HOST=0.0.0.0
```

Restart Docker and use `http://MAC_LAN_IP:8080` in LiftFlow. Keep port 8080 off the public internet; production HTTPS is a later batch.

Do not run `docker compose down --volumes`. Normal `docker compose down` preserves the server identity, owner, and device sessions.
