# DEVLOG-0021A — Active Workout Safe-Area and Keyboard Hotfix

## Goal

Fix the iPhone active-workout controls shown behind the status bar and keep the Set Controls modal usable while the numeric keyboard is open.

## Changes

- Added explicit top safe-area spacing for the active-workout header.
- Added fixed-width left and right header action areas so Close and Finish remain visible and easy to tap.
- Preserved the rest timer in the center of the header.
- Added bottom safe-area padding to the workout list.
- Rebuilt Set Controls as a keyboard-avoiding modal.
- Added a visible Close action in the Set Controls header.
- Kept the Done action in a fixed footer above the keyboard.
- Kept set type, effort, move, and delete controls inside a scrollable middle section.
- Dismissed the numeric keyboard when Set Controls is closed.

## Data safety

This hotfix changes only the active-workout screen layout. It does not change storage keys, migrations, exercises, templates, active-workout data, history, exports, or backups.

## Validation

- TypeScript syntax/transpile validation passed across all 28 TypeScript/TSX source files in the reconstructed current project.
- Full project typecheck and Expo Doctor must be run on the development Mac.
- Final validation requires testing the safe-area header and keyboard behavior on the physical iPhone.
