import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { SectionCard } from '@/components/SectionCard';
import { colors, spacing } from '@/constants/theme';
import { useActiveWorkout, WorkoutTemplate } from '@/context/ActiveWorkoutContext';

export default function WorkoutsScreen() {
  const router = useRouter();
  const { templates, startWorkout } = useActiveWorkout();

  const begin = (template: WorkoutTemplate) => {
    startWorkout(template.name, template.id);
    router.push('/active-workout');
  };

  const recentTemplates = templates.slice(0, 2);
  const folders = Array.from(new Set(templates.map((template) => template.folder)));

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <PrimaryButton
        label="Start Empty Workout"
        onPress={() => {
          startWorkout('Afternoon Workout');
          router.push('/active-workout');
        }}
      />

      <SectionCard title="Recent">
        {recentTemplates.map((template) => (
          <WorkoutRow
            key={`recent-${template.id}`}
            name={template.name}
            detail="Tap Start, edit today’s values, then choose whether to update the template when finishing."
            onStart={() => begin(template)}
          />
        ))}
      </SectionCard>

      {folders.map((folder) => (
        <SectionCard key={folder} title={folder}>
          {templates
            .filter((template) => template.folder === folder)
            .map((template) => (
              <WorkoutRow
                key={template.id}
                name={template.name}
                detail={template.detail}
                onStart={() => begin(template)}
              />
            ))}
        </SectionCard>
      ))}

      <PrimaryButton label="+ New Folder" onPress={() => {}} variant="secondary" />
      <PrimaryButton label="+ New Template" onPress={() => {}} variant="secondary" />
    </ScrollView>
  );
}

function WorkoutRow({
  name,
  detail,
  onStart,
}: {
  name: string;
  detail: string;
  onStart: () => void;
}) {
  return (
    <View style={styles.workoutRow}>
      <Pressable style={styles.workoutCopy}>
        <Text style={styles.workoutName}>{name}</Text>
        <Text style={styles.workoutDetail}>{detail}</Text>
      </Pressable>
      <PrimaryButton label="Start" onPress={onStart} style={styles.startButton} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    paddingBottom: 150,
    gap: spacing.md,
  },
  workoutRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  workoutCopy: {
    flex: 1,
    paddingVertical: spacing.sm,
  },
  workoutName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  workoutDetail: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 3,
    lineHeight: 18,
  },
  startButton: {
    minHeight: 38,
    minWidth: 70,
  },
});
