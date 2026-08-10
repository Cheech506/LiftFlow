import type { ExerciseDefinition, ExerciseType } from '@/constants/exercises';
import type {
  CompletedWorkout,
  WorkoutExercise,
  WorkoutSet,
} from '@/context/ActiveWorkoutContext';
import { estimateOneRepMax, getWorkoutDateTimestamp } from '@/lib/workoutStats';
import { formatSeconds, formatSetMetrics } from '@/lib/exerciseTracking';

export type ExerciseRecordKey =
  | 'weight'
  | 'reps'
  | 'estimatedOneRepMax'
  | 'setVolume'
  | 'assistance'
  | 'duration'
  | 'distance'
  | 'pace';

export type ExerciseRecord = {
  key: ExerciseRecordKey;
  label: string;
  value: number;
  displayValue: string;
  achievedAt: number;
  workoutId: string;
  workoutName: string;
  higherIsBetter: boolean;
};

export type ExercisePrAchievement = {
  id: string;
  key: ExerciseRecordKey;
  label: string;
  displayValue: string;
  achievedAt: number;
  workoutId: string;
  workoutName: string;
};

export type ExerciseHistoryEntry = {
  workoutId: string;
  workoutName: string;
  completedAt: number;
  completedSetCount: number;
  workingSetCount: number;
  bestSetLabel: string;
  totalVolume?: number;
};

export type ExerciseProgressSummary = {
  exerciseId: string;
  exerciseName: string;
  exerciseType: ExerciseType;
  totalSessions: number;
  totalCompletedSets: number;
  records: ExerciseRecord[];
  recentHistory: ExerciseHistoryEntry[];
  recentPrs: ExercisePrAchievement[];
};

type SetObservation = {
  workoutId: string;
  workoutName: string;
  completedAt: number;
  exercise: WorkoutExercise;
  set: WorkoutSet;
  setIndex: number;
};

type MetricCandidate = {
  key: ExerciseRecordKey;
  label: string;
  value: number;
  displayValue: string;
  higherIsBetter: boolean;
};

const normalizeName = (value: string) => value.trim().toLowerCase();

export function exerciseMatchesDefinition(
  definition: ExerciseDefinition,
  exercise: WorkoutExercise,
): boolean {
  if (exercise.exerciseDefinitionId && exercise.exerciseDefinitionId === definition.id) {
    return true;
  }

  const names = [definition.name, ...(definition.previousNames ?? [])].map(normalizeName);
  return names.includes(normalizeName(exercise.name));
}

export function findExerciseDefinition(
  exercise: WorkoutExercise,
  definitions: ExerciseDefinition[],
): ExerciseDefinition | null {
  if (exercise.exerciseDefinitionId) {
    const exact = definitions.find((definition) => definition.id === exercise.exerciseDefinitionId);
    if (exact) return exact;
  }

  return definitions.find((definition) => exerciseMatchesDefinition(definition, exercise)) ?? null;
}

export function buildExerciseProgress(
  definition: ExerciseDefinition,
  completedWorkouts: CompletedWorkout[],
): ExerciseProgressSummary {
  const sessions = completedWorkouts
    .reduce<ExerciseHistoryEntry[]>((entries, workout) => {
      const matchingExercises = workout.exercises.filter((exercise) =>
        exerciseMatchesDefinition(definition, exercise),
      );
      if (matchingExercises.length === 0) return entries;

      const completedSets = matchingExercises.flatMap((exercise) =>
        exercise.sets.filter((set) => set.completed),
      );
      if (completedSets.length === 0) return entries;

      const workingSets = completedSets.filter((set) => (set.setType ?? 'normal') !== 'warmup');
      const bestSet = chooseBestSet(definition.exerciseType, workingSets);
      const totalVolume = getSessionVolume(definition.exerciseType, workingSets);

      entries.push({
        workoutId: workout.id,
        workoutName: workout.name,
        completedAt: getWorkoutDateTimestamp(workout),
        completedSetCount: completedSets.length,
        workingSetCount: workingSets.length,
        bestSetLabel: bestSet
          ? formatSetMetrics(definition.exerciseType, bestSet)
          : 'Warm-up sets only',
        ...(totalVolume > 0 ? { totalVolume } : {}),
      });
      return entries;
    }, [])
    .sort((a, b) => b.completedAt - a.completedAt);


  const observations = collectObservations(definition, completedWorkouts);
  const records = buildRecords(definition.exerciseType, observations);
  const recentPrs = buildExercisePrTimeline(definition, completedWorkouts);

  return {
    exerciseId: definition.id,
    exerciseName: definition.name,
    exerciseType: definition.exerciseType,
    totalSessions: sessions.length,
    totalCompletedSets: sessions.reduce((total, session) => total + session.completedSetCount, 0),
    records,
    recentHistory: sessions,
    recentPrs,
  };
}

export function getSetPrLabels(
  exerciseType: ExerciseType,
  set: WorkoutSet,
  progress: ExerciseProgressSummary | null,
): string[] {
  if (!set.completed || (set.setType ?? 'normal') === 'warmup') return [];

  const historicRecords = new Map(
    (progress?.records ?? []).map((record) => [record.key, record]),
  );

  return metricCandidates(exerciseType, set)
    .filter((candidate) => {
      const record = historicRecords.get(candidate.key);
      if (!record) return true;
      return candidate.higherIsBetter
        ? candidate.value > record.value
        : candidate.value < record.value;
    })
    .map((candidate) => candidate.label)
    .slice(0, 3);
}

export function formatExerciseHistoryDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function collectObservations(
  definition: ExerciseDefinition,
  completedWorkouts: CompletedWorkout[],
): SetObservation[] {
  return completedWorkouts
    .flatMap((workout) =>
      workout.exercises
        .filter((exercise) => exerciseMatchesDefinition(definition, exercise))
        .flatMap((exercise) =>
          exercise.sets.map((set, setIndex) => ({
            workoutId: workout.id,
            workoutName: workout.name,
            completedAt: getWorkoutDateTimestamp(workout),
            exercise,
            set,
            setIndex,
          })),
        ),
    )
    .filter(
      (observation) =>
        observation.set.completed &&
        (observation.set.setType ?? 'normal') !== 'warmup' &&
        metricCandidates(definition.exerciseType, observation.set).length > 0,
    )
    .sort((a, b) =>
      a.completedAt === b.completedAt
        ? a.setIndex - b.setIndex
        : a.completedAt - b.completedAt,
    );
}

function buildRecords(
  exerciseType: ExerciseType,
  observations: SetObservation[],
): ExerciseRecord[] {
  const records = new Map<ExerciseRecordKey, ExerciseRecord>();

  observations.forEach((observation) => {
    metricCandidates(exerciseType, observation.set).forEach((candidate) => {
      const existing = records.get(candidate.key);
      const better =
        !existing ||
        (candidate.higherIsBetter
          ? candidate.value > existing.value
          : candidate.value < existing.value);

      if (!better) return;

      records.set(candidate.key, {
        ...candidate,
        achievedAt: observation.completedAt,
        workoutId: observation.workoutId,
        workoutName: observation.workoutName,
      });
    });
  });

  return getMetricOrder(exerciseType)
    .map((key) => records.get(key))
    .filter((record): record is ExerciseRecord => Boolean(record));
}

export function buildExercisePrTimeline(
  definition: ExerciseDefinition,
  completedWorkouts: CompletedWorkout[],
): ExercisePrAchievement[] {
  const exerciseType = definition.exerciseType;
  const observations = collectObservations(definition, completedWorkouts);
  const bestValues = new Map<ExerciseRecordKey, number>();
  const achievements: ExercisePrAchievement[] = [];

  observations.forEach((observation) => {
    metricCandidates(exerciseType, observation.set).forEach((candidate) => {
      const previous = bestValues.get(candidate.key);
      const isRecord =
        previous === undefined ||
        (candidate.higherIsBetter ? candidate.value > previous : candidate.value < previous);
      if (!isRecord) return;

      bestValues.set(candidate.key, candidate.value);
      achievements.push({
        id: `${observation.workoutId}-${observation.set.id}-${candidate.key}`,
        key: candidate.key,
        label: candidate.label,
        displayValue: candidate.displayValue,
        achievedAt: observation.completedAt,
        workoutId: observation.workoutId,
        workoutName: observation.workoutName,
      });
    });
  });

  return achievements.sort((a, b) => b.achievedAt - a.achievedAt);
}

export function hasQualifyingProgressMetrics(
  exerciseType: ExerciseType,
  set: WorkoutSet,
): boolean {
  return metricCandidates(exerciseType, set).length > 0;
}

function metricCandidates(
  exerciseType: ExerciseType,
  set: WorkoutSet,
): MetricCandidate[] {
  const candidates: MetricCandidate[] = [];
  const weight = validMetric(set.weight);
  const reps = validMetric(set.reps);
  const duration = validMetric(set.durationSeconds);
  const distance = validMetric(set.distance);

  if (exerciseType === 'Weight & Reps' || exerciseType === 'Bodyweight + Added Weight') {
    // Strong can export failed attempts as a completed row with a weight but 0 reps.
    // Keep those rows in History, but never let them become a weight, e1RM, or volume PR.
    if (weight !== undefined && reps !== undefined && reps > 0) {
      candidates.push({
        key: 'weight',
        label: exerciseType === 'Bodyweight + Added Weight' ? 'Added Weight PR' : 'Weight PR',
        value: weight,
        displayValue: `${formatNumber(weight)} lb`,
        higherIsBetter: true,
      });
    }
    if (reps !== undefined && reps > 0) {
      candidates.push({
        key: 'reps',
        label: 'Rep PR',
        value: reps,
        displayValue: `${formatNumber(reps)} reps`,
        higherIsBetter: true,
      });
    }
    if (weight !== undefined && reps !== undefined && weight > 0 && reps > 0) {
      const estimatedOneRepMax = estimateOneRepMax(weight, reps);
      if (estimatedOneRepMax !== undefined) {
        candidates.push({
          key: 'estimatedOneRepMax',
          label: 'e1RM PR',
          value: estimatedOneRepMax,
          displayValue: `${formatNumber(estimatedOneRepMax)} lb`,
          higherIsBetter: true,
        });
      }
      const setVolume = weight * reps;
      candidates.push({
        key: 'setVolume',
        label: 'Volume PR',
        value: setVolume,
        displayValue: `${formatNumber(setVolume)} lb`,
        higherIsBetter: true,
      });
    }
  } else if (exerciseType === 'Assisted Bodyweight') {
    if (weight !== undefined && reps !== undefined && reps > 0) {
      candidates.push({
        key: 'assistance',
        label: 'Assistance PR',
        value: weight,
        displayValue: `${formatNumber(weight)} lb assist`,
        higherIsBetter: false,
      });
    }
    if (reps !== undefined && reps > 0) {
      candidates.push({
        key: 'reps',
        label: 'Rep PR',
        value: reps,
        displayValue: `${formatNumber(reps)} reps`,
        higherIsBetter: true,
      });
    }
  } else if (exerciseType === 'Bodyweight & Reps' || exerciseType === 'Reps Only') {
    if (reps !== undefined && reps > 0) {
      candidates.push({
        key: 'reps',
        label: 'Rep PR',
        value: reps,
        displayValue: `${formatNumber(reps)} reps`,
        higherIsBetter: true,
      });
    }
  } else if (exerciseType === 'Duration') {
    if (duration !== undefined && duration > 0) {
      candidates.push({
        key: 'duration',
        label: 'Duration PR',
        value: duration,
        displayValue: formatSeconds(duration),
        higherIsBetter: true,
      });
    }
  } else if (exerciseType === 'Distance & Duration') {
    if (distance !== undefined && distance > 0) {
      candidates.push({
        key: 'distance',
        label: 'Distance PR',
        value: distance,
        displayValue: formatNumber(distance),
        higherIsBetter: true,
      });
    }
    if (duration !== undefined && duration > 0) {
      candidates.push({
        key: 'duration',
        label: 'Duration PR',
        value: duration,
        displayValue: formatSeconds(duration),
        higherIsBetter: true,
      });
    }
    if (distance !== undefined && distance > 0 && duration !== undefined && duration > 0) {
      const pace = duration / distance;
      candidates.push({
        key: 'pace',
        label: 'Pace PR',
        value: pace,
        displayValue: `${formatSeconds(pace)}/unit`,
        higherIsBetter: false,
      });
    }
  }

  return candidates;
}

function getMetricOrder(exerciseType: ExerciseType): ExerciseRecordKey[] {
  switch (exerciseType) {
    case 'Weight & Reps':
    case 'Bodyweight + Added Weight':
      return ['weight', 'reps', 'estimatedOneRepMax', 'setVolume'];
    case 'Assisted Bodyweight':
      return ['assistance', 'reps'];
    case 'Bodyweight & Reps':
    case 'Reps Only':
      return ['reps'];
    case 'Duration':
      return ['duration'];
    case 'Distance & Duration':
      return ['distance', 'pace', 'duration'];
  }
}

function chooseBestSet(exerciseType: ExerciseType, sets: WorkoutSet[]): WorkoutSet | null {
  if (sets.length === 0) return null;

  return [...sets].sort((a, b) => getSetScore(exerciseType, b) - getSetScore(exerciseType, a))[0] ?? null;
}

function getSetScore(exerciseType: ExerciseType, set: WorkoutSet): number {
  const weight = set.weight ?? 0;
  const reps = set.reps ?? 0;
  const duration = set.durationSeconds ?? 0;
  const distance = set.distance ?? 0;

  switch (exerciseType) {
    case 'Weight & Reps':
    case 'Bodyweight + Added Weight':
      return estimateOneRepMax(weight, reps) ?? (weight * 1000 + reps);
    case 'Assisted Bodyweight':
      return (100000 - weight * 100) + reps;
    case 'Bodyweight & Reps':
    case 'Reps Only':
      return reps;
    case 'Duration':
      return duration;
    case 'Distance & Duration':
      return distance > 0 ? distance * 100000 - duration / distance : duration;
  }
}

function getSessionVolume(exerciseType: ExerciseType, sets: WorkoutSet[]): number {
  if (exerciseType !== 'Weight & Reps' && exerciseType !== 'Bodyweight + Added Weight') {
    return 0;
  }

  return sets.reduce((total, set) => {
    if (
      set.weight === undefined ||
      set.reps === undefined ||
      set.weight <= 0 ||
      set.reps <= 0
    ) return total;
    return total + set.weight * set.reps;
  }, 0);
}

function validMetric(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '');
}
