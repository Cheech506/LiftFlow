# LiftFlow

LiftFlow is an open-source, self-hosted workout tracker inspired by Strong. This repository currently contains the first mobile application scaffold: five main tabs, Settings outside the tab bar, and a modal Active Workout experience with a persistent resume bar.

## Current foundation

- Expo SDK 57
- React Native + TypeScript
- Expo Router
- Exactly five tabs: Home, Exercises, Workouts, History, Progress
- Settings gear on every tab
- Active Workout opens as a full-screen modal
- Persistent workout-in-progress bar above the tab navigation
- Basic functional demo workout state

## Run locally

```bash
npm install
npx expo start
```

Then open the project using Expo Go, an Android emulator, or an iOS simulator.

## Current limitation

Workout state is currently stored only in React memory. SQLite persistence is the next major implementation phase.
