import type { ExerciseDefinition, ExerciseType } from '@/constants/exercises';

export type WorkoutMetricField = 'weight' | 'reps' | 'durationSeconds' | 'distance';

export type MetricValues = {
  weight?: number;
  reps?: number;
  durationSeconds?: number;
  distance?: number;
  previousWeight?: number;
  previousReps?: number;
  previousDurationSeconds?: number;
  previousDistance?: number;
};

export type MetricSlot = {
  field: WorkoutMetricField;
  label: string;
  decimal?: boolean;
};

export const EXERCISE_TYPE_OPTIONS: ExerciseType[] = [
  'Weight & Reps',
  'Bodyweight & Reps',
  'Bodyweight + Added Weight',
  'Assisted Bodyweight',
  'Reps Only',
  'Duration',
  'Distance & Duration',
];

export function normalizeExerciseType(value: unknown): ExerciseType {
  if (value === 'Bodyweight') return 'Bodyweight & Reps';
  return EXERCISE_TYPE_OPTIONS.includes(value as ExerciseType)
    ? (value as ExerciseType)
    : 'Weight & Reps';
}

export function getMetricSlots(exerciseType: ExerciseType): Array<MetricSlot | null> {
  switch (exerciseType) {
    case 'Weight & Reps':
      return [
        { field: 'weight', label: 'LB', decimal: true },
        { field: 'reps', label: 'REPS' },
      ];
    case 'Bodyweight & Reps':
      return [null, { field: 'reps', label: 'REPS' }];
    case 'Bodyweight + Added Weight':
      return [
        { field: 'weight', label: 'ADD LB', decimal: true },
        { field: 'reps', label: 'REPS' },
      ];
    case 'Assisted Bodyweight':
      return [
        { field: 'weight', label: 'ASSIST', decimal: true },
        { field: 'reps', label: 'REPS' },
      ];
    case 'Reps Only':
      return [null, { field: 'reps', label: 'REPS' }];
    case 'Duration':
      return [null, { field: 'durationSeconds', label: 'SEC' }];
    case 'Distance & Duration':
      return [
        { field: 'distance', label: 'DIST', decimal: true },
        { field: 'durationSeconds', label: 'SEC' },
      ];
  }
}

export function defaultMetricsForExercise(definition: ExerciseDefinition) {
  const values: Pick<MetricValues, 'weight' | 'reps' | 'durationSeconds' | 'distance'> = {};
  const type = normalizeExerciseType(definition.exerciseType);

  if (
    type === 'Weight & Reps' ||
    type === 'Bodyweight + Added Weight' ||
    type === 'Assisted Bodyweight'
  ) {
    values.weight = definition.defaultWeight;
  }
  if (
    type === 'Weight & Reps' ||
    type === 'Bodyweight & Reps' ||
    type === 'Bodyweight + Added Weight' ||
    type === 'Assisted Bodyweight' ||
    type === 'Reps Only'
  ) {
    values.reps = definition.defaultReps ?? 8;
  }
  if (type === 'Duration' || type === 'Distance & Duration') {
    values.durationSeconds = definition.defaultDurationSeconds ?? 60;
  }
  if (type === 'Distance & Duration') {
    values.distance = definition.defaultDistance;
  }

  return values;
}

export function copyMetricValues(values: MetricValues) {
  return {
    previousWeight: values.weight,
    previousReps: values.reps,
    previousDurationSeconds: values.durationSeconds,
    previousDistance: values.distance,
    weight: values.weight,
    reps: values.reps,
    durationSeconds: values.durationSeconds,
    distance: values.distance,
  };
}

export function clearIrrelevantMetrics<T extends MetricValues>(
  values: T,
  exerciseType: ExerciseType,
): T {
  const fields = new Set(
    getMetricSlots(exerciseType)
      .filter((slot): slot is MetricSlot => Boolean(slot))
      .map((slot) => slot.field),
  );

  return {
    ...values,
    weight: fields.has('weight') ? values.weight : undefined,
    reps: fields.has('reps') ? values.reps : undefined,
    durationSeconds: fields.has('durationSeconds') ? values.durationSeconds : undefined,
    distance: fields.has('distance') ? values.distance : undefined,
    previousWeight: fields.has('weight') ? values.previousWeight : undefined,
    previousReps: fields.has('reps') ? values.previousReps : undefined,
    previousDurationSeconds: fields.has('durationSeconds')
      ? values.previousDurationSeconds
      : undefined,
    previousDistance: fields.has('distance') ? values.previousDistance : undefined,
  };
}

function displayNumber(value: number | undefined) {
  return value === undefined ? '—' : String(value);
}

export function formatSeconds(value: number | undefined) {
  if (value === undefined) return '—';
  const safe = Math.max(0, Math.round(value));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return minutes > 0 ? `${minutes}:${String(seconds).padStart(2, '0')}` : `${seconds}s`;
}

export function formatSetMetrics(exerciseType: ExerciseType, values: MetricValues) {
  switch (exerciseType) {
    case 'Weight & Reps':
      return `${displayNumber(values.weight)} lb × ${displayNumber(values.reps)} reps`;
    case 'Bodyweight & Reps':
      return `${displayNumber(values.reps)} reps`;
    case 'Bodyweight + Added Weight':
      return `+${displayNumber(values.weight)} lb × ${displayNumber(values.reps)} reps`;
    case 'Assisted Bodyweight':
      return `${displayNumber(values.weight)} lb assist × ${displayNumber(values.reps)} reps`;
    case 'Reps Only':
      return `${displayNumber(values.reps)} reps`;
    case 'Duration':
      return formatSeconds(values.durationSeconds);
    case 'Distance & Duration':
      return `${displayNumber(values.distance)} distance · ${formatSeconds(values.durationSeconds)}`;
  }
}

export function formatPreviousMetrics(exerciseType: ExerciseType, values: MetricValues) {
  return formatSetMetrics(exerciseType, {
    weight: values.previousWeight,
    reps: values.previousReps,
    durationSeconds: values.previousDurationSeconds,
    distance: values.previousDistance,
  });
}

export function exerciseTypeUsesWeight(exerciseType: ExerciseType) {
  return (
    exerciseType === 'Weight & Reps' ||
    exerciseType === 'Bodyweight + Added Weight' ||
    exerciseType === 'Assisted Bodyweight'
  );
}

export function exerciseTypeUsesReps(exerciseType: ExerciseType) {
  return (
    exerciseType === 'Weight & Reps' ||
    exerciseType === 'Bodyweight & Reps' ||
    exerciseType === 'Bodyweight + Added Weight' ||
    exerciseType === 'Assisted Bodyweight' ||
    exerciseType === 'Reps Only'
  );
}

export function exerciseTypeUsesDuration(exerciseType: ExerciseType) {
  return exerciseType === 'Duration' || exerciseType === 'Distance & Duration';
}

export function exerciseTypeUsesDistance(exerciseType: ExerciseType) {
  return exerciseType === 'Distance & Duration';
}
