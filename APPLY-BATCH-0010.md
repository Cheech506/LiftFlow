# Apply Batch 0010 — Warm-Up Sets

This batch assumes Batches 0008 and 0009 are already applied.

## Apply

```bash
cd ~/Downloads
unzip -o LiftFlow-batch-0010-warmup-sets.zip
ditto LiftFlow-batch-0010-warmup-sets ~/LiftFlow

cd ~/LiftFlow
git branch --show-current
npm run typecheck
npx expo-doctor
npx expo start --lan --go --clear
```

The branch should be `sdk54-mobile`. No `npm install` is required.

## Test

1. Confirm previously created custom exercises are still present.
2. Open a template and tap **Edit Template**.
3. Tap a set label to switch it to **W**.
4. Create two warm-up sets and confirm working sets are numbered `1`, `2`, and so on.
5. Save and reopen the template.
6. Start the workout and confirm warm-up labels remain.
7. Tap a set label during the active workout and confirm it switches between **W** and a working-set number.
8. Finish the workout and update the template.
9. Confirm History labels the set as **Warm-up**.

## Commit after testing

```bash
git add .
git status
git commit -m "feat: customize templates and add warm-up sets"
git push origin sdk54-mobile
```

Confirm `docs/DEVLOG-0010.md` is staged before committing.
