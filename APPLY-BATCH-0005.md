# Apply LiftFlow Batch 0005

This batch contains only TypeScript files and documentation. It does not change npm dependencies.

## On the Mac development copy

```bash
cd ~/Downloads
unzip -o LiftFlow-batch-0005-button-hardening.zip
ditto LiftFlow-batch-0005-button-hardening ~/LiftFlow

cd ~/LiftFlow
npm run typecheck
npx expo-doctor
npx expo start --lan --clear
```

Test the complete interaction checklist in `docs/DEVLOG-0005.md` before committing.

## Commit and push

```bash
cd ~/LiftFlow
git add .
git status
git commit -m "fix: wire prototype interactions"
git push origin sdk54-mobile
```

Confirm `docs/DEVLOG-0005.md` is included in `git status` before committing.

## Update the Fedora tunnel copy

Attach to the LiftFlow tmux session and stop Expo with `Ctrl+C`:

```bash
tmux attach -t liftflow
```

Then update and restart:

```bash
cd ~/LiftFlow
git pull origin sdk54-mobile
npx expo start --tunnel --go --clear --port 8082
```

Detach without stopping Expo using `Ctrl+B`, release, then `D`.
