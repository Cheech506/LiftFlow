import type {
  CompletedWorkout,
  WorkoutExercise,
  WorkoutSet,
} from '@/context/ActiveWorkoutContext';

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

function exercisesMatch(current: WorkoutExercise, historic: WorkoutExercise) {
  if (
    current.exerciseDefinitionId &&
    historic.exerciseDefinitionId &&
    current.exerciseDefinitionId === historic.exerciseDefinitionId
  ) {
    return true;
  }

  return normalizeName(current.name) === normalizeName(historic.name);
}

function completedSets(exercise: WorkoutExercise) {
  return exercise.sets.filter((set) => set.completed);
}

function withPreviousMetrics(set: WorkoutSet, previous?: WorkoutSet): WorkoutSet {
  return {
    ...set,
    previousWeight: previous?.weight,
    previousReps: previous?.reps,
    previousDurationSeconds: previous?.durationSeconds,
    previousDistance: previous?.distance,
  };
}

/**
 * Adds Strong-style "Previous" values without changing the planned/current values.
 * The newest completed session for each exercise is used and set rows are matched
 * by their visible order.
 */
export function applyPreviousPerformance(
  exercises: WorkoutExercise[],
  history: CompletedWorkout[],
): WorkoutExercise[] {
  const newestFirst = [...history].sort((left, right) => right.startedAt - left.startedAt);

  return exercises.map((exercise) => {
    const previousExercise = newestFirst
      .flatMap((workout) => workout.exercises)
      .find((candidate) => exercisesMatch(exercise, candidate) && completedSets(candidate).length > 0);
    const previousSets = previousExercise ? completedSets(previousExercise) : [];

    return {
      ...exercise,
      sets: exercise.sets.map((set, index) => withPreviousMetrics(set, previousSets[index])),
    };
  });
}

