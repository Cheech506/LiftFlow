# Start Here

## 1. Extract the LiftFlow folder

Place it wherever you keep development projects.

## 2. Open a terminal in the project

```bash
cd LiftFlow
```

## 3. Install packages

```bash
npm install
npx expo install --fix
```

The second command asks Expo to align every native dependency with the installed Expo SDK.

## 4. Start with a clean cache

```bash
npx expo start --clear
```

Scan the QR code with Expo Go, or press the terminal shortcut for an Android emulator or iOS simulator.

## What to test first

1. Confirm the five tabs appear in this order: Home, Exercises, Workouts, History, Progress.
2. Open Settings from the gear in the top-right.
3. Start Upper A from Home or Workouts.
4. Close the full-screen workout using the down arrow.
5. Confirm the Workout in Progress bar remains above the tab bar.
6. Resume the workout and check off sets.
7. Confirm the rest timer begins when a set is checked.
8. Finish or discard the demo workout.

## Important

This is the first navigation and interaction scaffold. Workout data is not yet persisted to SQLite, so reloading the app clears the demo workout. SQLite is the next coding phase.
