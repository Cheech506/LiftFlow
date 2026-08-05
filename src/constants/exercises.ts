export type ExerciseType =
  | 'Weight & Reps'
  | 'Bodyweight & Reps'
  | 'Bodyweight + Added Weight'
  | 'Assisted Bodyweight'
  | 'Reps Only'
  | 'Duration'
  | 'Distance & Duration';

export type ExerciseDefinition = {
  id: string;
  name: string;
  detail: string;
  primaryMuscle: string;
  equipment: string;
  exerciseType: ExerciseType;
  defaultWeight?: number;
  defaultReps?: number;
  defaultDurationSeconds?: number;
  defaultDistance?: number;
  favorite?: boolean;
  recent?: boolean;
  isCustom?: boolean;
  archived?: boolean;
  previousNames?: string[];
};

export const exerciseLibrary: ExerciseDefinition[] = [
  {
    id: 'bench-press',
    name: 'Bench Press',
    detail: 'Chest · Barbell',
    primaryMuscle: 'Chest',
    equipment: 'Barbell',
    exerciseType: 'Weight & Reps',
    defaultWeight: 185,
    defaultReps: 6,
    favorite: true,
  },
  {
    id: 'lat-pulldown',
    name: 'Lat Pulldown',
    detail: 'Back · Cable',
    primaryMuscle: 'Back',
    equipment: 'Cable',
    exerciseType: 'Weight & Reps',
    defaultWeight: 150,
    defaultReps: 10,
    favorite: true,
  },
  {
    id: 'leg-press',
    name: 'Leg Press',
    detail: 'Quadriceps · Machine',
    primaryMuscle: 'Quadriceps',
    equipment: 'Machine',
    exerciseType: 'Weight & Reps',
    defaultWeight: 410,
    defaultReps: 10,
    favorite: true,
  },
  {
    id: 'incline-dumbbell-press',
    name: 'Incline Dumbbell Press',
    detail: 'Chest · Dumbbell',
    primaryMuscle: 'Chest',
    equipment: 'Dumbbell',
    exerciseType: 'Weight & Reps',
    defaultWeight: 65,
    defaultReps: 10,
    recent: true,
  },
  {
    id: 'cable-lateral-raise',
    name: 'Cable Lateral Raise',
    detail: 'Shoulders · Cable',
    primaryMuscle: 'Shoulders',
    equipment: 'Cable',
    exerciseType: 'Weight & Reps',
    defaultWeight: 20,
    defaultReps: 12,
    recent: true,
  },
  {
    id: 'triceps-pushdown',
    name: 'Triceps Pushdown',
    detail: 'Triceps · Cable',
    primaryMuscle: 'Triceps',
    equipment: 'Cable',
    exerciseType: 'Weight & Reps',
    defaultWeight: 50,
    defaultReps: 12,
    recent: true,
  },
  {
    id: 'pull-up',
    name: 'Pull-Up',
    detail: 'Back · Bodyweight',
    primaryMuscle: 'Back',
    equipment: 'Bodyweight',
    exerciseType: 'Bodyweight & Reps',
    defaultReps: 8,
  },
  {
    id: 'barbell-row',
    name: 'Barbell Row',
    detail: 'Back · Barbell',
    primaryMuscle: 'Back',
    equipment: 'Barbell',
    exerciseType: 'Weight & Reps',
    defaultWeight: 165,
    defaultReps: 8,
  },
  {
    id: 'romanian-deadlift',
    name: 'Romanian Deadlift',
    detail: 'Hamstrings · Barbell',
    primaryMuscle: 'Hamstrings',
    equipment: 'Barbell',
    exerciseType: 'Weight & Reps',
    defaultWeight: 185,
    defaultReps: 8,
  },
];
