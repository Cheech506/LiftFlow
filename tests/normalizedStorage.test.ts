import assert from 'node:assert/strict';
import test from 'node:test';

import type { LiftFlowStateSnapshot } from '@/context/ActiveWorkoutContext';
import {
  getProjectionCounts,
  hydrateLiftFlowProjection,
  projectLiftFlowState,
  projectionsMatch,
} from '@/storage/normalizedState';

const snapshot: LiftFlowStateSnapshot = {
  exercises: [{
    id: 'bench-definition',
    name: 'Bench Press',
    detail: 'Chest · Barbell',
    primaryMuscle: 'Chest',
    equipment: 'Barbell',
    exerciseType: 'Weight & Reps',
    defaultReps: 5,
    defaultRestSeconds: 120,
  }],
  folders: [{ id: 'upper-folder', name: 'Upper / Lower' }],
  templates: [{
    id: 'upper-template',
    name: 'Upper A',
    folder: 'Upper / Lower',
    detail: '2 exercises · 2 planned sets',
    exercises: [
      { id: 'template-bench', exerciseDefinitionId: 'bench-definition', name: 'Bench Press', exerciseType: 'Weight & Reps', supersetId: 'template-group', sets: [{ id: 'template-set-1', weight: 185, reps: 5, completed: false }] },
      { id: 'template-row', name: 'Barbell Row', exerciseType: 'Weight & Reps', supersetId: 'template-group', sets: [{ id: 'template-set-2', weight: 165, reps: 8, completed: false }] },
    ],
  }],
  activeWorkout: null,
  incompleteWorkouts: [{
    id: 'incomplete-1',
    name: 'Paused Upper',
    startedAt: 1_000,
    savedAt: 2_000,
    exercises: [{ id: 'paused-bench', name: 'Bench Press', exerciseType: 'Weight & Reps', sets: [{ id: 'paused-set', weight: 185, reps: 5, completed: true }] }],
  }],
  completedWorkouts: [{
    id: 'completed-1',
    name: 'Upper A',
    startedAt: 3_000,
    completedAt: 4_000,
    sourceTemplateId: 'upper-template',
    exercises: [{ id: 'completed-bench', name: 'Bench Press', exerciseType: 'Weight & Reps', sets: [{ id: 'completed-set', weight: 190, reps: 5, completed: true }] }],
  }],
  deletedWorkouts: [],
  restTimerSettings: { defaultSeconds: 120, autoStart: true, vibrationEnabled: true, notificationsEnabled: false },
  preferences: { weeklyWorkoutGoal: 3 },
};

test('projects every workout entity into normalized relationship rows', () => {
  const projection = projectLiftFlowState(snapshot);
  assert.deepEqual(getProjectionCounts(projection), {
    exercises: 1,
    folders: 1,
    templates: 1,
    sessions: 2,
    workoutExercises: 4,
    workoutSets: 4,
  });
  assert.equal(new Set(projection.workout_sets.map((item) => item.syncId)).size, 4);
});

test('round-trips normalized rows without losing templates, history, supersets, or incomplete workouts', () => {
  const projection = projectLiftFlowState(snapshot);
  const restored = hydrateLiftFlowProjection(projection);
  assert.deepEqual(restored, snapshot);
  assert.ok(restored);
  assert.equal(restored.templates[0].exercises[0].supersetId, 'template-group');
  assert.equal(restored.incompleteWorkouts[0].savedAt, 2_000);
  assert.equal(restored.completedWorkouts[0].sourceTemplateId, 'upper-template');
  assert.ok(projectionsMatch(projection, projectLiftFlowState(restored)));
});

