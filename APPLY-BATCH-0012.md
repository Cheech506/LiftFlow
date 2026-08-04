# Apply Batch 0012

This batch adds custom exercise editing, safe archive/restore, and protected permanent deletion.

## Apply

```bash
cd ~/Downloads
unzip -o LiftFlow-batch-0012-exercise-management.zip
ditto LiftFlow-batch-0012-exercise-management ~/LiftFlow

cd ~/LiftFlow
git branch --show-current
npm run typecheck
npx expo-doctor
npx expo start --lan --go --clear
```

The branch must be `sdk54-mobile`. No dependency installation is required.

## Commit after testing

```bash
git add .
git status
git commit -m "feat: add safe custom exercise management"
git push origin sdk54-mobile
```
