import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  NumericKeyboardAccessory,
  NUMERIC_KEYBOARD_ACCESSORY_ID,
} from '@/components/KeyboardAwareModal';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ExerciseDefinition } from '@/constants/exercises';
import { colors, radius, spacing } from '@/constants/theme';
import {
  EffortMode,
  useActiveWorkout,
  WorkoutExercise,
  WorkoutSet,
  WorkoutSetType,
} from '@/context/ActiveWorkoutContext';
import {
  formatPreviousMetrics,
  getMetricSlots,
  type WorkoutMetricField,
} from '@/lib/exerciseTracking';

type DialogType = 'finish' | 'discard' | null;
type SetMenuState = { exerciseId: string; setId: string } | null;

const SET_TYPES: Array<{ value: WorkoutSetType; label: string }> = [
  { value: 'normal', label: 'Working' },
  { value: 'warmup', label: 'Warm-up' },
  { value: 'drop', label: 'Drop' },
  { value: 'failure', label: 'Failure' },
  { value: 'amrap', label: 'AMRAP' },
];

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function ActiveWorkoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'ios' ? 52 : 0);
  const {
    workout,
    exercises,
    completedSetCount,
    totalSetCount,
    toggleSet,
    setSetType,
    updateSetValue,
    updateSetEffort,
    copyPreviousSet,
    addSet,
    removeSet,
    moveSet,
    addExercise,
    removeExercise,
    moveExercise,
    replaceExercise,
    updateExerciseNotes,
    updateWorkoutNotes,
    restTimerSettings,
    setRestTimer,
    adjustRestTimer,
    pauseRestTimer,
    resumeRestTimer,
    restartRestTimer,
    clearRestTimer,
    acknowledgeRestTimerComplete,
    updateWorkoutExerciseRestSeconds,
    finishWorkout,
    discardWorkout,
    persistenceStatus,
  } = useActiveWorkout();

  const [now, setNow] = useState(Date.now());
  const [dialog, setDialog] = useState<DialogType>(null);
  const [exercisePickerOpen, setExercisePickerOpen] = useState(false);
  const [exerciseMenuId, setExerciseMenuId] = useState<string | null>(null);
  const [replaceExerciseId, setReplaceExerciseId] = useState<string | null>(null);
  const [setMenu, setSetMenu] = useState<SetMenuState>(null);
  const [restTimerOpen, setRestTimerOpen] = useState(false);

  const availableExercises = useMemo(
    () => exercises.filter((exercise) => !exercise.archived),
    [exercises],
  );

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const elapsed = workout
    ? Math.max(0, Math.floor((now - workout.startedAt) / 1000))
    : 0;
  const restSeconds = workout?.restTimerPausedSeconds ?? (workout?.restTimerEndsAt
    ? Math.max(0, Math.ceil((workout.restTimerEndsAt - now) / 1000))
    : 0);
  const restTimerRunning = Boolean(workout?.restTimerEndsAt);
  const restTimerPaused = workout?.restTimerPausedSeconds !== undefined;

  useEffect(() => {
    if (workout?.restTimerCompletedAt) setRestTimerOpen(true);
  }, [workout?.restTimerCompletedAt]);

  const selectedExercise = workout?.exercises.find((exercise) => exercise.id === exerciseMenuId) ?? null;
  const selectedSetExercise = workout?.exercises.find((exercise) => exercise.id === setMenu?.exerciseId) ?? null;
  const selectedSet = selectedSetExercise?.sets.find((set) => set.id === setMenu?.setId) ?? null;

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
    <View style={styles.safeArea}>
      <View
        style={[
          styles.topBar,
          {
            minHeight: 56 + topInset,
            paddingTop: topInset,
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close active workout screen"
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.topBarSide, styles.topBarSideLeft, pressed && styles.pressed]}
        >
          <Text style={styles.close}>⌄</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open rest timer controls"
          onPress={() => setRestTimerOpen(true)}
          style={({ pressed }) => [styles.restButton, pressed && styles.pressed]}
        >
          <Text style={styles.restText}>{workout.restTimerCompletedAt ? 'Rest complete' : restTimerPaused ? `Paused ${formatDuration(restSeconds)}` : restTimerRunning ? `Rest ${formatDuration(restSeconds)}` : 'Rest Timer'}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Finish workout"
          onPress={() => setDialog('finish')}
          hitSlop={12}
          style={({ pressed }) => [styles.topBarSide, styles.topBarSideRight, pressed && styles.pressed]}
        >
          <Text style={styles.finish}>Finish</Text>
        </Pressable>
      </View>

      <ScrollView
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      >
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
            {persistenceStatus === 'saving' ? '↻ Saving on this device…' : persistenceStatus === 'error' ? '! Local save issue' : '✓ Saved on this device'}
          </Text>
        </View>

        {workout.exercises.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No exercises yet</Text>
            <Text style={styles.muted}>Add an exercise to begin recording sets.</Text>
            <PrimaryButton label="Add Exercises" onPress={() => setExercisePickerOpen(true)} />
          </View>
        ) : (
          workout.exercises.map((exercise, exerciseIndex) => (
            <ExerciseCard
              key={exercise.id}
              exercise={exercise}
              onToggle={(setId) => {
                const set = exercise.sets.find((item) => item.id === setId);
                toggleSet(exercise.id, setId);
                if (set && !set.completed && restTimerSettings.autoStart) {
                  setRestTimer(exercise.restSeconds ?? restTimerSettings.defaultSeconds, exercise.id);
                }
              }}
              onUpdateValue={(setId, field, value) => updateSetValue(exercise.id, setId, field, value)}
              onCopyPrevious={(setId) => copyPreviousSet(exercise.id, setId)}
              onAddSet={() => addSet(exercise.id)}
              onOpenSet={(setId) => setSetMenu({ exerciseId: exercise.id, setId })}
              onOpenMenu={() => setExerciseMenuId(exercise.id)}
              onUpdateNotes={(notes) => updateExerciseNotes(exercise.id, notes)}
              canMoveUp={exerciseIndex > 0}
              canMoveDown={exerciseIndex < workout.exercises.length - 1}
            />
          ))
        )}

        {workout.exercises.length > 0 ? (
          <PrimaryButton label="+ Add Exercises" onPress={() => setExercisePickerOpen(true)} variant="secondary" />
        ) : null}
        <PrimaryButton label="Discard Workout" onPress={() => setDialog('discard')} variant="danger" />
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
        title="Add Exercises"
        exercises={availableExercises}
        visible={exercisePickerOpen}
        disabledNames={workout.exercises.map((exercise) => exercise.name)}
        onClose={() => setExercisePickerOpen(false)}
        onSelect={addExercise}
      />

      <ExercisePickerModal
        title="Replace Exercise"
        exercises={availableExercises}
        visible={Boolean(replaceExerciseId)}
        disabledNames={workout.exercises.filter((item) => item.id !== replaceExerciseId).map((item) => item.name)}
        onClose={() => setReplaceExerciseId(null)}
        onSelect={(definitionId) => {
          if (replaceExerciseId) replaceExercise(replaceExerciseId, definitionId);
          setReplaceExerciseId(null);
        }}
      />

      <ExerciseActionsModal
        exercise={selectedExercise}
        canMoveUp={selectedExercise ? workout.exercises.findIndex((item) => item.id === selectedExercise.id) > 0 : false}
        canMoveDown={selectedExercise ? workout.exercises.findIndex((item) => item.id === selectedExercise.id) < workout.exercises.length - 1 : false}
        onClose={() => setExerciseMenuId(null)}
        onMove={(direction) => {
          if (selectedExercise) moveExercise(selectedExercise.id, direction);
          setExerciseMenuId(null);
        }}
        onReplace={() => {
          if (selectedExercise) setReplaceExerciseId(selectedExercise.id);
          setExerciseMenuId(null);
        }}
        restSeconds={selectedExercise?.restSeconds ?? restTimerSettings.defaultSeconds}
        onRestSecondsChange={(seconds) => {
          if (selectedExercise) updateWorkoutExerciseRestSeconds(selectedExercise.id, seconds);
        }}
        onRemove={() => {
          if (!selectedExercise) return;
          Alert.alert('Remove exercise?', `${selectedExercise.name} will only be removed from this active workout.`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Remove', style: 'destructive', onPress: () => removeExercise(selectedExercise.id) },
          ]);
          setExerciseMenuId(null);
        }}
      />

      <SetActionsModal
        exercise={selectedSetExercise}
        set={selectedSet}
        onClose={() => setSetMenu(null)}
        onSetType={(type) => {
          if (setMenu) setSetType(setMenu.exerciseId, setMenu.setId, type);
        }}
        onEffort={(mode, value) => {
          if (setMenu) updateSetEffort(setMenu.exerciseId, setMenu.setId, mode, value);
        }}
        onMove={(direction) => {
          if (setMenu) moveSet(setMenu.exerciseId, setMenu.setId, direction);
        }}
        onDelete={() => {
          if (setMenu) removeSet(setMenu.exerciseId, setMenu.setId);
          setSetMenu(null);
        }}
      />

      <RestTimerModal
        visible={restTimerOpen}
        seconds={restSeconds}
        durationSeconds={workout.restTimerDurationSeconds ?? restTimerSettings.defaultSeconds}
        running={restTimerRunning}
        paused={restTimerPaused}
        complete={Boolean(workout.restTimerCompletedAt)}
        sourceExerciseName={workout.exercises.find((exercise) => exercise.id === workout.restTimerSourceExerciseId)?.name}
        onClose={() => { acknowledgeRestTimerComplete(); setRestTimerOpen(false); }}
        onStart={() => setRestTimer(workout.restTimerDurationSeconds ?? restTimerSettings.defaultSeconds, workout.restTimerSourceExerciseId)}
        onAdjust={adjustRestTimer}
        onPause={pauseRestTimer}
        onResume={resumeRestTimer}
        onRestart={restartRestTimer}
        onSkip={() => { clearRestTimer(); setRestTimerOpen(false); }}
      />

      <NumericKeyboardAccessory />
    </View>
  );
}

function ExerciseCard({
  exercise,
  onToggle,
  onUpdateValue,
  onCopyPrevious,
  onAddSet,
  onOpenSet,
  onOpenMenu,
  onUpdateNotes,
}: {
  exercise: WorkoutExercise;
  onToggle: (setId: string) => void;
  onUpdateValue: (setId: string, field: WorkoutMetricField, value: number | undefined) => void;
  onCopyPrevious: (setId: string) => void;
  onAddSet: () => void;
  onOpenSet: (setId: string) => void;
  onOpenMenu: () => void;
  onUpdateNotes: (notes: string) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  return (
    <View style={styles.exerciseCard}>
      <View style={styles.exerciseHeader}>
        <View style={styles.exerciseHeaderCopy}>
          <Text style={styles.exerciseName}>{exercise.name}</Text>
          <Text style={styles.exerciseTracking}>{exercise.exerciseType}</Text>
          <Text style={styles.exerciseNote}>Tap a set label for type, effort, move, and delete controls.</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={`Open ${exercise.name} actions`} onPress={onOpenMenu} hitSlop={12} style={({ pressed }) => pressed && styles.pressed}>
          <Text style={styles.menu}>•••</Text>
        </Pressable>
      </View>

      <TextInput
        value={exercise.notes ?? ''}
        onChangeText={onUpdateNotes}
        placeholder="Exercise notes"
        placeholderTextColor={colors.textMuted}
        multiline
        style={styles.exerciseNotes}
      />

      <View style={styles.tableHeader}>
        <Text style={[styles.columnLabel, styles.setColumn]}>SET</Text>
        <Text style={[styles.columnLabel, styles.previousColumn]}>PREVIOUS</Text>
        {getMetricSlots(exercise.exerciseType).map((slot, slotIndex) => (
          <Text
            key={`${exercise.id}-header-${slotIndex}`}
            style={[styles.columnLabel, styles.valueColumn]}
          >
            {slot?.label ?? ''}
          </Text>
        ))}
        <Text style={[styles.columnLabel, styles.doneColumn]}>✓</Text>
      </View>

      {exercise.sets.map((set, index) => (
        <View key={set.id} style={styles.setBlock}>
          <View style={[styles.setRow, set.completed && styles.completedRow]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open controls for ${setTypeLabel(set.setType)} set`}
              onPress={() => onOpenSet(set.id)}
              style={({ pressed }) => [styles.setTypeButton, styles.setColumn, pressed && styles.pressed]}
            >
              <Text style={[styles.setNumber, (set.setType ?? 'normal') !== 'normal' && styles.specialSetNumber]}>{getSetLabel(exercise.sets, index)}</Text>
            </Pressable>
            <Pressable onPress={() => onCopyPrevious(set.id)} style={({ pressed }) => [styles.previousButton, styles.previousColumn, pressed && styles.previousButtonPressed]}>
              <Text style={styles.previousText} numberOfLines={1}>
                {formatPreviousMetrics(exercise.exerciseType, set)}
              </Text>
            </Pressable>
            {getMetricSlots(exercise.exerciseType).map((slot, slotIndex) =>
              slot ? (
                <SetValueInput
                  key={`${set.id}-${slot.field}`}
                  value={set[slot.field]}
                  decimal={slot.decimal}
                  accessibilityLabel={`${exercise.name} set ${index + 1} ${slot.label}`}
                  onCommit={(value) => onUpdateValue(set.id, slot.field, value)}
                />
              ) : (
                <View key={`${set.id}-empty-${slotIndex}`} style={styles.valueColumn} />
              ),
            )}
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: set.completed }} onPress={() => onToggle(set.id)} style={({ pressed }) => [styles.checkButton, styles.doneColumn, set.completed && styles.checkButtonComplete, pressed && styles.pressed]}>
              <Text style={set.completed ? styles.checkComplete : styles.checkEmpty}>{set.completed ? '✓' : ''}</Text>
            </Pressable>
          </View>
          <Pressable onPress={() => onOpenSet(set.id)} style={({ pressed }) => [styles.setMetaRow, pressed && styles.pressed]}>
            <Text style={styles.setMetaText}>{setTypeLabel(set.setType)}</Text>
            <Text style={styles.setMetaText}>{formatEffort(set)}</Text>
          </Pressable>
        </View>
      ))}

      <Pressable accessibilityRole="button" onPress={onAddSet} style={({ pressed }) => [styles.addSetButton, pressed && styles.pressed]}>
        <Text style={styles.addSetLabel}>+ Add Set</Text>
      </Pressable>
    </View>
  );
}

function SetValueInput({ value, decimal = false, accessibilityLabel, onCommit }: { value?: number; decimal?: boolean; accessibilityLabel: string; onCommit: (value: number | undefined) => void }) {
  const [text, setText] = useState(value === undefined ? '' : String(value));
  useEffect(() => setText(value === undefined ? '' : String(value)), [value]);
  const commit = () => {
    const normalized = text.trim().replace(',', '.');
    if (!normalized) return onCommit(undefined);
    const parsed = decimal ? Number.parseFloat(normalized) : Number.parseInt(normalized, 10);
    if (!Number.isFinite(parsed) || parsed < 0) return setText(value === undefined ? '' : String(value));
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
        inputAccessoryViewID={NUMERIC_KEYBOARD_ACCESSORY_ID}
        returnKeyType="done"
        selectTextOnFocus
        placeholder="—"
        placeholderTextColor={colors.textMuted}
        style={styles.valueInput}
      />
    </View>
  );
}

function ExercisePickerModal({ title, exercises, visible, disabledNames, onClose, onSelect }: { title: string; exercises: ExerciseDefinition[]; visible: boolean; disabledNames: string[]; onClose: () => void; onSelect: (exerciseId: string) => void }) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCardLarge}>
          <Text style={styles.modalTitle}>{title}</Text>
          <ScrollView style={styles.exercisePickerList}>
            {exercises.map((exercise) => {
              const disabled = disabledNames.includes(exercise.name);
              return (
                <Pressable key={exercise.id} disabled={disabled} onPress={() => onSelect(exercise.id)} style={({ pressed }) => [styles.pickerRow, disabled && styles.pickerRowAdded, pressed && styles.pressed]}>
                  <View style={styles.pickerCopy}>
                    <Text style={styles.pickerName}>{exercise.name}</Text>
                    <Text style={styles.pickerDetail}>{exercise.detail} · {exercise.exerciseType}</Text>
                  </View>
                  <Text style={disabled ? styles.addedLabel : styles.addLabel}>{disabled ? 'In workout' : 'Select'}</Text>
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


function RestTimerModal({ visible, seconds, durationSeconds, running, paused, complete, sourceExerciseName, onClose, onStart, onAdjust, onPause, onResume, onRestart, onSkip }: { visible: boolean; seconds: number; durationSeconds: number; running: boolean; paused: boolean; complete: boolean; sourceExerciseName?: string; onClose: () => void; onStart: () => void; onAdjust: (seconds: number) => void; onPause: () => void; onResume: () => void; onRestart: () => void; onSkip: () => void }) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{complete ? 'Rest complete' : 'Rest Timer'}</Text>
          <Text style={styles.restTimerDisplay}>{complete ? 'GO' : formatDuration(seconds || durationSeconds)}</Text>
          <Text style={styles.modalBody}>
            {sourceExerciseName ? `Started after ${sourceExerciseName}. ` : ''}
            {complete ? 'Your next set is ready.' : paused ? 'Timer is paused and saved on this device.' : running ? 'The timer keeps counting while you move around LiftFlow.' : 'Start the shown timer or complete a set to start that exercise’s timer automatically.'}
          </Text>
          {!complete ? (
            <View style={styles.timerStepper}>
              <SmallAction label="−15 sec" disabled={!running && !paused} onPress={() => onAdjust(-15)} />
              <SmallAction label="+15 sec" disabled={!running && !paused} onPress={() => onAdjust(15)} />
            </View>
          ) : null}
          {!running && !paused && !complete ? <PrimaryButton label={`Start ${formatDuration(durationSeconds)}`} onPress={onStart} /> : null}
          {running ? <PrimaryButton label="Pause" onPress={onPause} variant="secondary" /> : null}
          {paused ? <PrimaryButton label="Resume" onPress={onResume} /> : null}
          {(running || paused || complete) ? <PrimaryButton label="Restart" onPress={onRestart} variant="secondary" /> : null}
          {(running || paused) ? <PrimaryButton label="Skip Rest" onPress={onSkip} variant="danger" /> : null}
          <PrimaryButton label={complete ? 'Ready for Next Set' : 'Close'} onPress={onClose} variant={complete ? 'primary' : 'secondary'} />
        </View>
      </View>
    </Modal>
  );
}

function ExerciseActionsModal({ exercise, canMoveUp, canMoveDown, restSeconds, onClose, onMove, onReplace, onRestSecondsChange, onRemove }: { exercise: WorkoutExercise | null; canMoveUp: boolean; canMoveDown: boolean; restSeconds: number; onClose: () => void; onMove: (direction: 'up' | 'down') => void; onReplace: () => void; onRestSecondsChange: (seconds: number) => void; onRemove: () => void }) {
  return (
    <Modal transparent visible={Boolean(exercise)} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          {exercise ? (
            <>
              <Text style={styles.modalTitle}>{exercise.name}</Text>
              <Text style={styles.controlLabel}>Rest after completed sets</Text>
              <View style={styles.timerStepper}>
                <SmallAction label="−15 sec" onPress={() => onRestSecondsChange(Math.max(15, restSeconds - 15))} />
                <Text style={styles.timerStepperValue}>{formatDuration(restSeconds)}</Text>
                <SmallAction label="+15 sec" onPress={() => onRestSecondsChange(Math.min(3600, restSeconds + 15))} />
              </View>
              <View style={styles.horizontalButtons}>
                <SmallAction label="Move Up" disabled={!canMoveUp} onPress={() => onMove('up')} />
                <SmallAction label="Move Down" disabled={!canMoveDown} onPress={() => onMove('down')} />
              </View>
              <PrimaryButton label="Replace Exercise" onPress={onReplace} variant="secondary" />
              <PrimaryButton label="Remove Exercise" onPress={onRemove} variant="danger" />
              <PrimaryButton label="Cancel" onPress={onClose} variant="secondary" />
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function SetActionsModal({ exercise, set, onClose, onSetType, onEffort, onMove, onDelete }: { exercise: WorkoutExercise | null; set: WorkoutSet | null; onClose: () => void; onSetType: (type: WorkoutSetType) => void; onEffort: (mode: EffortMode | null, value?: number) => void; onMove: (direction: 'up' | 'down') => void; onDelete: () => void }) {
  const [effortMode, setEffortMode] = useState<EffortMode | null>(null);
  const [effortText, setEffortText] = useState('');
  useEffect(() => {
    if (set?.rpe !== undefined) { setEffortMode('rpe'); setEffortText(String(set.rpe)); }
    else if (set?.rir !== undefined) { setEffortMode('rir'); setEffortText(String(set.rir)); }
    else { setEffortMode(null); setEffortText(''); }
  }, [set]);
  const commitEffort = () => {
    if (!effortMode || !effortText.trim()) { onEffort(null); return; }
    const value = Number.parseFloat(effortText.replace(',', '.'));
    if (Number.isFinite(value)) onEffort(effortMode, value);
  };
  const closeModal = () => {
    commitEffort();
    Keyboard.dismiss();
    onClose();
  };
  const index = exercise && set ? exercise.sets.findIndex((item) => item.id === set.id) : -1;
  const visible = Boolean(exercise && set);

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={closeModal}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
        style={styles.keyboardModalRoot}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.setControlsCard}>
            {exercise && set ? (
              <>
                <View style={styles.setControlsHeader}>
                  <View style={styles.setControlsHeaderCopy}>
                    <Text style={styles.modalTitle}>Set Controls</Text>
                    <Text style={styles.modalBody}>{exercise.name}</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Close set controls"
                    hitSlop={12}
                    onPress={closeModal}
                    style={({ pressed }) => [styles.modalCloseButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.modalCloseLabel}>Close</Text>
                  </Pressable>
                </View>

                <ScrollView
                  automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
                  contentContainerStyle={styles.setControlsContent}
                  contentInsetAdjustmentBehavior="automatic"
                  keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                  showsVerticalScrollIndicator
                  style={styles.setControlsScroll}
                >
                  <Text style={styles.controlLabel}>Set type</Text>
                  <View style={styles.chipWrap}>
                    {SET_TYPES.map((option) => (
                      <Pressable key={option.value} onPress={() => onSetType(option.value)} style={[styles.chip, (set.setType ?? 'normal') === option.value && styles.chipActive]}>
                        <Text style={(set.setType ?? 'normal') === option.value ? styles.chipTextActive : styles.chipText}>{option.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={styles.controlLabel}>Effort</Text>
                  <View style={styles.horizontalButtons}>
                    <SmallAction label="None" active={effortMode === null} onPress={() => { setEffortMode(null); setEffortText(''); onEffort(null); }} />
                    <SmallAction label="RPE" active={effortMode === 'rpe'} onPress={() => setEffortMode('rpe')} />
                    <SmallAction label="RIR" active={effortMode === 'rir'} onPress={() => setEffortMode('rir')} />
                  </View>
                  {effortMode ? (
                    <TextInput
                      value={effortText}
                      onChangeText={setEffortText}
                      onBlur={commitEffort}
                      onSubmitEditing={() => {
                        commitEffort();
                        Keyboard.dismiss();
                      }}
                      keyboardType="decimal-pad"
                      placeholder={effortMode === 'rpe' ? '0–10 RPE' : 'Reps in reserve'}
                      placeholderTextColor={colors.textMuted}
                      returnKeyType="done"
                      selectTextOnFocus
                      style={styles.effortInput}
                    />
                  ) : null}
                  <View style={styles.horizontalButtons}>
                    <SmallAction label="Move Up" disabled={index <= 0} onPress={() => onMove('up')} />
                    <SmallAction label="Move Down" disabled={index < 0 || index >= exercise.sets.length - 1} onPress={() => onMove('down')} />
                  </View>
                  <PrimaryButton label="Delete Set" onPress={onDelete} variant="danger" />
                </ScrollView>

                <View style={styles.setControlsFooter}>
                  <PrimaryButton label="Done" onPress={closeModal} variant="secondary" />
                </View>
              </>
            ) : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function SmallAction({ label, onPress, disabled = false, active = false }: { label: string; onPress: () => void; disabled?: boolean; active?: boolean }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.smallAction, active && styles.smallActionActive, disabled && styles.disabled, pressed && styles.pressed]}>
      <Text style={[styles.smallActionText, active && styles.smallActionTextActive]}>{label}</Text>
    </Pressable>
  );
}

function WorkoutDialog({ type, completedSetCount, totalSetCount, canUpdateTemplate, onCancel, onDiscard, onFinish }: { type: DialogType; completedSetCount: number; totalSetCount: number; canUpdateTemplate: boolean; onCancel: () => void; onDiscard: () => void; onFinish: (updateTemplate: boolean) => void }) {
  return (
    <Modal transparent visible={type !== null} animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          {type === 'discard' ? (
            <>
              <Text style={styles.modalTitle}>Discard workout?</Text>
              <Text style={styles.modalBody}>This active workout will be removed. Saved templates stay unchanged.</Text>
              <PrimaryButton label="Cancel" onPress={onCancel} variant="secondary" />
              <PrimaryButton label="Discard Workout" onPress={onDiscard} variant="danger" />
            </>
          ) : null}
          {type === 'finish' ? (
            <>
              <Text style={styles.modalTitle}>Finish workout?</Text>
              <Text style={styles.modalBody}>{completedSetCount} of {totalSetCount} sets are complete.</Text>
              <PrimaryButton label="Continue Workout" onPress={onCancel} variant="secondary" />
              {canUpdateTemplate ? (
                <>
                  <PrimaryButton label="Finish Without Updating Template" onPress={() => onFinish(false)} variant="secondary" />
                  <PrimaryButton label="Finish & Update Template" onPress={() => onFinish(true)} />
                </>
              ) : <PrimaryButton label="Finish Workout" onPress={() => onFinish(false)} />}
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function getSetLabel(sets: WorkoutSet[], index: number) {
  const type = sets[index].setType ?? 'normal';
  if (type === 'warmup') return 'W';
  if (type === 'drop') return 'D';
  if (type === 'failure') return 'F';
  if (type === 'amrap') return 'A';
  return String(sets.slice(0, index + 1).filter((set) => (set.setType ?? 'normal') === 'normal').length);
}

function setTypeLabel(type: WorkoutSetType | undefined) {
  return SET_TYPES.find((item) => item.value === (type ?? 'normal'))?.label ?? 'Working';
}

function formatEffort(set: WorkoutSet) {
  if (set.rpe !== undefined) return `RPE ${set.rpe}`;
  if (set.rir !== undefined) return `RIR ${set.rir}`;
  return 'No effort recorded';
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, backgroundColor: colors.background },
  topBarSide: { width: 74, minHeight: 48, justifyContent: 'center' },
  topBarSideLeft: { alignItems: 'flex-start' },
  topBarSideRight: { alignItems: 'flex-end' },
  close: { color: colors.text, fontSize: 30, lineHeight: 34, fontWeight: '700' },
  restButton: { backgroundColor: colors.surfaceElevated, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  restText: { color: colors.primary, fontSize: 13, fontWeight: '800' },
  restTimerDisplay: { color: colors.primary, fontSize: 46, fontWeight: '900', textAlign: 'center', letterSpacing: 1 },
  finish: { color: colors.primary, fontSize: 16, fontWeight: '900' },
  pressed: { opacity: 0.65 },
  disabled: { opacity: 0.35 },
  content: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  workoutHeader: { gap: 4 },
  workoutName: { color: colors.text, fontSize: 30, fontWeight: '900' },
  elapsed: { color: colors.text, fontSize: 17, fontWeight: '700' },
  muted: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  workoutNotes: { minHeight: 48, maxHeight: 110, color: colors.text, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 14, marginTop: spacing.sm },
  saveStatus: { color: colors.primary, fontSize: 12, fontWeight: '700', marginTop: 5 },
  saveStatusError: { color: colors.danger },
  emptyCard: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  noWorkout: { flex: 1, justifyContent: 'center', padding: spacing.lg, gap: spacing.md },
  emptyTitle: { color: colors.text, fontSize: 21, fontWeight: '900' },
  exerciseCard: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md },
  exerciseHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: spacing.sm },
  exerciseHeaderCopy: { flex: 1, paddingRight: spacing.sm },
  exerciseName: { color: colors.text, fontSize: 20, fontWeight: '900' },
  exerciseTracking: { color: colors.primary, fontSize: 12, fontWeight: '800', marginTop: 2 },
  exerciseNote: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  exerciseNotes: { minHeight: 42, color: colors.text, backgroundColor: colors.surfaceElevated, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.sm, paddingVertical: 8, marginBottom: spacing.sm },
  menu: { color: colors.textMuted, fontSize: 18, fontWeight: '900' },
  tableHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  columnLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '900', textAlign: 'center' },
  setColumn: { width: 42 },
  previousColumn: { flex: 1.3 },
  valueColumn: { flex: 1 },
  doneColumn: { width: 42 },
  setBlock: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  setRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 5 },
  completedRow: { backgroundColor: 'rgba(91, 217, 137, 0.08)' },
  setTypeButton: { alignItems: 'center', justifyContent: 'center', minHeight: 38, borderRadius: radius.sm, backgroundColor: colors.surfaceElevated },
  setNumber: { color: colors.text, fontSize: 15, fontWeight: '900' },
  specialSetNumber: { color: colors.primary },
  previousButton: { minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  previousButtonPressed: { backgroundColor: colors.surfaceElevated },
  previousText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  valueBox: { minHeight: 38, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, justifyContent: 'center' },
  valueInput: { color: colors.text, fontSize: 15, fontWeight: '800', textAlign: 'center', paddingVertical: 6, paddingHorizontal: 2 },
  checkButton: { minHeight: 38, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  checkButtonComplete: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkComplete: { color: colors.background, fontSize: 17, fontWeight: '900' },
  checkEmpty: { color: colors.textMuted },
  setMetaRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 47, paddingBottom: 8 },
  setMetaText: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  addSetButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceElevated },
  addSetLabel: { color: colors.primary, fontSize: 14, fontWeight: '900' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', alignItems: 'center', justifyContent: 'center', padding: spacing.md },
  modalCard: { width: '100%', maxWidth: 500, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  modalCardLarge: { width: '100%', maxWidth: 560, maxHeight: '86%', backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  keyboardModalRoot: { flex: 1 },
  setControlsCard: { width: '100%', maxWidth: 560, maxHeight: '88%', overflow: 'hidden', backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg },
  setControlsHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  setControlsHeaderCopy: { flex: 1 },
  modalCloseButton: { minHeight: 40, minWidth: 58, alignItems: 'flex-end', justifyContent: 'center' },
  modalCloseLabel: { color: colors.primary, fontSize: 15, fontWeight: '900' },
  setControlsScroll: { flexShrink: 1 },
  setControlsContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md, gap: spacing.sm },
  setControlsFooter: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.surface },
  modalTitle: { color: colors.text, fontSize: 24, fontWeight: '900' },
  modalBody: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  exercisePickerList: { maxHeight: 480 },
  pickerRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingVertical: spacing.sm },
  pickerRowAdded: { opacity: 0.4 },
  pickerCopy: { flex: 1 },
  pickerName: { color: colors.text, fontSize: 16, fontWeight: '800' },
  pickerDetail: { color: colors.textMuted, fontSize: 13, marginTop: 3 },
  addLabel: { color: colors.primary, fontSize: 13, fontWeight: '900' },
  addedLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  horizontalButtons: { flexDirection: 'row', gap: spacing.sm },
  timerStepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  timerStepperValue: { minWidth: 74, color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'center' },
  smallAction: { flex: 1, minHeight: 44, borderRadius: radius.md, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  smallActionActive: { borderColor: colors.primary },
  smallActionText: { color: colors.text, fontSize: 13, fontWeight: '800' },
  smallActionTextActive: { color: colors.primary },
  controlLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '900', marginTop: spacing.md, marginBottom: spacing.sm, textTransform: 'uppercase' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 9, backgroundColor: colors.surfaceElevated, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  chipActive: { borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: '700' },
  chipTextActive: { color: colors.primary, fontWeight: '900' },
  effortInput: { color: colors.text, backgroundColor: colors.surfaceElevated, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, minHeight: 48, marginVertical: spacing.sm },
});
