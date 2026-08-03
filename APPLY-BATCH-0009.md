# Apply Batch 0009

This batch adds exercise reordering to the detailed template editor without changing LiftFlow's storage schema.

## Apply

```bash
cd ~/Downloads
unzip -o LiftFlow-batch-0009-template-exercise-reordering.zip
ditto LiftFlow-batch-0009-template-exercise-reordering ~/LiftFlow

cd ~/LiftFlow
npm run typecheck
npx expo-doctor
npx expo start --lan --go --clear
```

No `npm install` is required.

## Test

1. Open Workouts and preview a saved template.
2. Tap **Edit Template**.
3. Use the up/down arrows beside an exercise.
4. Move several exercises into a new order.
5. Confirm each exercise keeps its weight, reps, RPE/RIR, and sets.
6. Tap **Save Template**.
7. Reopen the template preview and confirm the order remains.
8. Start the template and confirm the active workout uses the same order.
9. Restart Expo Go and confirm the saved order is still present.

## Commit

```bash
git add .
git status
git commit -m "feat: reorder exercises in workout templates"
git push origin sdk54-mobile
```
