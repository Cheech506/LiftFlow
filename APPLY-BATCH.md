# Apply LiftFlow Batch 0002

From Terminal, while Expo is stopped:

```bash
cd ~/Downloads
unzip -o LiftFlow-batch-0002.zip
ditto LiftFlow-batch-0002 ~/LiftFlow
cd ~/LiftFlow
npx expo-doctor
npx expo start --clear
```

This batch replaces only the files included in this patch. It does not remove `node_modules`, reinstall packages, or change `package.json`.
