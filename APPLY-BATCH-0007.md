# Apply LiftFlow Batch 0007

This batch is applied on top of Batch 0006 on the `sdk54-mobile` branch.

```bash
cd ~/Downloads
unzip -o LiftFlow-batch-0007-template-exercise-creation.zip
ditto LiftFlow-batch-0007-template-exercise-creation ~/LiftFlow

cd ~/LiftFlow
npm run typecheck
npx expo-doctor
npx expo start --lan --go --clear
```

No dependency installation is required. Do not run `npm audit fix` or `npm audit fix --force`.
