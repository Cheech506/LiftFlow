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
import { loadLiftFlowState, saveLiftFlowState } from '@/storage/liftflowStorage';

export type WorkoutSetType = 'normal' | 'warmup';

export type WorkoutSet = {
  id: string;
  previousWeight?: number;
  previousReps?: number;
  weight?: number;
  reps?: number;
  rpe?: number;
  rir?: number;
  setType?: WorkoutSetType;
  completed: boolean;
};

export type WorkoutExercise = {
  id: string;
  name: string;
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

type SetValueField = 'weight' | 'reps';
type PersistenceStatus = 'loading' | 'saving' | 'saved' | 'error';
type FinishWorkoutOptions = {
  updateTemplate?: boolean;
};

export type CreateExerciseInput = {
  name: string;
  primaryMuscle: string;
  equipment: string;
  exerciseType: ExerciseType;
  defaultWeight?: number;
  defaultReps?: number;
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
  createTemplate: (input: CreateTemplateInput) => WorkoutTemplate;
  updateTemplate: (input: UpdateTemplateInput) => WorkoutTemplate | null;
  startWorkout: (name: string, templateId?: string) => void;
  toggleSet: (exerciseId: string, setId: string) => void;
  toggleSetType: (exerciseId: string, setId: string) => void;
  updateSetValue: (
    exerciseId: string,
    setId: string,
    field: SetValueField,
    value: number | undefined,
  ) => void;
  copyPreviousSet: (exerciseId: string, setId: string) => void;
  addSet: (exerciseId: string) => void;
  addExercise: (exerciseId: string) => void;
  removeExercise: (exerciseId: string) => void;
  updateWorkoutNotes: (notes: string) => void;
  finishWorkout: (options?: FinishWorkoutOptions) => void;
  discardWorkout: () => void;
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
        name: 'Bench Press',
        sets: [
          createTemplateSet('upper-a-bench-1', 185, 6),
          createTemplateSet('upper-a-bench-2', 185, 5),
          createTemplateSet('upper-a-bench-3', 175, 8),
        ],
      },
      {
        id: 'barbell-row',
        name: 'Barbell Row',
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
        name: 'Leg Press',
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
        name: 'Incline Dumbbell Press',
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
        name: 'Romanian Deadlift',
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
        name: 'Bench Press',
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
        name: 'Lat Pulldown',
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
        name: 'Leg Press',
        sets: [
          createTemplateSet('legs-leg-1', 410, 10),
          createTemplateSet('legs-leg-2', 410, 10),
          createTemplateSet('legs-leg-3', 390, 12),
        ],
      },
    ],
  },
];

const cloneTemplateExercises = (template: WorkoutTemplate): WorkoutExercise[] => {
  const workoutStamp = Date.now();

  return template.exercises.map((exercise) => ({
    ...exercise,
    sets: exercise.sets.map((set, index) => ({
      id: `${exercise.id}-${workoutStamp}-${index}`,
      previousWeight: set.weight,
      previousReps: set.reps,
      weight: set.weight,
      reps: set.reps,
      rpe: set.rpe,
      rir: set.rir,
      setType: set.setType ?? 'normal',
      completed: false,
    })),
  }));
};

function toId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function getTemplateDetail(exercises: WorkoutExercise[]) {
  const setCount = exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
  return `${exercises.length} exercise${exercises.length === 1 ? '' : 's'} · ${setCount} planned sets`;
}

export function ActiveWorkoutProvider({ children }: PropsWithChildren) {
  const [workout, setWorkout] = useState<ActiveWorkout | null>(null);
  const [exercises, setExercises] = useState<ExerciseDefinition[]>(exerciseLibrary);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>(initialTemplates);
  const [completedWorkouts, setCompletedWorkouts] = useState<CompletedWorkout[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [persistenceStatus, setPersistenceStatus] =
    useState<PersistenceStatus>('loading');
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

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setPersistenceStatus('saving');

    saveTimerRef.current = setTimeout(() => {
      void saveLiftFlowState({
        exercises,
        templates,
        activeWorkout: workout,
        completedWorkouts,
      })
        .then(() => {
          setPersistenceStatus('saved');
          setLastSavedAt(Date.now());
        })
        .catch((error: unknown) => {
          console.error('Unable to save LiftFlow local data.', error);
          setPersistenceStatus('error');
        });
    }, 150);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [completedWorkouts, exercises, isHydrated, templates, workout]);

  const createExercise = useCallback((input: CreateExerciseInput) => {
    const trimmedName = input.name.trim();
    const idBase = toId(trimmedName) || 'exercise';
    const exercise: ExerciseDefinition = {
      id: `${idBase}-${Date.now()}`,
      name: trimmedName,
      detail: `${input.primaryMuscle.trim()} · ${input.equipment.trim()}`,
      primaryMuscle: input.primaryMuscle.trim(),
      equipment: input.equipment.trim(),
      exerciseType: input.exerciseType,
      defaultWeight: input.exerciseType === 'Weight & Reps' ? input.defaultWeight : undefined,
      defaultReps: input.defaultReps ?? 8,
      isCustom: true,
    };

    setExercises((current) => [...current, exercise]);
    return exercise;
  }, []);

  const createTemplate = useCallback(
    (input: CreateTemplateInput) => {
      const templateId = `${toId(input.name) || 'template'}-${Date.now()}`;
      const selectedExercises = input.exerciseIds
        .map((exerciseId) => exercises.find((exercise) => exercise.id === exerciseId))
        .filter((exercise): exercise is ExerciseDefinition => Boolean(exercise));
      const safeSetCount = Math.min(10, Math.max(1, Math.round(input.setCount)));

      const templateExercises: WorkoutExercise[] = selectedExercises.map((definition) => ({
        id: `${templateId}-${definition.id}`,
        name: definition.name,
        sets: Array.from({ length: safeSetCount }, (_, index) => ({
          id: `${templateId}-${definition.id}-${index + 1}`,
          weight: definition.defaultWeight,
          reps: definition.defaultReps ?? 8,
          setType: 'normal',
          completed: false,
        })),
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
    },
    [exercises],
  );

  const updateTemplate = useCallback((input: UpdateTemplateInput) => {
    const trimmedName = input.name.trim();
    const trimmedFolder = input.folder.trim() || 'My Workouts';
    if (!trimmedName || input.exercises.length === 0) return null;

    const normalizedExercises = input.exercises.map((exercise, exerciseIndex) => ({
      ...exercise,
      id: exercise.id || `${input.id}-exercise-${exerciseIndex + 1}`,
      sets: exercise.sets.map((set, setIndex) => ({
        ...set,
        id: set.id || `${input.id}-${exercise.id || exerciseIndex + 1}-set-${setIndex + 1}`,
        completed: false,
        rpe: set.rpe,
        rir: set.rir,
        setType: set.setType ?? 'normal',
      })),
    }));

    const updatedTemplate: WorkoutTemplate = {
      id: input.id,
      name: trimmedName,
      folder: trimmedFolder,
      detail: getTemplateDetail(normalizedExercises),
      exercises: normalizedExercises,
    };

    setTemplates((current) =>
      current.map((template) => (template.id === input.id ? updatedTemplate : template)),
    );
    return updatedTemplate;
  }, []);

  const startWorkout = useCallback(
    (name: string, templateId?: string) => {
      const template = templateId
        ? templates.find((candidate) => candidate.id === templateId)
        : undefined;

      setWorkout({
        id: `workout-${Date.now()}`,
        name,
        startedAt: Date.now(),
        sourceTemplateId: template?.id,
        notes: '',
        exercises: template ? cloneTemplateExercises(template) : [],
      });
    },
    [templates],
  );

  const toggleSet = useCallback((exerciseId: string, setId: string) => {
    setWorkout((current) => {
      if (!current) return current;

      return {
        ...current,
        exercises: current.exercises.map((exercise) =>
          exercise.id !== exerciseId
            ? exercise
            : {
                ...exercise,
                sets: exercise.sets.map((set) =>
                  set.id === setId ? { ...set, completed: !set.completed } : set,
                ),
              },
        ),
      };
    });
  }, []);

  const toggleSetType = useCallback((exerciseId: string, setId: string) => {
    setWorkout((current) => {
      if (!current) return current;

      return {
        ...current,
        exercises: current.exercises.map((exercise) =>
          exercise.id !== exerciseId
            ? exercise
            : {
                ...exercise,
                sets: exercise.sets.map((set) =>
                  set.id === setId
                    ? {
                        ...set,
                        setType: (set.setType ?? 'normal') === 'warmup' ? 'normal' : 'warmup',
                      }
                    : set,
                ),
              },
        ),
      };
    });
  }, []);

  const updateSetValue = useCallback(
    (
      exerciseId: string,
      setId: string,
      field: SetValueField,
      value: number | undefined,
    ) => {
      setWorkout((current) => {
        if (!current) return current;

        return {
          ...current,
          exercises: current.exercises.map((exercise) =>
            exercise.id !== exerciseId
              ? exercise
              : {
                  ...exercise,
                  sets: exercise.sets.map((set) =>
                    set.id === setId ? { ...set, [field]: value } : set,
                  ),
                },
          ),
        };
      });
    },
    [],
  );

  const copyPreviousSet = useCallback((exerciseId: string, setId: string) => {
    setWorkout((current) => {
      if (!current) return current;

      return {
        ...current,
        exercises: current.exercises.map((exercise) =>
          exercise.id !== exerciseId
            ? exercise
            : {
                ...exercise,
                sets: exercise.sets.map((set) =>
                  set.id === setId
                    ? {
                        ...set,
                        weight: set.previousWeight,
                        reps: set.previousReps,
                      }
                    : set,
                ),
              },
        ),
      };
    });
  }, []);

  const addSet = useCallback((exerciseId: string) => {
    setWorkout((current) => {
      if (!current) return current;

      return {
        ...current,
        exercises: current.exercises.map((exercise) => {
          if (exercise.id !== exerciseId) return exercise;
          const lastSet = exercise.sets.at(-1);

          return {
            ...exercise,
            sets: [
              ...exercise.sets,
              {
                id: `${exercise.id}-${Date.now()}`,
                previousWeight: lastSet?.weight,
                previousReps: lastSet?.reps,
                weight: lastSet?.weight,
                reps: undefined,
                setType: 'normal',
                completed: false,
              },
            ],
          };
        }),
      };
    });
  }, []);

  const addExercise = useCallback((exerciseId: string) => {
    const definition = exercises.find((item) => item.id === exerciseId);
    if (!definition) return;

    setWorkout((current) => {
      if (!current) return current;
      if (current.exercises.some((exercise) => exercise.name === definition.name)) {
        return current;
      }

      const stamp = Date.now();
      const defaultReps = definition.defaultReps ?? 8;

      return {
        ...current,
        exercises: [
          ...current.exercises,
          {
            id: `${definition.id}-${stamp}`,
            name: definition.name,
            sets: Array.from({ length: 3 }, (_, index) => ({
              id: `${definition.id}-${stamp}-${index + 1}`,
              previousWeight: definition.defaultWeight,
              previousReps: defaultReps,
              weight: definition.defaultWeight,
              reps: defaultReps,
              setType: 'normal',
              completed: false,
            })),
          },
        ],
      };
    });
  }, [exercises]);

  const removeExercise = useCallback((exerciseId: string) => {
    setWorkout((current) => {
      if (!current) return current;
      return {
        ...current,
        exercises: current.exercises.filter((exercise) => exercise.id !== exerciseId),
      };
    });
  }, []);

  const updateWorkoutNotes = useCallback((notes: string) => {
    setWorkout((current) => (current ? { ...current, notes } : current));
  }, []);

  const finishWorkout = useCallback(
    (options: FinishWorkoutOptions = {}) => {
      if (!workout) return;

      const sourceTemplate = workout.sourceTemplateId
        ? templates.find((template) => template.id === workout.sourceTemplateId)
        : undefined;

      const completedWorkout: CompletedWorkout = {
        ...workout,
        completedAt: Date.now(),
        sourceFolder: sourceTemplate?.folder,
        exercises: workout.exercises.map((exercise) => ({
          ...exercise,
          sets: exercise.sets.map((set) => ({ ...set })),
        })),
      };

      if (options.updateTemplate && workout.sourceTemplateId) {
        setTemplates((currentTemplates) =>
          currentTemplates.map((template) => {
            if (template.id !== workout.sourceTemplateId) return template;

            return {
              ...template,
              detail: `${workout.exercises.length} exercise${
                workout.exercises.length === 1 ? '' : 's'
              } · ${workout.exercises.reduce(
                (total, exercise) => total + exercise.sets.length,
                0,
              )} planned sets`,
              exercises: workout.exercises.map((exercise) => ({
                id: exercise.id,
                name: exercise.name,
                sets: exercise.sets.map((set, index) => ({
                  id: `${template.id}-${exercise.id}-template-${index + 1}`,
                  weight: set.weight,
                  reps: set.reps,
                  rpe: set.rpe,
                  rir: set.rir,
                  setType: set.setType ?? 'normal',
                  completed: false,
                })),
              })),
            };
          }),
        );
      }

      setCompletedWorkouts((current) => [completedWorkout, ...current]);
      setWorkout(null);
    },
    [templates, workout],
  );

  const discardWorkout = useCallback(() => setWorkout(null), []);

  const { completedSetCount, totalSetCount } = useMemo(() => {
    const sets = workout?.exercises.flatMap((exercise) => exercise.sets) ?? [];
    return {
      completedSetCount: sets.filter((set) => set.completed).length,
      totalSetCount: sets.length,
    };
  }, [workout]);

  const value = useMemo(
    () => ({
      workout,
      exercises,
      templates,
      completedWorkouts,
      completedSetCount,
      totalSetCount,
      persistenceStatus,
      lastSavedAt,
      createExercise,
      createTemplate,
      updateTemplate,
      startWorkout,
      toggleSet,
      toggleSetType,
      updateSetValue,
      copyPreviousSet,
      addSet,
      addExercise,
      removeExercise,
      updateWorkoutNotes,
      finishWorkout,
      discardWorkout,
    }),
    [
      workout,
      exercises,
      templates,
      completedWorkouts,
      completedSetCount,
      totalSetCount,
      persistenceStatus,
      lastSavedAt,
      createExercise,
      createTemplate,
      updateTemplate,
      startWorkout,
      toggleSet,
      toggleSetType,
      updateSetValue,
      copyPreviousSet,
      addSet,
      addExercise,
      removeExercise,
      updateWorkoutNotes,
      finishWorkout,
      discardWorkout,
    ],
  );

  if (!isHydrated) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loadingTitle}>Loading LiftFlow</Text>
        <Text style={styles.loadingCopy}>Restoring workouts saved on this device…</Text>
      </View>
    );
  }

  return (
    <ActiveWorkoutContext.Provider value={value}>
      {children}
    </ActiveWorkoutContext.Provider>
  );
}

export function useActiveWorkout() {
  const context = useContext(ActiveWorkoutContext);
  if (!context) {
    throw new Error('useActiveWorkout must be used inside ActiveWorkoutProvider');
  }
  return context;
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  loadingTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    marginTop: spacing.sm,
  },
  loadingCopy: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
});
