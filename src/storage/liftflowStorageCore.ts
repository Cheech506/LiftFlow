import { exerciseLibrary, type ExerciseDefinition } from '@/constants/exercises';
import type {
  ActiveWorkout,
  AppPreferences,
  CompletedWorkout,
  DeletedWorkout,
  IncompleteWorkout,
  LiftFlowStateSnapshot,
  WorkoutExercise,
  WorkoutFolder,
  WorkoutSet,
  WorkoutSetType,
  WorkoutTemplate,
  RestTimerSettings,
} from '@/context/ActiveWorkoutContext';
import {
  clearIrrelevantMetrics,
  normalizeExerciseType,
} from '@/lib/exerciseTracking';

export const STORAGE_VERSION = 12 as const;
export const RECENTLY_DELETED_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

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

function safeBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function safeNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

function normalizeRestSeconds(value: unknown, fallback = 120) {
  const parsed = safeNumber(value);
  return Math.max(15, Math.min(3600, Math.round(parsed ?? fallback)));
}

function normalizeRestTimerSettings(raw: unknown): RestTimerSettings {
  const settings = raw && typeof raw === 'object' ? raw as Partial<RestTimerSettings> : {};
  return {
    defaultSeconds: normalizeRestSeconds(settings.defaultSeconds, 120),
    autoStart: safeBoolean(settings.autoStart, true),
    vibrationEnabled: safeBoolean(settings.vibrationEnabled, true),
    notificationsEnabled: safeBoolean(settings.notificationsEnabled, false),
  };
}

function normalizePreferences(raw: unknown): AppPreferences {
  const preferences = raw && typeof raw === 'object' ? raw as Partial<AppPreferences> : {};
  return {
    weeklyWorkoutGoal: Math.max(
      1,
      Math.min(14, Math.round(safeNumber(preferences.weeklyWorkoutGoal) ?? 3)),
    ),
    weightUnit: preferences.weightUnit === 'kg' ? 'kg' : 'lb',
    distanceUnit: preferences.distanceUnit === 'km' ? 'km' : 'mi',
    preferredEffort:
      preferences.preferredEffort === 'rir' || preferences.preferredEffort === 'none'
        ? preferences.preferredEffort
        : 'rpe',
  };
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
    restSeconds: normalizeRestSeconds(exercise.restSeconds ?? definition?.defaultRestSeconds),
    notes: safeString(exercise.notes),
    supersetId: safeString(exercise.supersetId) || undefined,
    sets,
  };
}

function normalizeExercises(
  raw: unknown,
  prefix: string,
  definitions: ExerciseDefinition[],
): WorkoutExercise[] {
  if (!Array.isArray(raw)) return [];
  const exercises = raw
    .map((exercise, index) =>
      normalizeExercise(exercise, `${prefix}-exercise-${index + 1}`, definitions),
    )
    .filter((exercise): exercise is WorkoutExercise => Boolean(exercise));
  const supersetCounts = new Map<string, number>();
  exercises.forEach((exercise) => {
    if (exercise.supersetId) supersetCounts.set(exercise.supersetId, (supersetCounts.get(exercise.supersetId) ?? 0) + 1);
  });
  return exercises.map((exercise) =>
    exercise.supersetId && (supersetCounts.get(exercise.supersetId) ?? 0) < 2
      ? { ...exercise, supersetId: undefined }
      : exercise,
  );
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
    folder: safeString(template.folder).trim(),
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
  return {
    id: safeString(folder.id, `folder-${index + 1}`),
    name,
    archived: Boolean(folder.archived),
  };
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
  templates.forEach((template, index) => {
    if (template.folder) add({ id: `migrated-folder-${index + 1}`, name: template.folder });
  });
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
    restTimerDurationSeconds: safeNumber(workout.restTimerDurationSeconds),
    restTimerPausedSeconds: safeNumber(workout.restTimerPausedSeconds),
    restTimerSourceExerciseId: safeString(workout.restTimerSourceExerciseId) || undefined,
    restTimerCompletedAt: safeNumber(workout.restTimerCompletedAt),
    restTimerNotificationId: safeString(workout.restTimerNotificationId) || undefined,
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
  const importedFromStrong = workout.importSource === 'strong';
  const rawDurationSeconds = Math.max(0, Math.floor((workout.completedAt - workout.startedAt) / 1000));
  const durationUnknown = Boolean(workout.durationUnknown) ||
    (importedFromStrong && rawDurationSeconds > 6 * 60 * 60);
  return {
    id,
    name,
    startedAt: workout.startedAt,
    completedAt: durationUnknown ? workout.startedAt + 60 * 1000 : workout.completedAt,
    sourceTemplateId: safeString(workout.sourceTemplateId) || undefined,
    sourceFolder: safeString(workout.sourceFolder) || undefined,
    notes: safeString(workout.notes),
    exercises: normalizeExercises(workout.exercises, id, definitions),
    importSource: workout.importSource === 'strong' ? 'strong' : undefined,
    importBatchId: safeString(workout.importBatchId) || undefined,
    importFingerprint: safeString(workout.importFingerprint) || undefined,
    importedAt: safeNumber(workout.importedAt),
    durationUnknown: durationUnknown || undefined,
  };
}

function normalizeIncompleteWorkout(
  raw: unknown,
  definitions: ExerciseDefinition[],
): IncompleteWorkout | null {
  const workout = normalizeActiveWorkout(raw, definitions);
  if (!workout || !raw || typeof raw !== 'object') return null;
  const savedAt = safeNumber((raw as Partial<IncompleteWorkout>).savedAt);
  if (savedAt === undefined) return null;
  return { ...workout, savedAt };
}

function normalizeDeletedWorkout(
  raw: unknown,
  index: number,
  definitions: ExerciseDefinition[],
): DeletedWorkout | null {
  const workout = normalizeCompletedWorkout(raw, index, definitions);
  if (!workout || !raw || typeof raw !== 'object') return null;
  const deletedAt = safeNumber((raw as Partial<DeletedWorkout>).deletedAt);
  if (deletedAt === undefined || Date.now() - deletedAt > RECENTLY_DELETED_RETENTION_MS) {
    return null;
  }
  return { ...workout, deletedAt };
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
    defaultRestSeconds: normalizeRestSeconds(exercise.defaultRestSeconds),
    instructions: safeString(exercise.instructions).trim() || undefined,
    favorite: Boolean(exercise.favorite),
    recent: Boolean(exercise.recent),
    isCustom: Boolean(exercise.isCustom),
    archived: Boolean(exercise.archived),
    previousNames: Array.isArray(exercise.previousNames)
      ? exercise.previousNames.filter((item): item is string => typeof item === 'string')
      : undefined,
    importSource: exercise.importSource === 'strong' ? 'strong' : undefined,
    importBatchId: safeString(exercise.importBatchId) || undefined,
  };
}

export function normalizeLiftFlowState(raw: unknown): PersistedLiftFlowState | null {
  if (!raw || typeof raw !== 'object') return null;
  const state = raw as StoredState;
  if (![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, STORAGE_VERSION].includes(state.version ?? 0)) return null;
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

  const deletedWorkouts = Array.isArray(state.deletedWorkouts)
    ? state.deletedWorkouts
        .map((workout, index) => normalizeDeletedWorkout(workout, index, safeExercises))
        .filter((workout): workout is DeletedWorkout => Boolean(workout))
    : [];

  const incompleteWorkouts = Array.isArray(state.incompleteWorkouts)
    ? state.incompleteWorkouts
        .map((workout) => normalizeIncompleteWorkout(workout, safeExercises))
        .filter((workout): workout is IncompleteWorkout => Boolean(workout))
    : [];

  return {
    version: STORAGE_VERSION,
    app: 'LiftFlow',
    exportedAt: safeNumber(state.exportedAt),
    exercises: safeExercises,
    folders,
    templates,
    activeWorkout: normalizeActiveWorkout(state.activeWorkout, safeExercises),
    incompleteWorkouts,
    completedWorkouts,
    deletedWorkouts,
    restTimerSettings: normalizeRestTimerSettings(state.restTimerSettings),
    preferences: normalizePreferences(state.preferences),
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
