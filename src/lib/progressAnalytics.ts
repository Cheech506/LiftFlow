import type { ExerciseDefinition, ExerciseType } from '@/constants/exercises';
import type {
  CompletedWorkout,
  WorkoutSet,
} from '@/context/ActiveWorkoutContext';
import {
  buildExercisePrTimeline,
  exerciseMatchesDefinition,
  findExerciseDefinition,
  type ExercisePrAchievement,
} from '@/lib/exerciseProgress';
import {
  formatDurationShort,
  getMondayStart,
  getWorkoutDurationSeconds,
  getWorkoutVolume,
} from '@/lib/workoutStats';

export type ProgressRangeKey = '4w' | '12w' | '26w' | 'all';

export type ProgressRangeOption = {
  key: ProgressRangeKey;
  label: string;
  weeks: number | null;
};

export const PROGRESS_RANGE_OPTIONS: ProgressRangeOption[] = [
  { key: '4w', label: '4W', weeks: 4 },
  { key: '12w', label: '12W', weeks: 12 },
  { key: '26w', label: '6M', weeks: 26 },
  { key: 'all', label: 'ALL', weeks: null },
];

export type ProgressSummary = {
  workoutCount: number;
  workingSetCount: number;
  trainingSeconds: number;
  totalVolume: number;
  prCount: number;
};

export type WeeklyProgressBucket = {
  weekStart: number;
  label: string;
  workoutCount: number;
  workingSetCount: number;
  trainingSeconds: number;
  volume: number;
};

export type MuscleBreakdownItem = {
  muscle: string;
  workingSetCount: number;
  percentage: number;
};

export type RecentPrItem = ExercisePrAchievement & {
  exerciseId: string;
  exerciseName: string;
};

export type ExerciseTrendMetricKey =
  | 'estimatedOneRepMax'
  | 'weight'
  | 'reps'
  | 'sessionVolume'
  | 'assistance'
  | 'duration'
  | 'distance'
  | 'pace';

export type ExerciseTrendMetricOption = {
  key: ExerciseTrendMetricKey;
  label: string;
  higherIsBetter: boolean;
};

export type ExerciseTrendPoint = {
  workoutId: string;
  workoutName: string;
  completedAt: number;
  value: number;
  displayValue: string;
};

export function getProgressRangeCutoff(
  range: ProgressRangeKey,
  now = Date.now(),
): number | null {
  const option = PROGRESS_RANGE_OPTIONS.find((item) => item.key === range);
  if (!option?.weeks) return null;
  return now - option.weeks * 7 * 24 * 60 * 60 * 1000;
}

export function filterWorkoutsForRange(
  workouts: CompletedWorkout[],
  range: ProgressRangeKey,
  now = Date.now(),
): CompletedWorkout[] {
  const cutoff = getProgressRangeCutoff(range, now);
  return [...workouts]
    .filter((workout) => cutoff === null || workout.completedAt >= cutoff)
    .sort((a, b) => a.completedAt - b.completedAt);
}

export function buildProgressSummary(
  workouts: CompletedWorkout[],
  exercises: ExerciseDefinition[],
  range: ProgressRangeKey,
  now = Date.now(),
): ProgressSummary {
  const rangedWorkouts = filterWorkoutsForRange(workouts, range, now);
  const recentPrs = buildRecentPrs(exercises, workouts, range, now);

  return {
    workoutCount: rangedWorkouts.length,
    workingSetCount: rangedWorkouts.reduce(
      (total, workout) => total + getWorkingSets(workout).length,
      0,
    ),
    trainingSeconds: rangedWorkouts.reduce(
      (total, workout) => total + getWorkoutDurationSeconds(workout),
      0,
    ),
    totalVolume: rangedWorkouts.reduce(
      (total, workout) => total + getWorkoutVolume(workout),
      0,
    ),
    prCount: recentPrs.length,
  };
}

export function buildWeeklyProgress(
  workouts: CompletedWorkout[],
  range: ProgressRangeKey,
  now = Date.now(),
): WeeklyProgressBucket[] {
  const rangedWorkouts = filterWorkoutsForRange(workouts, range, now);
  const configuredWeeks = PROGRESS_RANGE_OPTIONS.find((item) => item.key === range)?.weeks;
  const firstWorkoutWeek = rangedWorkouts.length
    ? getMondayStart(rangedWorkouts[0].completedAt)
    : getMondayStart(now);
  const currentWeek = getMondayStart(now);
  const weeks = configuredWeeks ?? Math.max(1, Math.round((currentWeek - firstWorkoutWeek) / WEEK_MS) + 1);
  const visibleWeeks = Math.min(Math.max(weeks, 1), 52);
  const startWeek = currentWeek - (visibleWeeks - 1) * WEEK_MS;

  const buckets = Array.from({ length: visibleWeeks }, (_, index) => {
    const weekStart = startWeek + index * WEEK_MS;
    return {
      weekStart,
      label: formatWeekLabel(weekStart),
      workoutCount: 0,
      workingSetCount: 0,
      trainingSeconds: 0,
      volume: 0,
    } satisfies WeeklyProgressBucket;
  });

  const bucketByWeek = new Map(buckets.map((bucket) => [bucket.weekStart, bucket]));
  rangedWorkouts.forEach((workout) => {
    const bucket = bucketByWeek.get(getMondayStart(workout.completedAt));
    if (!bucket) return;
    bucket.workoutCount += 1;
    bucket.workingSetCount += getWorkingSets(workout).length;
    bucket.trainingSeconds += getWorkoutDurationSeconds(workout);
    bucket.volume += getWorkoutVolume(workout);
  });

  return buckets;
}

export function buildMuscleBreakdown(
  workouts: CompletedWorkout[],
  exercises: ExerciseDefinition[],
  range: ProgressRangeKey,
  now = Date.now(),
): MuscleBreakdownItem[] {
  const counts = new Map<string, number>();

  filterWorkoutsForRange(workouts, range, now).forEach((workout) => {
    workout.exercises.forEach((exercise) => {
      const completedWorkingSets = exercise.sets.filter(isWorkingSet).length;
      if (completedWorkingSets === 0) return;
      const definition = findExerciseDefinition(exercise, exercises);
      const muscle = definition?.primaryMuscle?.trim() || 'Other';
      counts.set(muscle, (counts.get(muscle) ?? 0) + completedWorkingSets);
    });
  });

  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  return [...counts.entries()]
    .map(([muscle, workingSetCount]) => ({
      muscle,
      workingSetCount,
      percentage: total > 0 ? (workingSetCount / total) * 100 : 0,
    }))
    .sort((a, b) => b.workingSetCount - a.workingSetCount);
}

export function buildRecentPrs(
  exercises: ExerciseDefinition[],
  workouts: CompletedWorkout[],
  range: ProgressRangeKey,
  now = Date.now(),
): RecentPrItem[] {
  const cutoff = getProgressRangeCutoff(range, now);

  return exercises
    .flatMap((exercise) =>
      buildExercisePrTimeline(exercise, workouts).map((achievement) => ({
        ...achievement,
        exerciseId: exercise.id,
        exerciseName: exercise.name,
      })),
    )
    .filter((achievement) => cutoff === null || achievement.achievedAt >= cutoff)
    .sort((a, b) => b.achievedAt - a.achievedAt);
}

export function getExercisesWithProgress(
  exercises: ExerciseDefinition[],
  workouts: CompletedWorkout[],
): ExerciseDefinition[] {
  return exercises
    .filter((exercise) =>
      workouts.some((workout) =>
        workout.exercises.some(
          (workoutExercise) =>
            exerciseMatchesDefinition(exercise, workoutExercise) &&
            workoutExercise.sets.some(isWorkingSet),
        ),
      ),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getExerciseTrendMetricOptions(
  exerciseType: ExerciseType,
): ExerciseTrendMetricOption[] {
  switch (exerciseType) {
    case 'Weight & Reps':
    case 'Bodyweight + Added Weight':
      return [
        { key: 'estimatedOneRepMax', label: 'e1RM', higherIsBetter: true },
        { key: 'weight', label: 'Weight', higherIsBetter: true },
        { key: 'reps', label: 'Reps', higherIsBetter: true },
        { key: 'sessionVolume', label: 'Volume', higherIsBetter: true },
      ];
    case 'Assisted Bodyweight':
      return [
        { key: 'assistance', label: 'Assistance', higherIsBetter: false },
        { key: 'reps', label: 'Reps', higherIsBetter: true },
      ];
    case 'Bodyweight & Reps':
    case 'Reps Only':
      return [{ key: 'reps', label: 'Reps', higherIsBetter: true }];
    case 'Duration':
      return [{ key: 'duration', label: 'Duration', higherIsBetter: true }];
    case 'Distance & Duration':
      return [
        { key: 'distance', label: 'Distance', higherIsBetter: true },
        { key: 'pace', label: 'Pace', higherIsBetter: false },
        { key: 'duration', label: 'Duration', higherIsBetter: true },
      ];
  }
}

export function buildExerciseTrend(
  definition: ExerciseDefinition,
  workouts: CompletedWorkout[],
  metric: ExerciseTrendMetricKey,
  range: ProgressRangeKey,
  now = Date.now(),
): ExerciseTrendPoint[] {
  return filterWorkoutsForRange(workouts, range, now)
    .flatMap((workout) => {
      const matchingExercises = workout.exercises.filter((exercise) =>
        exerciseMatchesDefinition(definition, exercise),
      );
      const sets = matchingExercises.flatMap((exercise) =>
        exercise.sets.filter(isWorkingSet),
      );
      const value = getSessionMetric(definition.exerciseType, sets, metric);
      if (value === null) return [];

      return [{
        workoutId: workout.id,
        workoutName: workout.name,
        completedAt: workout.completedAt,
        value,
        displayValue: formatTrendValue(metric, value),
      } satisfies ExerciseTrendPoint];
    })
    .slice(-16);
}

export function formatProgressVolume(volume: number): string {
  if (volume >= 1_000_000) return `${trimDecimal(volume / 1_000_000)}M lb`;
  if (volume >= 1_000) return `${trimDecimal(volume / 1_000)}K lb`;
  return `${Math.round(volume).toLocaleString()} lb`;
}

export function formatProgressDuration(seconds: number): string {
  return formatDurationShort(seconds);
}

export function formatProgressDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function getTrendChange(
  points: ExerciseTrendPoint[],
  higherIsBetter: boolean,
): { label: string; improved: boolean } | null {
  if (points.length < 2) return null;
  const first = points[0].value;
  const latest = points[points.length - 1].value;
  if (first === 0) return null;
  const percent = ((latest - first) / Math.abs(first)) * 100;
  const improved = higherIsBetter ? percent > 0 : percent < 0;
  const direction = percent > 0 ? '+' : '';
  return {
    label: `${direction}${trimDecimal(percent)}%`,
    improved,
  };
}

function getWorkingSets(workout: CompletedWorkout): WorkoutSet[] {
  return workout.exercises.flatMap((exercise) => exercise.sets.filter(isWorkingSet));
}

function isWorkingSet(set: WorkoutSet): boolean {
  return set.completed && (set.setType ?? 'normal') !== 'warmup';
}

function getSessionMetric(
  exerciseType: ExerciseType,
  sets: WorkoutSet[],
  metric: ExerciseTrendMetricKey,
): number | null {
  const values = sets
    .map((set) => getSetMetric(exerciseType, set, metric))
    .filter((value): value is number => value !== null && Number.isFinite(value));

  if (metric === 'sessionVolume') {
    return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
  }
  if (values.length === 0) return null;
  if (metric === 'assistance' || metric === 'pace') return Math.min(...values);
  return Math.max(...values);
}

function getSetMetric(
  exerciseType: ExerciseType,
  set: WorkoutSet,
  metric: ExerciseTrendMetricKey,
): number | null {
  const weight = validNumber(set.weight);
  const reps = validNumber(set.reps);
  const duration = validNumber(set.durationSeconds);
  const distance = validNumber(set.distance);

  switch (metric) {
    case 'estimatedOneRepMax':
      return supportsWeightAndReps(exerciseType) && weight !== null && reps !== null && weight > 0 && reps > 0
        ? weight * (1 + reps / 30)
        : null;
    case 'weight':
      return supportsWeightAndReps(exerciseType) ? weight : null;
    case 'reps':
      return reps;
    case 'sessionVolume':
      return supportsWeightAndReps(exerciseType) && weight !== null && reps !== null
        ? weight * reps
        : null;
    case 'assistance':
      return exerciseType === 'Assisted Bodyweight' ? weight : null;
    case 'duration':
      return duration;
    case 'distance':
      return distance;
    case 'pace':
      return exerciseType === 'Distance & Duration' && distance !== null && distance > 0 && duration !== null
        ? duration / distance
        : null;
  }
}

function supportsWeightAndReps(exerciseType: ExerciseType): boolean {
  return exerciseType === 'Weight & Reps' || exerciseType === 'Bodyweight + Added Weight';
}

function validNumber(value: number | undefined): number | null {
  return value !== undefined && Number.isFinite(value) && value >= 0 ? value : null;
}

function formatTrendValue(metric: ExerciseTrendMetricKey, value: number): string {
  switch (metric) {
    case 'estimatedOneRepMax':
    case 'weight':
    case 'assistance':
      return `${trimDecimal(value)} lb`;
    case 'reps':
      return `${trimDecimal(value)} reps`;
    case 'sessionVolume':
      return formatProgressVolume(value);
    case 'duration':
      return formatClock(value);
    case 'distance':
      return trimDecimal(value);
    case 'pace':
      return `${formatClock(value)}/unit`;
  }
}

function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

function formatWeekLabel(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'numeric',
    day: 'numeric',
  });
}

function trimDecimal(value: number): string {
  return Number.isInteger(value)
    ? value.toLocaleString()
    : value.toFixed(1).replace(/\.0$/, '');
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
