import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useState } from 'react';

import { SectionCard } from '@/components/SectionCard';
import { colors, spacing } from '@/constants/theme';
import { useActiveWorkout } from '@/context/ActiveWorkoutContext';
import { pickTextFile, shareTextFile } from '@/lib/dataTransfer';
import { buildLiftFlowBackup, buildWorkoutHistoryCsv, exportFileStamp } from '@/lib/exportData';
import { showPrototypeNotice } from '@/lib/prototypeNotice';
import { requestRestTimerAlertPermission } from '@/lib/restTimerAlerts';
import { parseLiftFlowBackup } from '@/storage/liftflowStorage';

const plannedSections = [
  { title: 'Workout', rows: ['Units', 'Set Entry', 'RPE', 'Workout Behavior'] },
  { title: 'Appearance', rows: ['Theme', 'Accent Color', 'Workout Display'] },
  { title: 'Self-hosting', rows: ['Server Connection', 'Synchronization', 'Devices', 'Server Status'] },
  { title: 'Application', rows: ['Notifications', 'Progress Settings', 'Archived Items', 'About LiftFlow'] },
];

export default function SettingsScreen() {
  const {
    persistenceStatus,
    lastSavedAt,
    exercises,
    templates,
    workout,
    completedWorkouts,
    getStateSnapshot,
    restoreState,
    restTimerSettings,
    updateRestTimerSettings,
  } = useActiveWorkout();
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const runAction = async (label: string, action: () => Promise<void>) => {
    if (busyAction) return;
    setBusyAction(label);
    try {
      await action();
    } catch (error) {
      Alert.alert(`${label} failed`, error instanceof Error ? error.message : 'LiftFlow could not complete this action.');
    } finally {
      setBusyAction(null);
    }
  };

  const exportCsv = () => runAction('CSV export', async () => {
    if (completedWorkouts.length === 0) {
      Alert.alert('Nothing to export', 'Finish at least one workout before exporting workout history.');
      return;
    }
    const filename = `LiftFlow-history-${exportFileStamp()}.csv`;
    await shareTextFile(filename, buildWorkoutHistoryCsv(getStateSnapshot()), 'text/csv');
  });

  const exportBackup = () => runAction('Backup export', async () => {
    const filename = `LiftFlow-backup-${exportFileStamp()}.json`;
    await shareTextFile(filename, buildLiftFlowBackup(getStateSnapshot()), 'application/json');
  });

  const restoreBackup = () => runAction('Backup restore', async () => {
    const text = await pickTextFile(['application/json', 'text/plain']);
    if (!text) return;
    const parsed = parseLiftFlowBackup(text);
    Alert.alert(
      'Restore this LiftFlow backup?',
      `This backup contains ${parsed.exercises.length} exercises, ${parsed.templates.length} templates, and ${parsed.completedWorkouts.length} completed workouts. Your current state will be saved as an automatic safety snapshot first.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: () => {
            void restoreState({
              exercises: parsed.exercises,
              folders: parsed.folders,
              templates: parsed.templates,
              activeWorkout: parsed.activeWorkout,
              completedWorkouts: parsed.completedWorkouts,
              restTimerSettings: parsed.restTimerSettings,
            })
              .then(() => Alert.alert('Backup restored', 'LiftFlow restored the backup successfully.'))
              .catch((error: unknown) => Alert.alert('Restore failed', error instanceof Error ? error.message : 'The backup could not be restored.'));
          },
        },
      ],
    );
  });

  const openPlannedSetting = (label: string) => {
    showPrototypeNotice(label, 'This setting is planned for a later release. Stable v0.1 is focused on dependable local workout recording and data protection.');
  };

  const toggleRestNotifications = async (enabled: boolean) => {
    if (!enabled) {
      updateRestTimerSettings({ notificationsEnabled: false });
      return;
    }
    const granted = await requestRestTimerAlertPermission();
    if (!granted) {
      Alert.alert('Notifications not enabled', 'Allow LiftFlow notifications in iPhone or Android settings to receive rest alerts while the app is locked.');
      return;
    }
    updateRestTimerSettings({ notificationsEnabled: true });
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <SectionCard title="Stable local release">
        <SettingsRow label="LiftFlow v0.1" detail="Local exercises, templates, workout recording, editable history, CSV export, and JSON backup/restore" />
      </SectionCard>

      <SectionCard title="Local data">
        <SettingsRow label={formatPersistenceStatus(persistenceStatus)} detail={lastSavedAt ? `Last saved ${formatSavedTime(lastSavedAt)}` : 'Preparing local storage'} />
        <SettingsRow label={`${exercises.filter((item) => item.isCustom).length} custom exercises`} detail={`${exercises.filter((item) => item.archived).length} archived`} />
        <SettingsRow label={`${templates.length} workout templates`} detail={workout ? `Active workout: ${workout.name}` : 'No active workout'} />
        <SettingsRow label={`${completedWorkouts.length} completed workouts`} detail="Stored on this device" />
      </SectionCard>


      <SectionCard title="Rest timer">
        <View style={styles.timerSettingRow}>
          <View style={styles.copy}>
            <Text style={styles.rowLabel}>Default rest time</Text>
            <Text style={styles.rowDetail}>Starting value for manual timers and newly created exercises</Text>
          </View>
          <View style={styles.stepper}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Decrease default rest time by 15 seconds"
              onPress={() => updateRestTimerSettings({ defaultSeconds: restTimerSettings.defaultSeconds - 15 })}
              style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}
            >
              <Text style={styles.stepButtonLabel}>−15</Text>
            </Pressable>
            <Text style={styles.timerValue}>{formatRestTime(restTimerSettings.defaultSeconds)}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Increase default rest time by 15 seconds"
              onPress={() => updateRestTimerSettings({ defaultSeconds: restTimerSettings.defaultSeconds + 15 })}
              style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}
            >
              <Text style={styles.stepButtonLabel}>+15</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.switchRow}>
          <View style={styles.copy}><Text style={styles.rowLabel}>Auto-start after a completed set</Text><Text style={styles.rowDetail}>Uses the exercise rest time, then falls back to the global default</Text></View>
          <Switch value={restTimerSettings.autoStart} onValueChange={(autoStart) => updateRestTimerSettings({ autoStart })} trackColor={{ true: colors.primary }} />
        </View>
        <View style={styles.switchRow}>
          <View style={styles.copy}><Text style={styles.rowLabel}>Lock-screen rest alerts</Text><Text style={styles.rowDetail}>Schedules a local notification with sound when the timer finishes</Text></View>
          <Switch value={restTimerSettings.notificationsEnabled} onValueChange={(enabled) => { void toggleRestNotifications(enabled); }} trackColor={{ true: colors.primary }} />
        </View>
        <View style={styles.switchRow}>
          <View style={styles.copy}><Text style={styles.rowLabel}>Vibrate when rest ends</Text><Text style={styles.rowDetail}>Uses device haptics when LiftFlow is running</Text></View>
          <Switch value={restTimerSettings.vibrationEnabled} onValueChange={(vibrationEnabled) => updateRestTimerSettings({ vibrationEnabled })} trackColor={{ true: colors.primary }} />
        </View>
      </SectionCard>

      <SectionCard title="Export and backup">
        <SettingsRow label={busyAction === 'CSV export' ? 'Preparing CSV…' : 'Export workout history CSV'} detail="One row per recorded set; opens in Excel" onPress={exportCsv} disabled={Boolean(busyAction)} />
        <SettingsRow label={busyAction === 'Backup export' ? 'Preparing backup…' : 'Export full JSON backup'} detail="Exercises, templates, active workout, and history" onPress={exportBackup} disabled={Boolean(busyAction)} />
        <SettingsRow label={busyAction === 'Backup restore' ? 'Opening backup…' : 'Restore JSON backup'} detail="Validates the file before replacing current data" onPress={restoreBackup} disabled={Boolean(busyAction)} />
        <SettingsRow label="Strong Import" detail="Paused until Stable v0.1 is fully tested" onPress={() => openPlannedSetting('Strong Import')} />
      </SectionCard>

      {plannedSections.map((section) => (
        <SectionCard key={section.title} title={section.title}>
          {section.rows.map((row) => <SettingsRow key={row} label={row} onPress={() => openPlannedSetting(row)} />)}
        </SectionCard>
      ))}

      <SectionCard title="Current behavior">
        <View style={styles.switchRow}>
          <View style={styles.copy}><Text style={styles.rowLabel}>Show active workout bar</Text><Text style={styles.rowDetail}>Always on so an active workout is never hidden</Text></View>
          <Switch value trackColor={{ true: colors.primary }} disabled />
        </View>
        <View style={styles.switchRow}>
          <View style={styles.copy}><Text style={styles.rowLabel}>Automatically open active workout</Text><Text style={styles.rowDetail}>Off; use the Resume bar when ready</Text></View>
          <Switch value={false} disabled />
        </View>
      </SectionCard>
    </ScrollView>
  );
}

function SettingsRow({ label, detail, onPress, disabled = false }: { label: string; detail?: string; onPress?: () => void; disabled?: boolean }) {
  const content = (
    <>
      <View style={styles.copy}>
        <Text style={styles.rowLabel}>{label}</Text>
        {detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}
      </View>
      {onPress ? <Text style={styles.chevron}>›</Text> : null}
    </>
  );
  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${label}`} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.row, disabled && styles.disabled, pressed && styles.pressed]}>
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

function formatRestTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatSavedTime(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' }).format(new Date(timestamp));
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  row: { minHeight: 58, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  switchRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  timerSettingRow: { paddingVertical: spacing.md, gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepButton: { minWidth: 58, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceElevated },
  stepButtonLabel: { color: colors.primary, fontSize: 14, fontWeight: '900' },
  timerValue: { minWidth: 68, color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'center' },
  pressed: { opacity: 0.65 },
  disabled: { opacity: 0.45 },
  copy: { flex: 1, paddingRight: spacing.sm },
  rowLabel: { color: colors.text, fontSize: 16, fontWeight: '700' },
  rowDetail: { color: colors.textMuted, fontSize: 13, marginTop: 3, lineHeight: 18 },
  chevron: { color: colors.textMuted, fontSize: 26 },
});
