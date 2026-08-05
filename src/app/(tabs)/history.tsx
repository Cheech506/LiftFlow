import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { NumericKeyboardAccessory, NUMERIC_KEYBOARD_ACCESSORY_ID } from '@/components/KeyboardAwareModal';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SectionCard } from '@/components/SectionCard';
import { colors, radius, spacing } from '@/constants/theme';
import {
  formatSetMetrics,
  getMetricSlots,
} from '@/lib/exerciseTracking';
import {
  CompletedWorkout,
  useActiveWorkout,
  WorkoutSet,
  WorkoutSetType,
} from '@/context/ActiveWorkoutContext';
import {
  formatDurationShort,
  getCompletedSets,
  getWorkoutDurationSeconds,
  getWorkoutVolume,
} from '@/lib/workoutStats';

type HistoryView = 'timeline' | 'calendar';
const SET_TYPE_ORDER: WorkoutSetType[] = ['normal', 'warmup', 'drop', 'failure', 'amrap'];

export default function HistoryScreen() {
  const router = useRouter();
  const {
    workout: activeWorkout,
    completedWorkouts,
    updateCompletedWorkout,
    deleteCompletedWorkout,
    repeatCompletedWorkout,
    saveCompletedWorkoutAsTemplate,
  } = useActiveWorkout();
  const [view, setView] = useState<HistoryView>('timeline');
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null);
  const [editingWorkout, setEditingWorkout] = useState<CompletedWorkout | null>(null);

  const selectedWorkout = completedWorkouts.find((item) => item.id === selectedWorkoutId) ?? null;

  const repeatWorkout = (workout: CompletedWorkout) => {
    if (activeWorkout) {
      Alert.alert('Workout already active', `Finish or discard ${activeWorkout.name} before repeating another workout.`);
      return;
    }
    if (repeatCompletedWorkout(workout.id)) {
      setSelectedWorkoutId(null);
      router.push('/active-workout');
    }
  };

  const saveAsTemplate = (workout: CompletedWorkout) => {
    const template = saveCompletedWorkoutAsTemplate(workout.id);
    if (template) Alert.alert('Template created', `${template.name} was added to ${template.folder}.`);
  };

  const deleteWorkout = (workout: CompletedWorkout) => {
    Alert.alert(
      'Delete completed workout?',
      `${workout.name} will be removed from History. Exercises and templates will not be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteCompletedWorkout(workout.id);
            setSelectedWorkoutId(null);
          },
        },
      ],
    );
  };

  return (
    <>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.toggle}>
          <ToggleButton label="Timeline" active={view === 'timeline'} onPress={() => setView('timeline')} />
          <ToggleButton label="Calendar" active={view === 'calendar'} onPress={() => setView('calendar')} />
        </View>

        {completedWorkouts.length === 0 ? (
          <SectionCard title="Workout history">
            <View style={styles.emptyIcon}><Text style={styles.emptyIconText}>◷</Text></View>
            <Text style={styles.emptyTitle}>No completed workouts yet</Text>
            <Text style={styles.emptyCopy}>Finish your first workout and LiftFlow will preserve it here.</Text>
            <PrimaryButton label="Choose Workout" onPress={() => router.push('/workouts')} />
          </SectionCard>
        ) : view === 'timeline' ? (
          completedWorkouts.map((workout) => (
            <WorkoutHistoryCard key={workout.id} workout={workout} onPress={() => setSelectedWorkoutId(workout.id)} />
          ))
        ) : (
          <CalendarSummary workouts={completedWorkouts} onSelectWorkout={(item) => setSelectedWorkoutId(item.id)} />
        )}
      </ScrollView>

      <WorkoutDetailModal
        workout={selectedWorkout}
        onClose={() => setSelectedWorkoutId(null)}
        onEdit={() => selectedWorkout && setEditingWorkout(cloneWorkout(selectedWorkout))}
        onRepeat={() => selectedWorkout && repeatWorkout(selectedWorkout)}
        onSaveTemplate={() => selectedWorkout && saveAsTemplate(selectedWorkout)}
        onDelete={() => selectedWorkout && deleteWorkout(selectedWorkout)}
      />

      <WorkoutEditorModal
        workout={editingWorkout}
        onClose={() => setEditingWorkout(null)}
        onSave={(updated) => {
          updateCompletedWorkout(updated);
          setEditingWorkout(null);
          setSelectedWorkoutId(updated.id);
        }}
      />
      <NumericKeyboardAccessory />
    </>
  );
}

function ToggleButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={({ pressed }) => [styles.toggleOption, active && styles.toggleActive, pressed && styles.pressed]}>
      <Text style={active ? styles.toggleActiveLabel : styles.toggleLabel}>{label}</Text>
    </Pressable>
  );
}

function WorkoutHistoryCard({ workout, onPress }: { workout: CompletedWorkout; onPress: () => void }) {
  return (
    <SectionCard title={formatWorkoutDate(workout.completedAt)}>
      <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
        <View style={styles.rowBetween}>
          <View style={styles.flexCopy}>
            <Text style={styles.workoutName}>{workout.name}</Text>
            {workout.sourceFolder ? <Text style={styles.folder}>{workout.sourceFolder}</Text> : null}
          </View>
          <Text style={styles.chevron}>›</Text>
        </View>
        <View style={styles.summaryRow}>
          <Summary value={formatDurationShort(getWorkoutDurationSeconds(workout))} label="Duration" />
          <Summary value={String(getCompletedSets(workout).length)} label="Completed sets" />
          <Summary value={`${Math.round(getWorkoutVolume(workout)).toLocaleString()} lb`} label="Volume" />
        </View>
        {workout.notes ? <Text style={styles.notes}>“{workout.notes}”</Text> : null}
      </Pressable>
    </SectionCard>
  );
}

function CalendarSummary({ workouts, onSelectWorkout }: { workouts: CompletedWorkout[]; onSelectWorkout: (workout: CompletedWorkout) => void }) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const days = useMemo(() => buildCalendarDays(year, month), [month, year]);
  const workoutsByDate = useMemo(() => {
    const map = new Map<string, CompletedWorkout[]>();
    workouts.forEach((workout) => {
      const date = new Date(workout.completedAt);
      if (date.getFullYear() !== year || date.getMonth() !== month) return;
      map.set(dateKey(date), [...(map.get(dateKey(date)) ?? []), workout]);
    });
    return map;
  }, [month, workouts, year]);

  return (
    <SectionCard title={new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(today)}>
      <View style={styles.calendarHeader}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => <Text key={`${day}-${index}`} style={styles.calendarHeaderText}>{day}</Text>)}
      </View>
      <View style={styles.calendarGrid}>
        {days.map((date) => {
          const dayWorkouts = workoutsByDate.get(dateKey(date)) ?? [];
          const inMonth = date.getMonth() === month;
          return (
            <Pressable key={date.toISOString()} onPress={() => dayWorkouts[0] && onSelectWorkout(dayWorkouts[0])} style={({ pressed }) => [styles.calendarDay, dayWorkouts.length > 0 && styles.calendarDayActive, pressed && dayWorkouts.length > 0 && styles.pressed]}>
              <Text style={[styles.calendarDayText, !inMonth && styles.calendarDayMuted]}>{date.getDate()}</Text>
              {dayWorkouts.length > 0 ? <Text style={styles.calendarCount}>{dayWorkouts.length}</Text> : null}
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.calendarHint}>Tap a highlighted day to open its first completed workout.</Text>
    </SectionCard>
  );
}

function WorkoutDetailModal({ workout, onClose, onEdit, onRepeat, onSaveTemplate, onDelete }: { workout: CompletedWorkout | null; onClose: () => void; onEdit: () => void; onRepeat: () => void; onSaveTemplate: () => void; onDelete: () => void }) {
  return (
    <Modal transparent visible={Boolean(workout)} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          {workout ? (
            <>
              <Text style={styles.modalTitle}>{workout.name}</Text>
              <Text style={styles.folder}>{formatWorkoutDate(workout.completedAt)}</Text>
              {workout.notes ? <Text style={styles.notes}>{workout.notes}</Text> : null}
              <ScrollView style={styles.modalScroll}>
                {workout.exercises.map((exercise) => (
                  <View key={`${workout.id}-${exercise.id}`} style={styles.detailExercise}>
                    <Text style={styles.exerciseName}>{exercise.name}</Text>
                    {exercise.notes ? <Text style={styles.exerciseNotes}>{exercise.notes}</Text> : null}
                    {exercise.sets.map((set, index) => (
                      <View key={set.id} style={styles.setDetailRow}>
                        <Text style={[styles.setDetailLabel, (set.setType ?? 'normal') !== 'normal' && styles.specialSetDetailLabel]}>{setLabel(exercise.sets, index)}</Text>
                        <View style={styles.setDetailRight}>
                          <Text style={styles.setDetailValue}>{formatSetMetrics(exercise.exerciseType, set)} {set.completed ? '✓' : ''}</Text>
                          <Text style={styles.setDetailMeta}>{setTypeName(set.setType)} · {effortLabel(set)}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ))}
              </ScrollView>
              <View style={styles.twoColumnButtons}>
                <PrimaryButton label="Edit" onPress={onEdit} variant="secondary" style={styles.flexButton} />
                <PrimaryButton label="Repeat" onPress={onRepeat} style={styles.flexButton} />
              </View>
              <PrimaryButton label="Save as Template" onPress={onSaveTemplate} variant="secondary" />
              <PrimaryButton label="Delete Workout" onPress={onDelete} variant="danger" />
              <PrimaryButton label="Close" onPress={onClose} variant="secondary" />
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function WorkoutEditorModal({ workout, onClose, onSave }: { workout: CompletedWorkout | null; onClose: () => void; onSave: (workout: CompletedWorkout) => void }) {
  const [draft, setDraft] = useState<CompletedWorkout | null>(null);
  useEffect(() => setDraft(workout ? cloneWorkout(workout) : null), [workout]);
  if (!draft) return <Modal transparent visible={false} />;

  const updateSet = (exerciseIndex: number, setIndex: number, patch: Partial<WorkoutSet>) => {
    setDraft((current) => {
      if (!current) return current;
      const exercises = current.exercises.map((exercise, currentExerciseIndex) => currentExerciseIndex !== exerciseIndex ? exercise : {
        ...exercise,
        sets: exercise.sets.map((set, currentSetIndex) => currentSetIndex === setIndex ? { ...set, ...patch } : set),
      });
      return { ...current, exercises };
    });
  };

  return (
    <Modal transparent visible={Boolean(workout)} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.editorCard}>
          <Text style={styles.modalTitle}>Edit Completed Workout</Text>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.editorContent}>
            <Text style={styles.fieldLabel}>Workout name</Text>
            <TextInput value={draft.name} onChangeText={(name) => setDraft({ ...draft, name })} style={styles.textInput} />
            <Text style={styles.fieldLabel}>Workout notes</Text>
            <TextInput value={draft.notes ?? ''} onChangeText={(notes) => setDraft({ ...draft, notes })} multiline style={[styles.textInput, styles.multilineInput]} />

            {draft.exercises.map((exercise, exerciseIndex) => (
              <View key={exercise.id} style={styles.editExerciseCard}>
                <Text style={styles.exerciseName}>{exercise.name}</Text>
                <Text style={styles.exerciseNotes}>{exercise.exerciseType}</Text>
                <TextInput
                  value={exercise.notes ?? ''}
                  onChangeText={(notes) => setDraft((current) => current ? {
                    ...current,
                    exercises: current.exercises.map((item, index) => index === exerciseIndex ? { ...item, notes } : item),
                  } : current)}
                  placeholder="Exercise notes"
                  placeholderTextColor={colors.textMuted}
                  style={styles.textInput}
                />
                {exercise.sets.map((set, setIndex) => (
                  <View key={set.id} style={styles.editSetCard}>
                    <Pressable onPress={() => updateSet(exerciseIndex, setIndex, { setType: nextSetType(set.setType) })} style={styles.typePill}>
                      <Text style={styles.typePillText}>{setTypeName(set.setType)}</Text>
                    </Pressable>
                    {getMetricSlots(exercise.exerciseType).map((slot, slotIndex) =>
                      slot ? (
                        <NumericEditor
                          key={`${set.id}-${slot.field}`}
                          label={slot.label}
                          value={set[slot.field]}
                          integer={!slot.decimal}
                          onChange={(value) =>
                            updateSet(exerciseIndex, setIndex, { [slot.field]: value })
                          }
                        />
                      ) : null,
                    )}
                    <EffortEditor set={set} onChange={(patch) => updateSet(exerciseIndex, setIndex, patch)} />
                    <Pressable onPress={() => updateSet(exerciseIndex, setIndex, { completed: !set.completed })} style={[styles.completedToggle, set.completed && styles.completedToggleActive]}>
                      <Text style={set.completed ? styles.completedToggleTextActive : styles.completedToggleText}>{set.completed ? 'Completed ✓' : 'Not completed'}</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>
          <PrimaryButton label="Save Changes" onPress={() => onSave({ ...draft, name: draft.name.trim() || workout?.name || 'Workout' })} />
          <PrimaryButton label="Cancel" onPress={onClose} variant="secondary" />
        </View>
      </View>
    </Modal>
  );
}

function NumericEditor({ label, value, integer = false, onChange }: { label: string; value?: number; integer?: boolean; onChange: (value: number | undefined) => void }) {
  const [text, setText] = useState(value === undefined ? '' : String(value));
  useEffect(() => setText(value === undefined ? '' : String(value)), [value]);
  const commit = () => {
    if (!text.trim()) return onChange(undefined);
    const parsed = integer ? Number.parseInt(text, 10) : Number.parseFloat(text.replace(',', '.'));
    if (Number.isFinite(parsed) && parsed >= 0) onChange(parsed);
  };
  return (
    <View style={styles.numericEditor}>
      <Text style={styles.numericLabel}>{label}</Text>
      <TextInput value={text} onChangeText={setText} onBlur={commit} keyboardType={integer ? 'number-pad' : 'decimal-pad'} inputAccessoryViewID={NUMERIC_KEYBOARD_ACCESSORY_ID} style={styles.numericInput} />
    </View>
  );
}

function EffortEditor({ set, onChange }: { set: WorkoutSet; onChange: (patch: Partial<WorkoutSet>) => void }) {
  const mode = set.rpe !== undefined ? 'RPE' : set.rir !== undefined ? 'RIR' : 'None';
  const value = set.rpe ?? set.rir;
  return (
    <View style={styles.effortEditor}>
      <Pressable
        onPress={() => {
          if (mode === 'None') onChange({ rpe: 8, rir: undefined });
          else if (mode === 'RPE') onChange({ rpe: undefined, rir: 2 });
          else onChange({ rpe: undefined, rir: undefined });
        }}
        style={styles.effortModeButton}
      >
        <Text style={styles.effortModeText}>{mode}</Text>
      </Pressable>
      {mode !== 'None' ? (
        <NumericEditor label="Value" value={value} onChange={(next) => mode === 'RPE' ? onChange({ rpe: next, rir: undefined }) : onChange({ rir: next, rpe: undefined })} />
      ) : null}
    </View>
  );
}

function Summary({ value, label }: { value: string; label: string }) {
  return <View style={styles.summaryItem}><Text style={styles.summaryValue}>{value}</Text><Text style={styles.summaryLabel}>{label}</Text></View>;
}

function cloneWorkout(workout: CompletedWorkout): CompletedWorkout {
  return { ...workout, exercises: workout.exercises.map((exercise) => ({ ...exercise, sets: exercise.sets.map((set) => ({ ...set })) })) };
}

function nextSetType(type: WorkoutSetType | undefined) {
  const currentIndex = SET_TYPE_ORDER.indexOf(type ?? 'normal');
  return SET_TYPE_ORDER[(currentIndex + 1) % SET_TYPE_ORDER.length];
}

function setLabel(sets: WorkoutSet[], index: number) {
  const type = sets[index].setType ?? 'normal';
  if (type === 'warmup') return 'W';
  if (type === 'drop') return 'D';
  if (type === 'failure') return 'F';
  if (type === 'amrap') return 'A';
  return String(sets.slice(0, index + 1).filter((set) => (set.setType ?? 'normal') === 'normal').length);
}

function setTypeName(type: WorkoutSetType | undefined) {
  if (type === 'warmup') return 'Warm-up';
  if (type === 'drop') return 'Drop';
  if (type === 'failure') return 'Failure';
  if (type === 'amrap') return 'AMRAP';
  return 'Working';
}

function effortLabel(set: WorkoutSet) {
  if (set.rpe !== undefined) return `RPE ${set.rpe}`;
  if (set.rir !== undefined) return `RIR ${set.rir}`;
  return 'No effort';
}

function formatWorkoutDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(timestamp));
}

function buildCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const firstVisible = new Date(year, month, 1 - firstDay.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstVisible);
    date.setDate(firstVisible.getDate() + index);
    return date;
  });
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  toggle: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.md, padding: 4 },
  toggleOption: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  toggleActive: { backgroundColor: colors.surfaceElevated },
  toggleLabel: { color: colors.textMuted, fontWeight: '800' },
  toggleActiveLabel: { color: colors.primary, fontWeight: '900' },
  pressed: { opacity: 0.65 },
  emptyIcon: { alignItems: 'center', marginVertical: spacing.md },
  emptyIconText: { color: colors.textMuted, fontSize: 42 },
  emptyTitle: { color: colors.text, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  emptyCopy: { color: colors.textMuted, fontSize: 14, lineHeight: 20, textAlign: 'center', marginVertical: spacing.sm },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  flexCopy: { flex: 1 },
  workoutName: { color: colors.text, fontSize: 20, fontWeight: '900' },
  folder: { color: colors.primary, fontSize: 13, fontWeight: '800', marginTop: 3 },
  chevron: { color: colors.textMuted, fontSize: 28 },
  summaryRow: { flexDirection: 'row', marginTop: spacing.md },
  summaryItem: { flex: 1 },
  summaryValue: { color: colors.text, fontSize: 16, fontWeight: '900' },
  summaryLabel: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  notes: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: spacing.sm },
  calendarHeader: { flexDirection: 'row' },
  calendarHeaderText: { width: '14.2857%', color: colors.textMuted, textAlign: 'center', fontSize: 11, fontWeight: '900' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm },
  calendarDay: { width: '14.2857%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  calendarDayActive: { backgroundColor: colors.surfaceElevated },
  calendarDayText: { color: colors.text, fontWeight: '700' },
  calendarDayMuted: { color: colors.textMuted, opacity: 0.4 },
  calendarCount: { color: colors.primary, fontSize: 10, fontWeight: '900' },
  calendarHint: { color: colors.textMuted, fontSize: 12, marginTop: spacing.sm },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.76)', alignItems: 'center', justifyContent: 'center', padding: spacing.md },
  modalCard: { width: '100%', maxWidth: 580, maxHeight: '90%', backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  editorCard: { width: '100%', maxWidth: 620, maxHeight: '94%', backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  modalTitle: { color: colors.text, fontSize: 24, fontWeight: '900' },
  modalScroll: { maxHeight: 430 },
  detailExercise: { paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  exerciseName: { color: colors.text, fontSize: 17, fontWeight: '900' },
  exerciseNotes: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  setDetailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7 },
  setDetailLabel: { width: 38, color: colors.text, fontWeight: '900' },
  specialSetDetailLabel: { color: colors.primary },
  setDetailRight: { flex: 1 },
  setDetailValue: { color: colors.text, fontSize: 14, fontWeight: '700' },
  setDetailMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  twoColumnButtons: { flexDirection: 'row', gap: spacing.sm },
  flexButton: { flex: 1 },
  editorContent: { gap: spacing.sm, paddingBottom: spacing.lg },
  fieldLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', marginTop: spacing.sm },
  textInput: { minHeight: 46, color: colors.text, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  multilineInput: { minHeight: 80, textAlignVertical: 'top' },
  editExerciseCard: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, marginTop: spacing.sm },
  editSetCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, gap: spacing.sm },
  typePill: { alignSelf: 'flex-start', backgroundColor: colors.surfaceElevated, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.primary, paddingHorizontal: 12, paddingVertical: 7 },
  typePillText: { color: colors.primary, fontWeight: '900' },
  numericEditor: { flex: 1 },
  numericLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  numericInput: { minHeight: 42, color: colors.text, backgroundColor: colors.surfaceElevated, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.sm, marginTop: 4 },
  effortEditor: { gap: spacing.sm },
  effortModeButton: { minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border },
  effortModeText: { color: colors.primary, fontWeight: '900' },
  completedToggle: { minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  completedToggleActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  completedToggleText: { color: colors.textMuted, fontWeight: '800' },
  completedToggleTextActive: { color: colors.background, fontWeight: '900' },
});
