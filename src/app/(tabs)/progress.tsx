import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { SectionCard } from '@/components/SectionCard';
import { colors, spacing } from '@/constants/theme';

export default function ProgressScreen() {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <SectionCard title="Last 12 weeks">
        <View style={styles.statsGrid}>
          <ProgressStat value="0" label="Workouts" />
          <ProgressStat value="0" label="Working sets" />
          <ProgressStat value="0m" label="Training time" />
          <ProgressStat value="0" label="New records" />
        </View>
      </SectionCard>

      <SectionCard title="Consistency">
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.value}>0 workouts</Text>
            <Text style={styles.label}>Current week</Text>
          </View>
          <View style={styles.goalBadge}>
            <Text style={styles.goalText}>Goal: 3</Text>
          </View>
        </View>
        <Text style={styles.bodyText}>
          Weekly streaks will begin after your first completed workout.
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
