import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { KeyboardAwareModal, NumericKeyboardAccessory, NUMERIC_KEYBOARD_ACCESSORY_ID } from '@/components/KeyboardAwareModal';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SectionCard } from '@/components/SectionCard';
import { colors, radius, spacing } from '@/constants/theme';
import { ExerciseDefinition } from '@/constants/exercises';
import {
  formatSetMetrics,
  getMetricSlots,
  defaultMetricsForExercise,
} from '@/lib/exerciseTracking';
import {
  CompletedWorkout,
  DeletedWorkout,
  CreateManualWorkoutInput,
  useActiveWorkout,
  WorkoutExercise,
  WorkoutSet,
  WorkoutSetType,
} from '@/context/ActiveWorkoutContext';
import {
  formatDurationShort,
  getCompletedSets,
  getWorkoutDateTimestamp,
  getWorkoutDurationSeconds,
  getWorkoutVolume,
} from '@/lib/workoutStats';
import { createUuid } from '@/lib/ids';
import { shareTextFile } from '@/lib/dataTransfer';
import { buildWorkoutHistoryCsv, exportFileStamp } from '@/lib/exportData';
import { filterWorkoutHistory, type HistoryRange } from '@/lib/historyFilters';

type HistoryView = 'timeline' | 'calendar';
type HistorySource = 'all' | 'liftflow' | 'strong';
const SET_TYPE_ORDER: WorkoutSetType[] = ['normal', 'warmup', 'drop', 'failure', 'amrap'];

export default function HistoryScreen() {
  const router = useRouter();
  const { templateId: templateIdParam } = useLocalSearchParams<{ templateId?: string | string[] }>();
  const templateId = Array.isArray(templateIdParam) ? templateIdParam[0] : templateIdParam;
  const {
    workout: activeWorkout,
    exercises,
    templates,
    completedWorkouts,
    deletedWorkouts,
    updateCompletedWorkout,
    deleteCompletedWorkout,
    restoreDeletedWorkout,
    permanentlyDeleteWorkout,
    repeatCompletedWorkout,
    saveCompletedWorkoutAsTemplate,
    createManualWorkout,
    getStateSnapshot,
    preferences,
  } = useActiveWorkout();
  const [view, setView] = useState<HistoryView>('timeline');
  const [query, setQuery] = useState('');
  const [source, setSource] = useState<HistorySource>('all');
  const [range, setRange] = useState<HistoryRange>('all');
  const [exerciseFilterId, setExerciseFilterId] = useState<string | null>(null);
  const [exerciseFilterVisible, setExerciseFilterVisible] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [recentlyDeletedVisible, setRecentlyDeletedVisible] = useState(false);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null);
  const [editingWorkout, setEditingWorkout] = useState<CompletedWorkout | null>(null);
  const [manualWorkoutVisible, setManualWorkoutVisible] = useState(false);
  const templateFilter = templateId ? templates.find((template) => template.id === templateId) : undefined;
  const exerciseFilter = exerciseFilterId
    ? exercises.find((exercise) => exercise.id === exerciseFilterId) ?? null
    : null;

  const selectedWorkout = completedWorkouts.find((item) => item.id === selectedWorkoutId) ?? null;
  const filteredWorkouts = useMemo(() => {
    return filterWorkoutHistory(completedWorkouts, {
      query,
      source,
      range,
      exerciseId: exerciseFilter?.id,
      exerciseName: exerciseFilter?.name,
      templateId,
    });
  }, [completedWorkouts, exerciseFilter?.id, exerciseFilter?.name, query, range, source, templateId]);

  const exportFilteredHistory = async () => {
    if (filteredWorkouts.length === 0 || exporting) return;
    setExporting(true);
    try {
      const snapshot = getStateSnapshot();
      await shareTextFile(
        `LiftFlow-filtered-history-${exportFileStamp()}.csv`,
        buildWorkoutHistoryCsv({ ...snapshot, completedWorkouts: filteredWorkouts }),
        'text/csv',
      );
    } catch (error) {
      Alert.alert('Export failed', error instanceof Error ? error.message : 'LiftFlow could not export these workouts.');
    } finally {
      setExporting(false);
    }
  };

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
    if (template) Alert.alert('Template created', `${template.name} was added to ${template.folder || 'Unfiled Templates'}.`);
  };

  const deleteWorkout = (workout: CompletedWorkout) => {
    Alert.alert(
      'Delete completed workout?',
      `${workout.name} will move to Recently Deleted for 30 days. Exercises and templates will not be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Move to Recently Deleted',
          style: 'destructive',
          onPress: () => {
            deleteCompletedWorkout(workout.id);
            setSelectedWorkoutId(null);
          },
        },
      ],
    );
  };

  const historyHeader = (
    <>
      {templateId ? (
        <View style={styles.templateFilterBar}>
          <View style={styles.flexCopy}>
            <Text style={styles.templateFilterLabel}>Template history</Text>
            <Text style={styles.templateFilterName}>{templateFilter?.name ?? 'Deleted template'}</Text>
          </View>
          <Pressable onPress={() => router.replace('/(tabs)/history')} style={styles.clearFilterButton}>
            <Text style={styles.clearFilterLabel}>Clear</Text>
          </Pressable>
        </View>
      ) : null}
      <PrimaryButton label="Add Past Workout" onPress={() => setManualWorkoutVisible(true)} variant="secondary" />
      <HistoryHeader
      view={view}
      query={query}
      source={source}
      range={range}
      exerciseFilterName={exerciseFilter?.name ?? null}
      deletedCount={deletedWorkouts.length}
      resultCount={filteredWorkouts.length}
      onViewChange={setView}
      onQueryChange={setQuery}
      onSourceChange={setSource}
      onRangeChange={setRange}
      onChooseExercise={() => setExerciseFilterVisible(true)}
      onClearExercise={() => setExerciseFilterId(null)}
      onExport={() => { void exportFilteredHistory(); }}
      exporting={exporting}
      onOpenRecentlyDeleted={() => setRecentlyDeletedVisible(true)}
      />
    </>
  );

  return (
    <>
      {view === 'timeline' ? (
        <FlatList
          data={filteredWorkouts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <WorkoutHistoryCard workout={item} weightUnit={preferences.weightUnit} onPress={() => setSelectedWorkoutId(item.id)} />
          )}
          ListHeaderComponent={historyHeader}
          ListEmptyComponent={
            <HistoryEmptyState
              hasAnyWorkouts={completedWorkouts.length > 0}
              onChooseWorkout={() => router.push('/workouts')}
              onClearFilters={() => {
                setQuery('');
                setSource('all');
                setRange('all');
                setExerciseFilterId(null);
              }}
            />
          }
          ItemSeparatorComponent={() => <View style={styles.listGap} />}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {historyHeader}
          <CalendarSummary workouts={filteredWorkouts} onSelectWorkout={(item) => setSelectedWorkoutId(item.id)} />
        </ScrollView>
      )}

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
        exercises={exercises.filter((exercise) => !exercise.archived)}
        onClose={() => setEditingWorkout(null)}
        onSave={(updated) => {
          updateCompletedWorkout(updated);
          setEditingWorkout(null);
          setSelectedWorkoutId(updated.id);
        }}
      />
      <ManualWorkoutModal
        visible={manualWorkoutVisible}
        exercises={exercises.filter((exercise) => !exercise.archived)}
        onClose={() => setManualWorkoutVisible(false)}
        onSave={(input) => {
          const created = createManualWorkout(input);
          if (!created) return false;
          setManualWorkoutVisible(false);
          setSelectedWorkoutId(created.id);
          return true;
        }}
      />
      <RecentlyDeletedModal
        visible={recentlyDeletedVisible}
        workouts={deletedWorkouts}
        onClose={() => setRecentlyDeletedVisible(false)}
        onRestore={(workoutId) => {
          restoreDeletedWorkout(workoutId);
          if (deletedWorkouts.length <= 1) setRecentlyDeletedVisible(false);
        }}
        onDelete={(workout) => {
          Alert.alert(
            'Delete permanently?',
            `${workout.name} and its recorded sets will be removed permanently. This cannot be undone.`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete Permanently',
                style: 'destructive',
                onPress: () => {
                  permanentlyDeleteWorkout(workout.id);
                  if (deletedWorkouts.length <= 1) setRecentlyDeletedVisible(false);
                },
              },
            ],
          );
        }}
      />
      <HistoryExerciseFilterModal
        visible={exerciseFilterVisible}
        exercises={exercises.filter((exercise) => !exercise.archived)}
        selectedId={exerciseFilterId}
        onClose={() => setExerciseFilterVisible(false)}
        onSelect={(exerciseId) => {
          setExerciseFilterId(exerciseId);
          setExerciseFilterVisible(false);
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

function HistoryHeader({
  view,
  query,
  source,
  range,
  exerciseFilterName,
  deletedCount,
  resultCount,
  onViewChange,
  onQueryChange,
  onSourceChange,
  onRangeChange,
  onChooseExercise,
  onClearExercise,
  onExport,
  exporting,
  onOpenRecentlyDeleted,
}: {
  view: HistoryView;
  query: string;
  source: HistorySource;
  range: HistoryRange;
  exerciseFilterName: string | null;
  deletedCount: number;
  resultCount: number;
  onViewChange: (view: HistoryView) => void;
  onQueryChange: (query: string) => void;
  onSourceChange: (source: HistorySource) => void;
  onRangeChange: (range: HistoryRange) => void;
  onChooseExercise: () => void;
  onClearExercise: () => void;
  onExport: () => void;
  exporting: boolean;
  onOpenRecentlyDeleted: () => void;
}) {
  return (
    <View style={styles.headerStack}>
      <View style={styles.toggle}>
        <ToggleButton label="Timeline" active={view === 'timeline'} onPress={() => onViewChange('timeline')} />
        <ToggleButton label="Calendar" active={view === 'calendar'} onPress={() => onViewChange('calendar')} />
      </View>
      <TextInput
        accessibilityLabel="Search workout history"
        value={query}
        onChangeText={onQueryChange}
        placeholder="Search workouts, exercises, folders, or notes"
        placeholderTextColor={colors.textMuted}
        style={styles.search}
      />
      <View style={styles.sourceRow}>
        {([
          ['all', 'All'],
          ['liftflow', 'LiftFlow'],
          ['strong', 'Strong'],
        ] as const).map(([value, label]) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityState={{ selected: source === value }}
            onPress={() => onSourceChange(value)}
            style={({ pressed }) => [styles.sourceChip, source === value && styles.sourceChipActive, pressed && styles.pressed]}
          >
            <Text style={[styles.sourceChipText, source === value && styles.sourceChipTextActive]}>{label}</Text>
          </Pressable>
        ))}
        <Text style={styles.resultCount}>{resultCount} result{resultCount === 1 ? '' : 's'}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScrollRow}>
        {([
          ['all', 'All time'],
          ['4w', '4 weeks'],
          ['12w', '12 weeks'],
          ['6m', '6 months'],
        ] as const).map(([value, label]) => (
          <Pressable
            key={value}
            onPress={() => onRangeChange(value)}
            style={[styles.sourceChip, range === value && styles.sourceChipActive]}
          >
            <Text style={[styles.sourceChipText, range === value && styles.sourceChipTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.historyActionRow}>
        <PrimaryButton
          label={exerciseFilterName ? `Exercise: ${exerciseFilterName}` : 'Filter by Exercise'}
          onPress={onChooseExercise}
          variant="secondary"
          style={styles.flexButton}
        />
        {exerciseFilterName ? (
          <PrimaryButton label="Clear" onPress={onClearExercise} variant="secondary" />
        ) : null}
      </View>
      <PrimaryButton
        label={exporting ? 'Preparing Export…' : `Export ${resultCount} Result${resultCount === 1 ? '' : 's'}`}
        onPress={onExport}
        variant="secondary"
        disabled={exporting || resultCount === 0}
      />
      {deletedCount > 0 ? (
        <PrimaryButton
          label={`Recently Deleted (${deletedCount})`}
          onPress={onOpenRecentlyDeleted}
          variant="secondary"
        />
      ) : null}
    </View>
  );
}

function HistoryEmptyState({
  hasAnyWorkouts,
  onChooseWorkout,
  onClearFilters,
}: {
  hasAnyWorkouts: boolean;
  onChooseWorkout: () => void;
  onClearFilters: () => void;
}) {
  return (
    <SectionCard title="Workout history">
      <View style={styles.emptyIcon}><Text style={styles.emptyIconText}>◷</Text></View>
      <Text style={styles.emptyTitle}>{hasAnyWorkouts ? 'No matching workouts' : 'No completed workouts yet'}</Text>
      <Text style={styles.emptyCopy}>
        {hasAnyWorkouts
          ? 'Try another search or clear the active source filter.'
          : 'Finish your first workout and LiftFlow will preserve it here.'}
      </Text>
      <PrimaryButton
        label={hasAnyWorkouts ? 'Clear Filters' : 'Choose Workout'}
        onPress={hasAnyWorkouts ? onClearFilters : onChooseWorkout}
      />
    </SectionCard>
  );
}

function RecentlyDeletedModal({
  visible,
  workouts,
  onClose,
  onRestore,
  onDelete,
}: {
  visible: boolean;
  workouts: DeletedWorkout[];
  onClose: () => void;
  onRestore: (workoutId: string) => void;
  onDelete: (workout: DeletedWorkout) => void;
}) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Recently Deleted</Text>
          <Text style={styles.folder}>Workouts are removed automatically 30 days after deletion.</Text>
          <ScrollView style={styles.modalScroll}>
            {workouts.map((workout) => (
              <View key={workout.id} style={styles.deletedRow}>
                <View style={styles.flexCopy}>
                  <Text style={styles.exerciseName}>{workout.name}</Text>
                  <Text style={styles.exerciseNotes}>{formatWorkoutDate(getWorkoutDateTimestamp(workout))}</Text>
                  <Text style={styles.exerciseNotes}>{formatDeletedTime(workout.deletedAt)}</Text>
                </View>
                <View style={styles.deletedActions}>
                  <Pressable onPress={() => onRestore(workout.id)} style={styles.deletedActionButton}>
                    <Text style={styles.deletedActionLabel}>Restore</Text>
                  </Pressable>
                  <Pressable onPress={() => onDelete(workout)} style={[styles.deletedActionButton, styles.deletedDangerButton]}>
                    <Text style={styles.deletedDangerLabel}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </ScrollView>
          <PrimaryButton label="Close" onPress={onClose} variant="secondary" />
        </View>
      </View>
    </Modal>
  );
}

function HistoryExerciseFilterModal({ visible, exercises, selectedId, onClose, onSelect }: {
  visible: boolean;
  exercises: ExerciseDefinition[];
  selectedId: string | null;
  onClose: () => void;
  onSelect: (exerciseId: string | null) => void;
}) {
  const [query, setQuery] = useState('');
  const normalized = query.trim().toLowerCase();
  const filtered = exercises.filter((exercise) =>
    !normalized || exercise.name.toLowerCase().includes(normalized) || exercise.detail.toLowerCase().includes(normalized),
  );
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Filter by Exercise</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search exercises"
            placeholderTextColor={colors.textMuted}
            style={styles.search}
          />
          <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
            <Pressable onPress={() => onSelect(null)} style={styles.calendarWorkoutRow}>
              <Text style={styles.exerciseName}>All exercises</Text>
              <Text style={selectedId === null ? styles.clearFilterLabel : styles.chevron}>{selectedId === null ? '✓' : '›'}</Text>
            </Pressable>
            {filtered.map((exercise) => (
              <Pressable key={exercise.id} onPress={() => onSelect(exercise.id)} style={styles.calendarWorkoutRow}>
                <View style={styles.flexCopy}>
                  <Text style={styles.exerciseName}>{exercise.name}</Text>
                  <Text style={styles.exerciseNotes}>{exercise.detail}</Text>
                </View>
                <Text style={selectedId === exercise.id ? styles.clearFilterLabel : styles.chevron}>{selectedId === exercise.id ? '✓' : '›'}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <PrimaryButton label="Cancel" onPress={onClose} variant="secondary" />
        </View>
      </View>
    </Modal>
  );
}

function WorkoutHistoryCard({ workout, weightUnit, onPress }: { workout: CompletedWorkout; weightUnit: 'lb' | 'kg'; onPress: () => void }) {
  return (
    <SectionCard title={formatWorkoutDate(getWorkoutDateTimestamp(workout))}>
      <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
        <View style={styles.rowBetween}>
          <View style={styles.flexCopy}>
            <View style={styles.workoutTitleRow}>
              <Text style={styles.workoutName}>{workout.name}</Text>
              {workout.importSource === 'strong' ? <Text style={styles.strongBadge}>STRONG</Text> : null}
            </View>
            {workout.sourceFolder ? <Text style={styles.folder}>{workout.sourceFolder}</Text> : null}
          </View>
          <Text style={styles.chevron}>›</Text>
        </View>
        <View style={styles.summaryRow}>
          <Summary value={workout.durationUnknown ? 'Unknown' : formatDurationShort(getWorkoutDurationSeconds(workout))} label="Duration" />
          <Summary value={String(getCompletedSets(workout).length)} label="Completed sets" />
          <Summary value={`${Math.round(getWorkoutVolume(workout)).toLocaleString()} ${weightUnit}`} label="Volume" />
        </View>
        {workout.notes ? <Text style={styles.notes}>“{workout.notes}”</Text> : null}
      </Pressable>
    </SectionCard>
  );
}

function CalendarSummary({ workouts, onSelectWorkout }: { workouts: CompletedWorkout[]; onSelectWorkout: (workout: CompletedWorkout) => void }) {
  const [monthDate, setMonthDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const days = useMemo(() => buildCalendarDays(year, month), [month, year]);
  const workoutsByDate = useMemo(() => {
    const map = new Map<string, CompletedWorkout[]>();
    workouts.forEach((workout) => {
      const date = new Date(getWorkoutDateTimestamp(workout));
      if (date.getFullYear() !== year || date.getMonth() !== month) return;
      map.set(dateKey(date), [...(map.get(dateKey(date)) ?? []), workout]);
    });
    return map;
  }, [month, workouts, year]);
  const selectedDayWorkouts = selectedDayKey ? workoutsByDate.get(selectedDayKey) ?? [] : [];

  const moveMonth = (delta: number) => {
    setMonthDate((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
    setSelectedDayKey(null);
  };

  return (
    <SectionCard
      title={new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(monthDate)}
      headerRight={
        <View style={styles.monthActions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => moveMonth(-1)} style={styles.monthButton}>
            <Text style={styles.monthButtonLabel}>‹</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => moveMonth(1)} style={styles.monthButton}>
            <Text style={styles.monthButtonLabel}>›</Text>
          </Pressable>
        </View>
      }
    >
      <View style={styles.calendarHeader}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => <Text key={`${day}-${index}`} style={styles.calendarHeaderText}>{day}</Text>)}
      </View>
      <View style={styles.calendarGrid}>
        {days.map((date) => {
          const dayWorkouts = workoutsByDate.get(dateKey(date)) ?? [];
          const inMonth = date.getMonth() === month;
          return (
            <Pressable
              key={date.toISOString()}
              onPress={() => dayWorkouts.length > 0 && setSelectedDayKey(dateKey(date))}
              style={({ pressed }) => [
                styles.calendarDay,
                dayWorkouts.length > 0 && styles.calendarDayActive,
                selectedDayKey === dateKey(date) && styles.calendarDaySelected,
                pressed && dayWorkouts.length > 0 && styles.pressed,
              ]}
            >
              <Text style={[styles.calendarDayText, !inMonth && styles.calendarDayMuted]}>{date.getDate()}</Text>
              {dayWorkouts.length > 0 ? <Text style={styles.calendarCount}>{dayWorkouts.length}</Text> : null}
            </Pressable>
          );
        })}
      </View>
      {selectedDayWorkouts.length > 0 ? (
        <View style={styles.calendarWorkoutList}>
          <Text style={styles.calendarHint}>{selectedDayWorkouts.length} workout{selectedDayWorkouts.length === 1 ? '' : 's'} on this day</Text>
          {selectedDayWorkouts.map((workout) => (
            <Pressable key={workout.id} onPress={() => onSelectWorkout(workout)} style={({ pressed }) => [styles.calendarWorkoutRow, pressed && styles.pressed]}>
              <View style={styles.flexCopy}>
                <Text style={styles.exerciseName}>{workout.name}</Text>
                <Text style={styles.exerciseNotes}>{getCompletedSets(workout).length} completed sets</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Text style={styles.calendarHint}>Tap a highlighted day to view every workout recorded that day.</Text>
      )}
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
              <View style={styles.workoutTitleRow}>
                <Text style={styles.modalTitle}>{workout.name}</Text>
                {workout.importSource === 'strong' ? <Text style={styles.strongBadge}>IMPORTED FROM STRONG</Text> : null}
              </View>
              <Text style={styles.folder}>{formatWorkoutDate(getWorkoutDateTimestamp(workout))}</Text>
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

function ManualWorkoutModal({ visible, exercises, onClose, onSave }: { visible: boolean; exercises: ExerciseDefinition[]; onClose: () => void; onSave: (input: CreateManualWorkoutInput) => boolean }) {
  const [name, setName] = useState('Workout');
  const [dateText, setDateText] = useState('');
  const [timeText, setTimeText] = useState('');
  const [durationText, setDurationText] = useState('60');
  const [notes, setNotes] = useState('');
  const [draftExercises, setDraftExercises] = useState<WorkoutExercise[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    const now = new Date(Date.now() - 60 * 60 * 1000);
    setName('Workout');
    setDateText(formatInputDate(now));
    setTimeText(formatInputTime(now));
    setDurationText('60');
    setNotes('');
    setDraftExercises([]);
    setPickerOpen(false);
    setError('');
  };

  const addExercise = (definition: ExerciseDefinition) => {
    if (draftExercises.some((exercise) => exercise.exerciseDefinitionId === definition.id)) return;
    const exercise: WorkoutExercise = {
      id: createUuid(),
      exerciseDefinitionId: definition.id,
      name: definition.name,
      exerciseType: definition.exerciseType,
      restSeconds: definition.defaultRestSeconds,
      notes: '',
      sets: Array.from({ length: 3 }, () => ({
        id: createUuid(),
        ...defaultMetricsForExercise(definition),
        setType: 'normal' as const,
        completed: true,
      })),
    };
    setDraftExercises((current) => [...current, exercise]);
    setPickerOpen(false);
  };

  const updateSet = (exerciseId: string, setId: string, patch: Partial<WorkoutSet>) => {
    setDraftExercises((current) => current.map((exercise) => exercise.id !== exerciseId ? exercise : {
      ...exercise,
      sets: exercise.sets.map((set) => set.id === setId ? { ...set, ...patch } : set),
    }));
  };

  const submit = () => {
    const startedAt = parseLocalDateTime(dateText, timeText);
    const durationMinutes = Number.parseInt(durationText, 10);
    if (!startedAt) return setError('Enter a valid local date and time using YYYY-MM-DD and HH:MM.');
    if (!Number.isFinite(durationMinutes) || durationMinutes < 1 || durationMinutes > 1440) return setError('Duration must be between 1 and 1,440 minutes.');
    if (!name.trim()) return setError('Enter a workout name.');
    if (draftExercises.length === 0) return setError('Add at least one exercise.');
    const completedAt = startedAt + durationMinutes * 60 * 1000;
    if (completedAt > Date.now() + 5 * 60 * 1000) return setError('A past workout cannot finish in the future.');
    const saved = onSave({
      name,
      notes,
      startedAt,
      completedAt,
      exercises: draftExercises,
    });
    if (!saved) setError('The workout could not be saved. Check the entered details.');
  };

  return (
    <KeyboardAwareModal visible={visible} onClose={onClose} onShow={reset} cardStyle={styles.manualModalCard}>
      <Text style={styles.modalTitle}>Add Past Workout</Text>
      <Text style={styles.modalBody}>Record a workout you completed earlier. It will appear in History and recalculate progress automatically.</Text>
      <Text style={styles.fieldLabel}>Workout name</Text>
      <TextInput value={name} onChangeText={setName} placeholder="Upper A" placeholderTextColor={colors.textMuted} style={styles.textInput} />
      <View style={styles.manualDateRow}>
        <View style={styles.manualDateField}>
          <Text style={styles.fieldLabel}>Date</Text>
          <TextInput value={dateText} onChangeText={setDateText} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} autoCapitalize="none" style={styles.textInput} />
        </View>
        <View style={styles.manualTimeField}>
          <Text style={styles.fieldLabel}>Start</Text>
          <TextInput value={timeText} onChangeText={setTimeText} placeholder="HH:MM" placeholderTextColor={colors.textMuted} autoCapitalize="none" style={styles.textInput} />
        </View>
      </View>
      <Text style={styles.fieldLabel}>Duration (minutes)</Text>
      <TextInput value={durationText} onChangeText={setDurationText} keyboardType="number-pad" inputAccessoryViewID={NUMERIC_KEYBOARD_ACCESSORY_ID} style={styles.textInput} />
      <Text style={styles.fieldLabel}>Workout notes</Text>
      <TextInput value={notes} onChangeText={setNotes} multiline placeholder="Optional notes" placeholderTextColor={colors.textMuted} style={[styles.textInput, styles.multilineInput]} />

      {draftExercises.map((exercise) => (
        <View key={exercise.id} style={styles.editExerciseCard}>
          <View style={styles.rowBetween}>
            <View style={styles.flexCopy}>
              <Text style={styles.exerciseName}>{exercise.name}</Text>
              <Text style={styles.exerciseNotes}>{exercise.exerciseType}</Text>
            </View>
            <Pressable onPress={() => setDraftExercises((current) => current.filter((item) => item.id !== exercise.id))} style={styles.deletedActionButton}>
              <Text style={styles.deletedDangerLabel}>Remove</Text>
            </Pressable>
          </View>
          <TextInput value={exercise.notes ?? ''} onChangeText={(exerciseNotes) => setDraftExercises((current) => current.map((item) => item.id === exercise.id ? { ...item, notes: exerciseNotes } : item))} placeholder="Exercise notes" placeholderTextColor={colors.textMuted} style={styles.textInput} />
          {exercise.sets.map((set, setIndex) => (
            <View key={set.id} style={styles.editSetCard}>
              <View style={styles.rowBetween}>
                <Pressable onPress={() => updateSet(exercise.id, set.id, { setType: nextSetType(set.setType) })} style={styles.typePill}>
                  <Text style={styles.typePillText}>{setTypeName(set.setType)} · {setIndex + 1}</Text>
                </Pressable>
                <Pressable disabled={exercise.sets.length <= 1} onPress={() => setDraftExercises((current) => current.map((item) => item.id !== exercise.id ? item : { ...item, sets: item.sets.filter((candidate) => candidate.id !== set.id) }))} style={[styles.deletedActionButton, exercise.sets.length <= 1 && styles.disabledControl]}>
                  <Text style={styles.deletedDangerLabel}>Delete Set</Text>
                </Pressable>
              </View>
              {getMetricSlots(exercise.exerciseType).map((slot) => slot ? (
                <NumericEditor key={`${set.id}-${slot.field}`} label={slot.label} value={set[slot.field]} integer={!slot.decimal} onChange={(value) => updateSet(exercise.id, set.id, { [slot.field]: value })} />
              ) : null)}
              <EffortEditor set={set} onChange={(effort) => updateSet(exercise.id, set.id, effort)} />
            </View>
          ))}
          <PrimaryButton label="+ Add Set" onPress={() => setDraftExercises((current) => current.map((item) => item.id !== exercise.id ? item : { ...item, sets: [...item.sets, { ...(item.sets.at(-1) ?? {}), id: createUuid(), completed: true }] }))} variant="secondary" />
        </View>
      ))}

      <PrimaryButton label={pickerOpen ? 'Close Exercise Picker' : '+ Add Exercise'} onPress={() => setPickerOpen((current) => !current)} variant="secondary" />
      {pickerOpen ? (
        <View style={styles.manualPicker}>
          {exercises.map((exercise) => {
            const selected = draftExercises.some((item) => item.exerciseDefinitionId === exercise.id);
            return (
              <Pressable key={exercise.id} disabled={selected} onPress={() => addExercise(exercise)} style={[styles.calendarWorkoutRow, selected && styles.disabledControl]}>
                <View style={styles.flexCopy}>
                  <Text style={styles.exerciseName}>{exercise.name}</Text>
                  <Text style={styles.exerciseNotes}>{exercise.detail}</Text>
                </View>
                <Text style={styles.clearFilterLabel}>{selected ? 'Added' : 'Add'}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {error ? <Text style={styles.manualError}>{error}</Text> : null}
      <PrimaryButton label="Save Past Workout" onPress={submit} />
      <PrimaryButton label="Cancel" onPress={onClose} variant="secondary" />
    </KeyboardAwareModal>
  );
}

function WorkoutEditorModal({ workout, exercises, onClose, onSave }: {
  workout: CompletedWorkout | null;
  exercises: ExerciseDefinition[];
  onClose: () => void;
  onSave: (workout: CompletedWorkout) => void;
}) {
  const [draft, setDraft] = useState<CompletedWorkout | null>(null);
  const [dateText, setDateText] = useState('');
  const [timeText, setTimeText] = useState('');
  const [durationText, setDurationText] = useState('60');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!workout) {
      setDraft(null);
      return;
    }
    const copy = cloneWorkout(workout);
    const start = new Date(copy.startedAt);
    setDraft(copy);
    setDateText(formatInputDate(start));
    setTimeText(formatInputTime(start));
    setDurationText(String(Math.max(1, Math.round((copy.completedAt - copy.startedAt) / 60000))));
    setPickerOpen(false);
    setError('');
  }, [workout]);
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

  const addExercise = (definition: ExerciseDefinition) => {
    if (draft.exercises.some((exercise) =>
      exercise.exerciseDefinitionId === definition.id || exercise.name === definition.name,
    )) return;
    setDraft({
      ...draft,
      exercises: [...draft.exercises, {
        id: createUuid(),
        exerciseDefinitionId: definition.id,
        name: definition.name,
        exerciseType: definition.exerciseType,
        restSeconds: definition.defaultRestSeconds,
        notes: '',
        sets: Array.from({ length: 3 }, () => ({
          id: createUuid(),
          ...defaultMetricsForExercise(definition),
          setType: 'normal' as const,
          completed: true,
        })),
      }],
    });
  };

  const moveExercise = (exerciseIndex: number, delta: number) => {
    const target = exerciseIndex + delta;
    if (target < 0 || target >= draft.exercises.length) return;
    const next = [...draft.exercises];
    [next[exerciseIndex], next[target]] = [next[target], next[exerciseIndex]];
    setDraft({ ...draft, exercises: next });
  };

  const save = () => {
    const startedAt = parseLocalDateTime(dateText, timeText);
    const durationMinutes = Number.parseInt(durationText, 10);
    if (!startedAt) return setError('Enter a valid date and time using YYYY-MM-DD and HH:MM.');
    if (!Number.isFinite(durationMinutes) || durationMinutes < 1 || durationMinutes > 1440) {
      return setError('Duration must be between 1 and 1,440 minutes.');
    }
    if (startedAt + durationMinutes * 60 * 1000 > Date.now() + 5 * 60 * 1000) {
      return setError('A completed workout cannot finish in the future.');
    }
    if (!draft.name.trim()) return setError('Enter a workout name.');
    if (draft.exercises.length === 0) return setError('Keep at least one exercise in the workout.');
    onSave({
      ...draft,
      name: draft.name.trim(),
      startedAt,
      completedAt: startedAt + durationMinutes * 60 * 1000,
      durationUnknown: undefined,
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
            <View style={styles.manualDateRow}>
              <View style={styles.manualDateField}>
                <Text style={styles.fieldLabel}>Date</Text>
                <TextInput value={dateText} onChangeText={setDateText} autoCapitalize="none" style={styles.textInput} />
              </View>
              <View style={styles.manualTimeField}>
                <Text style={styles.fieldLabel}>Start</Text>
                <TextInput value={timeText} onChangeText={setTimeText} autoCapitalize="none" style={styles.textInput} />
              </View>
            </View>
            <Text style={styles.fieldLabel}>Duration (minutes)</Text>
            <TextInput value={durationText} onChangeText={setDurationText} keyboardType="number-pad" inputAccessoryViewID={NUMERIC_KEYBOARD_ACCESSORY_ID} style={styles.textInput} />
            <Text style={styles.fieldLabel}>Workout notes</Text>
            <TextInput value={draft.notes ?? ''} onChangeText={(notes) => setDraft({ ...draft, notes })} multiline style={[styles.textInput, styles.multilineInput]} />

            {draft.exercises.map((exercise, exerciseIndex) => (
              <View key={exercise.id} style={styles.editExerciseCard}>
                <View style={styles.rowBetween}>
                  <View style={styles.flexCopy}>
                    <Text style={styles.exerciseName}>{exercise.name}</Text>
                    <Text style={styles.exerciseNotes}>{exercise.exerciseType}</Text>
                  </View>
                  <View style={styles.deletedActions}>
                    <Pressable disabled={exerciseIndex === 0} onPress={() => moveExercise(exerciseIndex, -1)} style={[styles.deletedActionButton, exerciseIndex === 0 && styles.disabledControl]}>
                      <Text style={styles.deletedActionLabel}>↑</Text>
                    </Pressable>
                    <Pressable disabled={exerciseIndex === draft.exercises.length - 1} onPress={() => moveExercise(exerciseIndex, 1)} style={[styles.deletedActionButton, exerciseIndex === draft.exercises.length - 1 && styles.disabledControl]}>
                      <Text style={styles.deletedActionLabel}>↓</Text>
                    </Pressable>
                    <Pressable disabled={draft.exercises.length <= 1} onPress={() => setDraft({ ...draft, exercises: draft.exercises.filter((_, index) => index !== exerciseIndex) })} style={[styles.deletedActionButton, draft.exercises.length <= 1 && styles.disabledControl]}>
                      <Text style={styles.deletedDangerLabel}>Remove</Text>
                    </Pressable>
                  </View>
                </View>
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
                    <Pressable
                      disabled={exercise.sets.length <= 1}
                      onPress={() => setDraft({
                        ...draft,
                        exercises: draft.exercises.map((item, index) => index === exerciseIndex
                          ? { ...item, sets: item.sets.filter((_, index) => index !== setIndex) }
                          : item),
                      })}
                      style={[styles.deletedActionButton, exercise.sets.length <= 1 && styles.disabledControl]}
                    >
                      <Text style={styles.deletedDangerLabel}>Delete Set</Text>
                    </Pressable>
                  </View>
                ))}
                <PrimaryButton
                  label="+ Add Set"
                  onPress={() => {
                    const last = exercise.sets.at(-1);
                    setDraft({
                      ...draft,
                      exercises: draft.exercises.map((item, index) => index === exerciseIndex
                        ? { ...item, sets: [...item.sets, { ...(last ?? {}), id: createUuid(), completed: true }] }
                        : item),
                    });
                  }}
                  variant="secondary"
                />
              </View>
            ))}
            <PrimaryButton label={pickerOpen ? 'Close Exercise Picker' : '+ Add Exercise'} onPress={() => setPickerOpen((current) => !current)} variant="secondary" />
            {pickerOpen ? (
              <View style={styles.manualPicker}>
                {exercises.map((definition) => {
                  const selected = draft.exercises.some((exercise) =>
                    exercise.exerciseDefinitionId === definition.id || exercise.name === definition.name,
                  );
                  return (
                    <Pressable key={definition.id} disabled={selected} onPress={() => addExercise(definition)} style={[styles.calendarWorkoutRow, selected && styles.disabledControl]}>
                      <View style={styles.flexCopy}>
                        <Text style={styles.exerciseName}>{definition.name}</Text>
                        <Text style={styles.exerciseNotes}>{definition.detail}</Text>
                      </View>
                      <Text style={styles.clearFilterLabel}>{selected ? 'Added' : 'Add'}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
            {error ? <Text style={styles.manualError}>{error}</Text> : null}
          </ScrollView>
          <PrimaryButton label="Save Changes" onPress={save} />
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

function formatInputDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatInputTime(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function parseLocalDateTime(dateText: string, timeText: string) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateText.trim());
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeText.trim());
  if (!dateMatch || !timeMatch) return null;
  const [, yearText, monthText, dayText] = dateMatch;
  const [, hourText, minuteText] = timeMatch;
  const year = Number(yearText);
  const month = Number(monthText) - 1;
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const date = new Date(year, month, day, hour, minute, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day || date.getHours() !== hour || date.getMinutes() !== minute) return null;
  return date.getTime();
}

function formatWorkoutDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(timestamp));
}

function formatDeletedTime(timestamp: number) {
  const days = Math.max(0, Math.floor((Date.now() - timestamp) / (24 * 60 * 60 * 1000)));
  if (days === 0) return 'Deleted today';
  if (days === 1) return 'Deleted yesterday';
  return `Deleted ${days} days ago`;
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
  content: { padding: spacing.md, paddingBottom: 150 },
  headerStack: { gap: spacing.sm, marginBottom: spacing.md },
  listGap: { height: spacing.md },
  search: { minHeight: 48, color: colors.text, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, fontSize: 15 },
  sourceRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs },
  filterScrollRow: { gap: spacing.xs, paddingRight: spacing.md },
  historyActionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sourceChip: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 13, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  sourceChipActive: { borderColor: colors.primary, backgroundColor: colors.surfaceElevated },
  sourceChipText: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  sourceChipTextActive: { color: colors.primary, fontWeight: '900' },
  resultCount: { marginLeft: 'auto', color: colors.textMuted, fontSize: 12, fontWeight: '700' },
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
  templateFilterBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderColor: colors.primary, borderRadius: radius.md, backgroundColor: colors.surfaceElevated, marginBottom: spacing.sm },
  templateFilterLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  templateFilterName: { color: colors.text, fontSize: 16, fontWeight: '900', marginTop: 2 },
  clearFilterButton: { minHeight: 38, justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.primary },
  clearFilterLabel: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  workoutTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs },
  strongBadge: { color: colors.primary, backgroundColor: colors.surfaceElevated, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 4, fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
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
  calendarDaySelected: { borderWidth: 2, borderColor: colors.primary },
  calendarDayText: { color: colors.text, fontWeight: '700' },
  calendarDayMuted: { color: colors.textMuted, opacity: 0.4 },
  calendarCount: { color: colors.primary, fontSize: 10, fontWeight: '900' },
  calendarHint: { color: colors.textMuted, fontSize: 12, marginTop: spacing.sm },
  monthActions: { flexDirection: 'row', gap: spacing.xs },
  monthButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border },
  monthButtonLabel: { color: colors.primary, fontSize: 23, fontWeight: '900', lineHeight: 25 },
  calendarWorkoutList: { marginTop: spacing.sm, gap: spacing.xs },
  calendarWorkoutRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingVertical: spacing.xs },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.76)', alignItems: 'center', justifyContent: 'center', padding: spacing.md },
  modalCard: { width: '100%', maxWidth: 580, maxHeight: '90%', backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  editorCard: { width: '100%', maxWidth: 620, maxHeight: '94%', backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  modalTitle: { color: colors.text, fontSize: 24, fontWeight: '900' },
  modalBody: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  manualModalCard: { maxWidth: 680 },
  manualDateRow: { flexDirection: 'row', gap: spacing.sm },
  manualDateField: { flex: 2 },
  manualTimeField: { flex: 1 },
  manualPicker: { maxHeight: 340, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.sm },
  manualError: { color: colors.danger, fontSize: 13, fontWeight: '800' },
  disabledControl: { opacity: 0.35 },
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
  deletedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  deletedActions: { gap: spacing.xs },
  deletedActionButton: { minWidth: 72, minHeight: 34, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border },
  deletedDangerButton: { borderColor: colors.danger },
  deletedActionLabel: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  deletedDangerLabel: { color: colors.danger, fontSize: 12, fontWeight: '900' },
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
