import type {
  ActiveWorkout,
  CompletedWorkout,
  WorkoutTemplate,
} from '@/context/ActiveWorkoutContext';

const STORAGE_KEY = 'liftflow.local-state';
const STORAGE_VERSION = 1;

export type PersistedLiftFlowState = {
  version: typeof STORAGE_VERSION;
  templates: WorkoutTemplate[];
  activeWorkout: ActiveWorkout | null;
  completedWorkouts: CompletedWorkout[];
};

function getStorage() {
  if (!globalThis.localStorage) {
    throw new Error('Persistent local storage is unavailable in this browser.');
  }

  return globalThis.localStorage;
}

export async function loadLiftFlowState(): Promise<PersistedLiftFlowState | null> {
  const storedValue = getStorage().getItem(STORAGE_KEY);
  if (!storedValue) return null;

  const parsed = JSON.parse(storedValue) as Partial<PersistedLiftFlowState>;

  if (
    parsed.version !== STORAGE_VERSION ||
    !Array.isArray(parsed.templates) ||
    !Array.isArray(parsed.completedWorkouts)
  ) {
    return null;
  }

  return {
    version: STORAGE_VERSION,
    templates: parsed.templates,
    activeWorkout: parsed.activeWorkout ?? null,
    completedWorkouts: parsed.completedWorkouts,
  };
}

export async function saveLiftFlowState(
  state: Omit<PersistedLiftFlowState, 'version'>,
): Promise<void> {
  const payload: PersistedLiftFlowState = {
    version: STORAGE_VERSION,
    ...state,
  };

  getStorage().setItem(STORAGE_KEY, JSON.stringify(payload));
}

export async function clearLiftFlowState(): Promise<void> {
  getStorage().removeItem(STORAGE_KEY);
}
