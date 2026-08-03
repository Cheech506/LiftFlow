# LiftFlow

LiftFlow is an open-source, self-hosted workout tracker inspired by Strong. The mobile foundation currently includes five main tabs, Settings outside the tab bar, a modal Active Workout experience, and persistent local workout data.

## Current foundation

- Expo SDK 57
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

Then open the project using the web build, an Android emulator/device, or an iOS simulator/development build.

## Local-first behavior

LiftFlow saves workout changes on the device first. The future FastAPI/PostgreSQL server will add synchronization and centralized backups without making the server a requirement during a workout.
