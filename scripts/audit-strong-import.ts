import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { exerciseLibrary } from '@/constants/exercises';
import type { LiftFlowStateSnapshot } from '@/context/ActiveWorkoutContext';
import { buildStrongRollback, prepareStrongImport } from '@/lib/strongImport';
import { getProjectionCounts, hydrateLiftFlowProjection, projectLiftFlowState, projectionsMatch } from '@/storage/normalizedState';

const snapshot: LiftFlowStateSnapshot = {
  exercises: exerciseLibrary,
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
  preferences: { weeklyWorkoutGoal: 3 },
};

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    throw new Error('Usage: npm run audit:strong -- /path/to/strong_workouts.csv');
  }

  const resolvedPath = resolve(filePath);
  const csv = await readFile(resolvedPath, 'utf8');
  const plan = prepareStrongImport(csv, snapshot);
  const secondPass = prepareStrongImport(csv, plan.nextState);
  const rollback = buildStrongRollback(plan.nextState);
  const projection = projectLiftFlowState(plan.nextState);
  const hydrated = hydrateLiftFlowProjection(projection);
  assert.ok(hydrated, 'normalized v0.5 projection must hydrate');
  assert.ok(projectionsMatch(projection, projectLiftFlowState(hydrated)), 'normalized v0.5 projection identity must round-trip');

  assert.equal(secondPass.preview.workoutsReady, 0, 'a second import should not create duplicate workouts');
  assert.equal(secondPass.preview.duplicateWorkouts, plan.preview.workoutsReady);
  assert.ok(rollback, 'the imported batch should be recoverable');
  assert.equal(rollback.workoutsRemoved, plan.preview.workoutsReady);

  console.log(JSON.stringify({
    file: resolvedPath,
    preview: plan.preview,
    importedWorkouts: plan.nextState.completedWorkouts.length,
      totalExercises: plan.nextState.exercises.length,
      normalizedRows: getProjectionCounts(projection),
    rollback: {
      workoutsRemoved: rollback.workoutsRemoved,
      exercisesRemoved: rollback.exercisesRemoved,
      exercisesRetained: rollback.exercisesRetained,
    },
  }, null, 2));
}

void main();
