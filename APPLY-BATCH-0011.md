# Apply Batch 0011

This patch fixes keyboard overlap and scrolling in LiftFlow form modals. It does not modify stored data.

```bash
cd ~/Downloads
unzip -o LiftFlow-batch-0011-keyboard-modal-stability.zip
ditto LiftFlow-batch-0011-keyboard-modal-stability ~/LiftFlow

cd ~/LiftFlow
npm run typecheck
npx expo-doctor
npx expo start --lan --go --clear
```

After iPhone testing passes:

```bash
git add .
git status
git commit -m "fix: stabilize keyboard forms and workout inputs"
git push origin sdk54-mobile
```
