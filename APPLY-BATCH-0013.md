# Apply Batch 0013

This patch was built from the uploaded current LiftFlow source snapshot after Batch 0012.

## Apply

```bash
cd ~/Downloads
unzip -o LiftFlow-batch-0013-template-management-ui-polish.zip
ditto LiftFlow-batch-0013-template-management-ui-polish ~/LiftFlow

cd ~/LiftFlow
npm run typecheck
npx expo-doctor
npx expo start --lan --go --clear
```

No dependency installation is required.

## Test

1. Confirm existing custom exercises and templates still exist.
2. Open a built-in exercise with no active workout and confirm there is no fake green action button.
3. Open a custom exercise and test Edit and Archive.
4. Open Workouts and tap `•••` beside a template.
5. Open Edit Template, make a small change, save, and reopen it.
6. Create a temporary template and delete it through `•••`.
7. Confirm deleting the temporary template does not remove any custom exercises.
8. Restart Expo Go and confirm the deletion remains saved.

## Commit

```bash
git add .
git status
git commit -m "feat: manage templates and polish exercise details"
git push origin sdk54-mobile
```
