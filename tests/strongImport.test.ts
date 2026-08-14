import assert from 'node:assert/strict';
import test from 'node:test';

import type { LiftFlowStateSnapshot } from '@/context/ActiveWorkoutContext';
import { buildStrongRollback, prepareStrongImport } from '@/lib/strongImport';

const snapshot: LiftFlowStateSnapshot = {
  exercises: [],
  folders: [{ id: 'my-workouts', name: 'My Workouts' }],
  templates: [],
  activeWorkout: null,
  incompleteWorkouts: [],
  completedWorkouts: [],
  deletedWorkouts: [],
  restTimerSettings: {
    defaultSeconds: 120,
    autoStart: true,
    vibrationEnabled: true,
    notificationsEnabled: false,
  },
  preferences: { weeklyWorkoutGoal: 3, weightUnit: 'lb', distanceUnit: 'mi', preferredEffort: 'rpe' },
};

const csv = `Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE
2026-08-01 10:00:00,Upper A,1h 5m,Bench Press,1,185,5,,,"Paused, then finished",Good session,8
2026-08-01 10:00:00,Upper A,1h 5m,Bench Press,2,175,7,,,,Good session,9
2026-08-01 10:00:00,Upper A,1h 5m,Bench Press,Rest Timer,,,,120,,,
2026-08-03 08:30:00,Cardio,30m,Outdoor Run,1,,,3.1,1800,,Easy pace,
`;

test('previews, imports, deduplicates, and rolls back a Strong CSV batch', () => {
  const first = prepareStrongImport(csv, snapshot);
  assert.deepEqual(
    {
      sourceRows: first.preview.sourceRows,
      setRows: first.preview.setRows,
      restTimerRows: first.preview.restTimerRows,
      workoutsReady: first.preview.workoutsReady,
      exercisesToCreate: first.preview.exercisesToCreate,
    },
    {
      sourceRows: 4,
      setRows: 3,
      restTimerRows: 1,
      workoutsReady: 2,
      exercisesToCreate: 2,
    },
  );
  assert.equal(first.nextState.completedWorkouts.length, 2);
  assert.equal(first.nextState.exercises.length, 2);
  assert.equal(first.nextState.completedWorkouts[0].importSource, 'strong');

  const duplicate = prepareStrongImport(csv, first.nextState);
  assert.equal(duplicate.preview.workoutsReady, 0);
  assert.equal(duplicate.preview.duplicateWorkouts, 2);
  assert.equal(duplicate.preview.exercisesToCreate, 0);

  const rollback = buildStrongRollback(first.nextState);
  assert.ok(rollback);
  assert.equal(rollback.workoutsRemoved, 2);
  assert.equal(rollback.exercisesRemoved, 2);
  assert.equal(rollback.nextState.completedWorkouts.length, 0);
  assert.equal(rollback.nextState.exercises.length, 0);
});
