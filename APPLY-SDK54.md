# Apply LiftFlow Batch 0004 — Expo SDK 54

This conversion should be performed on a separate Git branch so the working SDK 57 state remains available as a checkpoint.

## 1. Create the mobile-test branch

```bash
cd ~/LiftFlow
git status
git switch -c sdk54-mobile
```

Only continue if `git status` reports a clean working tree before creating the branch.

## 2. Apply the batch

```bash
cd ~/Downloads
unzip -o LiftFlow-batch-0004-sdk54.zip
ditto LiftFlow-batch-0004-sdk54 ~/LiftFlow
```

## 3. Rebuild dependencies cleanly

```bash
cd ~/LiftFlow
rm -rf node_modules package-lock.json .expo
npm install
npx expo install --fix
```

Do not run `npm audit fix` or `npm audit fix --force`.

## 4. Validate the conversion

```bash
node -p "require('./package.json').dependencies.expo"
npx expo-doctor
npm run typecheck
```

The first command should print:

```text
~54.0.34
```

## 5. Start LiftFlow

```bash
npx expo start --clear
```

Scan the QR code with Expo Go on the iPhone or Android device. If LAN mode cannot connect:

```bash
npx expo start --tunnel --clear
```

## 6. Commit after mobile testing passes

```bash
cd ~/LiftFlow
git add .
git status
git commit -m "chore: convert LiftFlow to Expo SDK 54"
git push -u origin sdk54-mobile
```

Confirm `docs/DEVLOG-0004.md` is staged before committing.
