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
  preferences: { weeklyWorkoutGoal: 3 },
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
  const allTimeTrend = buildExerciseTrend(
    bench,
    imported.completedWorkouts,
    'weight',
    'all',
  );

  assert.equal(progress.totalSessions, 4);
  assert.equal(weightRecord?.value, 245);
  assert.equal(weightRecord?.workoutName, 'Upper C');
  assert.deepEqual(allTimeTrend.map((point) => point.value), [185, 245, 225]);
  assert.ok(progress.recentPrs.every((record) => record.displayValue !== '295 lb'));
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
