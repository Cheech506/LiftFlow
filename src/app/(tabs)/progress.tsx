import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { SectionCard } from '@/components/SectionCard';
import { colors, spacing } from '@/constants/theme';
import { useActiveWorkout } from '@/context/ActiveWorkoutContext';
import {
  formatDurationShort,
  getCompletedSets,
  getWorkoutDurationSeconds,
  isInCurrentWeek,
} from '@/lib/workoutStats';

const TWELVE_WEEKS_MS = 12 * 7 * 24 * 60 * 60 * 1000;

export default function ProgressScreen() {
  const { completedWorkouts } = useActiveWorkout();
  const cutoff = Date.now() - TWELVE_WEEKS_MS;
  const recentWorkouts = completedWorkouts.filter(
    (workout) => workout.completedAt >= cutoff,
  );
  const workingSets = recentWorkouts.reduce(
    (total, workout) => total + getCompletedSets(workout).length,
    0,
  );
  const trainingSeconds = recentWorkouts.reduce(
    (total, workout) => total + getWorkoutDurationSeconds(workout),
    0,
  );
  const currentWeekCount = completedWorkouts.filter(isInCurrentWeek).length;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <SectionCard title="Last 12 weeks">
        <View style={styles.statsGrid}>
          <ProgressStat value={String(recentWorkouts.length)} label="Workouts" />
          <ProgressStat value={String(workingSets)} label="Working sets" />
          <ProgressStat value={formatDurationShort(trainingSeconds)} label="Training time" />
          <ProgressStat value="0" label="New records" />
        </View>
      </SectionCard>

      <SectionCard title="Consistency">
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.value}>{currentWeekCount} workouts</Text>
            <Text style={styles.label}>Current week</Text>
          </View>
          <View style={styles.goalBadge}>
            <Text style={styles.goalText}>Goal: 3</Text>
          </View>
        </View>
        <Text style={styles.bodyText}>
          {currentWeekCount >= 3
            ? 'Weekly goal complete. Nice work.'
            : `${Math.max(0, 3 - currentWeekCount)} workout${
                3 - currentWeekCount === 1 ? '' : 's'
              } remaining this week.`}
        </Text>
      </SectionCard>

      <SectionCard title="Recent records">
        <Text style={styles.emptyTitle}>No personal records yet</Text>
        <Text style={styles.bodyText}>
          LiftFlow will calculate PRs locally from completed working sets.
        </Text>
      </SectionCard>

      <SectionCard title="Exercise progress">
        <Text style={styles.emptyTitle}>Choose an exercise</Text>
        <Text style={styles.bodyText}>
          Strength, volume, RPE, and frequency charts will appear after at least two sessions.
        </Text>
      </SectionCard>
    </ScrollView>
  );
}

function ProgressStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    paddingBottom: 150,
    gap: spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.lg,
  },
  stat: {
    width: '50%',
  },
  value: {
    color: colors.text,
    fontSize: 23,
    fontWeight: '900',
  },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 3,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  goalBadge: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 999,
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
  emptyTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
});
