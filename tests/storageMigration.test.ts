import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeLiftFlowState,
  RECENTLY_DELETED_RETENTION_MS,
  STORAGE_VERSION,
} from '@/storage/liftflowStorageCore';

function completedWorkout(id: string, completedAt: number) {
  return {
    id,
    name: 'Workout',
    startedAt: completedAt - 3_600_000,
    completedAt,
    exercises: [
      {
        id: `${id}-exercise`,
        name: 'Bench Press',
        exerciseType: 'Weight & Reps',
        sets: [{ id: `${id}-set`, weight: 100, reps: 5, completed: true }],
      },
    ],
  };
}

test('migrates a v9 snapshot and supplies v0.5 defaults', () => {
  const migrated = normalizeLiftFlowState({
    version: 9,
    exercises: [],
    folders: [],
    templates: [],
    activeWorkout: null,
    completedWorkouts: [],
    restTimerSettings: { defaultSeconds: 90, autoStart: true },
  });

  assert.ok(migrated);
  assert.equal(migrated.version, STORAGE_VERSION);
  assert.equal(migrated.preferences.weeklyWorkoutGoal, 3);
  assert.deepEqual(migrated.deletedWorkouts, []);
  assert.deepEqual(migrated.incompleteWorkouts, []);
  assert.equal(migrated.restTimerSettings.defaultSeconds, 90);
});

test('preserves incomplete workouts and superset membership', () => {
  const normalized = normalizeLiftFlowState({
    version: 10,
    exercises: [],
    folders: [],
    templates: [],
    activeWorkout: null,
    incompleteWorkouts: [{
      id: 'paused',
      name: 'Paused Upper',
      startedAt: 1_000,
      savedAt: 2_000,
      exercises: [
        { id: 'bench', name: 'Bench Press', exerciseType: 'Weight & Reps', supersetId: 'group-a', sets: [{ id: 'bench-set', weight: 185, reps: 5, completed: true }] },
        { id: 'row', name: 'Barbell Row', exerciseType: 'Weight & Reps', supersetId: 'group-a', sets: [{ id: 'row-set', weight: 165, reps: 8, completed: false }] },
      ],
    }],
    completedWorkouts: [],
    deletedWorkouts: [],
    restTimerSettings: {},
    preferences: {},
  });

  assert.ok(normalized);
  assert.equal(normalized.incompleteWorkouts[0].savedAt, 2_000);
  assert.deepEqual(normalized.incompleteWorkouts[0].exercises.map((item) => item.supersetId), ['group-a', 'group-a']);
});

test('keeps recent deleted workouts and purges entries older than 30 days', () => {
  const now = Date.now();
  const recent = completedWorkout('recent', now - 1_000);
  const expired = completedWorkout('expired', now - RECENTLY_DELETED_RETENTION_MS - 1_000);
  const normalized = normalizeLiftFlowState({
    version: STORAGE_VERSION,
    exercises: [],
    folders: [],
    templates: [],
    activeWorkout: null,
    completedWorkouts: [],
    deletedWorkouts: [
      { ...recent, deletedAt: now - 1_000 },
      { ...expired, deletedAt: now - RECENTLY_DELETED_RETENTION_MS - 1_000 },
    ],
    restTimerSettings: {},
    preferences: { weeklyWorkoutGoal: 50 },
  });

  assert.ok(normalized);
  assert.deepEqual(normalized.deletedWorkouts.map((item) => item.id), ['recent']);
  assert.equal(normalized.preferences.weeklyWorkoutGoal, 14);
});
