import { exerciseLibrary, type ExerciseDefinition } from '@/constants/exercises';
import type {
  ActiveWorkout,
  CompletedWorkout,
  LiftFlowStateSnapshot,
  WorkoutExercise,
  WorkoutSet,
  WorkoutSetType,
  WorkoutTemplate,
} from '@/context/ActiveWorkoutContext';

export const STORAGE_VERSION = 4 as const;

export type PersistedLiftFlowState = LiftFlowStateSnapshot & {
  version: typeof STORAGE_VERSION;
  exportedAt?: number;
  app?: 'LiftFlow';
};

type StoredState = Partial<PersistedLiftFlowState> & { version?: number };

const validSetTypes = new Set<WorkoutSetType>([
  'normal',
  'warmup',
  'drop',
  'failure',
  'amrap',
]);

function safeString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function safeNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

function normalizeSet(raw: unknown, fallbackId: string): WorkoutSet {
  const set = raw && typeof raw === 'object' ? (raw as Partial<WorkoutSet>) : {};
  const setType = validSetTypes.has(set.setType as WorkoutSetType)
    ? (set.setType as WorkoutSetType)
    : 'normal';

  return {
    id: safeString(set.id, fallbackId),
    previousWeight: safeNumber(set.previousWeight),
    previousReps: safeNumber(set.previousReps),
    weight: safeNumber(set.weight),
    reps: safeNumber(set.reps),
    rpe: safeNumber(set.rpe),
    rir: safeNumber(set.rir),
    setType,
    completed: Boolean(set.completed),
  };
}

function normalizeExercise(raw: unknown, fallbackId: string): WorkoutExercise | null {
  if (!raw || typeof raw !== 'object') return null;
  const exercise = raw as Partial<WorkoutExercise>;
  const name = safeString(exercise.name).trim();
  if (!name) return null;
  const sets = Array.isArray(exercise.sets)
    ? exercise.sets.map((set, index) => normalizeSet(set, `${fallbackId}-set-${index + 1}`))
    : [];
  if (sets.length === 0) {
    sets.push(normalizeSet({}, `${fallbackId}-set-1`));
  }
  return {
    id: safeString(exercise.id, fallbackId),
    name,
    notes: safeString(exercise.notes),
    sets,
  };
}

function normalizeExercises(raw: unknown, prefix: string): WorkoutExercise[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((exercise, index) => normalizeExercise(exercise, `${prefix}-exercise-${index + 1}`))
    .filter((exercise): exercise is WorkoutExercise => Boolean(exercise));
}

function normalizeTemplate(raw: unknown, index: number): WorkoutTemplate | null {
  if (!raw || typeof raw !== 'object') return null;
  const template = raw as Partial<WorkoutTemplate>;
  const name = safeString(template.name).trim();
  if (!name) return null;
  const id = safeString(template.id, `template-${index + 1}`);
  const exercises = normalizeExercises(template.exercises, id);
  if (exercises.length === 0) return null;
  const setCount = exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
  return {
    id,
    name,
    folder: safeString(template.folder, 'My Workouts').trim() || 'My Workouts',
    detail: `${exercises.length} exercise${exercises.length === 1 ? '' : 's'} · ${setCount} planned sets`,
    exercises,
  };
}

function normalizeActiveWorkout(raw: unknown): ActiveWorkout | null {
  if (!raw || typeof raw !== 'object') return null;
  const workout = raw as Partial<ActiveWorkout>;
  const name = safeString(workout.name).trim();
  if (!name || typeof workout.startedAt !== 'number') return null;
  return {
    id: safeString(workout.id, `workout-${workout.startedAt}`),
    name,
    startedAt: workout.startedAt,
    sourceTemplateId: safeString(workout.sourceTemplateId) || undefined,
    notes: safeString(workout.notes),
    restTimerEndsAt: safeNumber(workout.restTimerEndsAt),
    exercises: normalizeExercises(workout.exercises, safeString(workout.id, 'active')),
  };
}

function normalizeCompletedWorkout(raw: unknown, index: number): CompletedWorkout | null {
  if (!raw || typeof raw !== 'object') return null;
  const workout = raw as Partial<CompletedWorkout>;
  const name = safeString(workout.name).trim();
  if (!name || typeof workout.startedAt !== 'number' || typeof workout.completedAt !== 'number') {
    return null;
  }
  const id = safeString(workout.id, `completed-${workout.completedAt}-${index}`);
  return {
    id,
    name,
    startedAt: workout.startedAt,
    completedAt: workout.completedAt,
    sourceTemplateId: safeString(workout.sourceTemplateId) || undefined,
    sourceFolder: safeString(workout.sourceFolder) || undefined,
    notes: safeString(workout.notes),
    exercises: normalizeExercises(workout.exercises, id),
  };
}

function normalizeDefinition(raw: unknown): ExerciseDefinition | null {
  if (!raw || typeof raw !== 'object') return null;
  const exercise = raw as Partial<ExerciseDefinition>;
  const id = safeString(exercise.id).trim();
  const name = safeString(exercise.name).trim();
  if (!id || !name) return null;
  const primaryMuscle = safeString(exercise.primaryMuscle, 'Other').trim() || 'Other';
  const equipment = safeString(exercise.equipment, 'Other').trim() || 'Other';
  const exerciseType = exercise.exerciseType === 'Bodyweight' ? 'Bodyweight' : 'Weight & Reps';
  return {
    id,
    name,
    detail: `${primaryMuscle} · ${equipment}`,
    primaryMuscle,
    equipment,
    exerciseType,
    defaultWeight: exerciseType === 'Weight & Reps' ? safeNumber(exercise.defaultWeight) : undefined,
    defaultReps: safeNumber(exercise.defaultReps) ?? 8,
    favorite: Boolean(exercise.favorite),
    recent: Boolean(exercise.recent),
    isCustom: Boolean(exercise.isCustom),
    archived: Boolean(exercise.archived),
    previousNames: Array.isArray(exercise.previousNames)
      ? exercise.previousNames.filter((item): item is string => typeof item === 'string')
      : undefined,
  };
}

export function normalizeLiftFlowState(raw: unknown): PersistedLiftFlowState | null {
  if (!raw || typeof raw !== 'object') return null;
  const state = raw as StoredState;
  if (![1, 2, 3, STORAGE_VERSION].includes(state.version ?? 0)) return null;
  if (!Array.isArray(state.templates) || !Array.isArray(state.completedWorkouts)) return null;

  const exercises = Array.isArray(state.exercises)
    ? state.exercises.map(normalizeDefinition).filter((item): item is ExerciseDefinition => Boolean(item))
    : exerciseLibrary;

  const templates = state.templates
    .map((template, index) => normalizeTemplate(template, index))
    .filter((template): template is WorkoutTemplate => Boolean(template));

  const completedWorkouts = state.completedWorkouts
    .map((workout, index) => normalizeCompletedWorkout(workout, index))
    .filter((workout): workout is CompletedWorkout => Boolean(workout));

  return {
    version: STORAGE_VERSION,
    app: 'LiftFlow',
    exportedAt: safeNumber(state.exportedAt),
    exercises: exercises.length > 0 ? exercises : exerciseLibrary,
    templates,
    activeWorkout: normalizeActiveWorkout(state.activeWorkout),
    completedWorkouts,
  };
}

export function parseStoredState(storedValue: string | null): PersistedLiftFlowState | null {
  if (!storedValue) return null;
  try {
    return normalizeLiftFlowState(JSON.parse(storedValue));
  } catch {
    return null;
  }
}

export function parseLiftFlowBackup(text: string): PersistedLiftFlowState {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('This file is not valid JSON.');
  }
  const normalized = normalizeLiftFlowState(raw);
  if (!normalized) {
    throw new Error('This file is not a compatible LiftFlow backup.');
  }
  return normalized;
}
