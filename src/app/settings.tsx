import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { SectionCard } from '@/components/SectionCard';
import { colors, spacing } from '@/constants/theme';
import { useActiveWorkout } from '@/context/ActiveWorkoutContext';
import { showPrototypeNotice } from '@/lib/prototypeNotice';

const sections = [
  {
    title: 'Workout',
    rows: ['Units', 'Set Entry', 'Rest Timer', 'RPE', 'Workout Behavior'],
  },
  {
    title: 'Appearance',
    rows: ['Theme', 'Accent Color', 'Workout Display'],
  },
  {
    title: 'Data',
    rows: ['Strong Import', 'Export Data', 'Backup and Restore'],
  },
  {
    title: 'Self-hosting',
    rows: ['Server Connection', 'Synchronization', 'Devices', 'Server Status'],
  },
  {
    title: 'Application',
    rows: ['Notifications', 'Progress Settings', 'Archived Items', 'About LiftFlow'],
  },
];

export default function SettingsScreen() {
  const {
    persistenceStatus,
    lastSavedAt,
    templates,
    workout,
    completedWorkouts,
  } = useActiveWorkout();

  const openPlannedSetting = (label: string) => {
    showPrototypeNotice(
      label,
      'This settings page is planned but is not implemented in the current prototype. The row is now wired so it will never fail silently.',
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <SectionCard title="Profile">
        <SettingsRow
          label="LiftFlow Owner"
          detail="Single-owner instance"
          onPress={() =>
            showPrototypeNotice(
              'LiftFlow Owner',
              'The first release uses one local owner. Account editing will arrive with the self-hosted backend.',
            )
          }
        />
      </SectionCard>

      <SectionCard title="Local data">
        <SettingsRow
          label={formatPersistenceStatus(persistenceStatus)}
          detail={lastSavedAt ? `Last saved ${formatSavedTime(lastSavedAt)}` : 'Preparing local storage'}
        />
        <SettingsRow
          label={`${templates.length} workout templates`}
          detail={workout ? `Active workout: ${workout.name}` : 'No active workout'}
        />
        <SettingsRow
          label={`${completedWorkouts.length} completed workouts`}
          detail="Stored on this device"
        />
      </SectionCard>

      {sections.map((section) => (
        <SectionCard key={section.title} title={section.title}>
          {section.rows.map((row) => (
            <SettingsRow key={row} label={row} onPress={() => openPlannedSetting(row)} />
          ))}
        </SectionCard>
      ))}

      <SectionCard title="Current foundation">
        <View style={styles.switchRow}>
          <View style={styles.copy}>
            <Text style={styles.rowLabel}>Show active workout bar</Text>
            <Text style={styles.rowDetail}>Locked on for the first prototype</Text>
          </View>
          <Switch value trackColor={{ true: colors.primary }} disabled />
        </View>
        <View style={styles.switchRow}>
          <View style={styles.copy}>
            <Text style={styles.rowLabel}>Automatically open active workout</Text>
            <Text style={styles.rowDetail}>Off, matching the approved behavior</Text>
          </View>
          <Switch value={false} disabled />
        </View>
      </SectionCard>
    </ScrollView>
  );
}

function SettingsRow({
  label,
  detail,
  onPress,
}: {
  label: string;
  detail?: string;
  onPress?: () => void;
}) {
  const content = (
    <>
      <View style={styles.copy}>
        <Text style={styles.rowLabel}>{label}</Text>
        {detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}
      </View>
      {onPress ? <Text style={styles.chevron}>›</Text> : null}
    </>
  );

  if (!onPress) {
    return <View style={styles.row}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${label}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

function formatPersistenceStatus(status: 'loading' | 'saving' | 'saved' | 'error') {
  if (status === 'saving') return 'Saving local data…';
  if (status === 'error') return 'Local storage needs attention';
  if (status === 'loading') return 'Loading local data…';
  return 'Local data is saved';
}

function formatSavedTime(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(timestamp));
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  row: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  switchRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pressed: {
    opacity: 0.65,
  },
  copy: {
    flex: 1,
  },
  rowLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  rowDetail: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 3,
  },
  chevron: {
    color: colors.textMuted,
    fontSize: 26,
  },
});
