# LiftFlow

LiftFlow is an open-source, self-hosted workout tracker inspired by Strong. The mobile foundation includes five main tabs, Settings outside the tab bar, a modal Active Workout experience, and persistent local workout data.

## Current foundation

- Expo SDK 54 for physical-device testing through Expo Go
- React Native + TypeScript
- Expo Router
- Exactly five tabs: Home, Exercises, Workouts, History, Progress
- Settings gear on every tab
- Active Workout opens as a full-screen modal
- Persistent workout-in-progress bar above the tab navigation
- Editable weight and repetition values
- Optional template updates when finishing
- Persistent active workouts, templates, and completed history
- SQLite-backed local storage on iPhone and Android
- Browser local storage during web development

## Run locally

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go on an iPhone or Android device connected to the same network. If LAN discovery does not work, use:

```bash
npx expo start --tunnel --clear
```

## Local-first behavior

LiftFlow saves workout changes on the device first. The future FastAPI/PostgreSQL server will add synchronization and centralized backups without making the server a requirement during a workout.
