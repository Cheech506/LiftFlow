import assert from 'node:assert/strict';
import test from 'node:test';

import type { CompletedWorkout } from '@/context/ActiveWorkoutContext';
import { filterWorkoutHistory } from '@/lib/historyFilters';

const NOW = Date.UTC(2026, 7, 10, 12, 0, 0);

function workout(overrides: Partial<CompletedWorkout> & Pick<CompletedWorkout, 'id' | 'name' | 'startedAt'>): CompletedWorkout {
  return {
    completedAt: overrides.startedAt + 60 * 60 * 1000,
    exercises: [{
      id: `${overrides.id}-exercise`,
      exerciseDefinitionId: overrides.id === 'bench' ? 'bench-press' : 'lat-pulldown',
      name: overrides.id === 'bench' ? 'Bench Press' : 'Lat Pulldown',
      exerciseType: 'Weight & Reps',
      sets: [{ id: `${overrides.id}-set`, weight: 100, reps: 5, completed: true }],
    }],
    ...overrides,
  };
}

const workouts = [
  workout({ id: 'bench', name: 'Upper A', startedAt: NOW - 7 * 24 * 60 * 60 * 1000, sourceTemplateId: 'upper', notes: 'Paused bench' }),
  workout({ id: 'strong', name: 'Pull', startedAt: NOW - 35 * 24 * 60 * 60 * 1000, importSource: 'strong' }),
  workout({ id: 'old', name: 'Old Pull', startedAt: NOW - 200 * 24 * 60 * 60 * 1000 }),
];

test('combines date, source, template, exercise, and text history filters', () => {
  assert.deepEqual(
    filterWorkoutHistory(workouts, { range: '4w', now: NOW }).map((item) => item.id),
    ['bench'],
  );
  assert.deepEqual(
    filterWorkoutHistory(workouts, { source: 'strong', range: '12w', now: NOW }).map((item) => item.id),
    ['strong'],
  );
  assert.deepEqual(
    filterWorkoutHistory(workouts, { templateId: 'upper', exerciseId: 'bench-press', query: 'paused', now: NOW }).map((item) => item.id),
    ['bench'],
  );
  assert.deepEqual(
    filterWorkoutHistory(workouts, { exerciseName: 'Lat Pulldown', range: 'all', now: NOW }).map((item) => item.id),
    ['strong', 'old'],
  );
});
