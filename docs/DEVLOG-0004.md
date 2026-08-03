# DEVLOG-0004 — Expo SDK 54 Mobile Test Conversion

## Summary

This batch converts the LiftFlow mobile project from Expo SDK 57 to Expo SDK 54 so the current Expo Go application can run the project on physical iPhone and Android devices during development.

The existing LiftFlow features and local persistence architecture remain unchanged. This batch is focused on dependency compatibility and real-device testing rather than adding new product features.

## Changes

- Changed the Expo runtime from SDK 57 to SDK 54.
- Aligned React Native to 0.81.5 and React to 19.1.0.
- Aligned Expo Router, Expo SQLite, Expo Constants, Expo Linking, and Expo Status Bar with SDK 54.
- Aligned React Native Gesture Handler, Safe Area Context, Screens, and React Native Web with SDK 54.
- Aligned TypeScript and React type definitions with the SDK 54 toolchain.
- Preserved the existing five-tab navigation and full-screen Active Workout route.
- Preserved platform-specific storage:
  - browser `localStorage` on web
  - SQLite-backed `localStorage` on iPhone and Android
- Updated the README with Expo Go physical-device testing instructions.

## Why this conversion is happening now

The active-workout workflow, editable set values, template updates, and local persistence are complete enough to benefit from real-device testing. Testing now will expose mobile-specific issues such as safe-area spacing, numeric keyboard behavior, touch target sizing, long-workout scrolling, and persistence after closing Expo Go.

## Branch strategy

The SDK 57 `main` branch remains a safe checkpoint. The SDK 54 conversion should be committed to the `sdk54-mobile` branch until physical-device testing passes.

## Testing focus

1. Confirm Expo Doctor and TypeScript pass.
2. Open LiftFlow in Expo Go on an iPhone.
3. Verify all five tabs fit and navigate correctly.
4. Start Upper A and edit weight and reps using the iPhone numeric keyboard.
5. Complete a set and confirm the rest timer starts.
6. Close Expo Go completely, reopen it, and confirm the active workout returns.
7. Finish the workout and confirm it appears in History.
8. Finish and update a template, restart the app, and confirm the updated values remain.
9. Test discard, finish, and confirmation dialogs on iOS.
10. Repeat the same core workflow on Android when available.
