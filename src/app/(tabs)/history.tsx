import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { SectionCard } from '@/components/SectionCard';
import { colors, radius, spacing } from '@/constants/theme';
import { CompletedWorkout, useActiveWorkout } from '@/context/ActiveWorkoutContext';
import {
  formatDurationShort,
  getCompletedSets,
  getWorkoutDurationSeconds,
  getWorkoutVolume,
} from '@/lib/workoutStats';

type HistoryView = 'timeline' | 'calendar';

export default function HistoryScreen() {
  const router = useRouter();
  const { completedWorkouts } = useActiveWorkout();
  const [view, setView] = useState<HistoryView>('timeline');
  const [selectedWorkout, setSelectedWorkout] = useState<CompletedWorkout | null>(null);

  return (
    <>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.toggle}>
          <ToggleButton
            label="Timeline"
            active={view === 'timeline'}
            onPress={() => setView('timeline')}
          />
          <ToggleButton
            label="Calendar"
            active={view === 'calendar'}
            onPress={() => setView('calendar')}
          />
        </View>

        {completedWorkouts.length === 0 ? (
          <SectionCard title="Workout history">
            <View style={styles.emptyIcon}>
              <Text style={styles.emptyIconText}>◷</Text>
            </View>
            <Text style={styles.emptyTitle}>No completed workouts yet</Text>
            <Text style={styles.emptyCopy}>
              Finish your first workout and LiftFlow will preserve it here—even after
              you refresh or restart the app.
            </Text>
            <PrimaryButton label="Choose Workout" onPress={() => router.push('/workouts')} />
          </SectionCard>
        ) : view === 'timeline' ? (
          completedWorkouts.map((workout) => (
            <WorkoutHistoryCard
              key={workout.id}
              workout={workout}
              onPress={() => setSelectedWorkout(workout)}
            />
          ))
        ) : (
          <CalendarSummary
            workouts={completedWorkouts}
            onSelectWorkout={setSelectedWorkout}
          />
        )}
      </ScrollView>

      <WorkoutDetailModal
        workout={selectedWorkout}
        onClose={() => setSelectedWorkout(null)}
      />
    </>
  );
}

function ToggleButton({
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
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.toggleOption,
        active && styles.toggleActive,
        pressed && styles.pressed,
      ]}
    >
      <Text style={active ? styles.toggleActiveLabel : styles.toggleLabel}>{label}</Text>
    </Pressable>
  );
}

function WorkoutHistoryCard({
  workout,
  onPress,
}: {
  workout: CompletedWorkout;
  onPress: () => void;
}) {
  const completedSets = getCompletedSets(workout);
  const duration = getWorkoutDurationSeconds(workout);
  const volume = getWorkoutVolume(workout);

  return (
    <SectionCard title={formatWorkoutDate(workout.completedAt)}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${workout.name} workout details`}
        onPress={onPress}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <View style={styles.rowBetween}>
          <View style={styles.flexCopy}>
            <Text style={styles.workoutName}>{workout.name}</Text>
            {workout.sourceFolder ? (
              <Text style={styles.folder}>{workout.sourceFolder}</Text>
            ) : null}
          </View>
          <Text style={styles.chevron}>›</Text>
        </View>

        <View style={styles.summaryRow}>
          <Summary value={formatDurationShort(duration)} label="Duration" />
          <Summary value={String(completedSets.length)} label="Completed sets" />
          <Summary value={`${Math.round(volume).toLocaleString()} lb`} label="Volume" />
        </View>

        {workout.notes ? <Text style={styles.notes}>“{workout.notes}”</Text> : null}
      </Pressable>
    </SectionCard>
  );
}

function CalendarSummary({
  workouts,
  onSelectWorkout,
}: {
  workouts: CompletedWorkout[];
  onSelectWorkout: (workout: CompletedWorkout) => void;
}) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const days = useMemo(() => buildCalendarDays(year, month), [month, year]);

  const workoutsByDate = useMemo(() => {
    const map = new Map<string, CompletedWorkout[]>();
    workouts.forEach((workout) => {
      const date = new Date(workout.completedAt);
      if (date.getFullYear() !== year || date.getMonth() !== month) return;
      const key = dateKey(date);
      map.set(key, [...(map.get(key) ?? []), workout]);
    });
    return map;
  }, [month, workouts, year]);

  return (
    <SectionCard
      title={new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(
        today,
      )}
    >
      <View style={styles.calendarHeader}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
          <Text key={`${day}-${index}`} style={styles.calendarHeaderText}>
            {day}
          </Text>
        ))}
      </View>

      <View style={styles.calendarGrid}>
        {days.map((date) => {
          const dayWorkouts = workoutsByDate.get(dateKey(date)) ?? [];
          const inMonth = date.getMonth() === month;

          return (
            <Pressable
              key={date.toISOString()}
              accessibilityRole={dayWorkouts.length > 0 ? 'button' : undefined}
              onPress={() => dayWorkouts[0] && onSelectWorkout(dayWorkouts[0])}
              style={({ pressed }) => [
                styles.calendarDay,
                dayWorkouts.length > 0 && styles.calendarDayActive,
                pressed && dayWorkouts.length > 0 && styles.pressed,
              ]}
            >
              <Text style={[styles.calendarDayText, !inMonth && styles.calendarDayMuted]}>
                {date.getDate()}
              </Text>
              {dayWorkouts.length > 0 ? (
                <Text style={styles.calendarCount}>{dayWorkouts.length}</Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.calendarHint}>
        Tap a highlighted day to open its first completed workout.
      </Text>
    </SectionCard>
  );
}

function WorkoutDetailModal({
  workout,
  onClose,
}: {
  workout: CompletedWorkout | null;
  onClose: () => void;
}) {
  return (
    <Modal
      transparent
      visible={Boolean(workout)}
      animationType="fade"
      onRequestClose={onClose}
    >
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
                    {exercise.sets.map((set, index) => (
                      <View key={set.id} style={styles.setDetailRow}>
                        <Text style={styles.setDetailLabel}>Set {index + 1}</Text>
                        <Text style={styles.setDetailValue}>
                          {set.weight ?? '—'} lb × {set.reps ?? '—'}
                          {set.completed ? '  ✓' : ''}
                        </Text>
                      </View>
                    ))}
                  </View>
                ))}
              </ScrollView>

              <PrimaryButton label="Close" onPress={onClose} variant="secondary" />
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function Summary({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function formatWorkoutDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp));
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
  content: {
    padding: spacing.md,
    paddingBottom: 150,
    gap: spacing.md,
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 4,
  },
  toggleOption: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  toggleActive: {
    backgroundColor: colors.surfaceElevated,
  },
  toggleLabel: {
    color: colors.textMuted,
    fontWeight: '700',
  },
  toggleActiveLabel: {
    color: colors.text,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.65,
  },
  emptyIcon: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 27,
    marginTop: spacing.sm,
  },
  emptyIconText: {
    color: colors.primary,
    fontSize: 26,
  },
  emptyTitle: {
    color: colors.text,
    textAlign: 'center',
    fontSize: 19,
    fontWeight: '900',
  },
  emptyCopy: {
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: spacing.sm,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  flexCopy: {
    flex: 1,
  },
  chevron: {
    color: colors.textMuted,
    fontSize: 28,
  },
  workoutName: {
    color: colors.text,
    fontSize: 21,
    fontWeight: '900',
  },
  folder: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 3,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginVertical: spacing.sm,
  },
  summaryItem: {
    flex: 1,
    minHeight: 70,
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  summaryValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 4,
  },
  notes: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  calendarHeader: {
    flexDirection: 'row',
  },
  calendarHeaderText: {
    width: '14.2857%',
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '800',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDay: {
    width: '14.2857%',
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  calendarDayActive: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  calendarDayText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  calendarDayMuted: {
    color: colors.border,
  },
  calendarCount: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '900',
  },
  calendarHint: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    padding: spacing.lg,
  },
  modalCard: {
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
    fontSize: 25,
    fontWeight: '900',
  },
  modalScroll: {
    maxHeight: 430,
  },
  detailExercise: {
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  exerciseName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 5,
  },
  setDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  setDetailLabel: {
    color: colors.textMuted,
    fontSize: 13,
  },
  setDetailValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
});
