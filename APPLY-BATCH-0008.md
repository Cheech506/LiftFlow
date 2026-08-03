# Apply Batch 0008

This batch preserves existing local exercises and templates. Do not uninstall Expo Go or use any Clear Local Data action while testing the migration.

## Recommended checkpoint first

```bash
cd ~/LiftFlow
git add .
git status
git commit -m "feat: add custom exercises and template builder"
git push origin sdk54-mobile
```

Skip the commit only if Batch 0006/0007 is already committed.

## Apply

```bash
cd ~/Downloads
unzip -o LiftFlow-batch-0008-template-set-customization.zip
ditto LiftFlow-batch-0008-template-set-customization ~/LiftFlow

cd ~/LiftFlow
npm run typecheck
npx expo-doctor
npx expo start --lan --go --clear
```

`--clear` clears Metro's code cache only. It does not clear LiftFlow's saved exercises or workout data.

## Test

1. Confirm previously created custom exercises still appear under My Exercises.
2. Open Workouts and preview an existing template.
3. Tap Edit Template.
4. Change weight and reps on individual sets.
5. Tap the effort selector to cycle None → RPE → RIR.
6. Change the RPE or RIR value.
7. Add and remove sets.
8. Add an existing custom exercise to the template.
9. Save, close, and reopen the app.
10. Confirm the edited template and all custom exercises remain.
11. Start the template and confirm RPE/RIR targets appear beneath the proper sets.

## Commit

```bash
git add .
git status
git commit -m "feat: customize template sets and effort targets"
git push origin sdk54-mobile
```
