import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { SectionCard } from '@/components/SectionCard';
import { colors, radius, spacing } from '@/constants/theme';

const favorites = [
  ['Bench Press', 'Chest · Barbell'],
  ['Lat Pulldown', 'Back · Cable'],
  ['Leg Press', 'Quadriceps · Machine'],
];

const recent = [
  ['Incline Dumbbell Press', 'Chest · Dumbbell'],
  ['Cable Lateral Raise', 'Shoulders · Cable'],
  ['Triceps Pushdown', 'Triceps · Cable'],
];

export default function ExercisesScreen() {
  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <TextInput
        accessibilityLabel="Search exercises"
        placeholder="Search exercises..."
        placeholderTextColor={colors.textMuted}
        style={styles.search}
      />

      <View style={styles.filters}>
        {['Muscle', 'Equipment', 'Type'].map((filter) => (
          <View key={filter} style={styles.filterChip}>
            <Text style={styles.filterLabel}>{filter}</Text>
          </View>
        ))}
      </View>

      <ExerciseSection title="Favorites" exercises={favorites} favorite />
      <ExerciseSection title="Recently used" exercises={recent} />

      <SectionCard title="All exercises">
        {[...favorites, ...recent, ['Pull-Up', 'Back · Bodyweight']].map(([name, detail]) => (
          <ExerciseRow key={name} name={name} detail={detail} />
        ))}
      </SectionCard>
    </ScrollView>
  );
}

function ExerciseSection({
  title,
  exercises,
  favorite = false,
}: {
  title: string;
  exercises: string[][];
  favorite?: boolean;
}) {
  return (
    <SectionCard title={title}>
      {exercises.map(([name, detail]) => (
        <ExerciseRow key={name} name={name} detail={detail} favorite={favorite} />
      ))}
    </SectionCard>
  );
}

function ExerciseRow({
  name,
  detail,
  favorite = false,
}: {
  name: string;
  detail: string;
  favorite?: boolean;
}) {
  return (
    <View style={styles.exerciseRow}>
      <View style={styles.exerciseCopy}>
        <Text style={styles.exerciseName}>
          {favorite ? '★ ' : ''}
          {name}
        </Text>
        <Text style={styles.exerciseDetail}>{detail}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    paddingBottom: 150,
    gap: spacing.md,
  },
  search: {
    minHeight: 48,
    color: colors.text,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 16,
  },
  filters: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  filterChip: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  filterLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  exerciseRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  exerciseCopy: {
    flex: 1,
  },
  exerciseName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  exerciseDetail: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 3,
  },
  chevron: {
    color: colors.textMuted,
    fontSize: 26,
  },
});
