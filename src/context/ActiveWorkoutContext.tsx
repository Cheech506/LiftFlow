import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ActivityIndicator, AppState, StyleSheet, Text, View } from 'react-native';

import { exerciseLibrary, ExerciseDefinition, ExerciseType } from '@/constants/exercises';
import { colors, spacing } from '@/constants/theme';
import {
  clearIrrelevantMetrics,
  copyMetricValues,
  defaultMetricsForExercise,
  exerciseTypeUsesDistance,
  exerciseTypeUsesDuration,
  exerciseTypeUsesReps,
  exerciseTypeUsesWeight,
  normalizeExerciseType,
  type WorkoutMetricField,
} from '@/lib/exerciseTracking';
import {
  cancelRestTimerAlert,
  configureRestTimerAlerts,
  scheduleRestTimerAlert,
  signalRestTimerComplete,
} from '@/lib/restTimerAlerts';
import { applyPreviousPerformance } from '@/lib/previousPerformance';
import { createUuid } from '@/lib/ids';
import { loadLiftFlowState, saveLiftFlowSafetyBackup, saveLiftFlowState } from '@/storage/liftflowStorage';

export type WorkoutSetType = 'normal' | 'warmup' | 'drop' | 'failure' | 'amrap';
export type EffortMode = 'rpe' | 'rir';

export type WorkoutSet = {
  id: string;
  previousWeight?: number;
  previousReps?: number;
  previousDurationSeconds?: number;
  previousDistance?: number;
  weight?: number;
  reps?: number;
  durationSeconds?: number;
  distance?: number;
  rpe?: number;
  rir?: number;
  setType?: WorkoutSetType;
  completed: boolean;
};

export type WorkoutExercise = {
  id: string;
  exerciseDefinitionId?: string;
  name: string;
  exerciseType: ExerciseType;
  restSeconds?: number;
  notes?: string;
  supersetId?: string;
  sets: WorkoutSet[];
};

export type WorkoutFolder = {
  id: string;
  name: string;
  archived?: boolean;
};

export type WorkoutTemplate = {
  id: string;
  name: string;
  folder: string;
  detail: string;
  archived?: boolean;
  exercises: WorkoutExercise[];
};

export type ActiveWorkout = {
  id: string;
  name: string;
  startedAt: number;
  sourceTemplateId?: string;
  notes?: string;
  restTimerEndsAt?: number;
  restTimerDurationSeconds?: number;
  restTimerPausedSeconds?: number;
  restTimerSourceExerciseId?: string;
  restTimerCompletedAt?: number;
  restTimerNotificationId?: string;
  exercises: WorkoutExercise[];
};

export type IncompleteWorkout = ActiveWorkout & {
  savedAt: number;
};

export type RestTimerSettings = {
  defaultSeconds: number;
  autoStart: boolean;
  vibrationEnabled: boolean;
  notificationsEnabled: boolean;
};

export type CompletedWorkout = {
  id: string;
  name: string;
  startedAt: number;
  completedAt: number;
  sourceTemplateId?: string;
  sourceFolder?: string;
  notes?: string;
  exercises: WorkoutExercise[];
  importSource?: 'strong';
  importBatchId?: string;
  importFingerprint?: string;
  importedAt?: number;
  durationUnknown?: boolean;
};

export type DeletedWorkout = CompletedWorkout & {
  deletedAt: number;
};

export type AppPreferences = {
  weeklyWorkoutGoal: number;
  weightUnit: 'lb' | 'kg';
  distanceUnit: 'mi' | 'km';
  preferredEffort: EffortMode | 'none';
};

export type LiftFlowStateSnapshot = {
  exercises: ExerciseDefinition[];
  folders: WorkoutFolder[];
  templates: WorkoutTemplate[];
  activeWorkout: ActiveWorkout | null;
  incompleteWorkouts: IncompleteWorkout[];
  completedWorkouts: CompletedWorkout[];
  deletedWorkouts: DeletedWorkout[];
  restTimerSettings: RestTimerSettings;
  preferences: AppPreferences;
};

type SetValueField = WorkoutMetricField;
type PersistenceStatus = 'loading' | 'saving' | 'saved' | 'error';
type MoveDirection = 'up' | 'down';
type FinishWorkoutOptions = { updateTemplate?: boolean };

export type CreateExerciseInput = {
  name: string;
  primaryMuscle: string;
  equipment: string;
  exerciseType: ExerciseType;
  defaultWeight?: number;
  defaultReps?: number;
  defaultDurationSeconds?: number;
  defaultDistance?: number;
  defaultRestSeconds?: number;
  instructions?: string;
};

export type UpdateExerciseInput = CreateExerciseInput & { id: string };

export type ExerciseUsage = {
  templates: number;
  completedWorkouts: number;
  activeWorkout: boolean;
};

export type CreateTemplateInput = {
  name: string;
  folder: string;
  exerciseIds: string[];
  setCount: number;
};

export type UpdateTemplateInput = {
  id: string;
  name: string;
  folder: string;
  exercises: WorkoutExercise[];
};

export type CreateManualWorkoutInput = {
  name: string;
  startedAt: number;
  completedAt: number;
  notes?: string;
  exercises: WorkoutExercise[];
};

type ActiveWorkoutContextValue = {
  workout: ActiveWorkout | null;
  exercises: ExerciseDefinition[];
  folders: WorkoutFolder[];
  templates: WorkoutTemplate[];
  incompleteWorkouts: IncompleteWorkout[];
  completedWorkouts: CompletedWorkout[];
  deletedWorkouts: DeletedWorkout[];
  completedSetCount: number;
  totalSetCount: number;
  persistenceStatus: PersistenceStatus;
  lastSavedAt: number | null;
  restTimerSettings: RestTimerSettings;
  preferences: AppPreferences;
  createExercise: (input: CreateExerciseInput) => ExerciseDefinition;
  updateExercise: (input: UpdateExerciseInput) => ExerciseDefinition | null;
  setExerciseArchived: (exerciseId: string, archived: boolean) => void;
  toggleExerciseFavorite: (exerciseId: string) => void;
  deleteExercise: (exerciseId: string) => boolean;
  getExerciseUsage: (exerciseId: string) => ExerciseUsage;
  createFolder: (name: string) => WorkoutFolder | null;
  renameFolder: (folderId: string, name: string) => boolean;
  deleteFolder: (folderId: string) => boolean;
  moveFolder: (folderId: string, direction: MoveDirection) => void;
  setFolderArchived: (folderId: string, archived: boolean) => void;
  createTemplate: (input: CreateTemplateInput) => WorkoutTemplate;
  updateTemplate: (input: UpdateTemplateInput) => WorkoutTemplate | null;
  duplicateTemplate: (templateId: string) => WorkoutTemplate | null;
  moveTemplate: (templateId: string, direction: MoveDirection) => void;
  moveTemplateToFolder: (templateId: string, folderName: string) => boolean;
  setTemplateArchived: (templateId: string, archived: boolean) => void;
  deleteTemplate: (templateId: string) => boolean;
  startWorkout: (name: string, templateId?: string) => boolean;
  toggleSet: (exerciseId: string, setId: string) => void;
  setSetType: (exerciseId: string, setId: string, setType: WorkoutSetType) => void;
  toggleSetType: (exerciseId: string, setId: string) => void;
  updateSetValue: (exerciseId: string, setId: string, field: SetValueField, value: number | undefined) => void;
  updateSetEffort: (exerciseId: string, setId: string, mode: EffortMode | null, value?: number) => void;
  copyPreviousSet: (exerciseId: string, setId: string) => void;
  addSet: (exerciseId: string) => void;
  removeSet: (exerciseId: string, setId: string) => void;
  moveSet: (exerciseId: string, setId: string, direction: MoveDirection) => void;
  addExercise: (exerciseId: string) => void;
  removeExercise: (exerciseId: string) => void;
  moveExercise: (exerciseId: string, direction: MoveDirection) => void;
  replaceExercise: (workoutExerciseId: string, exerciseDefinitionId: string) => void;
  createSuperset: (exerciseId: string, partnerExerciseId: string) => boolean;
  removeFromSuperset: (exerciseId: string) => void;
  updateExerciseNotes: (exerciseId: string, notes: string) => void;
  updateWorkoutNotes: (notes: string) => void;
  updateWorkoutName: (name: string) => void;
  updateWorkoutExerciseRestSeconds: (exerciseId: string, seconds: number) => void;
  updateRestTimerSettings: (settings: Partial<RestTimerSettings>) => void;
  updatePreferences: (preferences: Partial<AppPreferences>) => void;
  setRestTimer: (seconds: number, sourceExerciseId?: string) => void;
  adjustRestTimer: (deltaSeconds: number) => void;
  pauseRestTimer: () => void;
  resumeRestTimer: () => void;
  restartRestTimer: () => void;
  clearRestTimer: () => void;
  acknowledgeRestTimerComplete: () => void;
  finishWorkout: (options?: FinishWorkoutOptions) => void;
  saveWorkoutForLater: () => boolean;
  resumeIncompleteWorkout: (workoutId: string) => boolean;
  deleteIncompleteWorkout: (workoutId: string) => boolean;
  discardWorkout: () => void;
  createManualWorkout: (input: CreateManualWorkoutInput) => CompletedWorkout | null;
  updateCompletedWorkout: (workout: CompletedWorkout) => void;
  deleteCompletedWorkout: (workoutId: string) => boolean;
  restoreDeletedWorkout: (workoutId: string) => boolean;
  permanentlyDeleteWorkout: (workoutId: string) => boolean;
  repeatCompletedWorkout: (workoutId: string) => boolean;
  saveCompletedWorkoutAsTemplate: (workoutId: string) => WorkoutTemplate | null;
  getStateSnapshot: () => LiftFlowStateSnapshot;
  restoreState: (snapshot: LiftFlowStateSnapshot) => Promise<void>;
};

const ActiveWorkoutContext = createContext<ActiveWorkoutContextValue | null>(null);

const createTemplateSet = (id: string, weight?: number, reps?: number): WorkoutSet => ({
  id,
  weight,
  reps,
  setType: 'normal',
  completed: false,
});

const initialTemplates: WorkoutTemplate[] = [
  {
    id: 'upper-a',
    name: 'Upper A',
    folder: 'Upper / Lower',
    detail: '2 exercises · 6 planned sets',
    exercises: [
      {
        id: 'bench-press',
        exerciseDefinitionId: 'bench-press',
        name: 'Bench Press',
        exerciseType: 'Weight & Reps',
        sets: [
          createTemplateSet('upper-a-bench-1', 185, 6),
          createTemplateSet('upper-a-bench-2', 185, 5),
          createTemplateSet('upper-a-bench-3', 175, 8),
        ],
      },
      {
        id: 'barbell-row',
        exerciseDefinitionId: 'barbell-row',
        name: 'Barbell Row',
        exerciseType: 'Weight & Reps',
        sets: [
          createTemplateSet('upper-a-row-1', 165, 8),
          createTemplateSet('upper-a-row-2', 165, 8),
          createTemplateSet('upper-a-row-3', 155, 10),
        ],
      },
    ],
  },
  {
    id: 'lower-a',
    name: 'Lower A',
    folder: 'Upper / Lower',
    detail: '1 exercise · 3 planned sets',
    exercises: [
      {
        id: 'leg-press',
        exerciseDefinitionId: 'leg-press',
        name: 'Leg Press',
        exerciseType: 'Weight & Reps',
        sets: [
          createTemplateSet('lower-a-leg-1', 410, 10),
          createTemplateSet('lower-a-leg-2', 410, 10),
          createTemplateSet('lower-a-leg-3', 390, 12),
        ],
      },
    ],
  },
  {
    id: 'upper-b',
    name: 'Upper B',
    folder: 'Upper / Lower',
    detail: '1 exercise · 3 planned sets',
    exercises: [
      {
        id: 'incline-dumbbell-press',
        exerciseDefinitionId: 'incline-dumbbell-press',
        name: 'Incline Dumbbell Press',
        exerciseType: 'Weight & Reps',
        sets: [
          createTemplateSet('upper-b-incline-1', 65, 10),
          createTemplateSet('upper-b-incline-2', 65, 9),
          createTemplateSet('upper-b-incline-3', 60, 12),
        ],
      },
    ],
  },
  {
    id: 'lower-b',
    name: 'Lower B',
    folder: 'Upper / Lower',
    detail: '1 exercise · 3 planned sets',
    exercises: [
      {
        id: 'romanian-deadlift',
        exerciseDefinitionId: 'romanian-deadlift',
        name: 'Romanian Deadlift',
        exerciseType: 'Weight & Reps',
        sets: [
          createTemplateSet('lower-b-rdl-1', 185, 8),
          createTemplateSet('lower-b-rdl-2', 185, 8),
          createTemplateSet('lower-b-rdl-3', 175, 10),
        ],
      },
    ],
  },
  {
    id: 'push',
    name: 'Push',
    folder: 'Push Pull Legs',
    detail: '1 exercise · 3 planned sets',
    exercises: [
      {
        id: 'push-bench-press',
        exerciseDefinitionId: 'bench-press',
        name: 'Bench Press',
        exerciseType: 'Weight & Reps',
        sets: [
          createTemplateSet('push-bench-1', 185, 6),
          createTemplateSet('push-bench-2', 185, 5),
          createTemplateSet('push-bench-3', 175, 8),
        ],
      },
    ],
  },
  {
    id: 'pull',
    name: 'Pull',
    folder: 'Push Pull Legs',
    detail: '1 exercise · 3 planned sets',
    exercises: [
      {
        id: 'lat-pulldown',
        exerciseDefinitionId: 'lat-pulldown',
        name: 'Lat Pulldown',
        exerciseType: 'Weight & Reps',
        sets: [
          createTemplateSet('pull-lat-1', 150, 10),
          createTemplateSet('pull-lat-2', 150, 9),
          createTemplateSet('pull-lat-3', 140, 12),
        ],
      },
    ],
  },
  {
    id: 'legs',
    name: 'Legs',
    folder: 'Push Pull Legs',
    detail: '1 exercise · 3 planned sets',
    exercises: [
      {
        id: 'legs-leg-press',
        exerciseDefinitionId: 'leg-press',
        name: 'Leg Press',
        exerciseType: 'Weight & Reps',
        sets: [
          createTemplateSet('legs-leg-1', 410, 10),
          createTemplateSet('legs-leg-2', 410, 10),
          createTemplateSet('legs-leg-3', 390, 12),
        ],
      },
    ],
  },
];


const DEFAULT_REST_TIMER_SETTINGS: RestTimerSettings = {
  defaultSeconds: 120,
  autoStart: true,
  vibrationEnabled: true,
  notificationsEnabled: false,
};

const DEFAULT_PREFERENCES: AppPreferences = {
  weeklyWorkoutGoal: 3,
  weightUnit: 'lb',
  distanceUnit: 'mi',
  preferredEffort: 'rpe',
};

const initialFolders: WorkoutFolder[] = [
  { id: 'upper-lower', name: 'Upper / Lower' },
  { id: 'push-pull-legs', name: 'Push Pull Legs' },
];

const cloneExercises = (exercises: WorkoutExercise[]): WorkoutExercise[] =>
  exercises.map((exercise) => ({
    ...exercise,
    sets: exercise.sets.map((set) => ({ ...set })),
  }));

const cloneTemplateExercises = (template: WorkoutTemplate): WorkoutExercise[] => {
  const supersetIds = new Map<string, string>();
  return template.exercises.map((exercise, exerciseIndex) => ({
    ...exercise,
    exerciseType: normalizeExerciseType(exercise.exerciseType),
    id: createUuid(),
    supersetId: exercise.supersetId
      ? supersetIds.get(exercise.supersetId) ?? (() => {
          const id = createUuid();
          supersetIds.set(exercise.supersetId as string, id);
          return id;
        })()
      : undefined,
    sets: exercise.sets.map((set, index) => ({
      id: createUuid(),
      ...copyMetricValues(set),
      rpe: set.rpe,
      rir: set.rir,
      setType: set.setType ?? 'normal',
      completed: false,
    })),
  }));
};

function createSetFromDefinition(definition: ExerciseDefinition, id: string): WorkoutSet {
  return {
    id,
    ...defaultMetricsForExercise(definition),
    setType: 'normal',
    completed: false,
  };
}

function createWorkoutSetFromDefinition(definition: ExerciseDefinition, id: string): WorkoutSet {
  const defaults = defaultMetricsForExercise(definition);
  return {
    id,
    ...copyMetricValues(defaults),
    setType: 'normal',
    completed: false,
  };
}

function canonicalFolderName(folders: WorkoutFolder[], requested: string) {
  const trimmed = requested.trim();
  if (!trimmed) return '';
  return folders.find((folder) => folder.name.toLowerCase() === trimmed.toLowerCase())?.name ?? trimmed;
}

function getTemplateDetail(exercises: WorkoutExercise[]) {
  const setCount = exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
  return `${exercises.length} exercise${exercises.length === 1 ? '' : 's'} · ${setCount} planned sets`;
}

function moveItem<T>(items: T[], index: number, direction: MoveDirection) {
  const target = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= items.length) return items;
  const copy = [...items];
  [copy[index], copy[target]] = [copy[target], copy[index]];
  return copy;
}

function normalizeSupersetMembers(exercises: WorkoutExercise[]): WorkoutExercise[] {
  const memberCounts = new Map<string, number>();
  exercises.forEach((exercise) => {
    if (exercise.supersetId) {
      memberCounts.set(exercise.supersetId, (memberCounts.get(exercise.supersetId) ?? 0) + 1);
    }
  });
  return exercises.map((exercise) =>
    exercise.supersetId && (memberCounts.get(exercise.supersetId) ?? 0) < 2
      ? { ...exercise, supersetId: undefined }
      : exercise,
  );
}

export function ActiveWorkoutProvider({ children }: PropsWithChildren) {
  const [workout, setWorkout] = useState<ActiveWorkout | null>(null);
  const [exercises, setExercises] = useState<ExerciseDefinition[]>(exerciseLibrary);
  // New installs start without demo routines. Existing users hydrate their saved
  // folders and templates from SQLite, so upgrading never removes real data.
  const [folders, setFolders] = useState<WorkoutFolder[]>([]);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [incompleteWorkouts, setIncompleteWorkouts] = useState<IncompleteWorkout[]>([]);
  const [completedWorkouts, setCompletedWorkouts] = useState<CompletedWorkout[]>([]);
  const [deletedWorkouts, setDeletedWorkouts] = useState<DeletedWorkout[]>([]);
  const [restTimerSettings, setRestTimerSettings] = useState<RestTimerSettings>(DEFAULT_REST_TIMER_SETTINGS);
  const [preferences, setPreferences] = useState<AppPreferences>(DEFAULT_PREFERENCES);
  const [isHydrated, setIsHydrated] = useState(false);
  const [persistenceStatus, setPersistenceStatus] = useState<PersistenceStatus>('loading');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextAutomaticSaveRef = useRef(false);
  const restNotificationIdRef = useRef<string | undefined>(undefined);
  const restTimerGenerationRef = useRef(0);
  const latestSnapshotRef = useRef<LiftFlowStateSnapshot | null>(null);

  useEffect(() => {
    void configureRestTimerAlerts();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      try {
        const savedState = await loadLiftFlowState();
        if (cancelled) return;
        if (savedState) {
          setExercises(savedState.exercises);
          setFolders(savedState.folders);
          setTemplates(savedState.templates);
          setWorkout(savedState.activeWorkout);
          setIncompleteWorkouts(savedState.incompleteWorkouts);
          setCompletedWorkouts(savedState.completedWorkouts);
          setDeletedWorkouts(savedState.deletedWorkouts);
          setRestTimerSettings(savedState.restTimerSettings);
          setPreferences(savedState.preferences);
          restNotificationIdRef.current = savedState.activeWorkout?.restTimerNotificationId;
        }
        setPersistenceStatus('saved');
        setLastSavedAt(Date.now());
      } catch (error) {
        console.error('Unable to load LiftFlow local data.', error);
        if (!cancelled) setPersistenceStatus('error');
      } finally {
        if (!cancelled) setIsHydrated(true);
      }
    };
    void hydrate();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const endsAt = workout?.restTimerEndsAt;
    if (!endsAt) return;
    const finishTimer = () => {
      restTimerGenerationRef.current += 1;
      void signalRestTimerComplete(restTimerSettings.vibrationEnabled);
      restNotificationIdRef.current = undefined;
      setWorkout((current) => current?.restTimerEndsAt ? {
        ...current,
        restTimerEndsAt: undefined,
        restTimerPausedSeconds: undefined,
        restTimerCompletedAt: Date.now(),
        restTimerNotificationId: undefined,
      } : current);
    };
    const remainingMs = endsAt - Date.now();
    if (remainingMs <= 0) {
      finishTimer();
      return;
    }
    const timer = setTimeout(finishTimer, remainingMs);
    return () => clearTimeout(timer);
  }, [restTimerSettings.vibrationEnabled, workout?.restTimerEndsAt]);

  useEffect(() => {
    if (!isHydrated) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (skipNextAutomaticSaveRef.current) {
      skipNextAutomaticSaveRef.current = false;
      setPersistenceStatus('saved');
      return;
    }
    setPersistenceStatus('saving');
    saveTimerRef.current = setTimeout(() => {
      void saveLiftFlowState({ exercises, folders, templates, activeWorkout: workout, incompleteWorkouts, completedWorkouts, deletedWorkouts, restTimerSettings, preferences })
        .then(() => { setPersistenceStatus('saved'); setLastSavedAt(Date.now()); })
        .catch((error: unknown) => {
          console.error('Unable to save LiftFlow local data.', error);
          setPersistenceStatus('error');
        });
    }, 150);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [completedWorkouts, deletedWorkouts, exercises, folders, incompleteWorkouts, isHydrated, preferences, restTimerSettings, templates, workout]);

  useEffect(() => {
    latestSnapshotRef.current = {
      exercises,
      folders,
      templates,
      activeWorkout: workout,
      incompleteWorkouts,
      completedWorkouts,
      deletedWorkouts,
      restTimerSettings,
      preferences,
    };
  }, [completedWorkouts, deletedWorkouts, exercises, folders, incompleteWorkouts, preferences, restTimerSettings, templates, workout]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' || !isHydrated || !latestSnapshotRef.current) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      setPersistenceStatus('saving');
      void saveLiftFlowState(latestSnapshotRef.current)
        .then(() => { setPersistenceStatus('saved'); setLastSavedAt(Date.now()); })
        .catch((error: unknown) => {
          console.error('Unable to checkpoint LiftFlow before backgrounding.', error);
          setPersistenceStatus('error');
        });
    });
    return () => subscription.remove();
  }, [isHydrated]);

  const createExercise = useCallback((input: CreateExerciseInput) => {
    const trimmedName = input.name.trim();
    const exerciseType = normalizeExerciseType(input.exerciseType);
    const exercise: ExerciseDefinition = {
      id: createUuid(),
      name: trimmedName,
      detail: `${input.primaryMuscle.trim()} · ${input.equipment.trim()}`,
      primaryMuscle: input.primaryMuscle.trim(),
      equipment: input.equipment.trim(),
      exerciseType,
      defaultWeight: exerciseTypeUsesWeight(exerciseType) ? input.defaultWeight : undefined,
      defaultReps: exerciseTypeUsesReps(exerciseType) ? input.defaultReps ?? 8 : undefined,
      defaultDurationSeconds: exerciseTypeUsesDuration(exerciseType)
        ? input.defaultDurationSeconds ?? 60
        : undefined,
      defaultDistance: exerciseTypeUsesDistance(exerciseType)
        ? input.defaultDistance
        : undefined,
      defaultRestSeconds: input.defaultRestSeconds ?? restTimerSettings.defaultSeconds,
      instructions: input.instructions?.trim() || undefined,
      isCustom: true,
    };
    setExercises((current) => [...current, exercise]);
    return exercise;
  }, [restTimerSettings.defaultSeconds]);

  const updateExercise = useCallback((input: UpdateExerciseInput) => {
    const existing = exercises.find((exercise) => exercise.id === input.id);
    if (!existing?.isCustom) return null;
    const trimmedName = input.name.trim();
    const oldName = existing.name;
    const renamed = trimmedName !== oldName;
    const exerciseType = normalizeExerciseType(input.exerciseType);
    const previousNames = renamed
      ? Array.from(new Set([...(existing.previousNames ?? []), oldName]))
      : existing.previousNames;
    const updated: ExerciseDefinition = {
      ...existing,
      name: trimmedName,
      detail: `${input.primaryMuscle.trim()} · ${input.equipment.trim()}`,
      primaryMuscle: input.primaryMuscle.trim(),
      equipment: input.equipment.trim(),
      exerciseType,
      defaultWeight: exerciseTypeUsesWeight(exerciseType) ? input.defaultWeight : undefined,
      defaultReps: exerciseTypeUsesReps(exerciseType) ? input.defaultReps ?? 8 : undefined,
      defaultDurationSeconds: exerciseTypeUsesDuration(exerciseType)
        ? input.defaultDurationSeconds ?? 60
        : undefined,
      defaultDistance: exerciseTypeUsesDistance(exerciseType)
        ? input.defaultDistance
        : undefined,
      defaultRestSeconds: input.defaultRestSeconds ?? existing.defaultRestSeconds ?? restTimerSettings.defaultSeconds,
      instructions: input.instructions?.trim() || undefined,
      previousNames,
    };
    setExercises((current) => current.map((exercise) => exercise.id === input.id ? updated : exercise));

    const matchesExercise = (exercise: WorkoutExercise) =>
      exercise.exerciseDefinitionId === input.id || exercise.name === oldName;
    const updateWorkoutDefinition = (exercise: WorkoutExercise): WorkoutExercise =>
      matchesExercise(exercise)
        ? {
            ...exercise,
            exerciseDefinitionId: input.id,
            name: trimmedName,
            exerciseType,
            restSeconds: updated.defaultRestSeconds,
            sets: exercise.sets.map((set) => clearIrrelevantMetrics(set, exerciseType)),
          }
        : exercise;

    setTemplates((current) => current.map((template) => ({
      ...template,
      exercises: template.exercises.map(updateWorkoutDefinition),
    })));
    setWorkout((current) => current ? {
      ...current,
      exercises: current.exercises.map(updateWorkoutDefinition),
    } : current);
    return updated;
  }, [exercises, restTimerSettings.defaultSeconds]);

  const getExerciseUsage = useCallback((exerciseId: string): ExerciseUsage => {
    const definition = exercises.find((exercise) => exercise.id === exerciseId);
    if (!definition) return { templates: 0, completedWorkouts: 0, activeWorkout: false };
    const names = new Set([definition.name, ...(definition.previousNames ?? [])].map((name) => name.trim().toLowerCase()));
    const matches = (name: string) => names.has(name.trim().toLowerCase());
    return {
      templates: templates.filter((template) => template.exercises.some((exercise) => matches(exercise.name))).length,
      completedWorkouts: completedWorkouts.filter((item) => item.exercises.some((exercise) => matches(exercise.name))).length,
      activeWorkout: Boolean(workout?.exercises.some((exercise) => matches(exercise.name))),
    };
  }, [completedWorkouts, exercises, templates, workout]);

  const setExerciseArchived = useCallback((exerciseId: string, archived: boolean) => {
    setExercises((current) => current.map((exercise) => exercise.id === exerciseId && exercise.isCustom ? { ...exercise, archived } : exercise));
  }, []);

  const toggleExerciseFavorite = useCallback((exerciseId: string) => {
    setExercises((current) => current.map((exercise) =>
      exercise.id === exerciseId ? { ...exercise, favorite: !exercise.favorite } : exercise,
    ));
  }, []);

  const deleteExercise = useCallback((exerciseId: string) => {
    const definition = exercises.find((exercise) => exercise.id === exerciseId);
    if (!definition?.isCustom || !definition.archived) return false;
    const usage = getExerciseUsage(exerciseId);
    if (usage.templates > 0 || usage.completedWorkouts > 0 || usage.activeWorkout) return false;
    setExercises((current) => current.filter((exercise) => exercise.id !== exerciseId));
    return true;
  }, [exercises, getExerciseUsage]);

  const createFolder = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    if (folders.some((folder) => folder.name.toLowerCase() === trimmed.toLowerCase())) return null;
    const folder: WorkoutFolder = { id: createUuid(), name: trimmed };
    setFolders((current) => [...current, folder]);
    return folder;
  }, [folders]);

  const renameFolder = useCallback((folderId: string, name: string) => {
    const trimmed = name.trim();
    const existing = folders.find((folder) => folder.id === folderId);
    if (!existing || !trimmed) return false;
    if (folders.some((folder) => folder.id !== folderId && folder.name.toLowerCase() === trimmed.toLowerCase())) return false;
    setFolders((current) => current.map((folder) => folder.id === folderId ? { ...folder, name: trimmed } : folder));
    setTemplates((current) => current.map((template) => template.folder === existing.name ? { ...template, folder: trimmed } : template));
    return true;
  }, [folders]);

  const deleteFolder = useCallback((folderId: string) => {
    const folder = folders.find((item) => item.id === folderId);
    if (!folder || templates.some((template) => template.folder === folder.name)) return false;
    setFolders((current) => current.filter((item) => item.id !== folderId));
    return true;
  }, [folders, templates]);

  const moveFolder = useCallback((folderId: string, direction: MoveDirection) => {
    setFolders((current) => {
      const source = current.find((folder) => folder.id === folderId);
      if (!source) return current;
      const peers = current.filter((folder) => Boolean(folder.archived) === Boolean(source.archived));
      const peerIndex = peers.findIndex((folder) => folder.id === folderId);
      const targetPeerIndex = direction === 'up' ? peerIndex - 1 : peerIndex + 1;
      if (targetPeerIndex < 0 || targetPeerIndex >= peers.length) return current;
      const sourceIndex = current.findIndex((folder) => folder.id === folderId);
      const targetIndex = current.findIndex((folder) => folder.id === peers[targetPeerIndex].id);
      const next = [...current];
      [next[sourceIndex], next[targetIndex]] = [next[targetIndex], next[sourceIndex]];
      return next;
    });
  }, []);

  const setFolderArchived = useCallback((folderId: string, archived: boolean) => {
    setFolders((current) => current.map((folder) =>
      folder.id === folderId ? { ...folder, archived } : folder,
    ));
  }, []);

  const createTemplate = useCallback((input: CreateTemplateInput) => {
    const templateId = createUuid();
    const selected = input.exerciseIds
      .map((id) => exercises.find((item) => item.id === id))
      .filter((item): item is ExerciseDefinition => Boolean(item && !item.archived));
    const safeSetCount = Math.min(10, Math.max(1, Math.round(input.setCount)));
    const templateExercises = selected.map((definition) => ({
      id: createUuid(),
      exerciseDefinitionId: definition.id,
      name: definition.name,
      exerciseType: normalizeExerciseType(definition.exerciseType),
      restSeconds: definition.defaultRestSeconds ?? restTimerSettings.defaultSeconds,
      notes: '',
      sets: Array.from({ length: safeSetCount }, (_, index) =>
        createSetFromDefinition(definition, createUuid()),
      ),
    }));
    const template: WorkoutTemplate = {
      id: templateId,
      name: input.name.trim(),
      folder: canonicalFolderName(folders, input.folder),
      detail: getTemplateDetail(templateExercises),
      exercises: templateExercises,
    };
    setFolders((current) => {
      if (!template.folder) return current;
      const existing = current.find((folder) => folder.name.toLowerCase() === template.folder.toLowerCase());
      if (!existing) return [...current, { id: createUuid(), name: template.folder }];
      return existing.archived
        ? current.map((folder) => folder.id === existing.id ? { ...folder, archived: false } : folder)
        : current;
    });
    setTemplates((current) => [...current, template]);
    return template;
  }, [exercises, folders, restTimerSettings.defaultSeconds]);

  const updateTemplate = useCallback((input: UpdateTemplateInput) => {
    const name = input.name.trim();
    if (!name || input.exercises.length === 0) return null;
    const normalized = normalizeSupersetMembers(input.exercises.map((exercise, exerciseIndex) => {
      const exerciseType = normalizeExerciseType(exercise.exerciseType);
      return {
        ...exercise,
        exerciseType,
        id: exercise.id || `${input.id}-exercise-${exerciseIndex + 1}`,
        sets: exercise.sets.map((set, setIndex) => ({
          ...clearIrrelevantMetrics(set, exerciseType),
          id: set.id || `${input.id}-${exercise.id || exerciseIndex + 1}-set-${setIndex + 1}`,
          completed: false,
          setType: set.setType ?? 'normal',
        })),
      };
    }));
    const updated: WorkoutTemplate = { id: input.id, name, folder: canonicalFolderName(folders, input.folder), detail: getTemplateDetail(normalized), exercises: normalized };
    setFolders((current) => {
      if (!updated.folder) return current;
      const existing = current.find((folder) => folder.name.toLowerCase() === updated.folder.toLowerCase());
      if (!existing) return [...current, { id: createUuid(), name: updated.folder }];
      return existing.archived
        ? current.map((folder) => folder.id === existing.id ? { ...folder, archived: false } : folder)
        : current;
    });
    setTemplates((current) => current.map((template) => template.id === input.id ? { ...updated, archived: template.archived } : template));
    return updated;
  }, [folders]);

  const duplicateTemplate = useCallback((templateId: string) => {
    const source = templates.find((template) => template.id === templateId);
    if (!source) return null;
    const duplicate: WorkoutTemplate = {
      ...source,
      id: createUuid(),
      name: `${source.name} Copy`,
      archived: false,
      exercises: source.exercises.map((exercise, exerciseIndex) => ({
        ...exercise,
        id: createUuid(),
        sets: exercise.sets.map((set, setIndex) => ({
          ...set,
          id: createUuid(),
          completed: false,
        })),
      })),
    };
    setTemplates((current) => {
      const sourceIndex = current.findIndex((template) => template.id === templateId);
      const next = [...current];
      next.splice(sourceIndex + 1, 0, duplicate);
      return next;
    });
    return duplicate;
  }, [templates]);

  const moveTemplate = useCallback((templateId: string, direction: MoveDirection) => {
    setTemplates((current) => {
      const source = current.find((template) => template.id === templateId);
      if (!source) return current;
      const peers = current.filter((template) => template.folder === source.folder && Boolean(template.archived) === Boolean(source.archived));
      const peerIndex = peers.findIndex((template) => template.id === templateId);
      const targetPeerIndex = direction === 'up' ? peerIndex - 1 : peerIndex + 1;
      if (targetPeerIndex < 0 || targetPeerIndex >= peers.length) return current;
      const targetId = peers[targetPeerIndex].id;
      const sourceIndex = current.findIndex((template) => template.id === templateId);
      const targetIndex = current.findIndex((template) => template.id === targetId);
      const next = [...current];
      [next[sourceIndex], next[targetIndex]] = [next[targetIndex], next[sourceIndex]];
      return next;
    });
  }, []);

  const moveTemplateToFolder = useCallback((templateId: string, folderName: string) => {
    const trimmed = folderName.trim();
    if (!templates.some((template) => template.id === templateId)) return false;
    const targetName = canonicalFolderName(folders, trimmed);
    setFolders((current) => {
      if (!targetName) return current;
      const existing = current.find((folder) => folder.name.toLowerCase() === targetName.toLowerCase());
      if (!existing) return [...current, { id: createUuid(), name: targetName }];
      return existing.archived
        ? current.map((folder) => folder.id === existing.id ? { ...folder, archived: false } : folder)
        : current;
    });
    setTemplates((current) => current.map((template) => template.id === templateId ? { ...template, folder: targetName } : template));
    return true;
  }, [folders, templates]);

  const setTemplateArchived = useCallback((templateId: string, archived: boolean) => {
    setTemplates((current) => current.map((template) => template.id === templateId ? { ...template, archived } : template));
  }, []);

  const deleteTemplate = useCallback((templateId: string) => {
    if (!templates.some((template) => template.id === templateId)) return false;
    setTemplates((current) => current.filter((template) => template.id !== templateId));
    return true;
  }, [templates]);

  const startWorkout = useCallback((name: string, templateId?: string) => {
    if (workout) return false;
    const template = templateId ? templates.find((candidate) => candidate.id === templateId) : undefined;
    const stamp = Date.now();
    const workoutExercises = template
      ? applyPreviousPerformance(cloneTemplateExercises(template), completedWorkouts)
      : [];
    setWorkout({ id: createUuid(), name, startedAt: stamp, sourceTemplateId: template?.id, notes: '', exercises: workoutExercises });
    return true;
  }, [completedWorkouts, templates, workout]);

  const updateWorkoutExercise = useCallback((exerciseId: string, updater: (exercise: WorkoutExercise) => WorkoutExercise) => {
    setWorkout((current) => current ? { ...current, exercises: current.exercises.map((exercise) => exercise.id === exerciseId ? updater(exercise) : exercise) } : current);
  }, []);

  const toggleSet = useCallback((exerciseId: string, setId: string) => updateWorkoutExercise(exerciseId, (exercise) => ({ ...exercise, sets: exercise.sets.map((set) => set.id === setId ? { ...set, completed: !set.completed } : set) })), [updateWorkoutExercise]);
  const setSetType = useCallback((exerciseId: string, setId: string, setType: WorkoutSetType) => updateWorkoutExercise(exerciseId, (exercise) => ({ ...exercise, sets: exercise.sets.map((set) => set.id === setId ? { ...set, setType } : set) })), [updateWorkoutExercise]);
  const toggleSetType = useCallback((exerciseId: string, setId: string) => updateWorkoutExercise(exerciseId, (exercise) => ({ ...exercise, sets: exercise.sets.map((set) => set.id === setId ? { ...set, setType: (set.setType ?? 'normal') === 'warmup' ? 'normal' : 'warmup' } : set) })), [updateWorkoutExercise]);
  const updateSetValue = useCallback((exerciseId: string, setId: string, field: SetValueField, value: number | undefined) => updateWorkoutExercise(exerciseId, (exercise) => ({ ...exercise, sets: exercise.sets.map((set) => set.id === setId ? { ...set, [field]: value } : set) })), [updateWorkoutExercise]);
  const updateSetEffort = useCallback((exerciseId: string, setId: string, mode: EffortMode | null, value?: number) => updateWorkoutExercise(exerciseId, (exercise) => ({ ...exercise, sets: exercise.sets.map((set) => {
    if (set.id !== setId) return set;
    if (mode === null) return { ...set, rpe: undefined, rir: undefined };
    const safe = value === undefined ? undefined : Math.max(0, Math.min(mode === 'rpe' ? 10 : 10, value));
    return mode === 'rpe' ? { ...set, rpe: safe, rir: undefined } : { ...set, rir: safe, rpe: undefined };
  }) })), [updateWorkoutExercise]);
  const copyPreviousSet = useCallback((exerciseId: string, setId: string) => updateWorkoutExercise(exerciseId, (exercise) => ({
    ...exercise,
    sets: exercise.sets.map((set) => set.id === setId ? {
      ...set,
      weight: set.previousWeight ?? set.weight,
      reps: set.previousReps ?? set.reps,
      durationSeconds: set.previousDurationSeconds ?? set.durationSeconds,
      distance: set.previousDistance ?? set.distance,
    } : set),
  })), [updateWorkoutExercise]);

  const addSet = useCallback((exerciseId: string) => updateWorkoutExercise(exerciseId, (exercise) => {
    const last = exercise.sets.at(-1);
    const metrics = last
      ? copyMetricValues(last)
      : {};
    return {
      ...exercise,
      sets: [
        ...exercise.sets,
        clearIrrelevantMetrics<WorkoutSet>(
          {
            id: createUuid(),
            ...metrics,
            setType: 'normal',
            completed: false,
          },
          exercise.exerciseType,
        ),
      ],
    };
  }), [updateWorkoutExercise]);

  const removeSet = useCallback((exerciseId: string, setId: string) => updateWorkoutExercise(exerciseId, (exercise) => exercise.sets.length <= 1 ? exercise : { ...exercise, sets: exercise.sets.filter((set) => set.id !== setId) }), [updateWorkoutExercise]);
  const moveSet = useCallback((exerciseId: string, setId: string, direction: MoveDirection) => updateWorkoutExercise(exerciseId, (exercise) => ({ ...exercise, sets: moveItem(exercise.sets, exercise.sets.findIndex((set) => set.id === setId), direction) })), [updateWorkoutExercise]);

  const addExercise = useCallback((exerciseId: string) => {
    const definition = exercises.find((item) => item.id === exerciseId);
    if (!definition || definition.archived) return;
    setWorkout((current) => {
      if (!current || current.exercises.some((exercise) => exercise.name === definition.name)) return current;
      const addedExercise: WorkoutExercise = {
        id: createUuid(),
        exerciseDefinitionId: definition.id,
        name: definition.name,
        exerciseType: normalizeExerciseType(definition.exerciseType),
        restSeconds: definition.defaultRestSeconds ?? restTimerSettings.defaultSeconds,
        notes: '',
        sets: Array.from({ length: 3 }, (_, index) =>
          createWorkoutSetFromDefinition(definition, createUuid()),
        ),
      };
      return {
        ...current,
        exercises: [
          ...current.exercises,
          applyPreviousPerformance([addedExercise], completedWorkouts)[0],
        ],
      };
    });
  }, [completedWorkouts, exercises, restTimerSettings.defaultSeconds]);

  const removeExercise = useCallback((exerciseId: string) => setWorkout((current) => current ? {
    ...current,
    exercises: normalizeSupersetMembers(current.exercises.filter((exercise) => exercise.id !== exerciseId)),
  } : current), []);
  const moveExercise = useCallback((exerciseId: string, direction: MoveDirection) => setWorkout((current) => current ? { ...current, exercises: moveItem(current.exercises, current.exercises.findIndex((exercise) => exercise.id === exerciseId), direction) } : current), []);
  const updateExerciseNotes = useCallback((exerciseId: string, notes: string) => updateWorkoutExercise(exerciseId, (exercise) => ({ ...exercise, notes })), [updateWorkoutExercise]);

  const createSuperset = useCallback((exerciseId: string, partnerExerciseId: string) => {
    if (!workout || exerciseId === partnerExerciseId) return false;
    const first = workout.exercises.find((exercise) => exercise.id === exerciseId);
    const second = workout.exercises.find((exercise) => exercise.id === partnerExerciseId);
    if (!first || !second) return false;
    setWorkout((current) => {
      if (!current) return current;
      const targetGroup = first.supersetId ?? second.supersetId ?? createUuid();
      const mergedGroups = new Set([first.supersetId, second.supersetId].filter(Boolean));
      return {
        ...current,
        exercises: current.exercises.map((exercise) =>
          exercise.id === exerciseId || exercise.id === partnerExerciseId ||
          (exercise.supersetId && mergedGroups.has(exercise.supersetId))
            ? { ...exercise, supersetId: targetGroup }
            : exercise,
        ),
      };
    });
    return true;
  }, [workout]);

  const removeFromSuperset = useCallback((exerciseId: string) => {
    setWorkout((current) => {
      if (!current) return current;
      return {
        ...current,
        exercises: normalizeSupersetMembers(current.exercises.map((exercise) =>
          exercise.id === exerciseId ? { ...exercise, supersetId: undefined } : exercise,
        )),
      };
    });
  }, []);

  const replaceExercise = useCallback((workoutExerciseId: string, definitionId: string) => {
    const definition = exercises.find((item) => item.id === definitionId && !item.archived);
    if (!definition) return;
    updateWorkoutExercise(workoutExerciseId, (exercise) => {
      const replacement: WorkoutExercise = {
        ...exercise,
        id: createUuid(),
        exerciseDefinitionId: definition.id,
        name: definition.name,
        exerciseType: normalizeExerciseType(definition.exerciseType),
        restSeconds: definition.defaultRestSeconds ?? restTimerSettings.defaultSeconds,
        sets: exercise.sets.map((set, index) => ({
          ...createWorkoutSetFromDefinition(definition, createUuid()),
          setType: set.setType ?? 'normal',
          rpe: set.rpe,
          rir: set.rir,
        })),
      };
      return applyPreviousPerformance([replacement], completedWorkouts)[0];
    });
  }, [completedWorkouts, exercises, restTimerSettings.defaultSeconds, updateWorkoutExercise]);

  const updateWorkoutNotes = useCallback((notes: string) => setWorkout((current) => current ? { ...current, notes } : current), []);
  const updateWorkoutName = useCallback((name: string) => setWorkout((current) => current ? {
    ...current,
    name: name.slice(0, 80),
  } : current), []);
  const updateWorkoutExerciseRestSeconds = useCallback((exerciseId: string, seconds: number) => {
    const safeSeconds = Math.max(15, Math.min(3600, Math.round(seconds)));
    updateWorkoutExercise(exerciseId, (exercise) => ({ ...exercise, restSeconds: safeSeconds }));
  }, [updateWorkoutExercise]);
  const updateRestTimerSettings = useCallback((settings: Partial<RestTimerSettings>) => {
    if (settings.notificationsEnabled === false) {
      restTimerGenerationRef.current += 1;
      const notificationId = restNotificationIdRef.current ?? workout?.restTimerNotificationId;
      restNotificationIdRef.current = undefined;
      void cancelRestTimerAlert(notificationId);
      setWorkout((current) => current ? { ...current, restTimerNotificationId: undefined } : current);
    }
    setRestTimerSettings((current) => ({
      defaultSeconds: Math.max(15, Math.min(3600, Math.round(settings.defaultSeconds ?? current.defaultSeconds))),
      autoStart: settings.autoStart ?? current.autoStart,
      vibrationEnabled: settings.vibrationEnabled ?? current.vibrationEnabled,
      notificationsEnabled: settings.notificationsEnabled ?? current.notificationsEnabled,
    }));
  }, [workout?.restTimerNotificationId]);

  const updatePreferences = useCallback((updates: Partial<AppPreferences>) => {
    setPreferences((current) => ({
      weeklyWorkoutGoal: Math.max(
        1,
        Math.min(14, Math.round(updates.weeklyWorkoutGoal ?? current.weeklyWorkoutGoal)),
      ),
      weightUnit: updates.weightUnit === 'kg' || updates.weightUnit === 'lb'
        ? updates.weightUnit
        : current.weightUnit,
      distanceUnit: updates.distanceUnit === 'km' || updates.distanceUnit === 'mi'
        ? updates.distanceUnit
        : current.distanceUnit,
      preferredEffort:
        updates.preferredEffort === 'rpe' ||
        updates.preferredEffort === 'rir' ||
        updates.preferredEffort === 'none'
          ? updates.preferredEffort
          : current.preferredEffort,
    }));
  }, []);
  const scheduleTimer = useCallback((seconds: number, sourceExerciseId?: string, durationSeconds?: number) => {
    const safeSeconds = Math.max(1, Math.min(3600, Math.round(seconds)));
    const safeDuration = Math.max(1, Math.min(3600, Math.round(durationSeconds ?? safeSeconds)));
    const endsAt = Date.now() + safeSeconds * 1000;
    const generation = restTimerGenerationRef.current + 1;
    restTimerGenerationRef.current = generation;
    const previousNotificationId = restNotificationIdRef.current;
    restNotificationIdRef.current = undefined;
    setWorkout((current) => current ? {
      ...current,
      restTimerEndsAt: endsAt,
      restTimerDurationSeconds: safeDuration,
      restTimerPausedSeconds: undefined,
      restTimerSourceExerciseId: sourceExerciseId,
      restTimerCompletedAt: undefined,
      restTimerNotificationId: undefined,
    } : current);
    void cancelRestTimerAlert(previousNotificationId).then(async () => {
      if (!restTimerSettings.notificationsEnabled) return;
      const notificationId = await scheduleRestTimerAlert(safeSeconds);
      if (!notificationId) return;
      if (restTimerGenerationRef.current !== generation) {
        void cancelRestTimerAlert(notificationId);
        return;
      }
      restNotificationIdRef.current = notificationId;
      setWorkout((current) => current?.restTimerEndsAt === endsAt
        ? { ...current, restTimerNotificationId: notificationId }
        : current);
    });
  }, [restTimerSettings.notificationsEnabled]);
  const setRestTimer = useCallback((seconds: number, sourceExerciseId?: string) => {
    scheduleTimer(seconds, sourceExerciseId, seconds);
  }, [scheduleTimer]);
  const adjustRestTimer = useCallback((deltaSeconds: number) => {
    if (!workout) return;
    const paused = workout.restTimerPausedSeconds;
    const remaining = paused ?? (workout.restTimerEndsAt ? Math.max(0, Math.ceil((workout.restTimerEndsAt - Date.now()) / 1000)) : 0);
    const baseDuration = workout.restTimerDurationSeconds ?? remaining;
    const nextRemaining = Math.max(1, Math.min(3600, remaining + deltaSeconds));
    const nextDuration = Math.max(1, Math.min(3600, baseDuration + deltaSeconds));
    if (paused !== undefined) {
      setWorkout((current) => current ? {
        ...current,
        restTimerPausedSeconds: nextRemaining,
        restTimerDurationSeconds: nextDuration,
        restTimerCompletedAt: undefined,
      } : current);
      return;
    }
    scheduleTimer(nextRemaining, workout.restTimerSourceExerciseId, nextDuration);
  }, [scheduleTimer, workout]);
  const pauseRestTimer = useCallback(() => {
    if (!workout?.restTimerEndsAt) return;
    const remaining = Math.max(1, Math.ceil((workout.restTimerEndsAt - Date.now()) / 1000));
    restTimerGenerationRef.current += 1;
    const notificationId = restNotificationIdRef.current ?? workout.restTimerNotificationId;
    restNotificationIdRef.current = undefined;
    void cancelRestTimerAlert(notificationId);
    setWorkout((current) => current ? {
      ...current,
      restTimerEndsAt: undefined,
      restTimerPausedSeconds: remaining,
      restTimerNotificationId: undefined,
    } : current);
  }, [workout]);
  const resumeRestTimer = useCallback(() => {
    if (!workout) return;
    const seconds = workout.restTimerPausedSeconds ?? workout.restTimerDurationSeconds ?? restTimerSettings.defaultSeconds;
    const duration = workout.restTimerDurationSeconds ?? seconds;
    scheduleTimer(seconds, workout.restTimerSourceExerciseId, duration);
  }, [restTimerSettings.defaultSeconds, scheduleTimer, workout]);
  const restartRestTimer = useCallback(() => {
    if (!workout) return;
    const seconds = workout.restTimerDurationSeconds ?? restTimerSettings.defaultSeconds;
    scheduleTimer(seconds, workout.restTimerSourceExerciseId, seconds);
  }, [restTimerSettings.defaultSeconds, scheduleTimer, workout]);
  const clearRestTimer = useCallback(() => {
    restTimerGenerationRef.current += 1;
    const notificationId = restNotificationIdRef.current ?? workout?.restTimerNotificationId;
    restNotificationIdRef.current = undefined;
    void cancelRestTimerAlert(notificationId);
    setWorkout((current) => current ? {
      ...current,
      restTimerEndsAt: undefined,
      restTimerPausedSeconds: undefined,
      restTimerSourceExerciseId: undefined,
      restTimerCompletedAt: undefined,
      restTimerNotificationId: undefined,
    } : current);
  }, [workout?.restTimerNotificationId]);
  const acknowledgeRestTimerComplete = useCallback(() => setWorkout((current) => current ? { ...current, restTimerCompletedAt: undefined } : current), []);

  const finishWorkout = useCallback((options: FinishWorkoutOptions = {}) => {
    if (!workout) return;
    const sourceTemplate = workout.sourceTemplateId ? templates.find((template) => template.id === workout.sourceTemplateId) : undefined;
    const { restTimerEndsAt: _restTimerEndsAt, restTimerDurationSeconds: _restTimerDurationSeconds, restTimerPausedSeconds: _restTimerPausedSeconds, restTimerSourceExerciseId: _restTimerSourceExerciseId, restTimerCompletedAt: _restTimerCompletedAt, restTimerNotificationId: _restTimerNotificationId, ...workoutWithoutTimer } = workout;
    const completedWorkout: CompletedWorkout = { ...workoutWithoutTimer, completedAt: Date.now(), sourceFolder: sourceTemplate?.folder, exercises: cloneExercises(workout.exercises) };
    if (options.updateTemplate && workout.sourceTemplateId) {
      setTemplates((current) => current.map((template) => template.id !== workout.sourceTemplateId ? template : {
        ...template,
        detail: getTemplateDetail(workout.exercises),
        exercises: workout.exercises.map((exercise) => ({ ...exercise, sets: exercise.sets.map((set) => ({ ...set, id: createUuid(), previousWeight: undefined, previousReps: undefined, previousDurationSeconds: undefined, previousDistance: undefined, completed: false })) })),
      }));
    }
    restTimerGenerationRef.current += 1;
    void cancelRestTimerAlert(restNotificationIdRef.current ?? workout.restTimerNotificationId);
    restNotificationIdRef.current = undefined;
    setCompletedWorkouts((current) => [completedWorkout, ...current]);
    setWorkout(null);
  }, [templates, workout]);

  const saveWorkoutForLater = useCallback(() => {
    if (!workout) return false;
    const now = Date.now();
    const {
      restTimerEndsAt: _restTimerEndsAt,
      restTimerDurationSeconds: _restTimerDurationSeconds,
      restTimerPausedSeconds: _restTimerPausedSeconds,
      restTimerSourceExerciseId: _restTimerSourceExerciseId,
      restTimerCompletedAt: _restTimerCompletedAt,
      restTimerNotificationId: _restTimerNotificationId,
      ...workoutWithoutTimer
    } = workout;
    restTimerGenerationRef.current += 1;
    void cancelRestTimerAlert(restNotificationIdRef.current ?? workout.restTimerNotificationId);
    restNotificationIdRef.current = undefined;
    setIncompleteWorkouts((current) => [
      { ...workoutWithoutTimer, savedAt: now, exercises: cloneExercises(workout.exercises) },
      ...current.filter((item) => item.id !== workout.id),
    ]);
    setWorkout(null);
    return true;
  }, [workout]);

  const resumeIncompleteWorkout = useCallback((workoutId: string) => {
    if (workout) return false;
    const incomplete = incompleteWorkouts.find((item) => item.id === workoutId);
    if (!incomplete) return false;
    const { savedAt, ...savedWorkout } = incomplete;
    const pausedDuration = Math.max(0, Date.now() - savedAt);
    setWorkout({
      ...savedWorkout,
      startedAt: savedWorkout.startedAt + pausedDuration,
      exercises: cloneExercises(savedWorkout.exercises),
    });
    setIncompleteWorkouts((current) => current.filter((item) => item.id !== workoutId));
    return true;
  }, [incompleteWorkouts, workout]);

  const deleteIncompleteWorkout = useCallback((workoutId: string) => {
    if (!incompleteWorkouts.some((item) => item.id === workoutId)) return false;
    setIncompleteWorkouts((current) => current.filter((item) => item.id !== workoutId));
    return true;
  }, [incompleteWorkouts]);

  const discardWorkout = useCallback(() => {
    restTimerGenerationRef.current += 1;
    void cancelRestTimerAlert(restNotificationIdRef.current ?? workout?.restTimerNotificationId);
    restNotificationIdRef.current = undefined;
    setWorkout(null);
  }, [workout?.restTimerNotificationId]);

  const createManualWorkout = useCallback((input: CreateManualWorkoutInput) => {
    const name = input.name.trim();
    const startedAt = Math.max(0, Math.round(input.startedAt));
    const completedAt = Math.max(startedAt, Math.round(input.completedAt));
    if (!name || input.exercises.length === 0 || !Number.isFinite(startedAt) || !Number.isFinite(completedAt)) {
      return null;
    }
    const completedWorkout: CompletedWorkout = {
      id: createUuid(),
      name,
      startedAt,
      completedAt,
      notes: input.notes?.trim() ?? '',
      exercises: normalizeSupersetMembers(cloneExercises(input.exercises)),
    };
    setCompletedWorkouts((current) =>
      [completedWorkout, ...current].sort((left, right) => right.startedAt - left.startedAt),
    );
    return completedWorkout;
  }, []);
  const updateCompletedWorkout = useCallback((updated: CompletedWorkout) => setCompletedWorkouts((current) => current.map((item) => item.id === updated.id ? {
    ...updated,
    exercises: normalizeSupersetMembers(cloneExercises(updated.exercises)),
  } : item)), []);
  const deleteCompletedWorkout = useCallback((workoutId: string) => {
    const deleted = completedWorkouts.find((item) => item.id === workoutId);
    if (!deleted) return false;
    setDeletedWorkouts((current) => [{ ...deleted, deletedAt: Date.now() }, ...current]);
    setCompletedWorkouts((current) => current.filter((item) => item.id !== workoutId));
    return true;
  }, [completedWorkouts]);

  const restoreDeletedWorkout = useCallback((workoutId: string) => {
    const deleted = deletedWorkouts.find((item) => item.id === workoutId);
    if (!deleted) return false;
    const { deletedAt: _deletedAt, ...restored } = deleted;
    setCompletedWorkouts((current) =>
      [...current, restored].sort((left, right) => right.startedAt - left.startedAt),
    );
    setDeletedWorkouts((current) => current.filter((item) => item.id !== workoutId));
    return true;
  }, [deletedWorkouts]);

  const permanentlyDeleteWorkout = useCallback((workoutId: string) => {
    if (!deletedWorkouts.some((item) => item.id === workoutId)) return false;
    setDeletedWorkouts((current) => current.filter((item) => item.id !== workoutId));
    return true;
  }, [deletedWorkouts]);

  const repeatCompletedWorkout = useCallback((workoutId: string) => {
    if (workout) return false;
    const completed = completedWorkouts.find((item) => item.id === workoutId);
    if (!completed) return false;
    const stamp = Date.now();
    const repeatedExercises = completed.exercises.map((exercise, exerciseIndex) => ({
      ...exercise,
      id: createUuid(),
      sets: exercise.sets.map((set, setIndex) => ({
        ...set,
        id: createUuid(),
        ...copyMetricValues(set),
        completed: false,
      })),
    }));
    setWorkout({
      id: createUuid(),
      name: completed.name,
      startedAt: stamp,
      sourceTemplateId: completed.sourceTemplateId,
      notes: '',
      exercises: applyPreviousPerformance(repeatedExercises, [completed, ...completedWorkouts]),
    });
    return true;
  }, [completedWorkouts, workout]);

  const saveCompletedWorkoutAsTemplate = useCallback((workoutId: string) => {
    const completed = completedWorkouts.find((item) => item.id === workoutId);
    if (!completed) return null;
    const template: WorkoutTemplate = {
      id: createUuid(),
      name: `${completed.name} Copy`,
      folder: canonicalFolderName(folders, completed.sourceFolder || 'From History'),
      detail: getTemplateDetail(completed.exercises),
      exercises: completed.exercises.map((exercise) => ({ ...exercise, id: createUuid(), sets: exercise.sets.map((set) => ({ ...set, id: createUuid(), previousWeight: undefined, previousReps: undefined, previousDurationSeconds: undefined, previousDistance: undefined, completed: false })) })),
    };
    setFolders((current) => current.some((folder) => folder.name.toLowerCase() === template.folder.toLowerCase())
      ? current
      : [...current, { id: createUuid(), name: template.folder }]);
    setTemplates((current) => [...current, template]);
    return template;
  }, [completedWorkouts, folders]);

  const getStateSnapshot = useCallback((): LiftFlowStateSnapshot => ({ restTimerSettings: { ...restTimerSettings }, preferences: { ...preferences }, exercises: exercises.map((item) => ({ ...item })), folders: folders.map((item) => ({ ...item })), templates: templates.map((item) => ({ ...item, exercises: cloneExercises(item.exercises) })), activeWorkout: workout ? { ...workout, restTimerNotificationId: undefined, exercises: cloneExercises(workout.exercises) } : null, incompleteWorkouts: incompleteWorkouts.map((item) => ({ ...item, exercises: cloneExercises(item.exercises) })), completedWorkouts: completedWorkouts.map((item) => ({ ...item, exercises: cloneExercises(item.exercises) })), deletedWorkouts: deletedWorkouts.map((item) => ({ ...item, exercises: cloneExercises(item.exercises) })) }), [completedWorkouts, deletedWorkouts, exercises, folders, incompleteWorkouts, preferences, restTimerSettings, templates, workout]);

  const restoreState = useCallback(async (snapshot: LiftFlowStateSnapshot) => {
    restTimerGenerationRef.current += 1;
    void cancelRestTimerAlert(restNotificationIdRef.current ?? workout?.restTimerNotificationId);
    restNotificationIdRef.current = undefined;
    const safeActiveWorkout = snapshot.activeWorkout
      ? { ...snapshot.activeWorkout, restTimerNotificationId: undefined, exercises: cloneExercises(snapshot.activeWorkout.exercises) }
      : null;
    const safe: LiftFlowStateSnapshot = { restTimerSettings: { ...snapshot.restTimerSettings }, preferences: { ...snapshot.preferences }, exercises: snapshot.exercises.map((item) => ({ ...item })), folders: snapshot.folders.map((item) => ({ ...item })), templates: snapshot.templates.map((item) => ({ ...item, exercises: cloneExercises(item.exercises) })), activeWorkout: safeActiveWorkout, incompleteWorkouts: snapshot.incompleteWorkouts.map((item) => ({ ...item, exercises: cloneExercises(item.exercises) })), completedWorkouts: snapshot.completedWorkouts.map((item) => ({ ...item, exercises: cloneExercises(item.exercises) })), deletedWorkouts: snapshot.deletedWorkouts.map((item) => ({ ...item, exercises: cloneExercises(item.exercises) })) };
    await saveLiftFlowSafetyBackup({ restTimerSettings: { ...restTimerSettings }, preferences: { ...preferences }, exercises: exercises.map((item) => ({ ...item })), folders: folders.map((item) => ({ ...item })), templates: templates.map((item) => ({ ...item, exercises: cloneExercises(item.exercises) })), activeWorkout: workout ? { ...workout, restTimerNotificationId: undefined, exercises: cloneExercises(workout.exercises) } : null, incompleteWorkouts: incompleteWorkouts.map((item) => ({ ...item, exercises: cloneExercises(item.exercises) })), completedWorkouts: completedWorkouts.map((item) => ({ ...item, exercises: cloneExercises(item.exercises) })), deletedWorkouts: deletedWorkouts.map((item) => ({ ...item, exercises: cloneExercises(item.exercises) })) });
    await saveLiftFlowState(safe);
    skipNextAutomaticSaveRef.current = true;
    setExercises(safe.exercises);
    setFolders(safe.folders);
    setTemplates(safe.templates);
    setWorkout(safe.activeWorkout);
    setIncompleteWorkouts(safe.incompleteWorkouts);
    setCompletedWorkouts(safe.completedWorkouts);
    setDeletedWorkouts(safe.deletedWorkouts);
    setRestTimerSettings(safe.restTimerSettings);
    setPreferences(safe.preferences);
    setPersistenceStatus('saved');
    setLastSavedAt(Date.now());
  }, [completedWorkouts, deletedWorkouts, exercises, folders, incompleteWorkouts, preferences, restTimerSettings, templates, workout]);

  const { completedSetCount, totalSetCount } = useMemo(() => {
    const sets = workout?.exercises.flatMap((exercise) => exercise.sets) ?? [];
    return { completedSetCount: sets.filter((set) => set.completed).length, totalSetCount: sets.length };
  }, [workout]);

  const value = useMemo<ActiveWorkoutContextValue>(() => ({
    workout, exercises, folders, templates, incompleteWorkouts, completedWorkouts, deletedWorkouts, completedSetCount, totalSetCount, persistenceStatus, lastSavedAt, restTimerSettings, preferences,
    createExercise, updateExercise, setExerciseArchived, toggleExerciseFavorite, deleteExercise, getExerciseUsage,
    createFolder, renameFolder, deleteFolder, moveFolder, setFolderArchived,
    createTemplate, updateTemplate, duplicateTemplate, moveTemplate, moveTemplateToFolder, setTemplateArchived, deleteTemplate, startWorkout, toggleSet, setSetType, toggleSetType,
    updateSetValue, updateSetEffort, copyPreviousSet, addSet, removeSet, moveSet, addExercise,
    removeExercise, moveExercise, replaceExercise, createSuperset, removeFromSuperset, updateExerciseNotes, updateWorkoutNotes, updateWorkoutName,
    updateWorkoutExerciseRestSeconds, updateRestTimerSettings, updatePreferences, setRestTimer, adjustRestTimer, pauseRestTimer, resumeRestTimer, restartRestTimer, clearRestTimer, acknowledgeRestTimerComplete, finishWorkout, saveWorkoutForLater, resumeIncompleteWorkout, deleteIncompleteWorkout, discardWorkout, createManualWorkout, updateCompletedWorkout,
    deleteCompletedWorkout, restoreDeletedWorkout, permanentlyDeleteWorkout, repeatCompletedWorkout, saveCompletedWorkoutAsTemplate,
    getStateSnapshot, restoreState,
  }), [
    workout, exercises, folders, templates, incompleteWorkouts, completedWorkouts, deletedWorkouts, completedSetCount, totalSetCount, persistenceStatus, lastSavedAt, restTimerSettings, preferences,
    createExercise, updateExercise, setExerciseArchived, toggleExerciseFavorite, deleteExercise, getExerciseUsage,
    createFolder, renameFolder, deleteFolder, moveFolder, setFolderArchived,
    createTemplate, updateTemplate, duplicateTemplate, moveTemplate, moveTemplateToFolder, setTemplateArchived, deleteTemplate, startWorkout, toggleSet, setSetType, toggleSetType,
    updateSetValue, updateSetEffort, copyPreviousSet, addSet, removeSet, moveSet, addExercise,
    removeExercise, moveExercise, replaceExercise, createSuperset, removeFromSuperset, updateExerciseNotes, updateWorkoutNotes, updateWorkoutName,
    updateWorkoutExerciseRestSeconds, updateRestTimerSettings, updatePreferences, setRestTimer, adjustRestTimer, pauseRestTimer, resumeRestTimer, restartRestTimer, clearRestTimer, acknowledgeRestTimerComplete, finishWorkout, saveWorkoutForLater, resumeIncompleteWorkout, deleteIncompleteWorkout, discardWorkout, createManualWorkout, updateCompletedWorkout,
    deleteCompletedWorkout, restoreDeletedWorkout, permanentlyDeleteWorkout, repeatCompletedWorkout, saveCompletedWorkoutAsTemplate, getStateSnapshot, restoreState,
  ]);

  if (!isHydrated) return (
    <View style={styles.loadingScreen}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.loadingTitle}>Loading LiftFlow</Text>
      <Text style={styles.loadingCopy}>Restoring workouts saved on this device…</Text>
    </View>
  );

  return <ActiveWorkoutContext.Provider value={value}>{children}</ActiveWorkoutContext.Provider>;
}

export function useActiveWorkout() {
  const context = useContext(ActiveWorkoutContext);
  if (!context) throw new Error('useActiveWorkout must be used inside ActiveWorkoutProvider');
  return context;
}

const styles = StyleSheet.create({
  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.lg, backgroundColor: colors.background },
  loadingTitle: { color: colors.text, fontSize: 20, fontWeight: '900', marginTop: spacing.sm },
  loadingCopy: { color: colors.textMuted, fontSize: 14, textAlign: 'center' },
});
