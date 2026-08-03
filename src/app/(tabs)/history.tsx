import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { SectionCard } from '@/components/SectionCard';
import { colors, radius, spacing } from '@/constants/theme';

export default function HistoryScreen() {
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

      <SectionCard title="Workout history">
        <View style={styles.emptyIcon}>
          <Text style={styles.emptyIconText}>◷</Text>
        </View>
        <Text style={styles.emptyTitle}>No completed workouts yet</Text>
        <Text style={styles.emptyCopy}>
          Finish your first workout and LiftFlow will preserve every exercise, set,
          note, and record here.
        </Text>
        <PrimaryButton label="Choose Workout" onPress={() => {}} />
      </SectionCard>
    </ScrollView>
  );
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
});
