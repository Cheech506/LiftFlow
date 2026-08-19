import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useState } from 'react';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useRouter } from 'expo-router';

import { SectionCard } from '@/components/SectionCard';
import { colors, spacing } from '@/constants/theme';
import { useActiveWorkout } from '@/context/ActiveWorkoutContext';
import { pickTextFile, shareTextFile } from '@/lib/dataTransfer';
import { buildLiftFlowBackup, buildWorkoutHistoryCsv, exportFileStamp } from '@/lib/exportData';
import { requestRestTimerAlertPermission } from '@/lib/restTimerAlerts';
import {
  buildProgressRecalculationPlan,
  countImportedStrongWorkouts,
} from '@/lib/progressRecalculation';
import {
  buildStrongRollback,
  formatStrongImportDateRange,
  getLastStrongImportFromWorkouts,
  prepareStrongImport,
} from '@/lib/strongImport';
import { parseLiftFlowBackup } from '@/storage/liftflowStorage';

export default function SettingsScreen() {
  const router = useRouter();
  const {
    persistenceStatus,
    lastSavedAt,
    exercises,
    templates,
    workout,
    incompleteWorkouts,
    completedWorkouts,
    deletedWorkouts,
    getStateSnapshot,
    restoreState,
    restTimerSettings,
    updateRestTimerSettings,
    preferences,
    updatePreferences,
  } = useActiveWorkout();
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const lastStrongImport = getLastStrongImportFromWorkouts(completedWorkouts);
  const importedStrongWorkoutCount = countImportedStrongWorkouts(completedWorkouts);
  const appVersion = Constants.expoConfig?.version ?? '0.7.0';
  const nativeBuildNumber = Constants.platform?.ios?.buildNumber
    ?? Constants.platform?.android?.versionCode
    ?? null;
  const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  const buildEnvironment = Platform.OS === 'web'
    ? 'Web development build'
    : isExpoGo
      ? 'Expo Go compatibility session'
      : Constants.executionEnvironment === ExecutionEnvironment.Standalone
        ? 'Installed release build'
        : 'Installed development build';
  const isFreshInstalledApp = Platform.OS !== 'web'
    && !isExpoGo
    && exercises.filter((item) => item.isCustom).length === 0
    && templates.length === 0
    && incompleteWorkouts.length === 0
    && completedWorkouts.length === 0;

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
              incompleteWorkouts: parsed.incompleteWorkouts,
              completedWorkouts: parsed.completedWorkouts,
              deletedWorkouts: parsed.deletedWorkouts,
              restTimerSettings: parsed.restTimerSettings,
              preferences: parsed.preferences,
            })
              .then(() => Alert.alert('Backup restored', 'LiftFlow restored the backup successfully.'))
              .catch((error: unknown) => Alert.alert('Restore failed', error instanceof Error ? error.message : 'The backup could not be restored.'));
          },
        },
      ],
    );
  });


  const importStrongCsv = () => runAction('Strong import', async () => {
    const text = await pickTextFile([
      'text/csv',
      'text/comma-separated-values',
      'application/csv',
      'text/plain',
    ]);
    if (!text) return;

    const snapshot = getStateSnapshot();
    const plan = prepareStrongImport(text, snapshot);
    const preview = plan.preview;
    if (preview.workoutsReady === 0) {
      const reason = preview.duplicateWorkouts > 0
        ? `LiftFlow found ${preview.duplicateWorkouts} workout${preview.duplicateWorkouts === 1 ? '' : 's'}, but all of them already exist in History.`
        : 'LiftFlow could not find any valid workout sets in this file.';
      Alert.alert('Nothing new to import', reason);
      return;
    }

    const warningText = preview.warnings.length > 0
      ? `\n\nNotes:\n${preview.warnings.slice(0, 3).map((warning) => `• ${warning}`).join('\n')}`
      : '';
    const confirmed = await confirmAction(
      'Import Strong workout history?',
      `${preview.workoutsReady} workout${preview.workoutsReady === 1 ? '' : 's'} will be added (${formatStrongImportDateRange(preview)}).\n\n${preview.exercisesMatched} exercises matched your LiftFlow library. ${preview.exercisesToCreate} new exercise${preview.exercisesToCreate === 1 ? '' : 's'} will be created. ${preview.duplicateWorkouts} duplicate workout${preview.duplicateWorkouts === 1 ? '' : 's'} will be skipped.${warningText}\n\nLiftFlow will open a full JSON safety backup before changing your data.`,
      'Import',
    );
    if (!confirmed) return;

    await shareTextFile(
      `LiftFlow-before-Strong-import-${exportFileStamp()}.json`,
      buildLiftFlowBackup(snapshot),
      'application/json',
    );
    await restoreState(plan.nextState);
    Alert.alert(
      'Strong import complete',
      `${preview.workoutsReady} workouts were imported. ${preview.exercisesToCreate} exercises were created, ${preview.duplicateWorkouts} duplicates were skipped, and ${preview.invalidRows} invalid row${preview.invalidRows === 1 ? '' : 's'} were skipped. You can roll this import back from Settings.`,
    );
  });

  const rollbackStrongImport = () => runAction('Strong rollback', async () => {
    const snapshot = getStateSnapshot();
    const plan = buildStrongRollback(snapshot);
    if (!plan) {
      Alert.alert('No Strong import found', 'There is no Strong import available to roll back.');
      return;
    }
    const retainedText = plan.exercisesRetained > 0
      ? ` ${plan.exercisesRetained} imported exercise${plan.exercisesRetained === 1 ? '' : 's'} will remain because they are now used by templates, an active or incomplete workout, or other history.`
      : '';
    const confirmed = await confirmAction(
      'Roll back the last Strong import?',
      `${plan.workoutsRemoved} imported workout${plan.workoutsRemoved === 1 ? '' : 's'} and ${plan.exercisesRemoved} unused imported exercise${plan.exercisesRemoved === 1 ? '' : 's'} will be removed.${retainedText}\n\nLiftFlow will open a full JSON safety backup first.`,
      'Roll Back',
      true,
    );
    if (!confirmed) return;

    await shareTextFile(
      `LiftFlow-before-Strong-rollback-${exportFileStamp()}.json`,
      buildLiftFlowBackup(snapshot),
      'application/json',
    );
    await restoreState(plan.nextState);
    Alert.alert('Strong import rolled back', `${plan.workoutsRemoved} workouts were removed successfully.`);
  });

  const recalculateProgress = () => runAction('Progress recalculation', async () => {
    const plan = buildProgressRecalculationPlan(getStateSnapshot());
    await restoreState(plan.nextState);
    const unmatchedText = plan.unmatchedExerciseNames.length > 0
      ? ` ${plan.unmatchedExerciseNames.length} unmatched exercise name${plan.unmatchedExerciseNames.length === 1 ? '' : 's'} remain visible in History but could not be linked to an exercise page.`
      : '';
    Alert.alert(
      'Progress and PRs rebuilt',
      `LiftFlow scanned ${plan.workoutsScanned} workouts and rebuilt charts for ${plan.exercisesWithHistory} exercises from ${plan.qualifyingSets} qualifying working sets. ${plan.recordEvents} historical record events were verified.${plan.linksRepaired > 0 ? ` ${plan.linksRepaired} missing exercise link${plan.linksRepaired === 1 ? '' : 's'} were repaired.` : ''}${unmatchedText}`,
    );
  });

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
      <SectionCard title="LiftFlow build">
        <SettingsRow
          label={`LiftFlow v${appVersion}`}
          detail={`${buildEnvironment}${nativeBuildNumber === null ? '' : ` · native build ${nativeBuildNumber}`}`}
        />
        {isExpoGo ? (
          <SettingsRow
            label={busyAction === 'Backup export' ? 'Preparing migration backup…' : 'Export before leaving Expo Go'}
            detail="The installed LiftFlow app uses separate storage, so save this JSON backup before moving."
            onPress={exportBackup}
            disabled={Boolean(busyAction)}
          />
        ) : null}
        {isFreshInstalledApp ? (
          <SettingsRow
            label={busyAction === 'Backup restore' ? 'Opening migration backup…' : 'Restore your Expo Go backup'}
            detail="Bring exercises, templates, Strong history, PRs, preferences, and incomplete workouts into this installed app."
            onPress={restoreBackup}
            disabled={Boolean(busyAction)}
          />
        ) : null}
      </SectionCard>

      <SectionCard title="Local data">
        <SettingsRow label={formatPersistenceStatus(persistenceStatus)} detail={lastSavedAt ? `Last saved ${formatSavedTime(lastSavedAt)}` : 'Preparing local storage'} />
        <SettingsRow label={`${exercises.filter((item) => item.isCustom).length} custom exercises`} detail={`${exercises.filter((item) => item.archived).length} archived`} />
        <SettingsRow label={`${templates.length} workout templates`} detail={workout ? `Active workout: ${workout.name}` : 'No active workout'} />
        <SettingsRow label={`${incompleteWorkouts.length} incomplete workouts`} detail="Saved safely until you resume or delete them" />
        <SettingsRow label={`${completedWorkouts.length} completed workouts`} detail="Stored on this device" />
        <SettingsRow label={`${deletedWorkouts.length} recently deleted`} detail="Recoverable from History for 30 days" />
      </SectionCard>

      <SectionCard title="Workout preferences">
        <View style={styles.timerSettingRow}>
          <View style={styles.copy}>
            <Text style={styles.rowLabel}>Weekly workout goal</Text>
            <Text style={styles.rowDetail}>Used by Home and Progress; completed workouts update it automatically</Text>
          </View>
          <View style={styles.stepper}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Decrease weekly workout goal"
              onPress={() => updatePreferences({ weeklyWorkoutGoal: preferences.weeklyWorkoutGoal - 1 })}
              style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}
            >
              <Text style={styles.stepButtonLabel}>−</Text>
            </Pressable>
            <Text style={styles.timerValue}>{preferences.weeklyWorkoutGoal}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Increase weekly workout goal"
              onPress={() => updatePreferences({ weeklyWorkoutGoal: preferences.weeklyWorkoutGoal + 1 })}
              style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}
            >
              <Text style={styles.stepButtonLabel}>+</Text>
            </Pressable>
          </View>
        </View>
        <PreferenceChoice
          label="Weight unit"
          detail="LiftFlow labels values as entered; switching does not convert historical numbers"
          options={['lb', 'kg']}
          value={preferences.weightUnit}
          onChange={(weightUnit) => updatePreferences({ weightUnit })}
        />
        <PreferenceChoice
          label="Distance unit"
          detail="Used for distance and pace labels"
          options={['mi', 'km']}
          value={preferences.distanceUnit}
          onChange={(distanceUnit) => updatePreferences({ distanceUnit })}
        />
        <PreferenceChoice
          label="Default effort"
          detail="Preferred effort scale for new workout entries"
          options={['rpe', 'rir', 'none']}
          value={preferences.preferredEffort}
          onChange={(preferredEffort) => updatePreferences({ preferredEffort })}
        />
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
        <SettingsRow
          label={busyAction === 'Strong import' ? 'Reading Strong export…' : 'Import Strong CSV'}
          detail="Imports workout dates, exercise history, chart data, and calculated PRs"
          onPress={importStrongCsv}
          disabled={Boolean(busyAction)}
        />
        <SettingsRow
          label={busyAction === 'Progress recalculation' ? 'Rebuilding progress…' : 'Recalculate Progress & PRs'}
          detail={`${importedStrongWorkoutCount} Strong workout${importedStrongWorkoutCount === 1 ? '' : 's'} available for all-time exercise records and charts`}
          onPress={recalculateProgress}
          disabled={Boolean(busyAction)}
        />
        {lastStrongImport ? (
          <SettingsRow
            label={busyAction === 'Strong rollback' ? 'Rolling back Strong import…' : 'Roll back last Strong import'}
            detail={`${lastStrongImport.workoutCount} workout${lastStrongImport.workoutCount === 1 ? '' : 's'} imported ${formatImportTime(lastStrongImport.importedAt)}`}
            onPress={rollbackStrongImport}
            disabled={Boolean(busyAction)}
          />
        ) : null}
      </SectionCard>

      <SectionCard title="Manage local data">
        <SettingsRow label="Archived workout templates" detail="Restore or permanently delete archived templates" onPress={() => router.push('/workouts')} />
        <SettingsRow label="Archived custom exercises" detail="Restore exercises or safely delete unused definitions" onPress={() => router.push('/exercises')} />
        <SettingsRow label="Recently Deleted workouts" detail={`${deletedWorkouts.length} workout${deletedWorkouts.length === 1 ? '' : 's'} recoverable for 30 days`} onPress={() => router.push('/history')} />
      </SectionCard>

      <SectionCard title="About LiftFlow">
        <SettingsRow label="Local-first by design" detail="Your workout data stays on this device unless you export or share it." />
        <SettingsRow label="Active workout protection" detail="Only one workout can run at a time, and the Resume bar keeps it visible." />
        <SettingsRow label="Self-hosted sync" detail="The next phase connects this installed app to the private Docker and PostgreSQL server." />
      </SectionCard>
    </ScrollView>
  );
}

function PreferenceChoice<T extends string>({ label, detail, options, value, onChange }: {
  label: string;
  detail: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.preferenceRow}>
      <View style={styles.copy}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowDetail}>{detail}</Text>
      </View>
      <View style={styles.choiceRow}>
        {options.map((option) => (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected: option === value }}
            onPress={() => onChange(option)}
            style={[styles.choiceButton, option === value && styles.choiceButtonActive]}
          >
            <Text style={[styles.choiceLabel, option === value && styles.choiceLabelActive]}>{option.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>
    </View>
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


function confirmAction(title: string, message: string, confirmLabel: string, destructive = false) {
  return new Promise<boolean>((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      {
        text: confirmLabel,
        style: destructive ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

function formatImportTime(timestamp: number) {
  if (!timestamp) return 'previously';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp));
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
  preferenceRow: { paddingVertical: spacing.md, gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  choiceButton: { minHeight: 36, minWidth: 58, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceElevated, paddingHorizontal: spacing.sm },
  choiceButtonActive: { borderColor: colors.primary, backgroundColor: 'rgba(100, 217, 139, 0.12)' },
  choiceLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '900' },
  choiceLabelActive: { color: colors.primary },
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
