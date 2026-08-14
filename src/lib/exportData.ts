import type { LiftFlowStateSnapshot, WorkoutSetType } from '@/context/ActiveWorkoutContext';
import { STORAGE_VERSION } from '@/storage/liftflowStorageCore';

function csvCell(value: unknown) {
  const text = value === undefined || value === null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function setTypeLabel(setType: WorkoutSetType | undefined) {
  if (setType === 'warmup') return 'Warm-up';
  if (setType === 'drop') return 'Drop';
  if (setType === 'failure') return 'Failure';
  if (setType === 'amrap') return 'AMRAP';
  return 'Working';
}

export function buildLiftFlowBackup(snapshot: LiftFlowStateSnapshot) {
  return JSON.stringify(
    {
      version: STORAGE_VERSION,
      app: 'LiftFlow',
      exportedAt: Date.now(),
      ...snapshot,
    },
    null,
    2,
  );
}

export function buildWorkoutHistoryCsv(snapshot: LiftFlowStateSnapshot) {
  const headers = [
    'Workout ID',
    'Workout Date',
    'Workout Name',
    'Workout Notes',
    'Import Source',
    'Exercise',
    'Exercise Type',
    'Exercise Notes',
    'Superset ID',
    'Set Number',
    'Set Type',
    'Weight Unit',
    'Weight / Added / Assistance',
    'Reps',
    'Duration Seconds',
    'Distance',
    'Distance Unit',
    'RPE',
    'RIR',
    'Completed',
  ];

  const rows = snapshot.completedWorkouts.flatMap((workout) =>
    workout.exercises.flatMap((exercise) => {
      let workingSetNumber = 0;
      return exercise.sets.map((set) => {
        if ((set.setType ?? 'normal') === 'normal') workingSetNumber += 1;
        const displaySetNumber = (set.setType ?? 'normal') === 'warmup'
          ? 'W'
          : workingSetNumber || 1;
        return [
          workout.id,
          new Date(workout.completedAt).toISOString(),
          workout.name,
          workout.notes ?? '',
          workout.importSource === 'strong' ? 'Strong' : '',
          exercise.name,
          exercise.exerciseType,
          exercise.notes ?? '',
          exercise.supersetId ?? '',
          displaySetNumber,
          setTypeLabel(set.setType),
          snapshot.preferences.weightUnit,
          set.weight,
          set.reps,
          set.durationSeconds,
          set.distance,
          snapshot.preferences.distanceUnit,
          set.rpe,
          set.rir,
          set.completed ? 'Yes' : 'No',
        ]
          .map(csvCell)
          .join(',');
      });
    }),
  );

  return [headers.map(csvCell).join(','), ...rows].join('\n');
}

export function exportFileStamp() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
}
