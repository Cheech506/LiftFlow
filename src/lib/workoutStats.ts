import type { CompletedWorkout, WorkoutSet } from '@/context/ActiveWorkoutContext';

export function getCompletedSets(workout: CompletedWorkout): WorkoutSet[] {
  return workout.exercises.flatMap((exercise) =>
    exercise.sets.filter((set) => set.completed),
  );
}

export function getWorkoutDurationSeconds(workout: CompletedWorkout): number {
  return Math.max(0, Math.floor((workout.completedAt - workout.startedAt) / 1000));
}

export function getWorkoutVolume(workout: CompletedWorkout): number {
  return workout.exercises.reduce((workoutTotal, exercise) => {
    if (
      exercise.exerciseType !== 'Weight & Reps' &&
      exercise.exerciseType !== 'Bodyweight + Added Weight'
    ) {
      return workoutTotal;
    }

    const exerciseVolume = exercise.sets.reduce((total, set) => {
      if (!set.completed || (set.setType ?? 'normal') === 'warmup') return total;
      if (set.weight === undefined || set.reps === undefined) return total;
      return total + set.weight * set.reps;
    }, 0);

    return workoutTotal + exerciseVolume;
  }, 0);
}

export function formatDurationShort(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function getMondayStart(timestamp = Date.now()): number {
  const date = new Date(timestamp);
  const day = date.getDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;

  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - daysSinceMonday);
  return date.getTime();
}

export function isInCurrentWeek(workout: CompletedWorkout): boolean {
  return workout.completedAt >= getMondayStart();
}
