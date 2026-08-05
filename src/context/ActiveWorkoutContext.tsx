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
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

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
import { loadLiftFlowState, saveLiftFlowState } from '@/storage/liftflowStorage';

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
  notes?: string;
  sets: WorkoutSet[];
};

export type WorkoutTemplate = {
  id: string;
  name: string;
  folder: string;
  detail: string;
  exercises: WorkoutExercise[];
};

export type ActiveWorkout = {
  id: string;
  name: string;
  startedAt: number;
  sourceTemplateId?: string;
  notes?: string;
  restTimerEndsAt?: number;
  exercises: WorkoutExercise[];
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
};

export type LiftFlowStateSnapshot = {
  exercises: ExerciseDefinition[];
  templates: WorkoutTemplate[];
  activeWorkout: ActiveWorkout | null;
  completedWorkouts: CompletedWorkout[];
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

type ActiveWorkoutContextValue = {
  workout: ActiveWorkout | null;
  exercises: ExerciseDefinition[];
  templates: WorkoutTemplate[];
  completedWorkouts: CompletedWorkout[];
  completedSetCount: number;
  totalSetCount: number;
  persistenceStatus: PersistenceStatus;
  lastSavedAt: number | null;
  createExercise: (input: CreateExerciseInput) => ExerciseDefinition;
  updateExercise: (input: UpdateExerciseInput) => ExerciseDefinition | null;
  setExerciseArchived: (exerciseId: string, archived: boolean) => void;
  deleteExercise: (exerciseId: string) => boolean;
  getExerciseUsage: (exerciseId: string) => ExerciseUsage;
  createTemplate: (input: CreateTemplateInput) => WorkoutTemplate;
  updateTemplate: (input: UpdateTemplateInput) => WorkoutTemplate | null;
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
  updateExerciseNotes: (exerciseId: string, notes: string) => void;
  updateWorkoutNotes: (notes: string) => void;
  setRestTimer: (seconds: number) => void;
  clearRestTimer: () => void;
  finishWorkout: (options?: FinishWorkoutOptions) => void;
  discardWorkout: () => void;
  updateCompletedWorkout: (workout: CompletedWorkout) => void;
  deleteCompletedWorkout: (workoutId: string) => boolean;
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

const cloneExercises = (exercises: WorkoutExercise[]): WorkoutExercise[] =>
  exercises.map((exercise) => ({
    ...exercise,
    sets: exercise.sets.map((set) => ({ ...set })),
  }));

const cloneTemplateExercises = (template: WorkoutTemplate): WorkoutExercise[] => {
  const workoutStamp = Date.now();
  return template.exercises.map((exercise, exerciseIndex) => ({
    ...exercise,
    exerciseType: normalizeExerciseType(exercise.exerciseType),
    id: `${exercise.id}-${workoutStamp}-${exerciseIndex}`,
    sets: exercise.sets.map((set, index) => ({
      id: `${exercise.id}-${workoutStamp}-${index}`,
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

function toId(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
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

export function ActiveWorkoutProvider({ children }: PropsWithChildren) {
  const [workout, setWorkout] = useState<ActiveWorkout | null>(null);
  const [exercises, setExercises] = useState<ExerciseDefinition[]>(exerciseLibrary);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>(initialTemplates);
  const [completedWorkouts, setCompletedWorkouts] = useState<CompletedWorkout[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [persistenceStatus, setPersistenceStatus] = useState<PersistenceStatus>('loading');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      try {
        const savedState = await loadLiftFlowState();
        if (cancelled) return;
        if (savedState) {
          setExercises(savedState.exercises);
          setTemplates(savedState.templates);
          setWorkout(savedState.activeWorkout);
          setCompletedWorkouts(savedState.completedWorkouts);
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
    if (!isHydrated) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setPersistenceStatus('saving');
    saveTimerRef.current = setTimeout(() => {
      void saveLiftFlowState({ exercises, templates, activeWorkout: workout, completedWorkouts })
        .then(() => { setPersistenceStatus('saved'); setLastSavedAt(Date.now()); })
        .catch((error: unknown) => {
          console.error('Unable to save LiftFlow local data.', error);
          setPersistenceStatus('error');
        });
    }, 150);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [completedWorkouts, exercises, isHydrated, templates, workout]);

  const createExercise = useCallback((input: CreateExerciseInput) => {
    const trimmedName = input.name.trim();
    const idBase = toId(trimmedName) || 'exercise';
    const exerciseType = normalizeExerciseType(input.exerciseType);
    const exercise: ExerciseDefinition = {
      id: `${idBase}-${Date.now()}`,
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
      isCustom: true,
    };
    setExercises((current) => [...current, exercise]);
    return exercise;
  }, []);

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
  }, [exercises]);

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

  const deleteExercise = useCallback((exerciseId: string) => {
    const definition = exercises.find((exercise) => exercise.id === exerciseId);
    if (!definition?.isCustom || !definition.archived) return false;
    const usage = getExerciseUsage(exerciseId);
    if (usage.templates > 0 || usage.completedWorkouts > 0 || usage.activeWorkout) return false;
    setExercises((current) => current.filter((exercise) => exercise.id !== exerciseId));
    return true;
  }, [exercises, getExerciseUsage]);

  const createTemplate = useCallback((input: CreateTemplateInput) => {
    const templateId = `${toId(input.name) || 'template'}-${Date.now()}`;
    const selected = input.exerciseIds
      .map((id) => exercises.find((item) => item.id === id))
      .filter((item): item is ExerciseDefinition => Boolean(item && !item.archived));
    const safeSetCount = Math.min(10, Math.max(1, Math.round(input.setCount)));
    const templateExercises = selected.map((definition) => ({
      id: `${templateId}-${definition.id}`,
      exerciseDefinitionId: definition.id,
      name: definition.name,
      exerciseType: normalizeExerciseType(definition.exerciseType),
      notes: '',
      sets: Array.from({ length: safeSetCount }, (_, index) =>
        createSetFromDefinition(definition, `${templateId}-${definition.id}-${index + 1}`),
      ),
    }));
    const template: WorkoutTemplate = {
      id: templateId,
      name: input.name.trim(),
      folder: input.folder.trim() || 'My Workouts',
      detail: getTemplateDetail(templateExercises),
      exercises: templateExercises,
    };
    setTemplates((current) => [...current, template]);
    return template;
  }, [exercises]);

  const updateTemplate = useCallback((input: UpdateTemplateInput) => {
    const name = input.name.trim();
    if (!name || input.exercises.length === 0) return null;
    const normalized = input.exercises.map((exercise, exerciseIndex) => {
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
    });
    const updated: WorkoutTemplate = { id: input.id, name, folder: input.folder.trim() || 'My Workouts', detail: getTemplateDetail(normalized), exercises: normalized };
    setTemplates((current) => current.map((template) => template.id === input.id ? updated : template));
    return updated;
  }, []);

  const deleteTemplate = useCallback((templateId: string) => {
    if (!templates.some((template) => template.id === templateId)) return false;
    setTemplates((current) => current.filter((template) => template.id !== templateId));
    return true;
  }, [templates]);

  const startWorkout = useCallback((name: string, templateId?: string) => {
    if (workout) return false;
    const template = templateId ? templates.find((candidate) => candidate.id === templateId) : undefined;
    setWorkout({ id: `workout-${Date.now()}`, name, startedAt: Date.now(), sourceTemplateId: template?.id, notes: '', exercises: template ? cloneTemplateExercises(template) : [] });
    return true;
  }, [templates, workout]);

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
  const copyPreviousSet = useCallback((exerciseId: string, setId: string) => updateWorkoutExercise(exerciseId, (exercise) => ({ ...exercise, sets: exercise.sets.map((set) => set.id === setId ? { ...set, weight: set.previousWeight, reps: set.previousReps, durationSeconds: set.previousDurationSeconds, distance: set.previousDistance } : set) })), [updateWorkoutExercise]);

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
            id: `${exercise.id}-${Date.now()}`,
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
      const stamp = Date.now();
      return {
        ...current,
        exercises: [
          ...current.exercises,
          {
            id: `${definition.id}-${stamp}`,
            exerciseDefinitionId: definition.id,
            name: definition.name,
            exerciseType: normalizeExerciseType(definition.exerciseType),
            notes: '',
            sets: Array.from({ length: 3 }, (_, index) =>
              createWorkoutSetFromDefinition(
                definition,
                `${definition.id}-${stamp}-${index + 1}`,
              ),
            ),
          },
        ],
      };
    });
  }, [exercises]);

  const removeExercise = useCallback((exerciseId: string) => setWorkout((current) => current ? { ...current, exercises: current.exercises.filter((exercise) => exercise.id !== exerciseId) } : current), []);
  const moveExercise = useCallback((exerciseId: string, direction: MoveDirection) => setWorkout((current) => current ? { ...current, exercises: moveItem(current.exercises, current.exercises.findIndex((exercise) => exercise.id === exerciseId), direction) } : current), []);
  const updateExerciseNotes = useCallback((exerciseId: string, notes: string) => updateWorkoutExercise(exerciseId, (exercise) => ({ ...exercise, notes })), [updateWorkoutExercise]);

  const replaceExercise = useCallback((workoutExerciseId: string, definitionId: string) => {
    const definition = exercises.find((item) => item.id === definitionId && !item.archived);
    if (!definition) return;
    const stamp = Date.now();
    updateWorkoutExercise(workoutExerciseId, (exercise) => ({
      ...exercise,
      id: `${definition.id}-${stamp}`,
      exerciseDefinitionId: definition.id,
      name: definition.name,
      exerciseType: normalizeExerciseType(definition.exerciseType),
      sets: exercise.sets.map((set, index) => ({
        ...createWorkoutSetFromDefinition(definition, `${definition.id}-${stamp}-${index}`),
        setType: set.setType ?? 'normal',
        rpe: set.rpe,
        rir: set.rir,
      })),
    }));
  }, [exercises, updateWorkoutExercise]);

  const updateWorkoutNotes = useCallback((notes: string) => setWorkout((current) => current ? { ...current, notes } : current), []);
  const setRestTimer = useCallback((seconds: number) => setWorkout((current) => current ? { ...current, restTimerEndsAt: Date.now() + Math.max(0, seconds) * 1000 } : current), []);
  const clearRestTimer = useCallback(() => setWorkout((current) => current ? { ...current, restTimerEndsAt: undefined } : current), []);

  const finishWorkout = useCallback((options: FinishWorkoutOptions = {}) => {
    if (!workout) return;
    const sourceTemplate = workout.sourceTemplateId ? templates.find((template) => template.id === workout.sourceTemplateId) : undefined;
    const { restTimerEndsAt: _restTimerEndsAt, ...workoutWithoutTimer } = workout;
    const completedWorkout: CompletedWorkout = { ...workoutWithoutTimer, completedAt: Date.now(), sourceFolder: sourceTemplate?.folder, exercises: cloneExercises(workout.exercises) };
    if (options.updateTemplate && workout.sourceTemplateId) {
      setTemplates((current) => current.map((template) => template.id !== workout.sourceTemplateId ? template : {
        ...template,
        detail: getTemplateDetail(workout.exercises),
        exercises: workout.exercises.map((exercise) => ({ ...exercise, sets: exercise.sets.map((set, index) => ({ ...set, id: `${template.id}-${exercise.id}-template-${index + 1}`, previousWeight: undefined, previousReps: undefined, previousDurationSeconds: undefined, previousDistance: undefined, completed: false })) })),
      }));
    }
    setCompletedWorkouts((current) => [completedWorkout, ...current]);
    setWorkout(null);
  }, [templates, workout]);

  const discardWorkout = useCallback(() => setWorkout(null), []);
  const updateCompletedWorkout = useCallback((updated: CompletedWorkout) => setCompletedWorkouts((current) => current.map((item) => item.id === updated.id ? { ...updated, exercises: cloneExercises(updated.exercises) } : item)), []);
  const deleteCompletedWorkout = useCallback((workoutId: string) => {
    if (!completedWorkouts.some((item) => item.id === workoutId)) return false;
    setCompletedWorkouts((current) => current.filter((item) => item.id !== workoutId));
    return true;
  }, [completedWorkouts]);

  const repeatCompletedWorkout = useCallback((workoutId: string) => {
    if (workout) return false;
    const completed = completedWorkouts.find((item) => item.id === workoutId);
    if (!completed) return false;
    const stamp = Date.now();
    setWorkout({ id: `workout-${stamp}`, name: completed.name, startedAt: stamp, sourceTemplateId: completed.sourceTemplateId, notes: '', exercises: completed.exercises.map((exercise, exerciseIndex) => ({ ...exercise, id: `${exercise.id}-repeat-${stamp}-${exerciseIndex}`, sets: exercise.sets.map((set, setIndex) => ({ ...set, id: `${set.id}-repeat-${stamp}-${setIndex}`, ...copyMetricValues(set), completed: false })) })) });
    return true;
  }, [completedWorkouts, workout]);

  const saveCompletedWorkoutAsTemplate = useCallback((workoutId: string) => {
    const completed = completedWorkouts.find((item) => item.id === workoutId);
    if (!completed) return null;
    const stamp = Date.now();
    const template: WorkoutTemplate = {
      id: `${toId(completed.name) || 'history-template'}-${stamp}`,
      name: `${completed.name} Copy`,
      folder: completed.sourceFolder || 'From History',
      detail: getTemplateDetail(completed.exercises),
      exercises: completed.exercises.map((exercise, exerciseIndex) => ({ ...exercise, id: `${exercise.id}-template-${stamp}-${exerciseIndex}`, sets: exercise.sets.map((set, setIndex) => ({ ...set, id: `${set.id}-template-${stamp}-${setIndex}`, previousWeight: undefined, previousReps: undefined, previousDurationSeconds: undefined, previousDistance: undefined, completed: false })) })),
    };
    setTemplates((current) => [...current, template]);
    return template;
  }, [completedWorkouts]);

  const getStateSnapshot = useCallback((): LiftFlowStateSnapshot => ({ exercises: exercises.map((item) => ({ ...item })), templates: templates.map((item) => ({ ...item, exercises: cloneExercises(item.exercises) })), activeWorkout: workout ? { ...workout, exercises: cloneExercises(workout.exercises) } : null, completedWorkouts: completedWorkouts.map((item) => ({ ...item, exercises: cloneExercises(item.exercises) })) }), [completedWorkouts, exercises, templates, workout]);

  const restoreState = useCallback(async (snapshot: LiftFlowStateSnapshot) => {
    const safe: LiftFlowStateSnapshot = { exercises: snapshot.exercises.map((item) => ({ ...item })), templates: snapshot.templates.map((item) => ({ ...item, exercises: cloneExercises(item.exercises) })), activeWorkout: snapshot.activeWorkout ? { ...snapshot.activeWorkout, exercises: cloneExercises(snapshot.activeWorkout.exercises) } : null, completedWorkouts: snapshot.completedWorkouts.map((item) => ({ ...item, exercises: cloneExercises(item.exercises) })) };
    await saveLiftFlowState(safe);
    setExercises(safe.exercises);
    setTemplates(safe.templates);
    setWorkout(safe.activeWorkout);
    setCompletedWorkouts(safe.completedWorkouts);
    setPersistenceStatus('saved');
    setLastSavedAt(Date.now());
  }, []);

  const { completedSetCount, totalSetCount } = useMemo(() => {
    const sets = workout?.exercises.flatMap((exercise) => exercise.sets) ?? [];
    return { completedSetCount: sets.filter((set) => set.completed).length, totalSetCount: sets.length };
  }, [workout]);

  const value = useMemo<ActiveWorkoutContextValue>(() => ({
    workout, exercises, templates, completedWorkouts, completedSetCount, totalSetCount, persistenceStatus, lastSavedAt,
    createExercise, updateExercise, setExerciseArchived, deleteExercise, getExerciseUsage,
    createTemplate, updateTemplate, deleteTemplate, startWorkout, toggleSet, setSetType, toggleSetType,
    updateSetValue, updateSetEffort, copyPreviousSet, addSet, removeSet, moveSet, addExercise,
    removeExercise, moveExercise, replaceExercise, updateExerciseNotes, updateWorkoutNotes,
    setRestTimer, clearRestTimer, finishWorkout, discardWorkout, updateCompletedWorkout,
    deleteCompletedWorkout, repeatCompletedWorkout, saveCompletedWorkoutAsTemplate,
    getStateSnapshot, restoreState,
  }), [
    workout, exercises, templates, completedWorkouts, completedSetCount, totalSetCount, persistenceStatus, lastSavedAt,
    createExercise, updateExercise, setExerciseArchived, deleteExercise, getExerciseUsage,
    createTemplate, updateTemplate, deleteTemplate, startWorkout, toggleSet, setSetType, toggleSetType,
    updateSetValue, updateSetEffort, copyPreviousSet, addSet, removeSet, moveSet, addExercise,
    removeExercise, moveExercise, replaceExercise, updateExerciseNotes, updateWorkoutNotes,
    setRestTimer, clearRestTimer, finishWorkout, discardWorkout, updateCompletedWorkout,
    deleteCompletedWorkout, repeatCompletedWorkout, saveCompletedWorkoutAsTemplate, getStateSnapshot, restoreState,
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
