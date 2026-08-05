import { exerciseLibrary, type ExerciseDefinition } from '@/constants/exercises';
import type {
  ActiveWorkout,
  CompletedWorkout,
  LiftFlowStateSnapshot,
  WorkoutExercise,
  WorkoutFolder,
  WorkoutSet,
  WorkoutSetType,
  WorkoutTemplate,
} from '@/context/ActiveWorkoutContext';
import {
  clearIrrelevantMetrics,
  normalizeExerciseType,
} from '@/lib/exerciseTracking';

export const STORAGE_VERSION = 6 as const;

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
    previousDurationSeconds: safeNumber(set.previousDurationSeconds),
    previousDistance: safeNumber(set.previousDistance),
    weight: safeNumber(set.weight),
    reps: safeNumber(set.reps),
    durationSeconds: safeNumber(set.durationSeconds),
    distance: safeNumber(set.distance),
    rpe: safeNumber(set.rpe),
    rir: safeNumber(set.rir),
    setType,
    completed: Boolean(set.completed),
  };
}

function findDefinition(
  exercise: Partial<WorkoutExercise>,
  definitions: ExerciseDefinition[],
) {
  const definitionId = safeString(exercise.exerciseDefinitionId);
  if (definitionId) {
    const byId = definitions.find((item) => item.id === definitionId);
    if (byId) return byId;
  }

  const normalizedName = safeString(exercise.name).trim().toLowerCase();
  return definitions.find((item) => {
    const names = [item.name, ...(item.previousNames ?? [])];
    return names.some((name) => name.trim().toLowerCase() === normalizedName);
  });
}

function normalizeExercise(
  raw: unknown,
  fallbackId: string,
  definitions: ExerciseDefinition[],
): WorkoutExercise | null {
  if (!raw || typeof raw !== 'object') return null;
  const exercise = raw as Partial<WorkoutExercise>;
  const name = safeString(exercise.name).trim();
  if (!name) return null;
  const definition = findDefinition(exercise, definitions);
  const exerciseType = normalizeExerciseType(exercise.exerciseType ?? definition?.exerciseType);
  const sets = Array.isArray(exercise.sets)
    ? exercise.sets.map((set, index) =>
        clearIrrelevantMetrics(
          normalizeSet(set, `${fallbackId}-set-${index + 1}`),
          exerciseType,
        ),
      )
    : [];
  if (sets.length === 0) {
    sets.push(
      clearIrrelevantMetrics(normalizeSet({}, `${fallbackId}-set-1`), exerciseType),
    );
  }
  return {
    id: safeString(exercise.id, fallbackId),
    exerciseDefinitionId:
      safeString(exercise.exerciseDefinitionId) || definition?.id || undefined,
    name,
    exerciseType,
    notes: safeString(exercise.notes),
    sets,
  };
}

function normalizeExercises(
  raw: unknown,
  prefix: string,
  definitions: ExerciseDefinition[],
): WorkoutExercise[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((exercise, index) =>
      normalizeExercise(exercise, `${prefix}-exercise-${index + 1}`, definitions),
    )
    .filter((exercise): exercise is WorkoutExercise => Boolean(exercise));
}

function normalizeTemplate(
  raw: unknown,
  index: number,
  definitions: ExerciseDefinition[],
): WorkoutTemplate | null {
  if (!raw || typeof raw !== 'object') return null;
  const template = raw as Partial<WorkoutTemplate>;
  const name = safeString(template.name).trim();
  if (!name) return null;
  const id = safeString(template.id, `template-${index + 1}`);
  const exercises = normalizeExercises(template.exercises, id, definitions);
  if (exercises.length === 0) return null;
  const setCount = exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
  return {
    id,
    name,
    folder: safeString(template.folder, 'My Workouts').trim() || 'My Workouts',
    detail: `${exercises.length} exercise${exercises.length === 1 ? '' : 's'} · ${setCount} planned sets`,
    archived: Boolean(template.archived),
    exercises,
  };
}


function normalizeFolder(raw: unknown, index: number): WorkoutFolder | null {
  if (typeof raw === 'string') {
    const name = raw.trim();
    return name ? { id: `folder-${index + 1}`, name } : null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const folder = raw as Partial<WorkoutFolder>;
  const name = safeString(folder.name).trim();
  if (!name) return null;
  return { id: safeString(folder.id, `folder-${index + 1}`), name };
}

function normalizeFolders(raw: unknown, templates: WorkoutTemplate[]): WorkoutFolder[] {
  const normalized = Array.isArray(raw)
    ? raw.map(normalizeFolder).filter((folder): folder is WorkoutFolder => Boolean(folder))
    : [];
  const seen = new Set<string>();
  const result: WorkoutFolder[] = [];
  const add = (folder: WorkoutFolder) => {
    const key = folder.name.trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    result.push(folder);
  };
  normalized.forEach(add);
  templates.forEach((template, index) => add({ id: `migrated-folder-${index + 1}`, name: template.folder }));
  if (result.length === 0) add({ id: 'my-workouts', name: 'My Workouts' });
  return result;
}

function normalizeActiveWorkout(
  raw: unknown,
  definitions: ExerciseDefinition[],
): ActiveWorkout | null {
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
    exercises: normalizeExercises(
      workout.exercises,
      safeString(workout.id, 'active'),
      definitions,
    ),
  };
}

function normalizeCompletedWorkout(
  raw: unknown,
  index: number,
  definitions: ExerciseDefinition[],
): CompletedWorkout | null {
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
    exercises: normalizeExercises(workout.exercises, id, definitions),
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
  const exerciseType = normalizeExerciseType(exercise.exerciseType);
  return {
    id,
    name,
    detail: `${primaryMuscle} · ${equipment}`,
    primaryMuscle,
    equipment,
    exerciseType,
    defaultWeight:
      exerciseType === 'Weight & Reps' ||
      exerciseType === 'Bodyweight + Added Weight' ||
      exerciseType === 'Assisted Bodyweight'
        ? safeNumber(exercise.defaultWeight)
        : undefined,
    defaultReps:
      exerciseType === 'Duration' || exerciseType === 'Distance & Duration'
        ? undefined
        : safeNumber(exercise.defaultReps) ?? 8,
    defaultDurationSeconds:
      exerciseType === 'Duration' || exerciseType === 'Distance & Duration'
        ? safeNumber(exercise.defaultDurationSeconds) ?? 60
        : undefined,
    defaultDistance:
      exerciseType === 'Distance & Duration'
        ? safeNumber(exercise.defaultDistance)
        : undefined,
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
  if (![1, 2, 3, 4, 5, STORAGE_VERSION].includes(state.version ?? 0)) return null;
  if (!Array.isArray(state.templates) || !Array.isArray(state.completedWorkouts)) return null;

  const exercises = Array.isArray(state.exercises)
    ? state.exercises
        .map(normalizeDefinition)
        .filter((item): item is ExerciseDefinition => Boolean(item))
    : exerciseLibrary;
  const safeExercises = exercises.length > 0 ? exercises : exerciseLibrary;

  const templates = state.templates
    .map((template, index) => normalizeTemplate(template, index, safeExercises))
    .filter((template): template is WorkoutTemplate => Boolean(template));

  const folders = normalizeFolders(state.folders, templates);

  const completedWorkouts = state.completedWorkouts
    .map((workout, index) => normalizeCompletedWorkout(workout, index, safeExercises))
    .filter((workout): workout is CompletedWorkout => Boolean(workout));

  return {
    version: STORAGE_VERSION,
    app: 'LiftFlow',
    exportedAt: safeNumber(state.exportedAt),
    exercises: safeExercises,
    folders,
    templates,
    activeWorkout: normalizeActiveWorkout(state.activeWorkout, safeExercises),
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
