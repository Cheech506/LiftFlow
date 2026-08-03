# Apply LiftFlow Batch 0006

This batch adds persistent custom exercise creation and persistent workout template creation.

## Apply on the Mac

```bash
cd ~/Downloads
unzip -o LiftFlow-batch-0006-exercises-templates.zip
ditto LiftFlow-batch-0006-exercises-templates ~/LiftFlow

cd ~/LiftFlow
npm run typecheck
npx expo-doctor
npx expo start --lan --clear
```

No dependency installation is required.

## Commit after iPhone testing

```bash
cd ~/LiftFlow
git add .
git status
git commit -m "feat: add custom exercises and templates"
git push origin sdk54-mobile
```

Confirm `docs/DEVLOG-0006.md` is included before committing.

## Update the Fedora tunnel copy

```bash
ssh cheech@weekflow-fedora
tmux attach -t liftflow
```

Stop the old Expo process with `Ctrl+C`, then run:

```bash
cd ~/LiftFlow
git pull origin sdk54-mobile
npx expo start --tunnel --go --clear --port 8082
```

Detach with `Ctrl+B`, release, then press `D`.
