import assert from 'node:assert/strict';
import test from 'node:test';

import type { CompletedWorkout, WorkoutExercise } from '@/context/ActiveWorkoutContext';
import { applyPreviousPerformance } from '@/lib/previousPerformance';

const plannedExercise: WorkoutExercise = {
  id: 'planned-bench',
  exerciseDefinitionId: 'bench-press',
  name: 'Bench Press',
  exerciseType: 'Weight & Reps',
  sets: [
    { id: 'planned-1', weight: 200, reps: 5, completed: false },
    { id: 'planned-2', weight: 195, reps: 6, completed: false },
    { id: 'planned-3', weight: 185, reps: 8, completed: false },
  ],
};

function workout(id: string, completedAt: number, weights: number[]): CompletedWorkout {
  return {
    id,
    name: 'Upper',
    startedAt: completedAt - 3_600_000,
    completedAt,
    exercises: [
      {
        id: `${id}-bench`,
        exerciseDefinitionId: 'bench-press',
        name: 'Bench Press',
        exerciseType: 'Weight & Reps',
        sets: weights.map((weight, index) => ({
          id: `${id}-set-${index}`,
          weight,
          reps: index + 5,
          completed: true,
        })),
      },
    ],
  };
}

test('uses the newest matching workout for Strong-style previous values', () => {
  const result = applyPreviousPerformance(
    [plannedExercise],
    [workout('older', 1_000, [135, 125]), workout('newer', 2_000, [185, 175])],
  )[0];

  assert.deepEqual(
    result.sets.map((set) => [set.previousWeight, set.previousReps]),
    [[185, 5], [175, 6], [undefined, undefined]],
  );
  assert.deepEqual(
    result.sets.map((set) => [set.weight, set.reps]),
    [[200, 5], [195, 6], [185, 8]],
    'planned values are not overwritten',
  );
});

test('matches a renamed exercise by its stable definition id', () => {
  const renamedHistory = workout('renamed', 3_000, [205]);
  renamedHistory.exercises[0].name = 'Barbell Bench Press';

  const result = applyPreviousPerformance([plannedExercise], [renamedHistory])[0];
  assert.equal(result.sets[0].previousWeight, 205);
});
