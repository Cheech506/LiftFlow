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

import { colors, spacing } from '@/constants/theme';
import { loadLiftFlowState, saveLiftFlowState } from '@/storage/liftflowStorage';

export type WorkoutSet = {
  id: string;
  previousWeight?: number;
  previousReps?: number;
  weight?: number;
  reps?: number;
  rpe?: number;
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
  exercises: WorkoutExercise[];
};

export type CompletedWorkout = {
  id: string;
  name: string;
  startedAt: number;
  completedAt: number;
  sourceTemplateId?: string;
  sourceFolder?: string;
  exercises: WorkoutExercise[];
};

type SetValueField = 'weight' | 'reps';
type PersistenceStatus = 'loading' | 'saving' | 'saved' | 'error';

type FinishWorkoutOptions = {
  updateTemplate?: boolean;
};

type ActiveWorkoutContextValue = {
  workout: ActiveWorkout | null;
  templates: WorkoutTemplate[];
  completedWorkouts: CompletedWorkout[];
  completedSetCount: number;
  totalSetCount: number;
  persistenceStatus: PersistenceStatus;
  lastSavedAt: number | null;
  startWorkout: (name: string, templateId?: string) => void;
  toggleSet: (exerciseId: string, setId: string) => void;
  updateSetValue: (
    exerciseId: string,
    setId: string,
    field: SetValueField,
    value: number | undefined,
  ) => void;
  copyPreviousSet: (exerciseId: string, setId: string) => void;
  addSet: (exerciseId: string) => void;
  addDemoExercise: () => void;
  finishWorkout: (options?: FinishWorkoutOptions) => void;
  discardWorkout: () => void;
};

const ActiveWorkoutContext = createContext<ActiveWorkoutContextValue | null>(null);

const createTemplateSet = (id: string, weight?: number, reps?: number): WorkoutSet => ({
  id,
  weight,
  reps,
  completed: false,
});

const initialTemplates: WorkoutTemplate[] = [
  {
    id: 'upper-a',
    name: 'Upper A',
    folder: 'Upper / Lower',
    detail: '6 exercises · 18 planned sets',
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
    detail: '5 exercises · 16 planned sets',
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
    detail: '7 exercises · 20 planned sets',
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
    detail: '5 exercises · 15 planned sets',
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
    detail: '6 exercises · 19 planned sets',
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
    detail: '6 exercises · 18 planned sets',
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
    detail: '6 exercises · 20 planned sets',
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
      completed: false,
    })),
  }));
};

export function ActiveWorkoutProvider({ children }: PropsWithChildren) {
  const [workout, setWorkout] = useState<ActiveWorkout | null>(null);
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
  }, [completedWorkouts, isHydrated, templates, workout]);

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
                completed: false,
              },
            ],
          };
        }),
      };
    });
  }, []);

  const addDemoExercise = useCallback(() => {
    setWorkout((current) => {
      if (!current || current.exercises.length > 0) return current;

      const stamp = Date.now();
      return {
        ...current,
        exercises: [
          {
            id: 'bench-press',
            name: 'Bench Press',
            sets: [
              {
                id: `bench-${stamp}-1`,
                previousWeight: 185,
                previousReps: 6,
                weight: 185,
                reps: 6,
                completed: false,
              },
              {
                id: `bench-${stamp}-2`,
                previousWeight: 185,
                previousReps: 5,
                weight: 185,
                reps: 5,
                completed: false,
              },
              {
                id: `bench-${stamp}-3`,
                previousWeight: 175,
                previousReps: 8,
                weight: 175,
                reps: 8,
                completed: false,
              },
            ],
          },
        ],
      };
    });
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
              exercises: workout.exercises.map((exercise) => ({
                id: exercise.id,
                name: exercise.name,
                sets: exercise.sets.map((set, index) => ({
                  id: `${template.id}-${exercise.id}-template-${index + 1}`,
                  weight: set.weight,
                  reps: set.reps,
                  rpe: set.rpe,
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
      templates,
      completedWorkouts,
      completedSetCount,
      totalSetCount,
      persistenceStatus,
      lastSavedAt,
      startWorkout,
      toggleSet,
      updateSetValue,
      copyPreviousSet,
      addSet,
      addDemoExercise,
      finishWorkout,
      discardWorkout,
    }),
    [
      workout,
      templates,
      completedWorkouts,
      completedSetCount,
      totalSetCount,
      persistenceStatus,
      lastSavedAt,
      startWorkout,
      toggleSet,
      updateSetValue,
      copyPreviousSet,
      addSet,
      addDemoExercise,
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
