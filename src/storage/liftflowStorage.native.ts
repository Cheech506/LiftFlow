import 'expo-sqlite/localStorage/install';

import { exerciseLibrary, type ExerciseDefinition } from '@/constants/exercises';
import type {
  ActiveWorkout,
  CompletedWorkout,
  WorkoutTemplate,
} from '@/context/ActiveWorkoutContext';

const STORAGE_KEY = 'liftflow.local-state';
const BACKUP_STORAGE_KEY = 'liftflow.local-state.backup';
const STORAGE_VERSION = 3;

export type PersistedLiftFlowState = {
  version: typeof STORAGE_VERSION;
  exercises: ExerciseDefinition[];
  templates: WorkoutTemplate[];
  activeWorkout: ActiveWorkout | null;
  completedWorkouts: CompletedWorkout[];
};

type StoredLiftFlowState = Partial<PersistedLiftFlowState> & {
  version?: number;
};

function getStorage() {
  if (!globalThis.localStorage) {
    throw new Error('Persistent local storage is unavailable on this device.');
  }

  return globalThis.localStorage;
}

function parseStoredState(storedValue: string | null): PersistedLiftFlowState | null {
  if (!storedValue) return null;

  try {
    const parsed = JSON.parse(storedValue) as StoredLiftFlowState;

    if (
      ![1, 2, STORAGE_VERSION].includes(parsed.version ?? 0) ||
      !Array.isArray(parsed.templates) ||
      !Array.isArray(parsed.completedWorkouts)
    ) {
      return null;
    }

    return {
      version: STORAGE_VERSION,
      // Keep the stored exercise array exactly as-is so custom exercises are never
      // replaced during schema upgrades. The built-in library is only a fallback.
      exercises: Array.isArray(parsed.exercises) ? parsed.exercises : exerciseLibrary,
      templates: parsed.templates,
      activeWorkout: parsed.activeWorkout ?? null,
      completedWorkouts: parsed.completedWorkouts,
    };
  } catch {
    return null;
  }
}

export async function loadLiftFlowState(): Promise<PersistedLiftFlowState | null> {
  const storage = getStorage();
  const primary = parseStoredState(storage.getItem(STORAGE_KEY));
  if (primary) return primary;

  // If a write was interrupted or a future migration is malformed, recover the
  // previous complete snapshot instead of returning an empty application.
  return parseStoredState(storage.getItem(BACKUP_STORAGE_KEY));
}

export async function saveLiftFlowState(
  state: Omit<PersistedLiftFlowState, 'version'>,
): Promise<void> {
  const storage = getStorage();
  const existing = storage.getItem(STORAGE_KEY);
  if (existing) storage.setItem(BACKUP_STORAGE_KEY, existing);

  const payload: PersistedLiftFlowState = {
    version: STORAGE_VERSION,
    ...state,
  };

  storage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export async function clearLiftFlowState(): Promise<void> {
  const storage = getStorage();
  storage.removeItem(STORAGE_KEY);
  storage.removeItem(BACKUP_STORAGE_KEY);
}
