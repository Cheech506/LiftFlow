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
  getWorkoutDateTimestamp,
  isInCurrentWeek,
} from '@/lib/workoutStats';
import { buildRecentPrs } from '@/lib/progressAnalytics';
import { showPrototypeNotice } from '@/lib/prototypeNotice';

export default function HomeScreen() {
  const router = useRouter();
  const {
    workout,
    startWorkout,
    completedSetCount,
    totalSetCount,
    completedWorkouts,
    exercises,
    templates,
    incompleteWorkouts,
    preferences,
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
  const workoutDays = new Set(
    currentWeekWorkouts.map((item) => {
      const day = new Date(getWorkoutDateTimestamp(item)).getDay();
      return day === 0 ? 6 : day - 1;
    }),
  );
  const recentPrs = buildRecentPrs(exercises, completedWorkouts, '4w').slice(0, 3);
  const activeTemplates = templates.filter((template) => !template.archived);
  const recentlyUsedTemplateIds = completedWorkouts
    .filter((item) => item.sourceTemplateId)
    .sort((left, right) => getWorkoutDateTimestamp(right) - getWorkoutDateTimestamp(left))
    .map((item) => item.sourceTemplateId as string);
  const recentTemplates = [
    ...recentlyUsedTemplateIds
      .map((templateId) => activeTemplates.find((template) => template.id === templateId))
      .filter((template, index, list) =>
        Boolean(template) && list.findIndex((candidate) => candidate?.id === template?.id) === index,
      ),
    ...activeTemplates,
  ]
    .filter((template, index, list) =>
      Boolean(template) && list.findIndex((candidate) => candidate?.id === template?.id) === index,
    )
    .slice(0, 3);
  const recentCompleted = [...completedWorkouts]
    .sort((left, right) => getWorkoutDateTimestamp(right) - getWorkoutDateTimestamp(left))
    .slice(0, 3);
  const isFirstRun = !workout && templates.length === 0 && completedWorkouts.length === 0 && incompleteWorkouts.length === 0;

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

      {isFirstRun ? (
        <SectionCard title="Welcome to LiftFlow">
          <Text style={styles.cardHeading}>Start clean—no fake workouts or analytics.</Text>
          <Text style={styles.muted}>
            Begin an empty workout, build a reusable template, or open Settings to import your Strong CSV. LiftFlow supports Weight & Reps, Bodyweight & Reps, Added Weight, Assisted Bodyweight, Reps Only, Duration, and Distance & Duration.
          </Text>
          <View style={styles.buttonRow}>
            <PrimaryButton label="Build Template" onPress={() => router.push('/workouts')} style={styles.flexButton} />
            <PrimaryButton label="Import Strong" onPress={() => router.push('/settings')} variant="secondary" style={styles.flexButton} />
          </View>
        </SectionCard>
      ) : null}

      <SectionCard title="Recent workouts">
        {recentTemplates.length > 0 ? recentTemplates.map((template, index) => template ? (
          <View key={template.id}>
            {index > 0 ? <View style={styles.divider} /> : null}
            <View style={styles.templateCard}>
              <View style={styles.flexCopy}>
                <Text style={styles.cardHeading}>{template.name}</Text>
                <Text style={styles.muted}>{template.folder} · {template.detail}</Text>
              </View>
              <PrimaryButton
                label="Start"
                onPress={() => beginWorkout(template.name, template.id)}
                style={styles.smallButton}
              />
            </View>
          </View>
        ) : null) : (
          <View>
            <Text style={styles.emptyTitle}>No templates yet</Text>
            <Text style={styles.muted}>Create a workout template to keep your routine one tap away.</Text>
          </View>
        )}
      </SectionCard>

      <SectionCard
        title="This week"
        headerRight={<Text style={styles.weekGoal}>{currentWeekWorkouts.length}/{preferences.weeklyWorkoutGoal} goal</Text>}
      >
        <View style={styles.statsRow}>
          <Stat value={String(currentWeekWorkouts.length)} label="Workouts" />
          <Stat value={formatDurationShort(currentWeekSeconds)} label="Training" />
          <Stat value={String(currentWeekSets)} label="Sets" />
        </View>
        <View style={styles.weekRow}>
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
            <View key={`${day}-${index}`} style={styles.day}>
              <Text style={styles.dayLabel}>{day}</Text>
              <View style={[styles.dayDot, workoutDays.has(index) && styles.dayDotActive]} />
            </View>
          ))}
        </View>
      </SectionCard>

      <SectionCard title="Recent personal records">
        {recentPrs.length > 0 ? recentPrs.map((record, index) => (
          <View key={`${record.exerciseId}-${record.key}-${record.workoutId}-${index}`}>
            {index > 0 ? <View style={styles.divider} /> : null}
            <View style={styles.rowBetween}>
              <View style={styles.flexCopy}>
                <Text style={styles.cardHeading}>{record.exerciseName}</Text>
                <Text style={styles.muted}>{record.label} · {record.workoutName}</Text>
              </View>
              <Text style={styles.prValue}>{record.displayValue}</Text>
            </View>
          </View>
        )) : (
          <>
            <Text style={styles.emptyTitle}>No records yet</Text>
            <Text style={styles.muted}>
              Complete qualifying working sets and your newest PRs will appear here.
            </Text>
          </>
        )}
      </SectionCard>

      <SectionCard title="Recent activity">
        {recentCompleted.length > 0 ? recentCompleted.map((completed, index) => (
          <View key={completed.id}>
            {index > 0 ? <View style={styles.divider} /> : null}
            <View style={styles.templateCard}>
              <View style={styles.flexCopy}>
                <Text style={styles.cardHeading}>{completed.name}</Text>
                <Text style={styles.muted}>{formatRecentDate(getWorkoutDateTimestamp(completed))} · {getCompletedSets(completed).length} completed sets</Text>
              </View>
              <PrimaryButton label="View" onPress={() => router.push('/history')} variant="secondary" style={styles.smallButton} />
            </View>
          </View>
        )) : (
          <Text style={styles.muted}>Finished workouts will appear here with one-tap access to History.</Text>
        )}
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

function formatRecentDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(timestamp));
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
  dayDotActive: {
    backgroundColor: colors.primary,
  },
  flexCopy: {
    flex: 1,
  },
  prValue: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '900',
    marginLeft: spacing.sm,
  },
  weekGoal: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
});
