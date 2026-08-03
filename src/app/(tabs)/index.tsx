import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { SectionCard } from '@/components/SectionCard';
import { colors, spacing } from '@/constants/theme';
import { useActiveWorkout } from '@/context/ActiveWorkoutContext';
import {
  formatDurationShort,
  getCompletedSets,
  getWorkoutDurationSeconds,
  isInCurrentWeek,
} from '@/lib/workoutStats';
import { showPrototypeNotice } from '@/lib/prototypeNotice';

export default function HomeScreen() {
  const router = useRouter();
  const {
    workout,
    startWorkout,
    completedSetCount,
    totalSetCount,
    completedWorkouts,
    persistenceStatus,
  } = useActiveWorkout();

  const beginWorkout = (name: string, templateId?: string) => {
    if (workout) {
      showPrototypeNotice(
        'Workout already in progress',
        `${workout.name} is still active. LiftFlow will resume it instead of overwriting it.`,
      );
      router.push('/active-workout');
      return;
    }

    startWorkout(name, templateId);
    router.push('/active-workout');
  };

  const currentWeekWorkouts = completedWorkouts.filter(isInCurrentWeek);
  const currentWeekSeconds = currentWeekWorkouts.reduce(
    (total, item) => total + getWorkoutDurationSeconds(item),
    0,
  );
  const currentWeekSets = currentWeekWorkouts.reduce(
    (total, item) => total + getCompletedSets(item).length,
    0,
  );

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View>
        <Text style={styles.eyebrow}>{formatToday()}</Text>
        <Text style={styles.hero}>Ready to train?</Text>
        <Text style={styles.subhead}>Your workouts stay yours.</Text>
        <Text
          style={[
            styles.storageStatus,
            persistenceStatus === 'error' && styles.storageStatusError,
          ]}
        >
          {persistenceStatus === 'saving'
            ? '↻ Saving locally…'
            : persistenceStatus === 'error'
              ? '! Local save issue'
              : '✓ Local data ready'}
        </Text>
      </View>

      {workout ? (
        <SectionCard title="Workout in progress">
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.cardHeading}>{workout.name}</Text>
              <Text style={styles.muted}>
                {completedSetCount} of {totalSetCount} sets complete
              </Text>
            </View>
            <Text style={styles.liveBadge}>LIVE</Text>
          </View>
          <PrimaryButton label="Resume Workout" onPress={() => router.push('/active-workout')} />
        </SectionCard>
      ) : null}

      <SectionCard title="Quick start">
        <View style={styles.buttonRow}>
          <PrimaryButton
            label="Start Empty"
            onPress={() => beginWorkout(getEmptyWorkoutName())}
            style={styles.flexButton}
          />
          <PrimaryButton
            label="Choose Workout"
            onPress={() => router.push('/workouts')}
            variant="secondary"
            style={styles.flexButton}
          />
        </View>
      </SectionCard>

      <SectionCard title="Recent workouts">
        <View style={styles.templateCard}>
          <View>
            <Text style={styles.cardHeading}>Upper A</Text>
            <Text style={styles.muted}>Upper / Lower · 2 exercises</Text>
          </View>
          <PrimaryButton
            label="Start"
            onPress={() => beginWorkout('Upper A', 'upper-a')}
            style={styles.smallButton}
          />
        </View>
        <View style={styles.divider} />
        <View style={styles.templateCard}>
          <View>
            <Text style={styles.cardHeading}>Lower A</Text>
            <Text style={styles.muted}>Upper / Lower · 1 exercise</Text>
          </View>
          <PrimaryButton
            label="Start"
            onPress={() => beginWorkout('Lower A', 'lower-a')}
            style={styles.smallButton}
          />
        </View>
      </SectionCard>

      <SectionCard title="This week">
        <View style={styles.statsRow}>
          <Stat value={String(currentWeekWorkouts.length)} label="Workouts" />
          <Stat value={formatDurationShort(currentWeekSeconds)} label="Training" />
          <Stat value={String(currentWeekSets)} label="Sets" />
        </View>
        <View style={styles.weekRow}>
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
            <View key={`${day}-${index}`} style={styles.day}>
              <Text style={styles.dayLabel}>{day}</Text>
              <View style={styles.dayDot} />
            </View>
          ))}
        </View>
      </SectionCard>

      <SectionCard title="Recent personal records">
        <Text style={styles.emptyTitle}>No records yet</Text>
        <Text style={styles.muted}>
          Complete qualifying working sets and your newest PRs will appear here.
        </Text>
      </SectionCard>
    </ScrollView>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function getEmptyWorkoutName() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Morning Workout';
  if (hour < 17) return 'Afternoon Workout';
  return 'Evening Workout';
}

function formatToday() {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
    .format(new Date())
    .toUpperCase();
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
    fontSize: 16,
    marginTop: 4,
  },
  storageStatus: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    marginTop: spacing.sm,
  },
  storageStatusError: {
    color: colors.danger,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardHeading: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  muted: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  liveBadge: {
    color: colors.background,
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 11,
    fontWeight: '900',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  flexButton: {
    flex: 1,
  },
  templateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  smallButton: {
    minHeight: 40,
    minWidth: 74,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    color: colors.text,
    fontSize: 23,
    fontWeight: '900',
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 3,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  day: {
    alignItems: 'center',
    gap: 7,
  },
  dayLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  dayDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
});
