# DEVLOG-0022 — Folder and Template Organization

## Goal

Turn the Workouts tab into a complete organization screen instead of relying on folder names typed into templates.

## Completed

- Added persistent workout folders as first-class local data.
- Added folder creation, rename, reordering, and safe deletion of empty folders.
- Added template duplication.
- Added moving templates between folders.
- Added moving templates up and down inside their current folder.
- Added template archiving and restoration.
- Kept permanent template deletion behind confirmation.
- Preserved empty folders across app restarts and JSON backup/restore.
- Added storage migration from version 5 to version 6.
- Migrated existing folder names from saved templates automatically.
- Kept exercises, active workouts, and completed history independent from template organization changes.

## Data Safety

- Existing templates keep their IDs, exercise order, sets, notes, tracking types, and effort targets.
- Existing version 5 data is upgraded by deriving the folder list from each template's saved folder name.
- Archiving or deleting a template does not delete exercises or workout history.
- A folder cannot be deleted while any active or archived template still belongs to it.

## Files Changed

- `src/app/(tabs)/workouts.tsx`
- `src/components/SectionCard.tsx`
- `src/context/ActiveWorkoutContext.tsx`
- `src/storage/liftflowStorageCore.ts`
- `docs/V0.2-FOLDER-TEMPLATE-CHECKLIST.md`
