import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  KeyboardAwareModal,
  NUMERIC_KEYBOARD_ACCESSORY_ID,
} from '@/components/KeyboardAwareModal';
import { ExerciseProgressChart } from '@/components/ExerciseProgressChart';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SectionCard } from '@/components/SectionCard';
import { ExerciseDefinition, ExerciseType } from '@/constants/exercises';
import { colors, radius, spacing } from '@/constants/theme';
import {
  CreateExerciseInput,
  ExerciseUsage,
  type CompletedWorkout,
  useActiveWorkout,
} from '@/context/ActiveWorkoutContext';
import {
  EXERCISE_TYPE_OPTIONS,
  exerciseTypeUsesDistance,
  exerciseTypeUsesDuration,
  exerciseTypeUsesReps,
  exerciseTypeUsesWeight,
} from '@/lib/exerciseTracking';
import {
  buildExerciseProgress,
  formatExerciseHistoryDate,
  type ExerciseProgressSummary,
} from '@/lib/exerciseProgress';
import { showPrototypeNotice } from '@/lib/prototypeNotice';

const typeOptions: Array<'All' | ExerciseType> = ['All', ...EXERCISE_TYPE_OPTIONS];
const emptyUsage: ExerciseUsage = { templates: 0, completedWorkouts: 0, activeWorkout: false };
type FilterKind = 'muscle' | 'equipment' | 'type';

export default function ExercisesScreen() {
  const {
    exercises,
    workout,
    addExercise,
    createExercise,
    updateExercise,
    setExerciseArchived,
    toggleExerciseFavorite,
    deleteExercise,
    getExerciseUsage,
    completedWorkouts,
    restTimerSettings,
  } = useActiveWorkout();
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState('All');
  const [equipment, setEquipment] = useState('All');
  const [exerciseType, setExerciseType] = useState<'All' | ExerciseType>('All');
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
  const [createVisible, setCreateVisible] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [filterPicker, setFilterPicker] = useState<FilterKind | null>(null);

  const muscleOptions = useMemo(
    () => ['All', ...Array.from(new Set(exercises.filter((item) => !item.archived).map((item) => item.primaryMuscle))).sort()],
    [exercises],
  );
  const equipmentOptions = useMemo(
    () => ['All', ...Array.from(new Set(exercises.filter((item) => !item.archived).map((item) => item.equipment))).sort()],
    [exercises],
  );

  const selectedExercise = selectedExerciseId
    ? exercises.find((exercise) => exercise.id === selectedExerciseId) ?? null
    : null;
  const editingExercise = editingExerciseId
    ? exercises.find((exercise) => exercise.id === editingExerciseId) ?? null
    : null;

  const filteredExercises = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return exercises.filter((exercise) => {
      if (exercise.archived) return false;

      const matchesSearch =
        !normalizedQuery ||
        exercise.name.toLowerCase().includes(normalizedQuery) ||
        exercise.detail.toLowerCase().includes(normalizedQuery);
      const matchesMuscle = muscle === 'All' || exercise.primaryMuscle === muscle;
      const matchesEquipment = equipment === 'All' || exercise.equipment === equipment;
      const matchesType = exerciseType === 'All' || exercise.exerciseType === exerciseType;

      return matchesSearch && matchesMuscle && matchesEquipment && matchesType;
    });
  }, [equipment, exerciseType, exercises, muscle, query]);

  const archivedExercises = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return exercises.filter(
      (exercise) =>
        exercise.archived &&
        (!normalizedQuery ||
          exercise.name.toLowerCase().includes(normalizedQuery) ||
          exercise.detail.toLowerCase().includes(normalizedQuery)),
    );
  }, [exercises, query]);

  const favorites = filteredExercises.filter((exercise) => exercise.favorite);
  const recentExerciseIds = useMemo(() => {
    const ids: string[] = [];
    [...completedWorkouts]
      .sort((left, right) => right.startedAt - left.startedAt)
      .forEach((completed) => completed.exercises.forEach((historicExercise) => {
        const definition = exercises.find((candidate) =>
          candidate.id === historicExercise.exerciseDefinitionId ||
          candidate.name.trim().toLowerCase() === historicExercise.name.trim().toLowerCase(),
        );
        if (definition && !ids.includes(definition.id)) ids.push(definition.id);
      }));
    return ids.slice(0, 8);
  }, [completedWorkouts, exercises]);
  const recent = recentExerciseIds
    .map((id) => filteredExercises.find((exercise) => exercise.id === id))
    .filter((exercise): exercise is ExerciseDefinition => Boolean(exercise));
  const customExercises = filteredExercises.filter((exercise) => exercise.isCustom);
  const selectedUsage = selectedExercise
    ? getExerciseUsage(selectedExercise.id)
    : emptyUsage;
  const selectedProgress = useMemo(
    () =>
      selectedExercise
        ? buildExerciseProgress(selectedExercise, completedWorkouts)
        : null,
    [completedWorkouts, selectedExercise],
  );

  const addToWorkout = (exercise: ExerciseDefinition) => {
    if (exercise.archived) {
      showPrototypeNotice(
        'Exercise is archived',
        'Restore this exercise before adding it to a new workout.',
      );
      return;
    }

    if (!workout) {
      showPrototypeNotice(
        'No active workout',
        'Start or resume a workout first, then return here to add this exercise.',
      );
      return;
    }

    if (workout.exercises.some((item) => item.name === exercise.name)) {
      showPrototypeNotice('Already added', `${exercise.name} is already in this workout.`);
      return;
    }

    addExercise(exercise.id);
    setSelectedExerciseId(null);
    showPrototypeNotice('Exercise added', `${exercise.name} was added to ${workout.name}.`);
  };

  const saveExercise = (input: CreateExerciseInput) => {
    const duplicate = exercises.some(
      (exercise) => exercise.name.trim().toLowerCase() === input.name.trim().toLowerCase(),
    );

    if (duplicate) {
      showPrototypeNotice(
        'Exercise already exists',
        'Use the existing exercise or choose a different name.',
      );
      return false;
    }

    const created = createExercise(input);
    setCreateVisible(false);
    setQuery('');
    setSelectedExerciseId(created.id);
    return true;
  };

  const saveEditedExercise = (input: CreateExerciseInput) => {
    if (!editingExercise) return false;

    const duplicate = exercises.some(
      (exercise) =>
        exercise.id !== editingExercise.id &&
        exercise.name.trim().toLowerCase() === input.name.trim().toLowerCase(),
    );

    if (duplicate) {
      showPrototypeNotice(
        'Exercise already exists',
        'Use a different name so every exercise remains easy to identify.',
      );
      return false;
    }

    const updated = updateExercise({ id: editingExercise.id, ...input });
    if (!updated) {
      showPrototypeNotice(
        'Exercise could not be updated',
        'Only custom exercises can be edited.',
      );
      return false;
    }

    setEditingExerciseId(null);
    setSelectedExerciseId(updated.id);
    return true;
  };

  const archiveSelectedExercise = () => {
    if (!selectedExercise?.isCustom) return;

    confirmAction(
      `Archive ${selectedExercise.name}?`,
      'It will be hidden from new workout and template pickers. Existing templates, active workouts, and history will remain untouched.',
      'Archive',
      () => {
        setExerciseArchived(selectedExercise.id, true);
        setSelectedExerciseId(null);
        setShowArchived(true);
      },
    );
  };

  const restoreSelectedExercise = () => {
    if (!selectedExercise?.isCustom) return;
    setExerciseArchived(selectedExercise.id, false);
    setSelectedExerciseId(null);
    showPrototypeNotice(
      'Exercise restored',
      `${selectedExercise.name} is available for workouts and templates again.`,
    );
  };

  const permanentlyDeleteSelectedExercise = () => {
    if (!selectedExercise?.isCustom || !selectedExercise.archived) return;

    if (hasUsage(selectedUsage)) {
      showPrototypeNotice(
        'Exercise is still in use',
        `${usageSummary(selectedUsage)} LiftFlow will keep it archived so your templates and recorded workouts stay intact.`,
      );
      return;
    }

    confirmAction(
      `Delete ${selectedExercise.name} permanently?`,
      'This cannot be undone. The exercise is not used by any template, active workout, or completed workout.',
      'Delete Permanently',
      () => {
        const deleted = deleteExercise(selectedExercise.id);
        if (!deleted) {
          showPrototypeNotice(
            'Exercise was not deleted',
            'LiftFlow detected a usage or safety conflict. Keep it archived instead.',
          );
          return;
        }
        setSelectedExerciseId(null);
      },
    );
  };

  return (
    <>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <PrimaryButton label="+ Create Exercise" onPress={() => setCreateVisible(true)} />

        <TextInput
          accessibilityLabel="Search exercises"
          placeholder="Search exercises..."
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          style={styles.search}
        />

        <View style={styles.filters}>
          <FilterChip
            label={muscle === 'All' ? 'Muscle' : muscle}
            active={muscle !== 'All'}
            onPress={() => setFilterPicker('muscle')}
          />
          <FilterChip
            label={equipment === 'All' ? 'Equipment' : equipment}
            active={equipment !== 'All'}
            onPress={() => setFilterPicker('equipment')}
          />
          <FilterChip
            label={exerciseType === 'All' ? 'Type' : exerciseType}
            active={exerciseType !== 'All'}
            onPress={() => setFilterPicker('type')}
          />
        </View>

        {customExercises.length > 0 ? (
          <ExerciseSection
            title="My Exercises"
            exercises={customExercises}
            onSelect={(exercise) => setSelectedExerciseId(exercise.id)}
          />
        ) : null}

        {favorites.length > 0 ? (
          <ExerciseSection
            title="Favorites"
            exercises={favorites}
            onSelect={(exercise) => setSelectedExerciseId(exercise.id)}
          />
        ) : null}

        {recent.length > 0 ? (
          <ExerciseSection
            title="Recently used"
            exercises={recent}
            onSelect={(exercise) => setSelectedExerciseId(exercise.id)}
          />
        ) : null}

        <SectionCard title={`All exercises · ${filteredExercises.length}`}>
          {filteredExercises.length > 0 ? (
            filteredExercises.map((exercise) => (
              <ExerciseRow
                key={exercise.id}
                exercise={exercise}
                onPress={() => setSelectedExerciseId(exercise.id)}
              />
            ))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No exercises found</Text>
              <Text style={styles.exerciseDetail}>
                Try another search or clear the active filters.
              </Text>
              <PrimaryButton
                label="Clear Filters"
                variant="secondary"
                onPress={() => {
                  setQuery('');
                  setMuscle('All');
                  setEquipment('All');
                  setExerciseType('All');
                }}
              />
            </View>
          )}
        </SectionCard>

        {archivedExercises.length > 0 ? (
          <>
            <PrimaryButton
              label={`${showArchived ? 'Hide' : 'Show'} Archived Exercises (${archivedExercises.length})`}
              variant="secondary"
              onPress={() => setShowArchived((current) => !current)}
            />
            {showArchived ? (
              <ExerciseSection
                title="Archived Exercises"
                exercises={archivedExercises}
                onSelect={(exercise) => setSelectedExerciseId(exercise.id)}
              />
            ) : null}
          </>
        ) : null}
      </ScrollView>

      <ExerciseDetailModal
        exercise={selectedExercise}
        usage={selectedUsage}
        progress={selectedProgress}
        completedWorkouts={completedWorkouts}
        hasActiveWorkout={Boolean(workout)}
        onClose={() => setSelectedExerciseId(null)}
        onAdd={() => selectedExercise && addToWorkout(selectedExercise)}
        onToggleFavorite={() => selectedExercise && toggleExerciseFavorite(selectedExercise.id)}
        onEdit={() => {
          if (!selectedExercise?.isCustom) return;
          setEditingExerciseId(selectedExercise.id);
          setSelectedExerciseId(null);
        }}
        onArchive={archiveSelectedExercise}
        onRestore={restoreSelectedExercise}
        onDelete={permanentlyDeleteSelectedExercise}
      />

      <ExerciseFormModal
        visible={createVisible}
        exercise={null}
        globalDefaultRestSeconds={restTimerSettings.defaultSeconds}
        onClose={() => setCreateVisible(false)}
        onSave={saveExercise}
      />

      <ExerciseFormModal
        visible={Boolean(editingExercise)}
        exercise={editingExercise}
        globalDefaultRestSeconds={restTimerSettings.defaultSeconds}
        onClose={() => setEditingExerciseId(null)}
        onSave={saveEditedExercise}
      />

      <FilterPickerModal
        title={filterPicker === 'muscle' ? 'Filter by Muscle' : filterPicker === 'equipment' ? 'Filter by Equipment' : 'Filter by Tracking Type'}
        visible={Boolean(filterPicker)}
        options={filterPicker === 'muscle' ? muscleOptions : filterPicker === 'equipment' ? equipmentOptions : typeOptions}
        selected={filterPicker === 'muscle' ? muscle : filterPicker === 'equipment' ? equipment : exerciseType}
        onClose={() => setFilterPicker(null)}
        onSelect={(value) => {
          if (filterPicker === 'muscle') setMuscle(value);
          if (filterPicker === 'equipment') setEquipment(value);
          if (filterPicker === 'type') setExerciseType(value as 'All' | ExerciseType);
          setFilterPicker(null);
        }}
      />
    </>
  );
}

function ExerciseSection({
  title,
  exercises,
  onSelect,
}: {
  title: string;
  exercises: ExerciseDefinition[];
  onSelect: (exercise: ExerciseDefinition) => void;
}) {
  return (
    <SectionCard title={title}>
      {exercises.map((exercise) => (
        <ExerciseRow
          key={`${title}-${exercise.id}`}
          exercise={exercise}
          onPress={() => onSelect(exercise)}
        />
      ))}
    </SectionCard>
  );
}

function ExerciseRow({
  exercise,
  onPress,
}: {
  exercise: ExerciseDefinition;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${exercise.name}`}
      onPress={onPress}
      style={({ pressed }) => [styles.exerciseRow, pressed && styles.rowPressed]}
    >
      <View style={styles.exerciseCopy}>
        <Text style={styles.exerciseName}>
          {exercise.favorite ? '★ ' : ''}
          {exercise.name}
        </Text>
        <Text style={styles.exerciseDetail}>
          {exercise.detail} · {exercise.exerciseType}
          {exercise.isCustom ? ' · Custom' : ''}
          {exercise.archived ? ' · Archived' : ''}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterChip,
        active && styles.filterChipActive,
        pressed && styles.rowPressed,
      ]}
    >
      <Text style={[styles.filterLabel, active && styles.filterLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function FilterPickerModal({
  title,
  visible,
  options,
  selected,
  onClose,
  onSelect,
}: {
  title: string;
  visible: boolean;
  options: readonly string[];
  selected: string;
  onClose: () => void;
  onSelect: (value: string) => void;
}) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.filterModalCard}>
          <Text style={styles.modalTitle}>{title}</Text>
          <ScrollView style={styles.filterOptionList}>
            {options.map((option) => {
              const active = option === selected;
              return (
                <Pressable
                  key={option}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => onSelect(option)}
                  style={({ pressed }) => [styles.filterOption, active && styles.filterOptionActive, pressed && styles.rowPressed]}
                >
                  <Text style={[styles.filterOptionLabel, active && styles.filterOptionLabelActive]}>{option}</Text>
                  <Text style={active ? styles.filterOptionCheckActive : styles.filterOptionCheck}>{active ? '✓' : '›'}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <PrimaryButton label="Cancel" onPress={onClose} variant="secondary" />
        </View>
      </View>
    </Modal>
  );
}

function ExerciseDetailModal({
  exercise,
  usage,
  progress,
  completedWorkouts,
  hasActiveWorkout,
  onClose,
  onAdd,
  onToggleFavorite,
  onEdit,
  onArchive,
  onRestore,
  onDelete,
}: {
  exercise: ExerciseDefinition | null;
  usage: ExerciseUsage;
  progress: ExerciseProgressSummary | null;
  completedWorkouts: CompletedWorkout[];
  hasActiveWorkout: boolean;
  onClose: () => void;
  onAdd: () => void;
  onToggleFavorite: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const used = hasUsage(usage);
  const [showAllPrs, setShowAllPrs] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);

  useEffect(() => {
    setShowAllPrs(false);
    setShowAllHistory(false);
  }, [exercise?.id]);

  return (
    <Modal transparent visible={Boolean(exercise)} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <ScrollView
            style={styles.detailScroll}
            contentContainerStyle={styles.detailContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {exercise ? (
              <>
                <View style={styles.titleRow}>
                  <Text style={styles.modalTitle}>{exercise.name}</Text>
                  {exercise.archived ? <Text style={styles.archivedBadge}>Archived</Text> : null}
                </View>
                <Text style={styles.modalSubtitle}>{exercise.detail}</Text>

                <View style={styles.detailGrid}>
                  <Detail label="Primary muscle" value={exercise.primaryMuscle} />
                  <Detail label="Equipment" value={exercise.equipment} />
                  <Detail label="Tracking" value={exercise.exerciseType} />
                  {exerciseTypeUsesWeight(exercise.exerciseType) ? (
                    <Detail
                      label={
                        exercise.exerciseType === 'Bodyweight + Added Weight'
                          ? 'Default added weight'
                          : exercise.exerciseType === 'Assisted Bodyweight'
                            ? 'Default assistance'
                            : 'Default weight'
                      }
                      value={
                        exercise.defaultWeight === undefined
                          ? 'Not set'
                          : String(exercise.defaultWeight)
                      }
                    />
                  ) : null}
                  {exerciseTypeUsesReps(exercise.exerciseType) ? (
                    <Detail label="Default reps" value={String(exercise.defaultReps ?? 8)} />
                  ) : null}
                  {exerciseTypeUsesDistance(exercise.exerciseType) ? (
                    <Detail
                      label="Default distance"
                      value={
                        exercise.defaultDistance === undefined
                          ? 'Not set'
                          : String(exercise.defaultDistance)
                      }
                    />
                  ) : null}
                  <Detail label="Default rest" value={formatRestTime(exercise.defaultRestSeconds ?? 120)} />
                  {exerciseTypeUsesDuration(exercise.exerciseType) ? (
                    <Detail
                      label="Default duration"
                      value={`${exercise.defaultDurationSeconds ?? 60} sec`}
                    />
                  ) : null}
                </View>

                <View style={styles.performanceSection}>
                  <View style={styles.performanceTitleRow}>
                    <Text style={styles.performanceTitle}>Performance</Text>
                    <Text style={styles.performanceCount}>
                      {progress?.totalSessions ?? 0} session{progress?.totalSessions === 1 ? '' : 's'} · {progress?.totalCompletedSets ?? 0} completed set{progress?.totalCompletedSets === 1 ? '' : 's'}
                    </Text>
                  </View>

                  {progress && progress.records.length > 0 ? (
                    <View style={styles.recordGrid}>
                      {progress.records.map((record) => (
                        <View key={record.key} style={styles.recordCard}>
                          <Text style={styles.recordLabel}>{record.label.replace(' PR', '')}</Text>
                          <Text style={styles.recordValue}>{record.displayValue}</Text>
                          <Text style={styles.recordDate}>
                            {formatExerciseHistoryDate(record.achievedAt)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View style={styles.emptyPerformance}>
                      <Text style={styles.emptyPerformanceTitle}>No performance data yet</Text>
                      <Text style={styles.emptyPerformanceCopy}>
                        Complete working sets for this exercise and LiftFlow will build records automatically. Warm-up sets do not count toward PRs.
                      </Text>
                    </View>
                  )}

                  {progress && progress.totalSessions > 0 ? (
                    <View style={styles.performanceList}>
                      <Text style={styles.performanceSubheading}>Progress chart</Text>
                      <ExerciseProgressChart
                        exercise={exercise}
                        completedWorkouts={completedWorkouts}
                        showRangeControls
                      />
                    </View>
                  ) : null}

                  {progress && progress.recentPrs.length > 0 ? (
                    <View style={styles.performanceList}>
                      <Text style={styles.performanceSubheading}>PR history</Text>
                      {(showAllPrs ? progress.recentPrs : progress.recentPrs.slice(0, 4)).map((pr) => (
                        <View key={pr.id} style={styles.performanceRow}>
                          <View style={styles.performanceRowCopy}>
                            <Text style={styles.performanceRowTitle}>{pr.label}</Text>
                            <Text style={styles.performanceRowSubtitle}>
                              {pr.workoutName} · {formatExerciseHistoryDate(pr.achievedAt)}
                            </Text>
                          </View>
                          <Text style={styles.performanceRowValue}>{pr.displayValue}</Text>
                        </View>
                      ))}
                      {progress.recentPrs.length > 4 ? (
                        <PrimaryButton
                          label={showAllPrs ? 'Show Recent PRs' : `Show All ${progress.recentPrs.length} PRs`}
                          variant="secondary"
                          onPress={() => setShowAllPrs((current) => !current)}
                        />
                      ) : null}
                    </View>
                  ) : null}

                  {progress && progress.recentHistory.length > 0 ? (
                    <View style={styles.performanceList}>
                      <Text style={styles.performanceSubheading}>Workout history</Text>
                      {(showAllHistory ? progress.recentHistory : progress.recentHistory.slice(0, 5)).map((entry) => (
                        <View key={entry.workoutId} style={styles.performanceRow}>
                          <View style={styles.performanceRowCopy}>
                            <Text style={styles.performanceRowTitle}>{entry.workoutName}</Text>
                            <Text style={styles.performanceRowSubtitle}>
                              {formatExerciseHistoryDate(entry.completedAt)} · {entry.completedSetCount} completed set{entry.completedSetCount === 1 ? '' : 's'}
                            </Text>
                          </View>
                          <View style={styles.performanceRowRight}>
                            <Text style={styles.performanceRowValue}>{entry.bestSetLabel}</Text>
                            {entry.totalVolume ? (
                              <Text style={styles.performanceRowSubtitle}>{Math.round(entry.totalVolume).toLocaleString()} lb volume</Text>
                            ) : null}
                          </View>
                        </View>
                      ))}
                      {progress.recentHistory.length > 5 ? (
                        <PrimaryButton
                          label={showAllHistory ? 'Show Recent Workouts' : `Show All ${progress.recentHistory.length} Workouts`}
                          variant="secondary"
                          onPress={() => setShowAllHistory((current) => !current)}
                        />
                      ) : null}
                    </View>
                  ) : null}
                </View>

                {exercise.isCustom ? (
                  <View style={styles.usageBox}>
                    <Text style={styles.usageTitle}>Data safety</Text>
                    <Text style={styles.usageCopy}>
                      {used
                        ? usageSummary(usage)
                        : 'Not currently used by a template, active workout, or completed workout.'}
                    </Text>
                  </View>
                ) : null}

                {!exercise.archived && hasActiveWorkout ? (
                  <PrimaryButton label="Add to Active Workout" onPress={onAdd} />
                ) : !exercise.archived ? (
                  <View style={styles.noWorkoutNotice}>
                    <Text style={styles.noWorkoutTitle}>No active workout</Text>
                    <Text style={styles.noWorkoutCopy}>
                      Start or resume a workout to add this exercise. You can still view its
                      details here.
                    </Text>
                  </View>
                ) : null}

                {!exercise.archived ? (
                  <PrimaryButton
                    label={exercise.favorite ? 'Remove from Favorites' : 'Add to Favorites'}
                    onPress={onToggleFavorite}
                    variant="secondary"
                  />
                ) : null}

                {exercise.isCustom ? (
                  <View style={styles.managementActions}>
                    <PrimaryButton label="Edit Exercise" onPress={onEdit} variant="secondary" />
                    {exercise.archived ? (
                      <PrimaryButton label="Restore Exercise" onPress={onRestore} />
                    ) : (
                      <PrimaryButton label="Archive Exercise" onPress={onArchive} variant="danger" />
                    )}
                    {exercise.archived && !used ? (
                      <PrimaryButton label="Delete Permanently" onPress={onDelete} variant="danger" />
                    ) : null}
                  </View>
                ) : null}

                <PrimaryButton label="Close" onPress={onClose} variant="secondary" />
              </>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function ExerciseFormModal({
  visible,
  exercise,
  globalDefaultRestSeconds,
  onClose,
  onSave,
}: {
  visible: boolean;
  exercise: ExerciseDefinition | null;
  globalDefaultRestSeconds: number;
  onClose: () => void;
  onSave: (input: CreateExerciseInput) => boolean;
}) {
  const [name, setName] = useState('');
  const [primaryMuscle, setPrimaryMuscle] = useState('Other');
  const [equipment, setEquipment] = useState('Other');
  const [exerciseType, setExerciseType] = useState<ExerciseType>('Weight & Reps');
  const [defaultWeight, setDefaultWeight] = useState('');
  const [defaultReps, setDefaultReps] = useState('8');
  const [defaultDurationSeconds, setDefaultDurationSeconds] = useState('60');
  const [defaultDistance, setDefaultDistance] = useState('');
  const [defaultRestSeconds, setDefaultRestSeconds] = useState(String(globalDefaultRestSeconds));

  useEffect(() => {
    if (!visible) return;
    setName(exercise?.name ?? '');
    setPrimaryMuscle(exercise?.primaryMuscle ?? 'Other');
    setEquipment(exercise?.equipment ?? 'Other');
    setExerciseType(exercise?.exerciseType ?? 'Weight & Reps');
    setDefaultWeight(
      exercise?.defaultWeight === undefined ? '' : String(exercise.defaultWeight),
    );
    setDefaultReps(String(exercise?.defaultReps ?? 8));
    setDefaultDurationSeconds(String(exercise?.defaultDurationSeconds ?? 60));
    setDefaultDistance(
      exercise?.defaultDistance === undefined ? '' : String(exercise.defaultDistance),
    );
    setDefaultRestSeconds(String(exercise?.defaultRestSeconds ?? globalDefaultRestSeconds));
  }, [exercise, globalDefaultRestSeconds, visible]);

  const submit = () => {
    if (!name.trim()) {
      showPrototypeNotice('Exercise name required', 'Enter a name for the exercise.');
      return;
    }
    if (!primaryMuscle.trim() || !equipment.trim()) {
      showPrototypeNotice('Exercise details required', 'Enter a muscle group and equipment.');
      return;
    }

    const reps = defaultReps.trim() ? Number(defaultReps) : undefined;
    const weight = defaultWeight.trim() ? Number(defaultWeight) : undefined;
    const durationSeconds = defaultDurationSeconds.trim()
      ? Number(defaultDurationSeconds)
      : undefined;
    const distance = defaultDistance.trim() ? Number(defaultDistance) : undefined;
    const restSeconds = defaultRestSeconds.trim() ? Number(defaultRestSeconds) : undefined;

    if (exerciseTypeUsesReps(exerciseType) && (!Number.isFinite(reps) || (reps ?? 0) <= 0)) {
      showPrototypeNotice('Invalid reps', 'Default reps must be a number greater than zero.');
      return;
    }
    if (
      exerciseTypeUsesWeight(exerciseType) &&
      weight !== undefined &&
      (!Number.isFinite(weight) || weight < 0)
    ) {
      showPrototypeNotice('Invalid weight', 'Default weight must be zero or greater.');
      return;
    }
    if (
      exerciseTypeUsesDuration(exerciseType) &&
      (!Number.isFinite(durationSeconds) || (durationSeconds ?? 0) <= 0)
    ) {
      showPrototypeNotice('Invalid duration', 'Default duration must be greater than zero seconds.');
      return;
    }
    if (!Number.isFinite(restSeconds) || (restSeconds ?? 0) < 15 || (restSeconds ?? 0) > 3600) {
      showPrototypeNotice('Invalid rest time', 'Default rest must be between 15 and 3600 seconds.');
      return;
    }
    if (
      exerciseTypeUsesDistance(exerciseType) &&
      distance !== undefined &&
      (!Number.isFinite(distance) || distance < 0)
    ) {
      showPrototypeNotice('Invalid distance', 'Default distance must be zero or greater.');
      return;
    }

    const saved = onSave({
      name,
      primaryMuscle,
      equipment,
      exerciseType,
      defaultWeight: exerciseTypeUsesWeight(exerciseType) ? weight : undefined,
      defaultReps: exerciseTypeUsesReps(exerciseType) ? reps : undefined,
      defaultDurationSeconds: exerciseTypeUsesDuration(exerciseType)
        ? durationSeconds
        : undefined,
      defaultDistance: exerciseTypeUsesDistance(exerciseType) ? distance : undefined,
      defaultRestSeconds: restSeconds,
    });

    if (saved) onClose();
  };

  return (
    <KeyboardAwareModal visible={visible} onClose={onClose} cardStyle={styles.formModalCard}>
      <Text style={styles.modalTitle}>{exercise ? 'Edit Exercise' : 'Create Exercise'}</Text>
      <Text style={styles.formHelp}>
        {exercise
          ? 'Update the exercise defaults used when it is added to future workouts and templates.'
          : 'Add your own movement and use it in workouts and templates immediately.'}
      </Text>

      <FormField
        label="Exercise name"
        value={name}
        onChangeText={setName}
        placeholder="Cable Y Raise"
      />
      <FormField
        label="Primary muscle"
        value={primaryMuscle}
        onChangeText={setPrimaryMuscle}
        placeholder="Shoulders"
      />
      <FormField
        label="Equipment"
        value={equipment}
        onChangeText={setEquipment}
        placeholder="Cable"
      />

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Tracking type</Text>
        <View style={styles.filters}>
          {EXERCISE_TYPE_OPTIONS.map((option) => (
            <FilterChip
              key={option}
              label={option}
              active={exerciseType === option}
              onPress={() => setExerciseType(option)}
            />
          ))}
        </View>
      </View>

      {exerciseTypeUsesWeight(exerciseType) ? (
        <FormField
          label={
            exerciseType === 'Bodyweight + Added Weight'
              ? 'Default added weight (optional)'
              : exerciseType === 'Assisted Bodyweight'
                ? 'Default assistance weight (optional)'
                : 'Default weight (optional)'
          }
          value={defaultWeight}
          onChangeText={setDefaultWeight}
          placeholder="25"
          keyboardType="decimal-pad"
        />
      ) : null}
      {exerciseTypeUsesReps(exerciseType) ? (
        <FormField
          label="Default reps"
          value={defaultReps}
          onChangeText={setDefaultReps}
          placeholder="8"
          keyboardType="number-pad"
        />
      ) : null}
      {exerciseTypeUsesDistance(exerciseType) ? (
        <FormField
          label="Default distance (optional)"
          value={defaultDistance}
          onChangeText={setDefaultDistance}
          placeholder="1.0"
          keyboardType="decimal-pad"
        />
      ) : null}
      {exerciseTypeUsesDuration(exerciseType) ? (
        <FormField
          label="Default duration (seconds)"
          value={defaultDurationSeconds}
          onChangeText={setDefaultDurationSeconds}
          placeholder="60"
          keyboardType="number-pad"
        />
      ) : null}

      <FormField
        label="Default rest after a set (seconds)"
        value={defaultRestSeconds}
        onChangeText={setDefaultRestSeconds}
        placeholder="120"
        keyboardType="number-pad"
      />

      <PrimaryButton label={exercise ? 'Save Changes' : 'Create Exercise'} onPress={submit} />
      <PrimaryButton label="Cancel" onPress={onClose} variant="secondary" />
    </KeyboardAwareModal>
  );
}

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'decimal-pad' | 'number-pad';
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType}
        inputAccessoryViewID={
          keyboardType === 'decimal-pad' || keyboardType === 'number-pad'
            ? NUMERIC_KEYBOARD_ACCESSORY_ID
            : undefined
        }
        returnKeyType={keyboardType === 'default' ? 'next' : 'done'}
        style={styles.formInput}
      />
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailItem}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function formatRestTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function hasUsage(usage: ExerciseUsage) {
  return usage.templates > 0 || usage.completedWorkouts > 0 || usage.activeWorkout;
}

function usageSummary(usage: ExerciseUsage) {
  const parts: string[] = [];
  if (usage.templates > 0) {
    parts.push(`${usage.templates} template${usage.templates === 1 ? '' : 's'}`);
  }
  if (usage.completedWorkouts > 0) {
    parts.push(
      `${usage.completedWorkouts} completed workout${usage.completedWorkouts === 1 ? '' : 's'}`,
    );
  }
  if (usage.activeWorkout) parts.push('the active workout');

  return `Used by ${parts.join(', ')}. Archiving is safe, but permanent deletion is blocked.`;
}

function confirmAction(
  title: string,
  message: string,
  confirmLabel: string,
  onConfirm: () => void,
) {
  if (Platform.OS === 'web') {
    const confirmFunction = (globalThis as { confirm?: (value: string) => boolean }).confirm;
    if (confirmFunction?.(`${title}\n\n${message}`)) onConfirm();
    return;
  }

  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    paddingBottom: 150,
    gap: spacing.md,
  },
  search: {
    minHeight: 48,
    color: colors.text,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 16,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  filterChip: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  filterModalCard: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '82%',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  filterOptionList: {
    flexShrink: 1,
  },
  filterOption: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.sm,
  },
  filterOptionActive: {
    backgroundColor: colors.surfaceElevated,
  },
  filterOptionLabel: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  filterOptionLabelActive: {
    color: colors.primary,
    fontWeight: '900',
  },
  filterOptionCheck: {
    color: colors.textMuted,
    fontSize: 20,
  },
  filterOptionCheckActive: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '900',
  },
  filterChipActive: {
    borderColor: colors.primary,
  },
  filterLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  filterLabelActive: {
    color: colors.primary,
  },
  exerciseRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowPressed: {
    opacity: 0.65,
  },
  exerciseCopy: {
    flex: 1,
  },
  exerciseName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  exerciseDetail: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 3,
    lineHeight: 19,
  },
  chevron: {
    color: colors.textMuted,
    fontSize: 26,
  },
  emptyState: {
    gap: spacing.sm,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xl,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '84%',
    alignSelf: 'center',
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
  },
  detailScroll: {
    width: '100%',
  },
  detailContent: {
    padding: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  formModalCard: {
    maxWidth: 480,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  modalTitle: {
    flexShrink: 1,
    color: colors.text,
    fontSize: 25,
    fontWeight: '900',
  },
  archivedBadge: {
    color: colors.background,
    backgroundColor: colors.textMuted,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  modalSubtitle: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '800',
  },
  formHelp: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  formInput: {
    minHeight: 48,
    color: colors.text,
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 16,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  detailItem: {
    minWidth: '47%',
    flexGrow: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  detailLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  detailValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 3,
  },
  performanceSection: {
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  performanceTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  performanceTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  performanceCount: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  recordGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  recordCard: {
    minWidth: '47%',
    flexGrow: 1,
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: 3,
  },
  recordLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  recordValue: {
    color: colors.primary,
    fontSize: 19,
    fontWeight: '900',
  },
  recordDate: {
    color: colors.textMuted,
    fontSize: 11,
  },
  emptyPerformance: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 4,
  },
  emptyPerformanceTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  emptyPerformanceCopy: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  performanceList: {
    gap: 4,
  },
  performanceSubheading: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginTop: spacing.xs,
  },
  performanceRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingVertical: spacing.xs,
  },
  performanceRowCopy: {
    flex: 1,
  },
  performanceRowRight: {
    maxWidth: '48%',
    alignItems: 'flex-end',
  },
  performanceRowTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  performanceRowSubtitle: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  performanceRowValue: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'right',
  },
  usageBox: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 5,
  },
  usageTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  usageCopy: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  noWorkoutNotice: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    padding: spacing.md,
    gap: 4,
  },
  noWorkoutTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  noWorkoutCopy: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  managementActions: {
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
});
