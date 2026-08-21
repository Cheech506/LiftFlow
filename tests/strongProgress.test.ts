import assert from 'node:assert/strict';
import test from 'node:test';

import type { LiftFlowStateSnapshot } from '@/context/ActiveWorkoutContext';
import { buildExerciseProgress } from '@/lib/exerciseProgress';
import { buildExerciseTrend } from '@/lib/progressAnalytics';
import { buildProgressRecalculationPlan } from '@/lib/progressRecalculation';
import { prepareStrongImport } from '@/lib/strongImport';

const snapshot: LiftFlowStateSnapshot = {
  exercises: [{
    id: 'bench-press',
    name: 'Bench Press',
    detail: 'Chest · Barbell',
    primaryMuscle: 'Chest',
    equipment: 'Barbell',
    exerciseType: 'Weight & Reps',
  }],
  folders: [],
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

const header = 'Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE';
const csv = `${header}
2020-01-01 10:00:00,Upper A,1h,Bench Press,W,135,5,,,,,
2020-01-01 10:00:00,Upper A,1h,Bench Press,1,185,5,,,,,8
2020-02-01 10:00:00,Upper B,1h,Bench Press,1,295,0,,,,,10
2020-03-01 10:00:00,Upper C,1h,Bench Press,1,245,1,,,,,9
2020-04-01 10:00:00,Upper D,1h,Bench Press,1,225,5,,,,,9`;

test('Strong history rebuilds all-time exercise records without zero-rep fake PRs', () => {
  const imported = prepareStrongImport(csv, snapshot).nextState;
  const bench = imported.exercises[0];
  const progress = buildExerciseProgress(bench, imported.completedWorkouts);
  const weightRecord = progress.records.find((record) => record.key === 'weight');
  const oneRepMax = progress.repMaxRecords.find((record) => record.repCount === 1);
  const fiveRepMax = progress.repMaxRecords.find((record) => record.repCount === 5);
  const twoRepMax = progress.repMaxRecords.find((record) => record.repCount === 2);
  const allTimeTrend = buildExerciseTrend(
    bench,
    imported.completedWorkouts,
    'weight',
    'all',
  );

  assert.equal(progress.totalSessions, 4);
  assert.equal(weightRecord?.value, 245);
  assert.equal(weightRecord?.workoutName, 'Upper C');
  assert.equal(progress.repMaxRecords.length, 12);
  assert.equal(oneRepMax?.weight, 245);
  assert.equal(oneRepMax?.workoutName, 'Upper C');
  assert.equal(fiveRepMax?.weight, 225);
  assert.equal(fiveRepMax?.workoutName, 'Upper D');
  assert.equal(twoRepMax?.weight, 225);
  assert.equal(twoRepMax?.workoutName, 'Upper D');
  assert.deepEqual(allTimeTrend.map((point) => point.value), [185, 245, 225]);
  assert.ok(progress.recentPrs.every((record) => record.displayValue !== '295 lb'));
});

test('higher-rep sets raise every supported lower-rep record without using warmups or failed attempts', () => {
  const exactRepCsv = `${header}
2024-01-01 10:00:00,Session 1,1h,Bench Press,W,300,3,,,,,
2024-01-01 10:00:00,Session 1,1h,Bench Press,1,200,3,,,,,8
2024-02-01 10:00:00,Session 2,1h,Bench Press,1,215,3,,,,,9
2024-03-01 10:00:00,Session 3,1h,Bench Press,1,225,5,,,,,9
2024-04-01 10:00:00,Session 4,1h,Bench Press,1,315,0,,,,,10
2024-05-01 10:00:00,Session 5,1h,Bench Press,1,205,13,,,,,9`;
  const imported = prepareStrongImport(exactRepCsv, snapshot).nextState;
  const progress = buildExerciseProgress(imported.exercises[0], imported.completedWorkouts);

  assert.deepEqual(
    progress.repMaxRecords.map((record) => record.repCount),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  );
  assert.equal(progress.repMaxRecords[0].weight, 225);
  assert.equal(progress.repMaxRecords[1].weight, 225);
  assert.equal(progress.repMaxRecords[2].weight, 225);
  assert.equal(progress.repMaxRecords[2].workoutName, 'Session 3');
  assert.equal(progress.repMaxRecords[3].weight, 225);
  assert.equal(progress.repMaxRecords[4].weight, 225);
  assert.equal(progress.repMaxRecords[5].weight, 205);
  assert.equal(progress.repMaxRecords[11].weight, 205);
  assert.equal(progress.repMaxRecords[11].workoutName, 'Session 5');
  assert.ok(progress.repMaxRecords.every((record) => record.weight !== 300));
  assert.ok(progress.repMaxRecords.every((record) => record.weight !== 315));
});

test('ALL exercise trend keeps complete imported history instead of only 16 sessions', () => {
  const rows = Array.from({ length: 24 }, (_, index) =>
    `2024-${String((index % 12) + 1).padStart(2, '0')}-${String(Math.floor(index / 12) + 1).padStart(2, '0')} 10:00:00,Session ${index + 1},1h,Bench Press,1,${100 + index},5,,,,,8`,
  );
  const imported = prepareStrongImport([header, ...rows].join('\n'), snapshot).nextState;
  const points = buildExerciseTrend(
    imported.exercises[0],
    imported.completedWorkouts,
    'weight',
    'all',
  );

  assert.equal(points.length, 24);
  assert.equal(points[0].value, 100);
  assert.equal(points[23].value, 123);
});

test('manual progress recalculation repairs a missing historical exercise link', () => {
  const imported = prepareStrongImport(csv, snapshot).nextState;
  const damaged: LiftFlowStateSnapshot = {
    ...imported,
    completedWorkouts: imported.completedWorkouts.map((workout) => ({
      ...workout,
      exercises: workout.exercises.map((exercise) => ({
        ...exercise,
        exerciseDefinitionId: undefined,
      })),
    })),
  };
  const plan = buildProgressRecalculationPlan(damaged);

  assert.equal(plan.linksRepaired, 4);
  assert.equal(plan.exercisesWithHistory, 1);
  assert.equal(plan.nextState.completedWorkouts[0].exercises[0].exerciseDefinitionId, 'bench-press');
  assert.ok(plan.qualifyingSets > 0);
  assert.ok(plan.recordEvents > 0);
});
