import type { ExerciseDefinition } from '@/constants/exercises';
import type {
  ActiveWorkout,
  AppPreferences,
  CompletedWorkout,
  DeletedWorkout,
  IncompleteWorkout,
  LiftFlowStateSnapshot,
  RestTimerSettings,
  WorkoutExercise,
  WorkoutFolder,
  WorkoutSet,
  WorkoutTemplate,
} from '@/context/ActiveWorkoutContext';
import { deterministicUuid } from '@/lib/ids';

export const LOCAL_OWNER_ID = '00000000-0000-4000-8000-000000000001';

export type NormalizedTableName =
  | 'preferences'
  | 'exercises'
  | 'workout_folders'
  | 'workout_templates'
  | 'workout_sessions'
  | 'workout_exercises'
  | 'workout_sets';

export type NormalizedRow = {
  rowKey: string;
  syncId: string;
  appId: string;
  parentId: string | null;
  position: number;
  status: string | null;
  searchableName: string | null;
  dataJson: string;
  recordHash: string;
  deletedAt: number | null;
};

export type NormalizedProjection = Record<NormalizedTableName, NormalizedRow[]>;

export type SnapshotCounts = {
  exercises: number;
  folders: number;
  templates: number;
  sessions: number;
  workoutExercises: number;
  workoutSets: number;
};

function hashText(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function row(
  table: NormalizedTableName,
  rowKey: string,
  appId: string,
  data: object,
  options: Partial<Pick<NormalizedRow, 'parentId' | 'position' | 'status' | 'searchableName' | 'deletedAt'>> = {},
): NormalizedRow {
  const dataJson = JSON.stringify(data);
  return {
    rowKey,
    syncId: deterministicUuid(table, rowKey),
    appId,
    parentId: options.parentId ?? null,
    position: options.position ?? 0,
    status: options.status ?? null,
    searchableName: options.searchableName ?? null,
    dataJson,
    recordHash: hashText(JSON.stringify({ appId, dataJson, ...options })),
    deletedAt: options.deletedAt ?? null,
  };
}

function withoutSets(exercise: WorkoutExercise) {
  const { sets: _sets, ...metadata } = exercise;
  return metadata;
}

function addWorkoutExercises(
  projection: NormalizedProjection,
  ownerKind: 'template' | 'session',
  ownerId: string,
  exercises: WorkoutExercise[],
) {
  const parentId = `${ownerKind}:${ownerId}`;
  exercises.forEach((exercise, exerciseIndex) => {
    const exerciseRowKey = `${parentId}:exercise:${exercise.id}`;
    projection.workout_exercises.push(row(
      'workout_exercises',
      exerciseRowKey,
      exercise.id,
      withoutSets(exercise),
      {
        parentId,
        position: exerciseIndex,
        searchableName: exercise.name,
      },
    ));
    exercise.sets.forEach((set, setIndex) => {
      const setRowKey = `${exerciseRowKey}:set:${set.id}`;
      projection.workout_sets.push(row(
        'workout_sets',
        setRowKey,
        set.id,
        set,
        { parentId: exerciseRowKey, position: setIndex },
      ));
    });
  });
}

function addSession(
  projection: NormalizedProjection,
  status: 'active' | 'incomplete' | 'completed' | 'deleted',
  workout: ActiveWorkout | IncompleteWorkout | CompletedWorkout | DeletedWorkout,
  position: number,
) {
  const { exercises, ...metadata } = workout;
  const sessionRowKey = `session:${workout.id}`;
  projection.workout_sessions.push(row(
    'workout_sessions',
    sessionRowKey,
    workout.id,
    metadata,
    {
      position,
      status,
      searchableName: workout.name,
      deletedAt: status === 'deleted' ? (workout as DeletedWorkout).deletedAt : null,
    },
  ));
  addWorkoutExercises(projection, 'session', workout.id, exercises);
}

export function projectLiftFlowState(snapshot: LiftFlowStateSnapshot): NormalizedProjection {
  const projection: NormalizedProjection = {
    preferences: [],
    exercises: [],
    workout_folders: [],
    workout_templates: [],
    workout_sessions: [],
    workout_exercises: [],
    workout_sets: [],
  };

  projection.preferences.push(row('preferences', 'preferences:owner', 'owner', {
    preferences: snapshot.preferences,
    restTimerSettings: snapshot.restTimerSettings,
  }));
  snapshot.exercises.forEach((exercise, index) => projection.exercises.push(row(
    'exercises', `exercise:${exercise.id}`, exercise.id, exercise,
    { position: index, searchableName: exercise.name },
  )));
  snapshot.folders.forEach((folder, index) => projection.workout_folders.push(row(
    'workout_folders', `folder:${folder.id}`, folder.id, folder,
    { position: index, searchableName: folder.name },
  )));
  snapshot.templates.forEach((template, index) => {
    const { exercises, ...metadata } = template;
    projection.workout_templates.push(row(
      'workout_templates', `template:${template.id}`, template.id, metadata,
      { position: index, status: template.archived ? 'archived' : 'active', searchableName: template.name },
    ));
    addWorkoutExercises(projection, 'template', template.id, exercises);
  });
  if (snapshot.activeWorkout) addSession(projection, 'active', snapshot.activeWorkout, 0);
  snapshot.incompleteWorkouts.forEach((workout, index) => addSession(projection, 'incomplete', workout, index));
  snapshot.completedWorkouts.forEach((workout, index) => addSession(projection, 'completed', workout, index));
  snapshot.deletedWorkouts.forEach((workout, index) => addSession(projection, 'deleted', workout, index));
  return projection;
}

function parseData<T>(value: string): T {
  return JSON.parse(value) as T;
}

function sorted(rows: NormalizedRow[]) {
  return [...rows].sort((left, right) => left.position - right.position);
}

function hydrateExercises(
  projection: NormalizedProjection,
  ownerKind: 'template' | 'session',
  ownerId: string,
) {
  const parentId = `${ownerKind}:${ownerId}`;
  return sorted(projection.workout_exercises.filter((item) => item.parentId === parentId)).map((exerciseRow) => ({
    ...parseData<Omit<WorkoutExercise, 'sets'>>(exerciseRow.dataJson),
    sets: sorted(projection.workout_sets.filter((item) => item.parentId === exerciseRow.rowKey))
      .map((setRow) => parseData<WorkoutSet>(setRow.dataJson)),
  }));
}

export function hydrateLiftFlowProjection(projection: NormalizedProjection): LiftFlowStateSnapshot | null {
  const preferenceRow = projection.preferences[0];
  if (!preferenceRow) return null;
  const settings = parseData<{ preferences: AppPreferences; restTimerSettings: RestTimerSettings }>(preferenceRow.dataJson);
  const templates = sorted(projection.workout_templates).map((templateRow) => ({
    ...parseData<Omit<WorkoutTemplate, 'exercises'>>(templateRow.dataJson),
    exercises: hydrateExercises(projection, 'template', templateRow.appId),
  }));
  const sessions = sorted(projection.workout_sessions).map((sessionRow) => ({
    row: sessionRow,
    data: parseData<Omit<ActiveWorkout & Partial<IncompleteWorkout & CompletedWorkout & DeletedWorkout>, 'exercises'>>(sessionRow.dataJson),
    exercises: hydrateExercises(projection, 'session', sessionRow.appId),
  }));
  const active = sessions.find((item) => item.row.status === 'active');
  const incomplete = sessions.filter((item) => item.row.status === 'incomplete');
  const completed = sessions.filter((item) => item.row.status === 'completed');
  const deleted = sessions.filter((item) => item.row.status === 'deleted');

  return {
    preferences: settings.preferences,
    restTimerSettings: settings.restTimerSettings,
    exercises: sorted(projection.exercises).map((item) => parseData<ExerciseDefinition>(item.dataJson)),
    folders: sorted(projection.workout_folders).map((item) => parseData<WorkoutFolder>(item.dataJson)),
    templates,
    activeWorkout: active ? { ...active.data, exercises: active.exercises } as ActiveWorkout : null,
    incompleteWorkouts: incomplete.map((item) => ({ ...item.data, exercises: item.exercises }) as IncompleteWorkout),
    completedWorkouts: completed.map((item) => ({ ...item.data, exercises: item.exercises }) as CompletedWorkout),
    deletedWorkouts: deleted.map((item) => ({ ...item.data, exercises: item.exercises }) as DeletedWorkout),
  };
}

export function getProjectionCounts(projection: NormalizedProjection): SnapshotCounts {
  return {
    exercises: projection.exercises.length,
    folders: projection.workout_folders.length,
    templates: projection.workout_templates.length,
    sessions: projection.workout_sessions.length,
    workoutExercises: projection.workout_exercises.length,
    workoutSets: projection.workout_sets.length,
  };
}

export function projectionIdentity(projection: NormalizedProjection) {
  const identity = (Object.keys(projection) as NormalizedTableName[])
    .flatMap((table) => projection[table].map((item) => `${table}:${item.rowKey}:${item.recordHash}`))
    .sort()
    .join('|');
  return hashText(identity);
}

export function projectionsMatch(left: NormalizedProjection, right: NormalizedProjection) {
  return JSON.stringify(getProjectionCounts(left)) === JSON.stringify(getProjectionCounts(right)) &&
    projectionIdentity(left) === projectionIdentity(right);
}

