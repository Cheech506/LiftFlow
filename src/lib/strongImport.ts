import type { ExerciseDefinition, ExerciseType } from '@/constants/exercises';
import type {
  CompletedWorkout,
  LiftFlowStateSnapshot,
  WorkoutExercise,
  WorkoutSet,
  WorkoutSetType,
} from '@/context/ActiveWorkoutContext';

const REQUIRED_COLUMNS = [
  'Date',
  'Workout Name',
  'Duration',
  'Exercise Name',
  'Set Order',
  'Weight',
  'Reps',
  'Distance',
  'Seconds',
  'Notes',
  'Workout Notes',
  'RPE',
] as const;

type StrongColumn = (typeof REQUIRED_COLUMNS)[number];

const MAX_CREDIBLE_STRONG_DURATION_SECONDS = 6 * 60 * 60;

type CsvRecord = Record<StrongColumn, string> & { __rowNumber: number };

type StrongExerciseSummary = {
  name: string;
  rows: CsvRecord[];
  restRows: CsvRecord[];
  firstRowNumber: number;
};

export type StrongImportPreview = {
  sourceRows: number;
  setRows: number;
  restTimerRows: number;
  invalidRows: number;
  workoutsFound: number;
  workoutsReady: number;
  duplicateWorkouts: number;
  exercisesMatched: number;
  exercisesToCreate: number;
  earliestWorkoutAt?: number;
  latestWorkoutAt?: number;
  warnings: string[];
};

export type StrongImportPlan = {
  batchId: string;
  importedAt: number;
  preview: StrongImportPreview;
  nextState: LiftFlowStateSnapshot;
  createdExerciseIds: string[];
  importedWorkoutIds: string[];
};

export type StrongRollbackPlan = {
  batchId: string;
  importedAt: number;
  workoutsRemoved: number;
  exercisesRemoved: number;
  exercisesRetained: number;
  nextState: LiftFlowStateSnapshot;
};

export type LastStrongImport = {
  batchId: string;
  importedAt: number;
  workoutCount: number;
};

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error('The Strong CSV contains an unfinished quoted field.');
  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }
  const nonEmptyRows = rows.filter((item) => item.some((value) => value.trim().length > 0));
  const headers = nonEmptyRows.shift()?.map((header) => header.replace(/^\uFEFF/, '').trim()) ?? [];
  return { headers, rows: nonEmptyRows };
}

function readStrongRows(text: string) {
  const parsed = parseCsv(text);
  const headerIndex = new Map(parsed.headers.map((header, index) => [header.toLowerCase(), index]));
  const missing = REQUIRED_COLUMNS.filter((column) => !headerIndex.has(column.toLowerCase()));
  if (missing.length > 0) {
    throw new Error(`This does not look like a Strong workout export. Missing columns: ${missing.join(', ')}.`);
  }

  const records: CsvRecord[] = parsed.rows.map((row, index) => {
    const record = { __rowNumber: index + 2 } as CsvRecord;
    REQUIRED_COLUMNS.forEach((column) => {
      record[column] = row[headerIndex.get(column.toLowerCase()) ?? -1]?.trim() ?? '';
    });
    return record;
  });
  return records;
}

function parseStrongDate(value: string): number | undefined {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return undefined;
  const [, year, month, day, hour, minute, second] = match;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
  const timestamp = date.getTime();
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

function parseDurationSeconds(value: string): number {
  const normalized = value.toLowerCase().trim();
  const hours = Number(normalized.match(/(\d+(?:\.\d+)?)\s*h/)?.[1] ?? 0);
  const minutes = Number(normalized.match(/(\d+(?:\.\d+)?)\s*m/)?.[1] ?? 0);
  const seconds = Number(normalized.match(/(\d+(?:\.\d+)?)\s*s/)?.[1] ?? 0);
  return Math.max(0, Math.round(hours * 3600 + minutes * 60 + seconds));
}

function numberValue(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number.parseFloat(value.replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function positiveNumber(value: string): number | undefined {
  const parsed = numberValue(value);
  return parsed !== undefined && parsed > 0 ? parsed : undefined;
}

function normalizedName(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function splitStrongExerciseName(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  return {
    base: (match?.[1] ?? trimmed).trim(),
    qualifier: match?.[2]?.trim() ?? '',
  };
}

function inferEquipment(name: string) {
  const normalized = normalizedName(name);
  if (normalized.includes('smith machine')) return 'Smith Machine';
  if (normalized.includes('dumbbell')) return 'Dumbbell';
  if (normalized.includes('barbell')) return 'Barbell';
  if (normalized.includes('cable') || normalized.includes('pulldown') || normalized.includes('pushdown')) return 'Cable';
  if (normalized.includes('plate loaded')) return 'Plate Loaded';
  if (normalized.includes('machine') || normalized.includes('leg extension') || normalized.includes('leg curl')) return 'Machine';
  if (normalized.includes('landmine')) return 'Landmine';
  if (normalized.includes('assisted')) return 'Assisted Machine';
  if (isBodyweightName(normalized)) return 'Bodyweight';
  return 'Other';
}

function inferPrimaryMuscle(name: string) {
  const normalized = normalizedName(name);
  if (/bicep|bi cep|curl/.test(normalized)) return 'Biceps';
  if (/tricep|tri cep|pushdown|jm press/.test(normalized)) return 'Triceps';
  if (/bench|chest|fly|push up/.test(normalized)) return 'Chest';
  if (/lateral raise|rear delt|shoulder|overhead press|upright row/.test(normalized)) return 'Shoulders';
  if (/leg curl|rdl|stiff leg|good morning|hamstring/.test(normalized)) return 'Hamstrings';
  if (/pulldown|row|pull up|back extension|deadlift/.test(normalized)) return 'Back';
  if (/leg extension|leg press|squat|sissy|bulgarian/.test(normalized)) return 'Quadriceps';
  if (/calf/.test(normalized)) return 'Calves';
  if (/tibialis/.test(normalized)) return 'Tibialis';
  if (/crunch|leg raise|sit up|plank/.test(normalized)) return 'Core';
  if (/stretch/.test(normalized)) return 'Full Body';
  return 'Other';
}

function isBodyweightName(normalized: string) {
  return /(^| )(pull ups?|push ups?|dips?|crunch(?:es)?|leg raises?|sit ups?|planks?|burpees?|mountain climbers?)( |$)/.test(normalized);
}

function inferExerciseType(summary: StrongExerciseSummary): ExerciseType {
  const normalized = normalizedName(summary.name);
  if (summary.rows.some((row) => (positiveNumber(row.Distance) ?? 0) > 0)) return 'Distance & Duration';
  if (summary.rows.some((row) => (positiveNumber(row.Seconds) ?? 0) > 0)) return 'Duration';
  if (normalized.includes('assisted')) return 'Assisted Bodyweight';
  if (isBodyweightName(normalized)) return 'Bodyweight & Reps';
  if (summary.rows.some((row) => (positiveNumber(row.Weight) ?? 0) > 0)) return 'Weight & Reps';
  if (/press|curl|row|squat|raise|extension|deadlift|pulldown|pushdown|fly|morning/.test(normalized)) {
    return 'Weight & Reps';
  }
  return 'Reps Only';
}

function median(values: number[]) {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function roundedMedian(values: Array<number | undefined>, fallback?: number) {
  const valid = values.filter((value): value is number => value !== undefined && Number.isFinite(value));
  const result = median(valid);
  return result === undefined ? fallback : Math.round(result * 100) / 100;
}

function findExistingDefinition(name: string, definitions: ExerciseDefinition[]) {
  const strongParts = splitStrongExerciseName(name);
  const strongExact = normalizedName(name);
  const strongBase = normalizedName(strongParts.base);
  const strongEquipment = inferEquipment(name);

  const exact = definitions.find((definition) =>
    [definition.name, ...(definition.previousNames ?? [])]
      .some((candidate) => normalizedName(candidate) === strongExact),
  );
  if (exact) return exact;

  const qualifier = normalizedName(strongParts.qualifier);
  const pureEquipmentQualifiers = new Set([
    'barbell',
    'dumbbell',
    'cable',
    'machine',
    'smith machine',
    'bodyweight',
    'plate loaded',
  ]);
  if (qualifier && !pureEquipmentQualifiers.has(qualifier)) return undefined;

  const baseCandidates = definitions.filter((definition) => {
    const aliases = [definition.name, ...(definition.previousNames ?? [])];
    return aliases.some((candidate) => normalizedName(splitStrongExerciseName(candidate).base) === strongBase);
  });
  const compatibleCandidates = baseCandidates.filter((candidate) => {
    const existingEquipment = normalizedName(candidate.equipment);
    return strongEquipment === 'Other' ||
      existingEquipment === normalizedName(strongEquipment) ||
      (strongEquipment === 'Bodyweight' && candidate.exerciseType === 'Bodyweight & Reps');
  });
  const unqualifiedCandidates = compatibleCandidates.filter((candidate) =>
    [candidate.name, ...(candidate.previousNames ?? [])]
      .some((alias) => normalizedName(alias) === strongBase),
  );
  if (unqualifiedCandidates.length === 1) return unqualifiedCandidates[0];
  if (compatibleCandidates.length === 1) return compatibleCandidates[0];
  return undefined;
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function makeId(value: string) {
  return normalizedName(value).replace(/\s+/g, '-').slice(0, 42) || 'strong-item';
}

function setTypeFromStrong(value: string): WorkoutSetType {
  const normalized = value.trim().toUpperCase();
  if (normalized === 'W') return 'warmup';
  if (normalized === 'D') return 'drop';
  if (normalized === 'F') return 'failure';
  if (normalized === 'A' || normalized === 'AMRAP') return 'amrap';
  return 'normal';
}

function uniqueNotes(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).join('\n\n');
}

function workoutDuplicateKey(startedAt: number, name: string) {
  return `${startedAt}|${normalizedName(name)}`;
}

function rawWorkoutFingerprint(rows: CsvRecord[]) {
  const normalized = rows
    .filter((row) => row['Set Order'].toLowerCase() !== 'rest timer')
    .map((row) => [
      row.Date,
      normalizedName(row['Workout Name']),
      normalizedName(row['Exercise Name']),
      row['Set Order'].toUpperCase(),
      numberValue(row.Weight) ?? '',
      numberValue(row.Reps) ?? '',
      numberValue(row.Distance) ?? '',
      numberValue(row.Seconds) ?? '',
      numberValue(row.RPE) ?? '',
    ].join('|'))
    .join('\n');
  return `strong-${stableHash(normalized)}`;
}

function createDefinition(summary: StrongExerciseSummary, batchId: string, defaultRestSeconds: number): ExerciseDefinition {
  const exerciseType = inferExerciseType(summary);
  const primaryMuscle = inferPrimaryMuscle(summary.name);
  const equipment = inferEquipment(summary.name);
  const weights = summary.rows.map((row) => positiveNumber(row.Weight));
  const reps = summary.rows.map((row) => positiveNumber(row.Reps));
  const durations = summary.rows.map((row) => positiveNumber(row.Seconds));
  const distances = summary.rows.map((row) => positiveNumber(row.Distance));
  const restSeconds = roundedMedian(summary.restRows.map((row) => positiveNumber(row.Seconds)), defaultRestSeconds);
  return {
    id: `strong-exercise-${makeId(summary.name)}-${stableHash(summary.name)}`,
    name: summary.name.trim(),
    detail: `${primaryMuscle} · ${equipment}`,
    primaryMuscle,
    equipment,
    exerciseType,
    defaultWeight:
      exerciseType === 'Weight & Reps' ||
      exerciseType === 'Bodyweight + Added Weight' ||
      exerciseType === 'Assisted Bodyweight'
        ? roundedMedian(weights)
        : undefined,
    defaultReps:
      exerciseType === 'Duration' || exerciseType === 'Distance & Duration'
        ? undefined
        : Math.round(roundedMedian(reps, 8) ?? 8),
    defaultDurationSeconds:
      exerciseType === 'Duration' || exerciseType === 'Distance & Duration'
        ? Math.round(roundedMedian(durations, 60) ?? 60)
        : undefined,
    defaultDistance: exerciseType === 'Distance & Duration' ? roundedMedian(distances) : undefined,
    defaultRestSeconds: restSeconds,
    isCustom: true,
    importSource: 'strong',
    importBatchId: batchId,
  };
}

function createSet(
  row: CsvRecord,
  exerciseType: ExerciseType,
  id: string,
): WorkoutSet {
  const weight = numberValue(row.Weight);
  const reps = numberValue(row.Reps);
  const distance = numberValue(row.Distance);
  const durationSeconds = numberValue(row.Seconds);
  const rpe = positiveNumber(row.RPE);
  return {
    id,
    weight:
      exerciseType === 'Weight & Reps' ||
      exerciseType === 'Bodyweight + Added Weight' ||
      exerciseType === 'Assisted Bodyweight'
        ? weight
        : undefined,
    reps:
      exerciseType === 'Duration' || exerciseType === 'Distance & Duration'
        ? undefined
        : reps,
    durationSeconds:
      exerciseType === 'Duration' || exerciseType === 'Distance & Duration'
        ? durationSeconds
        : undefined,
    distance: exerciseType === 'Distance & Duration' ? distance : undefined,
    rpe: rpe !== undefined && rpe <= 10 ? rpe : undefined,
    setType: setTypeFromStrong(row['Set Order']),
    completed: true,
  };
}

function groupByWorkout(records: CsvRecord[]) {
  const groups = new Map<string, CsvRecord[]>();
  records.forEach((row) => {
    const key = `${row.Date}\u0001${row['Workout Name']}\u0001${row.Duration}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  });
  return Array.from(groups.values());
}

export function prepareStrongImport(csvText: string, snapshot: LiftFlowStateSnapshot): StrongImportPlan {
  const records = readStrongRows(csvText);
  const importedAt = Date.now();
  const batchId = `strong-${importedAt}-${stableHash(String(records.length))}`;
  const warnings: string[] = [];
  const validRows: CsvRecord[] = [];
  let invalidRows = 0;

  records.forEach((row) => {
    if (!row.Date || !row['Workout Name'] || !row['Exercise Name'] || !row['Set Order']) {
      invalidRows += 1;
      return;
    }
    validRows.push(row);
  });

  const setRows = validRows.filter((row) => row['Set Order'].toLowerCase() !== 'rest timer');
  const restRows = validRows.filter((row) => row['Set Order'].toLowerCase() === 'rest timer');

  const exerciseMap = new Map<string, StrongExerciseSummary>();
  validRows.forEach((row) => {
    const key = normalizedName(row['Exercise Name']);
    const existing = exerciseMap.get(key) ?? {
      name: row['Exercise Name'].trim(),
      rows: [],
      restRows: [],
      firstRowNumber: row.__rowNumber,
    };
    if (row['Set Order'].toLowerCase() === 'rest timer') existing.restRows.push(row);
    else existing.rows.push(row);
    exerciseMap.set(key, existing);
  });

  const definitions = snapshot.exercises.map((exercise) => ({ ...exercise }));
  const definitionByStrongName = new Map<string, ExerciseDefinition>();
  const createdExerciseIds: string[] = [];
  let exercisesMatched = 0;
  let exercisesToCreate = 0;

  Array.from(exerciseMap.values())
    .sort((left, right) => left.firstRowNumber - right.firstRowNumber)
    .forEach((summary) => {
      const existing = findExistingDefinition(summary.name, definitions);
      if (existing) {
        definitionByStrongName.set(normalizedName(summary.name), existing);
        exercisesMatched += 1;
        return;
      }
      const created = createDefinition(summary, batchId, snapshot.restTimerSettings.defaultSeconds);
      let id = created.id;
      let suffix = 2;
      while (definitions.some((definition) => definition.id === id)) {
        id = `${created.id}-${suffix}`;
        suffix += 1;
      }
      const unique = { ...created, id };
      definitions.push(unique);
      definitionByStrongName.set(normalizedName(summary.name), unique);
      createdExerciseIds.push(unique.id);
      exercisesToCreate += 1;
    });

  const existingDuplicateKeys = new Set(
    snapshot.completedWorkouts.map((workout) => workoutDuplicateKey(workout.startedAt, workout.name)),
  );
  const existingFingerprints = new Set(
    snapshot.completedWorkouts
      .map((workout) => workout.importFingerprint)
      .filter((fingerprint): fingerprint is string => Boolean(fingerprint)),
  );

  const importedWorkouts: CompletedWorkout[] = [];
  const importedWorkoutIds: string[] = [];
  let duplicateWorkouts = 0;
  let suspiciousDurationWorkouts = 0;
  let workoutsFound = 0;
  let earliestWorkoutAt: number | undefined;
  let latestWorkoutAt: number | undefined;

  groupByWorkout(validRows).forEach((workoutRows) => {
    const first = workoutRows[0];
    const actualSetRows = workoutRows.filter((row) => row['Set Order'].toLowerCase() !== 'rest timer');
    if (actualSetRows.length === 0) return;
    workoutsFound += 1;
    const startedAt = parseStrongDate(first.Date);
    if (startedAt === undefined) {
      invalidRows += actualSetRows.length;
      warnings.push(`Skipped ${first['Workout Name']} because its date could not be read: ${first.Date}.`);
      return;
    }
    const duplicateKey = workoutDuplicateKey(startedAt, first['Workout Name']);
    const fingerprint = rawWorkoutFingerprint(workoutRows);
    if (existingDuplicateKeys.has(duplicateKey) || existingFingerprints.has(fingerprint)) {
      duplicateWorkouts += 1;
      return;
    }

    const exerciseGroups = new Map<string, CsvRecord[]>();
    actualSetRows.forEach((row) => {
      const key = normalizedName(row['Exercise Name']);
      exerciseGroups.set(key, [...(exerciseGroups.get(key) ?? []), row]);
    });

    const workoutId = `strong-workout-${stableHash(`${first.Date}|${first['Workout Name']}`)}`;
    const exercises: WorkoutExercise[] = Array.from(exerciseGroups.entries()).map(([key, rows], exerciseIndex) => {
      const definition = definitionByStrongName.get(key);
      const exerciseType = definition?.exerciseType ?? inferExerciseType(exerciseMap.get(key) ?? {
        name: rows[0]['Exercise Name'], rows, restRows: [], firstRowNumber: rows[0].__rowNumber,
      });
      const exerciseId = `${workoutId}-exercise-${exerciseIndex + 1}`;
      return {
        id: exerciseId,
        exerciseDefinitionId: definition?.id,
        name: definition?.name ?? rows[0]['Exercise Name'].trim(),
        exerciseType,
        restSeconds: definition?.defaultRestSeconds ?? snapshot.restTimerSettings.defaultSeconds,
        notes: uniqueNotes(rows.map((row) => row.Notes)),
        sets: rows.map((row, setIndex) => createSet(row, exerciseType, `${exerciseId}-set-${setIndex + 1}`)),
      };
    });

    const durationSeconds = parseDurationSeconds(first.Duration);
    const durationUnknown = durationSeconds > MAX_CREDIBLE_STRONG_DURATION_SECONDS;
    if (durationUnknown) suspiciousDurationWorkouts += 1;
    const completedAt = startedAt + (durationUnknown ? 60 : Math.max(durationSeconds, 60)) * 1000;
    const workout: CompletedWorkout = {
      id: workoutId,
      name: first['Workout Name'].trim(),
      startedAt,
      completedAt,
      sourceFolder: 'Strong Import',
      notes: uniqueNotes(workoutRows.map((row) => row['Workout Notes'])),
      exercises,
      importSource: 'strong',
      importBatchId: batchId,
      importFingerprint: fingerprint,
      importedAt,
      durationUnknown: durationUnknown || undefined,
    };
    importedWorkouts.push(workout);
    importedWorkoutIds.push(workout.id);
    existingDuplicateKeys.add(duplicateKey);
    existingFingerprints.add(fingerprint);
    earliestWorkoutAt = earliestWorkoutAt === undefined ? startedAt : Math.min(earliestWorkoutAt, startedAt);
    latestWorkoutAt = latestWorkoutAt === undefined ? startedAt : Math.max(latestWorkoutAt, startedAt);
  });

  if (restRows.length > 0) {
    warnings.push(`${restRows.length} Strong rest-timer rows were used for exercise defaults and were not imported as workout sets.`);
  }
  if (suspiciousDurationWorkouts > 0) {
    warnings.push(`${suspiciousDurationWorkouts} workout${suspiciousDurationWorkouts === 1 ? '' : 's'} reported a duration over 6 hours. LiftFlow kept the workout date but excluded that duration from training-time totals.`);
  }
  if (invalidRows > 0) warnings.push(`${invalidRows} row${invalidRows === 1 ? '' : 's'} could not be imported.`);

  return {
    batchId,
    importedAt,
    preview: {
      sourceRows: records.length,
      setRows: setRows.length,
      restTimerRows: restRows.length,
      invalidRows,
      workoutsFound,
      workoutsReady: importedWorkouts.length,
      duplicateWorkouts,
      exercisesMatched,
      exercisesToCreate,
      earliestWorkoutAt,
      latestWorkoutAt,
      warnings,
    },
    nextState: {
      ...snapshot,
      exercises: definitions,
      completedWorkouts: [...importedWorkouts, ...snapshot.completedWorkouts]
        .sort((left, right) => right.completedAt - left.completedAt),
    },
    createdExerciseIds,
    importedWorkoutIds,
  };
}

export function getLastStrongImportFromWorkouts(workouts: CompletedWorkout[]): LastStrongImport | null {
  const batches = new Map<string, LastStrongImport>();
  workouts.forEach((workout) => {
    if (workout.importSource !== 'strong' || !workout.importBatchId) return;
    const importedAt = workout.importedAt ?? 0;
    const existing = batches.get(workout.importBatchId);
    batches.set(workout.importBatchId, {
      batchId: workout.importBatchId,
      importedAt: Math.max(existing?.importedAt ?? 0, importedAt),
      workoutCount: (existing?.workoutCount ?? 0) + 1,
    });
  });
  return Array.from(batches.values()).sort((left, right) => right.importedAt - left.importedAt)[0] ?? null;
}

export function getLastStrongImport(snapshot: LiftFlowStateSnapshot): LastStrongImport | null {
  return getLastStrongImportFromWorkouts(snapshot.completedWorkouts);
}

export function buildStrongRollback(snapshot: LiftFlowStateSnapshot): StrongRollbackPlan | null {
  const latest = getLastStrongImport(snapshot);
  if (!latest) return null;
  const remainingWorkouts = snapshot.completedWorkouts.filter((workout) => workout.importBatchId !== latest.batchId);
  const candidateExercises = snapshot.exercises.filter((exercise) => exercise.importBatchId === latest.batchId);
  const retainedIds = new Set<string>();
  const isUsed = (definition: ExerciseDefinition) => {
    const names = new Set([definition.name, ...(definition.previousNames ?? [])].map(normalizedName));
    const exerciseMatches = (exercise: WorkoutExercise) =>
      exercise.exerciseDefinitionId === definition.id || names.has(normalizedName(exercise.name));
    return snapshot.templates.some((template) => template.exercises.some(exerciseMatches)) ||
      Boolean(snapshot.activeWorkout?.exercises.some(exerciseMatches)) ||
      snapshot.incompleteWorkouts.some((workout) => workout.exercises.some(exerciseMatches)) ||
      remainingWorkouts.some((workout) => workout.exercises.some(exerciseMatches));
  };
  candidateExercises.forEach((exercise) => {
    if (isUsed(exercise)) retainedIds.add(exercise.id);
  });
  const nextExercises = snapshot.exercises.filter((exercise) =>
    exercise.importBatchId !== latest.batchId || retainedIds.has(exercise.id),
  );
  return {
    batchId: latest.batchId,
    importedAt: latest.importedAt,
    workoutsRemoved: latest.workoutCount,
    exercisesRemoved: candidateExercises.length - retainedIds.size,
    exercisesRetained: retainedIds.size,
    nextState: {
      ...snapshot,
      exercises: nextExercises,
      completedWorkouts: remainingWorkouts,
    },
  };
}

export function formatStrongImportDateRange(preview: StrongImportPreview) {
  if (preview.earliestWorkoutAt === undefined || preview.latestWorkoutAt === undefined) return 'No valid workout dates';
  const formatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  return `${formatter.format(new Date(preview.earliestWorkoutAt))} – ${formatter.format(new Date(preview.latestWorkoutAt))}`;
}
