import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/PrimaryButton';
import { ExerciseDefinition } from '@/constants/exercises';
import { colors, radius, spacing } from '@/constants/theme';
import { useActiveWorkout, WorkoutExercise } from '@/context/ActiveWorkoutContext';

type DialogType = 'finish' | 'discard' | null;

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`;
  }

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export default function ActiveWorkoutScreen() {
  const router = useRouter();
  const {
    workout,
    exercises,
    completedSetCount,
    totalSetCount,
    toggleSet,
    toggleSetType,
    updateSetValue,
    copyPreviousSet,
    addSet,
    addExercise,
    removeExercise,
    updateWorkoutNotes,
    finishWorkout,
    discardWorkout,
    persistenceStatus,
  } = useActiveWorkout();
  const [now, setNow] = useState(Date.now());
  const [restSeconds, setRestSeconds] = useState(0);
  const [dialog, setDialog] = useState<DialogType>(null);
  const [exercisePickerOpen, setExercisePickerOpen] = useState(false);
  const [exerciseMenuId, setExerciseMenuId] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
      setRestSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const elapsed = useMemo(() => {
    if (!workout) return 0;
    return Math.max(0, Math.floor((now - workout.startedAt) / 1000));
  }, [now, workout]);

  const selectedExercise = workout?.exercises.find(
    (exercise) => exercise.id === exerciseMenuId,
  );

  const closeWorkoutScreen = () => {
    setDialog(null);
    router.back();
  };

  const finish = (updateTemplate: boolean) => {
    finishWorkout({ updateTemplate });
    closeWorkoutScreen();
  };

  const discard = () => {
    discardWorkout();
    closeWorkoutScreen();
  };

  if (!workout) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.noWorkout}>
          <Text style={styles.emptyTitle}>No active workout</Text>
          <Text style={styles.muted}>Start one from Home or Workouts.</Text>
          <PrimaryButton label="Close" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close active workout screen"
          onPress={() => router.back()}
          hitSlop={12}
        >
          <Text style={styles.close}>⌄</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => setRestSeconds(restSeconds > 0 ? 0 : 120)}
          style={({ pressed }) => [styles.restButton, pressed && styles.pressed]}
        >
          <Text style={styles.restText}>
            {restSeconds > 0 ? `Rest ${formatDuration(restSeconds)}` : 'Rest Timer'}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Finish workout"
          onPress={() => setDialog('finish')}
          hitSlop={12}
        >
          <Text style={styles.finish}>Finish</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.workoutHeader}>
          <Text style={styles.workoutName}>{workout.name}</Text>
          <Text style={styles.elapsed}>{formatDuration(elapsed)}</Text>
          <TextInput
            accessibilityLabel="Workout notes"
            value={workout.notes ?? ''}
            onChangeText={updateWorkoutNotes}
            placeholder="Add workout notes"
            placeholderTextColor={colors.textMuted}
            multiline
            style={styles.workoutNotes}
          />
          <Text style={[styles.saveStatus, persistenceStatus === 'error' && styles.saveStatusError]}>
            {persistenceStatus === 'saving'
              ? '↻ Saving on this device…'
              : persistenceStatus === 'error'
                ? '! Local save issue'
                : '✓ Saved on this device'}
          </Text>
          {workout.sourceTemplateId ? (
            <Text style={styles.templateHint}>
              Edit today’s values freely. When you finish, LiftFlow will ask whether to save them back to the template.
            </Text>
          ) : null}
        </View>

        {workout.exercises.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No exercises yet</Text>
            <Text style={styles.muted}>
              Add an exercise from the LiftFlow library to begin logging sets.
            </Text>
            <PrimaryButton label="Add Exercises" onPress={() => setExercisePickerOpen(true)} />
          </View>
        ) : (
          workout.exercises.map((exercise) => (
            <ExerciseCard
              key={exercise.id}
              exercise={exercise}
              onToggle={(setId) => {
                const set = exercise.sets.find((item) => item.id === setId);
                toggleSet(exercise.id, setId);
                if (set && !set.completed) setRestSeconds(120);
              }}
              onToggleSetType={(setId) => toggleSetType(exercise.id, setId)}
              onUpdateValue={(setId, field, value) =>
                updateSetValue(exercise.id, setId, field, value)
              }
              onCopyPrevious={(setId) => copyPreviousSet(exercise.id, setId)}
              onAddSet={() => addSet(exercise.id)}
              onOpenMenu={() => setExerciseMenuId(exercise.id)}
            />
          ))
        )}

        {workout.exercises.length > 0 ? (
          <PrimaryButton
            label="+ Add Exercises"
            onPress={() => setExercisePickerOpen(true)}
            variant="secondary"
          />
        ) : null}

        <PrimaryButton
          label="Discard Workout"
          onPress={() => setDialog('discard')}
          variant="danger"
        />
      </ScrollView>

      <WorkoutDialog
        type={dialog}
        completedSetCount={completedSetCount}
        totalSetCount={totalSetCount}
        canUpdateTemplate={Boolean(workout.sourceTemplateId)}
        onCancel={() => setDialog(null)}
        onDiscard={discard}
        onFinish={finish}
      />

      <ExercisePickerModal
        exercises={exercises}
        visible={exercisePickerOpen}
        addedExerciseNames={workout.exercises.map((exercise) => exercise.name)}
        onClose={() => setExercisePickerOpen(false)}
        onAdd={addExercise}
      />

      <ExerciseActionsModal
        exercise={selectedExercise ?? null}
        onClose={() => setExerciseMenuId(null)}
        onRemove={() => {
          if (selectedExercise) removeExercise(selectedExercise.id);
          setExerciseMenuId(null);
        }}
      />
    </SafeAreaView>
  );
}

function ExerciseCard({
  exercise,
  onToggle,
  onToggleSetType,
  onUpdateValue,
  onCopyPrevious,
  onAddSet,
  onOpenMenu,
}: {
  exercise: WorkoutExercise;
  onToggle: (setId: string) => void;
  onToggleSetType: (setId: string) => void;
  onUpdateValue: (
    setId: string,
    field: 'weight' | 'reps',
    value: number | undefined,
  ) => void;
  onCopyPrevious: (setId: string) => void;
  onAddSet: () => void;
  onOpenMenu: () => void;
}) {
  return (
    <View style={styles.exerciseCard}>
      <View style={styles.exerciseHeader}>
        <View style={styles.exerciseHeaderCopy}>
          <Text style={styles.exerciseName}>{exercise.name}</Text>
          <Text style={styles.exerciseNote}>
            Tap Previous to copy it, or type today’s weight and reps. Tap the set label to mark a warm-up.
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${exercise.name} actions`}
          onPress={onOpenMenu}
          hitSlop={12}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Text style={styles.menu}>•••</Text>
        </Pressable>
      </View>

      <View style={styles.tableHeader}>
        <Text style={[styles.columnLabel, styles.setColumn]}>SET</Text>
        <Text style={[styles.columnLabel, styles.previousColumn]}>PREVIOUS</Text>
        <Text style={[styles.columnLabel, styles.valueColumn]}>LB</Text>
        <Text style={[styles.columnLabel, styles.valueColumn]}>REPS</Text>
        <Text style={[styles.columnLabel, styles.doneColumn]}>✓</Text>
      </View>

      {exercise.sets.map((set, index) => {
        const setLabel = getSetLabel(exercise.sets, index);
        const isWarmup = (set.setType ?? 'normal') === 'warmup';

        return (
        <View key={set.id}>
          <View
            style={[
              styles.setRow,
              isWarmup && styles.warmupSetRow,
              set.completed && styles.completedRow,
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${isWarmup ? 'Warm-up' : `Working set ${setLabel}`}. Tap to switch set type.`}
              onPress={() => onToggleSetType(set.id)}
              style={({ pressed }) => [
                styles.setColumn,
                styles.activeSetTypeButton,
                isWarmup && styles.activeWarmupSetTypeButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.setNumber, isWarmup && styles.warmupSetNumber]}>
                {setLabel}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Copy previous values for ${isWarmup ? 'warm-up set' : `set ${setLabel}`}`}
              onPress={() => onCopyPrevious(set.id)}
              style={({ pressed }) => [
                styles.previousColumn,
                styles.previousButton,
                pressed && styles.previousButtonPressed,
              ]}
            >
              <Text style={styles.previousText}>
                {set.previousWeight ?? '—'} × {set.previousReps ?? '—'}
              </Text>
            </Pressable>
            <SetValueInput
              value={set.weight}
              decimal
              accessibilityLabel={`${exercise.name} set ${index + 1} weight`}
              onCommit={(value) => onUpdateValue(set.id, 'weight', value)}
            />
            <SetValueInput
              value={set.reps}
              accessibilityLabel={`${exercise.name} set ${index + 1} reps`}
              onCommit={(value) => onUpdateValue(set.id, 'reps', value)}
            />
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: set.completed }}
              onPress={() => onToggle(set.id)}
              style={({ pressed }) => [
                styles.checkButton,
                styles.doneColumn,
                set.completed && styles.checkButtonComplete,
                pressed && styles.pressed,
              ]}
            >
              <Text style={set.completed ? styles.checkComplete : styles.checkEmpty}>
                {set.completed ? '✓' : ''}
              </Text>
            </Pressable>
          </View>
          {set.rpe !== undefined || set.rir !== undefined ? (
            <View style={styles.effortTargetRow}>
              <Text style={styles.effortTargetLabel}>
                Target: {set.rpe !== undefined ? `RPE ${set.rpe}` : `RIR ${set.rir}`}
              </Text>
            </View>
          ) : null}
        </View>
        );
      })}

      <Pressable
        accessibilityRole="button"
        onPress={onAddSet}
        style={({ pressed }) => [styles.addSetButton, pressed && styles.pressed]}
      >
        <Text style={styles.addSetLabel}>+ Add Set</Text>
      </Pressable>
    </View>
  );
}

function getSetLabel(sets: WorkoutExercise['sets'], index: number) {
  const set = sets[index];
  if ((set.setType ?? 'normal') === 'warmup') return 'W';

  return String(
    sets
      .slice(0, index + 1)
      .filter((candidate) => (candidate.setType ?? 'normal') === 'normal').length,
  );
}

function SetValueInput({
  value,
  decimal = false,
  accessibilityLabel,
  onCommit,
}: {
  value?: number;
  decimal?: boolean;
  accessibilityLabel: string;
  onCommit: (value: number | undefined) => void;
}) {
  const [text, setText] = useState(value === undefined ? '' : String(value));

  useEffect(() => {
    setText(value === undefined ? '' : String(value));
  }, [value]);

  const commit = () => {
    const normalized = text.trim().replace(',', '.');

    if (!normalized) {
      onCommit(undefined);
      return;
    }

    const parsed = decimal ? Number.parseFloat(normalized) : Number.parseInt(normalized, 10);

    if (!Number.isFinite(parsed) || parsed < 0) {
      setText(value === undefined ? '' : String(value));
      return;
    }

    onCommit(parsed);
    setText(String(parsed));
  };

  return (
    <View style={[styles.valueBox, styles.valueColumn]}>
      <TextInput
        accessibilityLabel={accessibilityLabel}
        value={text}
        onChangeText={setText}
        onBlur={commit}
        onSubmitEditing={commit}
        inputMode={decimal ? 'decimal' : 'numeric'}
        keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
        selectTextOnFocus
        placeholder="—"
        placeholderTextColor={colors.textMuted}
        style={styles.valueInput}
      />
    </View>
  );
}

function ExercisePickerModal({
  exercises,
  visible,
  addedExerciseNames,
  onClose,
  onAdd,
}: {
  exercises: ExerciseDefinition[];
  visible: boolean;
  addedExerciseNames: string[];
  onClose: () => void;
  onAdd: (exerciseId: string) => void;
}) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCardLarge}>
          <Text style={styles.modalTitle}>Add Exercises</Text>
          <Text style={styles.modalBody}>Tap an exercise to add it to this workout.</Text>

          <ScrollView style={styles.exercisePickerList}>
            {exercises.map((exercise) => {
              const added = addedExerciseNames.includes(exercise.name);
              return (
                <Pressable
                  key={exercise.id}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: added }}
                  disabled={added}
                  onPress={() => onAdd(exercise.id)}
                  style={({ pressed }) => [
                    styles.pickerRow,
                    added && styles.pickerRowAdded,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.pickerCopy}>
                    <Text style={styles.pickerName}>{exercise.name}</Text>
                    <Text style={styles.pickerDetail}>{exercise.detail}</Text>
                  </View>
                  <Text style={added ? styles.addedLabel : styles.addLabel}>
                    {added ? 'Added' : '+ Add'}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <PrimaryButton label="Done" onPress={onClose} variant="secondary" />
        </View>
      </View>
    </Modal>
  );
}

function ExerciseActionsModal({
  exercise,
  onClose,
  onRemove,
}: {
  exercise: WorkoutExercise | null;
  onClose: () => void;
  onRemove: () => void;
}) {
  return (
    <Modal
      transparent
      visible={Boolean(exercise)}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          {exercise ? (
            <>
              <Text style={styles.modalTitle}>{exercise.name}</Text>
              <Text style={styles.modalBody}>
                Exercise actions are intentionally limited in this foundation batch.
              </Text>
              <PrimaryButton label="Remove Exercise" onPress={onRemove} variant="danger" />
              <PrimaryButton label="Cancel" onPress={onClose} variant="secondary" />
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function WorkoutDialog({
  type,
  completedSetCount,
  totalSetCount,
  canUpdateTemplate,
  onCancel,
  onDiscard,
  onFinish,
}: {
  type: DialogType;
  completedSetCount: number;
  totalSetCount: number;
  canUpdateTemplate: boolean;
  onCancel: () => void;
  onDiscard: () => void;
  onFinish: (updateTemplate: boolean) => void;
}) {
  return (
    <Modal
      transparent
      visible={type !== null}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          {type === 'discard' ? (
            <>
              <Text style={styles.modalTitle}>Discard workout?</Text>
              <Text style={styles.modalBody}>
                This active workout will be removed. Your saved templates will stay unchanged.
              </Text>
              <View style={styles.modalButtons}>
                <PrimaryButton label="Cancel" onPress={onCancel} variant="secondary" />
                <PrimaryButton label="Discard Workout" onPress={onDiscard} variant="danger" />
              </View>
            </>
          ) : null}

          {type === 'finish' ? (
            <>
              <Text style={styles.modalTitle}>Finish workout?</Text>
              <Text style={styles.modalBody}>
                {completedSetCount} of {totalSetCount} sets are complete.
              </Text>
              <View style={styles.modalButtons}>
                <PrimaryButton label="Continue Workout" onPress={onCancel} variant="secondary" />
                {canUpdateTemplate ? (
                  <>
                    <PrimaryButton
                      label="Finish Without Updating Template"
                      onPress={() => onFinish(false)}
                      variant="secondary"
                    />
                    <PrimaryButton
                      label="Finish & Update Template"
                      onPress={() => onFinish(true)}
                    />
                  </>
                ) : (
                  <PrimaryButton label="Finish Workout" onPress={() => onFinish(false)} />
                )}
              </View>
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  close: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '700',
  },
  restButton: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  restText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  finish: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.65,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  workoutHeader: {
    gap: 4,
  },
  workoutName: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '900',
  },
  elapsed: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  muted: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  workoutNotes: {
    minHeight: 48,
    maxHeight: 110,
    color: colors.text,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    marginTop: spacing.sm,
  },
  saveStatus: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 5,
  },
  saveStatusError: {
    color: colors.danger,
  },
  templateHint: {
    color: colors.warning,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  noWorkout: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 21,
    fontWeight: '900',
  },
  exerciseCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  exerciseHeaderCopy: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  exerciseName: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  exerciseNote: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  menu: {
    color: colors.textMuted,
    fontSize: 18,
    letterSpacing: 2,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  columnLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '900',
    textAlign: 'center',
  },
  setColumn: {
    width: 36,
  },
  previousColumn: {
    flex: 1.2,
  },
  valueColumn: {
    flex: 0.8,
    marginHorizontal: 3,
  },
  doneColumn: {
    width: 38,
  },
  setRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  completedRow: {
    opacity: 0.75,
  },
  setNumber: {
    color: colors.text,
    textAlign: 'center',
    fontWeight: '800',
  },
  activeSetTypeButton: {
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  activeWarmupSetTypeButton: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.primary,
    borderWidth: 1,
  },
  warmupSetRow: {
    backgroundColor: 'rgba(98, 216, 139, 0.05)',
  },
  warmupSetNumber: {
    color: colors.primary,
  },
  previousButton: {
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  previousButtonPressed: {
    backgroundColor: colors.surfaceElevated,
  },
  previousText: {
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: 13,
  },
  valueBox: {
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
  },
  valueInput: {
    width: '100%',
    minHeight: 38,
    paddingHorizontal: 6,
    paddingVertical: 0,
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  checkButton: {
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
  },
  checkButtonComplete: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkEmpty: {
    color: colors.textMuted,
  },
  checkComplete: {
    color: colors.background,
    fontSize: 18,
    fontWeight: '900',
  },
  addSetButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  addSetLabel: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    padding: spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  modalCardLarge: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '85%',
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  modalBody: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  modalButtons: {
    gap: spacing.sm,
  },
  exercisePickerList: {
    maxHeight: 430,
  },
  pickerRow: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  pickerRowAdded: {
    opacity: 0.48,
  },
  pickerCopy: {
    flex: 1,
  },
  pickerName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  pickerDetail: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 3,
  },
  addLabel: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
  },
  addedLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  effortTargetRow: {
    alignItems: 'flex-end',
    paddingRight: 44,
    paddingBottom: 5,
  },
  effortTargetLabel: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '800',
  },

});
