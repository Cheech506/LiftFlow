# Apply LiftFlow Batches 0014–0020

This is one cumulative Stable Local release-candidate patch. It assumes Batch 0013 is already applied.

## Apply

```bash
cd ~/Downloads
unzip -o LiftFlow-batch-0014-0020-stable-local.zip
ditto LiftFlow-batch-0014-0020-stable-local ~/LiftFlow
cd ~/LiftFlow
```

## Install the three SDK 54 modules added for file export and restore

```bash
npx expo install expo-document-picker expo-file-system expo-sharing
```

Do not run `npm audit fix` or `npm audit fix --force`.

## Verify and launch

```bash
npm run typecheck
npx expo-doctor
npx expo start --lan --go --clear
```

Complete `docs/STABLE-V0.1-CHECKLIST.md` before committing.

## Commit after the full checklist passes

```bash
git add .
git status
git commit -m "feat: complete LiftFlow stable local v0.1"
git push origin sdk54-mobile
```
