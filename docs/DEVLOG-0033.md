# DEVLOG-0033 — Installed Development Build Foundation (v0.7)

## Goal

Replace Expo Go with a LiftFlow-owned iPhone and Android development build without changing or risking the completed v0.6 workout system or its portable data format.

## Native application identity

- Preserved the permanent `com.cheech.liftflow` identifier on iOS and Android.
- Preserved the `liftflow` deep-link scheme.
- Added explicit iOS build number 1 and Android version code 1.
- Increased the application release version to 0.7.0 across Expo and npm metadata.
- Kept generated `ios` and `android` projects out of source control so Expo Continuous Native Generation remains reproducible from `app.json`.

## Development client

- Added the Expo SDK 54-compatible `expo-dev-client` 6.0.21 dependency.
- Changed the default Metro command to target the LiftFlow development client rather than Expo Go.
- Added clear-cache and tunnel development-client commands.
- Added local iPhone/Android compile-and-install commands.
- Added a clean prebuild command for safely regenerating native projects after configuration changes.

## Signing and distribution profiles

- Added EAS development, preview, and production build profiles.
- Development uses a development client and internal distribution.
- Preview creates an internally distributed standalone test build.
- Production remains ready for App Store and Play Store signing after account enrollment.
- Added source-control protections for credentials, provisioning profiles, certificates, and local environment files.

## Data migration safety

- Kept portable storage version 12 unchanged; the development-build conversion does not alter workout data.
- Settings now identifies Expo Go, installed development, installed release, and web environments dynamically.
- Expo Go shows a direct migration-backup action.
- A fresh installed LiftFlow app shows a direct restore action for the Expo Go JSON backup.
- The migration text explicitly includes exercises, templates, Strong history, PRs, preferences, and incomplete workouts.
- Expo Go should remain installed until the restored data has been verified in the standalone LiftFlow sandbox.

## Quality coverage

- Added automated checks for version alignment, native identifiers, build numbers, development-client configuration, native scripts, and all three EAS build profiles.
- Parsed the supplied real LiftFlow backup through the unchanged v12 restore path and preserved 75 exercises, 2 folders, 5 templates, 379 completed workouts, 1,927 workout exercises, and 8,173 sets.
- Added a dedicated real-device migration and development-build checklist.
- Updated the README for free local Xcode signing, paid EAS signing, backup restoration, and daily development-client use.

## Dependency-lock note

The replacement package and lockfile pin the SDK 54-compatible development client and its transitive native packages. Run `npm ci` on the development Mac for a deterministic install, then run Expo Doctor before generating the iOS project.
