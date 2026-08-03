import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { SectionCard } from '@/components/SectionCard';
import { colors, radius, spacing } from '@/constants/theme';
import { useActiveWorkout } from '@/context/ActiveWorkoutContext';
import {
  formatDurationShort,
  getCompletedSets,
  getWorkoutDurationSeconds,
  getWorkoutVolume,
} from '@/lib/workoutStats';

export default function HistoryScreen() {
  const router = useRouter();
  const { completedWorkouts } = useActiveWorkout();

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.toggle}>
        <View style={[styles.toggleOption, styles.toggleActive]}>
          <Text style={styles.toggleActiveLabel}>Timeline</Text>
        </View>
        <View style={styles.toggleOption}>
          <Text style={styles.toggleLabel}>Calendar</Text>
        </View>
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
      ) : (
        completedWorkouts.map((workout) => {
          const completedSets = getCompletedSets(workout);
          const duration = getWorkoutDurationSeconds(workout);
          const volume = getWorkoutVolume(workout);

          return (
            <SectionCard key={workout.id} title={formatWorkoutDate(workout.completedAt)}>
              <Text style={styles.workoutName}>{workout.name}</Text>
              {workout.sourceFolder ? (
                <Text style={styles.folder}>{workout.sourceFolder}</Text>
              ) : null}
              <View style={styles.summaryRow}>
                <Summary value={formatDurationShort(duration)} label="Duration" />
                <Summary value={String(completedSets.length)} label="Completed sets" />
                <Summary value={`${Math.round(volume).toLocaleString()} lb`} label="Volume" />
              </View>
              {workout.exercises.map((exercise) => (
                <View key={`${workout.id}-${exercise.id}`} style={styles.exerciseRow}>
                  <Text style={styles.exerciseName}>{exercise.name}</Text>
                  <Text style={styles.exerciseDetail}>
                    {exercise.sets.filter((set) => set.completed).length} completed sets
                  </Text>
                </View>
              ))}
            </SectionCard>
          );
        })
      )}
    </ScrollView>
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
  workoutName: {
    color: colors.text,
    fontSize: 21,
    fontWeight: '900',
  },
  folder: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
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
  exerciseRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  exerciseName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  exerciseDetail: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 3,
  },
});
