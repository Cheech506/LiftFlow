# Apply LiftFlow Batch 0003

Stop Expo with `Ctrl+C`, then copy this batch over the LiftFlow project.

```bash
cd ~/Downloads
unzip -o LiftFlow-batch-0003.zip
ditto LiftFlow-batch-0003 ~/LiftFlow

cd ~/LiftFlow
npx expo install expo-sqlite
npx expo-doctor
npm run typecheck
npx expo start --clear
```

Do not run `npm audit fix` or `npm audit fix --force`.

## Persistence test

1. Start Upper A.
2. Change a weight and complete a set.
3. Wait until the screen says `Saved on this device`.
4. Refresh the browser.
5. Confirm the active workout and edited values return.
6. Finish and update the template.
7. Refresh again and start Upper A.
8. Confirm the updated template values remain.
9. Open History and confirm the completed workout appears.
