import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ExerciseProgressChart } from '@/components/ExerciseProgressChart';
import { SectionCard } from '@/components/SectionCard';
import type { ExerciseDefinition } from '@/constants/exercises';
import { colors, radius, spacing } from '@/constants/theme';
import { useActiveWorkout } from '@/context/ActiveWorkoutContext';
import {
  buildMuscleBreakdown,
  buildProgressSummary,
  buildRecentPrs,
  buildWeeklyProgress,
  filterWorkoutsForRange,
  formatProgressDate,
  formatProgressDuration,
  formatProgressVolume,
  getExercisesWithProgress,
  PROGRESS_RANGE_OPTIONS,
  type ProgressRangeKey,
} from '@/lib/progressAnalytics';

export default function ProgressScreen() {
  const { completedWorkouts, exercises, preferences } = useActiveWorkout();
  const [range, setRange] = useState<ProgressRangeKey>('12w');
  const [exercisePickerVisible, setExercisePickerVisible] = useState(false);

  const exercisesWithProgress = useMemo(
    () => getExercisesWithProgress(exercises, completedWorkouts),
    [completedWorkouts, exercises],
  );
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const selectedExercise =
    exercisesWithProgress.find((exercise) => exercise.id === selectedExerciseId) ??
    exercisesWithProgress[0] ??
    null;
  useEffect(() => {
    if (!selectedExerciseId && exercisesWithProgress[0]) {
      setSelectedExerciseId(exercisesWithProgress[0].id);
    }
  }, [exercisesWithProgress, selectedExerciseId]);

  const summary = useMemo(
    () => buildProgressSummary(completedWorkouts, exercises, range),
    [completedWorkouts, exercises, range],
  );
  const weeklyProgress = useMemo(
    () => buildWeeklyProgress(completedWorkouts, range),
    [completedWorkouts, range],
  );
  const muscleBreakdown = useMemo(
    () => buildMuscleBreakdown(completedWorkouts, exercises, range),
    [completedWorkouts, exercises, range],
  );
  const recentPrs = useMemo(
    () => buildRecentPrs(exercises, completedWorkouts, range).slice(0, 8),
    [completedWorkouts, exercises, range],
  );
  const currentWeek = weeklyProgress[weeklyProgress.length - 1];
  const rangedWorkouts = useMemo(
    () => filterWorkoutsForRange(completedWorkouts, range),
    [completedWorkouts, range],
  );
  const rangeLabel =
    PROGRESS_RANGE_OPTIONS.find((option) => option.key === range)?.label ?? '12W';

  return (
    <>
      <ScrollView contentContainerStyle={styles.content}>
        <View>
          <Text style={styles.eyebrow}>TRAINING ANALYTICS</Text>
          <Text style={styles.hero}>Progress</Text>
          <Text style={styles.subhead}>Calculated locally from your completed workouts.</Text>
        </View>

        <View style={styles.rangeRow}>
          {PROGRESS_RANGE_OPTIONS.map((option) => (
            <RangeChip
              key={option.key}
              label={option.label}
              selected={range === option.key}
              onPress={() => setRange(option.key)}
            />
          ))}
        </View>

        <SectionCard title={`${rangeLabel} overview`}>
          <View style={styles.statsGrid}>
            <ProgressStat value={String(summary.workoutCount)} label="Workouts" />
            <ProgressStat value={String(summary.workingSetCount)} label="Working sets" />
            <ProgressStat
              value={formatProgressDuration(summary.trainingSeconds)}
              label="Training time"
            />
            <ProgressStat value={formatProgressVolume(summary.totalVolume)} label="Volume" />
            <ProgressStat value={String(summary.prCount)} label="New records" />
            <ProgressStat
              value={
                summary.workoutCount > 0
                  ? String(Math.round(summary.workingSetCount / summary.workoutCount))
                  : '0'
              }
              label="Sets / workout"
            />
          </View>
        </SectionCard>

        <SectionCard title="Weekly activity">
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.cardValue}>{currentWeek?.workoutCount ?? 0} workouts</Text>
              <Text style={styles.muted}>Current week</Text>
            </View>
            <View style={styles.goalBadge}>
              <Text style={styles.goalText}>Goal: {preferences.weeklyWorkoutGoal}</Text>
            </View>
          </View>
          <Text style={styles.bodyText}>
            {(currentWeek?.workoutCount ?? 0) >= preferences.weeklyWorkoutGoal
              ? 'Weekly goal complete. Nice work.'
              : `${Math.max(0, preferences.weeklyWorkoutGoal - (currentWeek?.workoutCount ?? 0))} workout${
                  preferences.weeklyWorkoutGoal - (currentWeek?.workoutCount ?? 0) === 1 ? '' : 's'
                } remaining this week.`}
          </Text>
          <BarChart
            items={weeklyProgress}
            getValue={(item) => item.workoutCount}
            getLabel={(item) => item.label}
            formatValue={(value) => String(Math.round(value))}
            emptyText="Finish a workout to start your weekly activity chart."
          />
        </SectionCard>

        <SectionCard title="Weekly volume">
          <BarChart
            items={weeklyProgress}
            getValue={(item) => item.volume}
            getLabel={(item) => item.label}
            formatValue={(value) => compactNumber(value)}
            emptyText="Weight-based working sets will build your weekly volume chart."
          />
          {summary.totalVolume > 0 ? (
            <Text style={styles.chartFootnote}>
              Warm-up sets and non-weight exercises are excluded from volume.
            </Text>
          ) : null}
        </SectionCard>

        <SectionCard title="Muscle groups">
          {muscleBreakdown.length > 0 ? (
            muscleBreakdown.slice(0, 8).map((item) => (
              <View key={item.muscle} style={styles.muscleRow}>
                <View style={styles.rowBetween}>
                  <Text style={styles.muscleName}>{item.muscle}</Text>
                  <Text style={styles.muscleValue}>
                    {item.workingSetCount} sets · {Math.round(item.percentage)}%
                  </Text>
                </View>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${Math.max(3, item.percentage)}%` },
                    ]}
                  />
                </View>
              </View>
            ))
          ) : (
            <EmptyState
              title="No muscle data yet"
              body="Complete working sets and LiftFlow will group them by each exercise’s primary muscle."
            />
          )}
        </SectionCard>

        <SectionCard
          title="Exercise progress"
          headerRight={
            exercisesWithProgress.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setExercisePickerVisible(true)}
                style={({ pressed }) => [styles.selectorButton, pressed && styles.pressed]}
              >
                <Text numberOfLines={1} style={styles.selectorText}>
                  {selectedExercise?.name ?? 'Choose'}⌄
                </Text>
              </Pressable>
            ) : null
          }
        >
          {selectedExercise ? (
            <>
              <Text style={styles.exerciseDetail}>{selectedExercise.detail}</Text>
              <ExerciseProgressChart
                exercise={selectedExercise}
                completedWorkouts={completedWorkouts}
                range={range}
              />
            </>
          ) : (
            <EmptyState
              title="No exercise history yet"
              body="Complete a working set and its exercise trend will appear here."
            />
          )}
        </SectionCard>

        <SectionCard title="Recent records">
          {recentPrs.length > 0 ? (
            recentPrs.map((record, index) => (
              <View key={record.id}>
                {index > 0 ? <View style={styles.divider} /> : null}
                <View style={styles.recordRow}>
                  <View style={styles.recordCopy}>
                    <Text style={styles.recordExercise}>{record.exerciseName}</Text>
                    <Text style={styles.recordLabel}>
                      {record.label} · {record.workoutName}
                    </Text>
                  </View>
                  <View style={styles.recordRight}>
                    <Text style={styles.recordValue}>{record.displayValue}</Text>
                    <Text style={styles.recordDate}>{formatProgressDate(record.achievedAt)}</Text>
                  </View>
                </View>
              </View>
            ))
          ) : (
            <EmptyState
              title="No records in this range"
              body="A completed working set creates a PR when it beats your previous best for that metric."
            />
          )}
        </SectionCard>

        {rangedWorkouts.length === 0 ? (
          <Text style={styles.rangeEmptyNote}>
            Try a wider date range to include older workouts.
          </Text>
        ) : null}
      </ScrollView>

      <ExercisePickerModal
        visible={exercisePickerVisible}
        exercises={exercisesWithProgress}
        selectedExerciseId={selectedExercise?.id ?? null}
        onSelect={(exercise) => {
          setSelectedExerciseId(exercise.id);
          setExercisePickerVisible(false);
        }}
        onClose={() => setExercisePickerVisible(false)}
      />
    </>
  );
}

function RangeChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.rangeChip,
        selected && styles.rangeChipSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.rangeChipText, selected && styles.rangeChipTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

function ProgressStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.statValue}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function BarChart<T>({
  items,
  getValue,
  getLabel,
  formatValue,
  emptyText,
  lowerIsBetter = false,
}: {
  items: T[];
  getValue: (item: T) => number;
  getLabel: (item: T) => string;
  formatValue: (value: number, index: number) => string;
  emptyText: string;
  lowerIsBetter?: boolean;
}) {
  const values = items.map(getValue).filter((value) => Number.isFinite(value));
  const hasData =
    items.length > 0 &&
    values.length > 0 &&
    (lowerIsBetter || values.some((value) => value > 0));
  if (!hasData) {
    return <Text style={styles.bodyText}>{emptyText}</Text>;
  }

  const max = Math.max(...values);
  const min = Math.min(...values);
  const spread = max - min;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chartContent}
    >
      {items.map((item, index) => {
        const value = getValue(item);
        const normalized = lowerIsBetter && spread > 0
          ? (max - value) / spread
          : max > 0
            ? value / max
            : 0;
        const height = value > 0 ? Math.max(10, Math.round(normalized * 92)) : 4;

        return (
          <View key={`${getLabel(item)}-${index}`} style={styles.chartColumn}>
            <Text numberOfLines={1} style={styles.chartValue}>
              {formatValue(value, index)}
            </Text>
            <View style={styles.chartBarSlot}>
              <View style={[styles.chartBar, { height }]} />
            </View>
            <Text numberOfLines={1} style={styles.chartLabel}>
              {getLabel(item)}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.bodyText}>{body}</Text>
    </View>
  );
}

function ExercisePickerModal({
  visible,
  exercises,
  selectedExerciseId,
  onSelect,
  onClose,
}: {
  visible: boolean;
  exercises: ExerciseDefinition[];
  selectedExerciseId: string | null;
  onSelect: (exercise: ExerciseDefinition) => void;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <Pressable style={styles.modalDismissLayer} onPress={onClose} />
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Choose Exercise</Text>
              <Text style={styles.modalSubtitle}>Only exercises with recorded working sets appear.</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalList}>
            {exercises.map((exercise) => {
              const selected = exercise.id === selectedExerciseId;
              return (
                <Pressable
                  key={exercise.id}
                  accessibilityRole="button"
                  onPress={() => onSelect(exercise)}
                  style={({ pressed }) => [
                    styles.exerciseOption,
                    selected && styles.exerciseOptionSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.exerciseOptionCopy}>
                    <Text style={styles.exerciseOptionName}>{exercise.name}</Text>
                    <Text style={styles.exerciseOptionDetail}>{exercise.detail}</Text>
                  </View>
                  <Text style={selected ? styles.checkSelected : styles.checkMuted}>
                    {selected ? '✓' : '›'}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function compactNumber(value: number): string {
  if (value >= 1_000_000) return `${trim(value / 1_000_000)}M`;
  if (value >= 1_000) return `${trim(value / 1_000)}K`;
  return String(Math.round(value));
}

function trim(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '');
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    paddingBottom: 150,
    gap: spacing.md,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  hero: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '900',
    marginTop: 4,
  },
  subhead: {
    color: colors.textMuted,
    fontSize: 15,
    marginTop: 4,
  },
  rangeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rangeChip: {
    minHeight: 38,
    minWidth: 54,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rangeChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  rangeChipText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '900',
  },
  rangeChipTextSelected: {
    color: colors.background,
  },
  pressed: {
    opacity: 0.75,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.lg,
  },
  stat: {
    width: '50%',
    paddingRight: spacing.sm,
  },
  statValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 3,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardValue: {
    color: colors.text,
    fontSize: 21,
    fontWeight: '900',
  },
  muted: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  goalBadge: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  goalText: {
    color: colors.primary,
    fontWeight: '800',
  },
  bodyText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  chartContent: {
    minWidth: '100%',
    alignItems: 'flex-end',
    paddingTop: spacing.sm,
    paddingBottom: 2,
    gap: spacing.sm,
  },
  chartColumn: {
    width: 48,
    alignItems: 'center',
  },
  chartValue: {
    width: 52,
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 5,
  },
  chartBarSlot: {
    height: 96,
    width: 24,
    justifyContent: 'flex-end',
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
  },
  chartBar: {
    width: '100%',
    minHeight: 4,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
  },
  chartLabel: {
    width: 52,
    color: colors.textMuted,
    fontSize: 10,
    textAlign: 'center',
    marginTop: 6,
  },
  chartFootnote: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  muscleRow: {
    gap: 6,
  },
  muscleName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  muscleValue: {
    color: colors.textMuted,
    fontSize: 12,
  },
  progressTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  selectorButton: {
    maxWidth: 180,
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: 11,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectorText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  exerciseDetail: {
    color: colors.textMuted,
    fontSize: 13,
  },
  metricRow: {
    gap: spacing.sm,
    paddingVertical: 2,
  },
  trendSummary: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    paddingVertical: spacing.sm,
  },
  trendStat: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  trendLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  trendValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
    marginTop: 4,
  },
  positiveText: {
    color: colors.primary,
  },
  neutralText: {
    color: colors.textMuted,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: 2,
  },
  recordCopy: {
    flex: 1,
  },
  recordExercise: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  recordLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 3,
  },
  recordRight: {
    alignItems: 'flex-end',
  },
  recordValue: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '900',
  },
  recordDate: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 3,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  emptyState: {
    paddingVertical: spacing.sm,
    gap: 5,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  rangeEmptyNote: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  modalDismissLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  modalCard: {
    maxHeight: '78%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 21,
    fontWeight: '900',
  },
  modalSubtitle: {
    maxWidth: 230,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  closeButton: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
  },
  closeButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  modalList: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  exerciseOption: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  exerciseOptionSelected: {
    borderColor: colors.primary,
  },
  exerciseOptionCopy: {
    flex: 1,
  },
  exerciseOptionName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  exerciseOptionDetail: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 3,
  },
  checkSelected: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: '900',
  },
  checkMuted: {
    color: colors.textMuted,
    fontSize: 20,
  },
});
