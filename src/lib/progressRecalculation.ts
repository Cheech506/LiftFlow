import type { ExerciseDefinition } from '@/constants/exercises';
import type {
  CompletedWorkout,
  LiftFlowStateSnapshot,
  WorkoutExercise,
} from '@/context/ActiveWorkoutContext';
import {
  buildExercisePrTimeline,
  exerciseMatchesDefinition,
  hasQualifyingProgressMetrics,
} from '@/lib/exerciseProgress';
import { getExercisesWithProgress } from '@/lib/progressAnalytics';

export type ProgressRecalculationPlan = {
  nextState: LiftFlowStateSnapshot;
  workoutsScanned: number;
  exercisesWithHistory: number;
  qualifyingSets: number;
  recordEvents: number;
  linksRepaired: number;
  unmatchedExerciseNames: string[];
};

/**
 * Repairs legacy/missing exercise-definition links and verifies every derived
 * record against completed sets. PRs and charts remain derived data, so no
 * separate record table can drift away from the workout history.
 */
export function buildProgressRecalculationPlan(
  snapshot: LiftFlowStateSnapshot,
): ProgressRecalculationPlan {
  const definitionIds = new Set(snapshot.exercises.map((exercise) => exercise.id));
  const unmatchedNames = new Set<string>();
  let linksRepaired = 0;

  const completedWorkouts = snapshot.completedWorkouts.map((workout) => ({
    ...workout,
    exercises: workout.exercises.map((exercise) => {
      if (exercise.exerciseDefinitionId && definitionIds.has(exercise.exerciseDefinitionId)) {
        return exercise;
      }
      const match = findDefinitionByHistory(snapshot.exercises, exercise);
      if (!match) {
        unmatchedNames.add(exercise.name);
        return exercise;
      }
      linksRepaired += 1;
      return { ...exercise, exerciseDefinitionId: match.id };
    }),
  }));

  const exercisesWithProgress = getExercisesWithProgress(snapshot.exercises, completedWorkouts);
  const qualifyingSets = completedWorkouts.reduce(
    (total, workout) => total + workout.exercises.reduce(
      (exerciseTotal, exercise) => exerciseTotal + exercise.sets.filter(
        (set) =>
          set.completed &&
          (set.setType ?? 'normal') !== 'warmup' &&
          hasQualifyingProgressMetrics(exercise.exerciseType, set),
      ).length,
      0,
    ),
    0,
  );
  const recordEvents = exercisesWithProgress.reduce(
    (total, exercise) => total + buildExercisePrTimeline(exercise, completedWorkouts).length,
    0,
  );

  return {
    nextState: { ...snapshot, completedWorkouts },
    workoutsScanned: completedWorkouts.length,
    exercisesWithHistory: exercisesWithProgress.length,
    qualifyingSets,
    recordEvents,
    linksRepaired,
    unmatchedExerciseNames: [...unmatchedNames].sort((left, right) => left.localeCompare(right)),
  };
}

function findDefinitionByHistory(
  definitions: ExerciseDefinition[],
  historicExercise: WorkoutExercise,
): ExerciseDefinition | null {
  return definitions.find((definition) =>
    exerciseMatchesDefinition(definition, historicExercise),
  ) ?? null;
}

export function countImportedStrongWorkouts(workouts: CompletedWorkout[]): number {
  return workouts.filter((workout) => workout.importSource === 'strong').length;
}
