import type { CompletedWorkout } from '@/context/ActiveWorkoutContext';
import { getWorkoutDateTimestamp } from '@/lib/workoutStats';

export type HistoryRange = 'all' | '4w' | '12w' | '6m';
export type HistorySourceFilter = 'all' | 'liftflow' | 'strong';

export type HistoryFilterOptions = {
  query?: string;
  source?: HistorySourceFilter;
  range?: HistoryRange;
  exerciseId?: string;
  exerciseName?: string;
  templateId?: string;
  now?: number;
};

const RANGE_DAYS: Record<Exclude<HistoryRange, 'all'>, number> = {
  '4w': 28,
  '12w': 84,
  '6m': 183,
};

export function filterWorkoutHistory(
  workouts: CompletedWorkout[],
  options: HistoryFilterOptions,
) {
  const normalizedQuery = options.query?.trim().toLowerCase() ?? '';
  const normalizedExerciseName = options.exerciseName?.trim().toLowerCase() ?? '';
  const source = options.source ?? 'all';
  const range = options.range ?? 'all';
  const now = options.now ?? Date.now();
  const cutoff = range === 'all'
    ? Number.NEGATIVE_INFINITY
    : now - RANGE_DAYS[range] * 24 * 60 * 60 * 1000;

  return workouts
    .filter((workout) => {
      if (options.templateId && workout.sourceTemplateId !== options.templateId) return false;
      if (source === 'strong' && workout.importSource !== 'strong') return false;
      if (source === 'liftflow' && workout.importSource === 'strong') return false;
      if (getWorkoutDateTimestamp(workout) < cutoff) return false;
      if (options.exerciseId || normalizedExerciseName) {
        const matchesExercise = workout.exercises.some((exercise) =>
          (options.exerciseId && exercise.exerciseDefinitionId === options.exerciseId) ||
          (normalizedExerciseName && exercise.name.trim().toLowerCase() === normalizedExerciseName),
        );
        if (!matchesExercise) return false;
      }
      if (!normalizedQuery) return true;
      return [
        workout.name,
        workout.notes,
        workout.sourceFolder,
        ...workout.exercises.flatMap((exercise) => [exercise.name, exercise.notes]),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery);
    })
    .sort((left, right) => getWorkoutDateTimestamp(right) - getWorkoutDateTimestamp(left));
}
