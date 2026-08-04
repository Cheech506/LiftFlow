import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  KeyboardAwareModal,
  NUMERIC_KEYBOARD_ACCESSORY_ID,
} from '@/components/KeyboardAwareModal';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SectionCard } from '@/components/SectionCard';
import { ExerciseDefinition, ExerciseType } from '@/constants/exercises';
import { colors, radius, spacing } from '@/constants/theme';
import { CreateExerciseInput, useActiveWorkout } from '@/context/ActiveWorkoutContext';
import { showPrototypeNotice } from '@/lib/prototypeNotice';

const muscleOptions = ['All', 'Chest', 'Back', 'Shoulders', 'Quadriceps', 'Hamstrings'];
const equipmentOptions = ['All', 'Barbell', 'Dumbbell', 'Cable', 'Machine', 'Bodyweight'];
const typeOptions: Array<'All' | ExerciseType> = ['All', 'Weight & Reps', 'Bodyweight'];

export default function ExercisesScreen() {
  const { exercises, workout, addExercise, createExercise } = useActiveWorkout();
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState('All');
  const [equipment, setEquipment] = useState('All');
  const [exerciseType, setExerciseType] = useState<'All' | ExerciseType>('All');
  const [selectedExercise, setSelectedExercise] = useState<ExerciseDefinition | null>(null);
  const [createVisible, setCreateVisible] = useState(false);

  const filteredExercises = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return exercises.filter((exercise) => {
      const matchesSearch =
        !normalizedQuery ||
        exercise.name.toLowerCase().includes(normalizedQuery) ||
        exercise.detail.toLowerCase().includes(normalizedQuery);
      const matchesMuscle = muscle === 'All' || exercise.primaryMuscle === muscle;
      const matchesEquipment = equipment === 'All' || exercise.equipment === equipment;
      const matchesType = exerciseType === 'All' || exercise.exerciseType === exerciseType;

      return matchesSearch && matchesMuscle && matchesEquipment && matchesType;
    });
  }, [equipment, exerciseType, exercises, muscle, query]);

  const favorites = filteredExercises.filter((exercise) => exercise.favorite);
  const recent = filteredExercises.filter((exercise) => exercise.recent);
  const customExercises = filteredExercises.filter((exercise) => exercise.isCustom);

  const addToWorkout = (exercise: ExerciseDefinition) => {
    if (!workout) {
      showPrototypeNotice(
        'No active workout',
        'Start or resume a workout first, then return here to add this exercise.',
      );
      return;
    }

    if (workout.exercises.some((item) => item.name === exercise.name)) {
      showPrototypeNotice('Already added', `${exercise.name} is already in this workout.`);
      return;
    }

    addExercise(exercise.id);
    setSelectedExercise(null);
    showPrototypeNotice('Exercise added', `${exercise.name} was added to ${workout.name}.`);
  };

  const saveExercise = (input: CreateExerciseInput) => {
    const duplicate = exercises.some(
      (exercise) => exercise.name.trim().toLowerCase() === input.name.trim().toLowerCase(),
    );

    if (duplicate) {
      showPrototypeNotice(
        'Exercise already exists',
        'Use the existing exercise or choose a different name.',
      );
      return false;
    }

    const created = createExercise(input);
    setCreateVisible(false);
    setQuery('');
    setSelectedExercise(created);
    return true;
  };

  return (
    <>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <PrimaryButton label="+ Create Exercise" onPress={() => setCreateVisible(true)} />

        <TextInput
          accessibilityLabel="Search exercises"
          placeholder="Search exercises..."
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          style={styles.search}
        />

        <View style={styles.filters}>
          <FilterChip
            label={muscle === 'All' ? 'Muscle' : muscle}
            active={muscle !== 'All'}
            onPress={() => setMuscle(nextOption(muscleOptions, muscle))}
          />
          <FilterChip
            label={equipment === 'All' ? 'Equipment' : equipment}
            active={equipment !== 'All'}
            onPress={() => setEquipment(nextOption(equipmentOptions, equipment))}
          />
          <FilterChip
            label={exerciseType === 'All' ? 'Type' : exerciseType}
            active={exerciseType !== 'All'}
            onPress={() => setExerciseType(nextOption(typeOptions, exerciseType))}
          />
        </View>

        {customExercises.length > 0 ? (
          <ExerciseSection
            title="My Exercises"
            exercises={customExercises}
            onSelect={setSelectedExercise}
          />
        ) : null}

        {favorites.length > 0 ? (
          <ExerciseSection
            title="Favorites"
            exercises={favorites}
            onSelect={setSelectedExercise}
          />
        ) : null}

        {recent.length > 0 ? (
          <ExerciseSection
            title="Recently used"
            exercises={recent}
            onSelect={setSelectedExercise}
          />
        ) : null}

        <SectionCard title={`All exercises · ${filteredExercises.length}`}>
          {filteredExercises.length > 0 ? (
            filteredExercises.map((exercise) => (
              <ExerciseRow
                key={exercise.id}
                exercise={exercise}
                onPress={() => setSelectedExercise(exercise)}
              />
            ))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No exercises found</Text>
              <Text style={styles.exerciseDetail}>
                Try another search or clear the active filters.
              </Text>
              <PrimaryButton
                label="Clear Filters"
                variant="secondary"
                onPress={() => {
                  setQuery('');
                  setMuscle('All');
                  setEquipment('All');
                  setExerciseType('All');
                }}
              />
            </View>
          )}
        </SectionCard>
      </ScrollView>

      <ExerciseDetailModal
        exercise={selectedExercise}
        hasActiveWorkout={Boolean(workout)}
        onClose={() => setSelectedExercise(null)}
        onAdd={() => selectedExercise && addToWorkout(selectedExercise)}
      />

      <CreateExerciseModal
        visible={createVisible}
        onClose={() => setCreateVisible(false)}
        onSave={saveExercise}
      />
    </>
  );
}

function ExerciseSection({
  title,
  exercises,
  onSelect,
}: {
  title: string;
  exercises: ExerciseDefinition[];
  onSelect: (exercise: ExerciseDefinition) => void;
}) {
  return (
    <SectionCard title={title}>
      {exercises.map((exercise) => (
        <ExerciseRow
          key={`${title}-${exercise.id}`}
          exercise={exercise}
          onPress={() => onSelect(exercise)}
        />
      ))}
    </SectionCard>
  );
}

function ExerciseRow({
  exercise,
  onPress,
}: {
  exercise: ExerciseDefinition;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${exercise.name}`}
      onPress={onPress}
      style={({ pressed }) => [styles.exerciseRow, pressed && styles.rowPressed]}
    >
      <View style={styles.exerciseCopy}>
        <Text style={styles.exerciseName}>
          {exercise.favorite ? '★ ' : ''}
          {exercise.name}
        </Text>
        <Text style={styles.exerciseDetail}>
          {exercise.detail}
          {exercise.isCustom ? ' · Custom' : ''}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterChip,
        active && styles.filterChipActive,
        pressed && styles.rowPressed,
      ]}
    >
      <Text style={[styles.filterLabel, active && styles.filterLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function ExerciseDetailModal({
  exercise,
  hasActiveWorkout,
  onClose,
  onAdd,
}: {
  exercise: ExerciseDefinition | null;
  hasActiveWorkout: boolean;
  onClose: () => void;
  onAdd: () => void;
}) {
  return (
    <Modal transparent visible={Boolean(exercise)} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          {exercise ? (
            <>
              <Text style={styles.modalTitle}>{exercise.name}</Text>
              <Text style={styles.modalSubtitle}>{exercise.detail}</Text>
              <View style={styles.detailGrid}>
                <Detail label="Primary muscle" value={exercise.primaryMuscle} />
                <Detail label="Equipment" value={exercise.equipment} />
                <Detail label="Tracking" value={exercise.exerciseType} />
              </View>
              <PrimaryButton
                label={hasActiveWorkout ? 'Add to Active Workout' : 'Start a Workout First'}
                onPress={onAdd}
              />
              <PrimaryButton label="Close" onPress={onClose} variant="secondary" />
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function CreateExerciseModal({
  visible,
  onClose,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (input: CreateExerciseInput) => boolean;
}) {
  const [name, setName] = useState('');
  const [primaryMuscle, setPrimaryMuscle] = useState('Other');
  const [equipment, setEquipment] = useState('Other');
  const [exerciseType, setExerciseType] = useState<ExerciseType>('Weight & Reps');
  const [defaultWeight, setDefaultWeight] = useState('');
  const [defaultReps, setDefaultReps] = useState('8');

  const closeAndReset = () => {
    setName('');
    setPrimaryMuscle('Other');
    setEquipment('Other');
    setExerciseType('Weight & Reps');
    setDefaultWeight('');
    setDefaultReps('8');
    onClose();
  };

  const submit = () => {
    if (!name.trim()) {
      showPrototypeNotice('Exercise name required', 'Enter a name for the exercise.');
      return;
    }
    if (!primaryMuscle.trim() || !equipment.trim()) {
      showPrototypeNotice('Exercise details required', 'Enter a muscle group and equipment.');
      return;
    }

    const reps = Number(defaultReps);
    const weight = defaultWeight.trim() ? Number(defaultWeight) : undefined;

    if (!Number.isFinite(reps) || reps <= 0) {
      showPrototypeNotice('Invalid reps', 'Default reps must be a number greater than zero.');
      return;
    }
    if (weight !== undefined && (!Number.isFinite(weight) || weight < 0)) {
      showPrototypeNotice('Invalid weight', 'Default weight must be zero or greater.');
      return;
    }

    const saved = onSave({
      name,
      primaryMuscle,
      equipment,
      exerciseType,
      defaultWeight: weight,
      defaultReps: reps,
    });

    if (saved) closeAndReset();
  };

  return (
    <KeyboardAwareModal
      visible={visible}
      onClose={closeAndReset}
      cardStyle={styles.formModalCard}
    >
      <Text style={styles.modalTitle}>Create Exercise</Text>
      <Text style={styles.formHelp}>
        Add your own movement and use it in workouts and templates immediately.
      </Text>

      <FormField
        label="Exercise name"
        value={name}
        onChangeText={setName}
        placeholder="Cable Y Raise"
      />
      <FormField
        label="Primary muscle"
        value={primaryMuscle}
        onChangeText={setPrimaryMuscle}
        placeholder="Shoulders"
      />
      <FormField
        label="Equipment"
        value={equipment}
        onChangeText={setEquipment}
        placeholder="Cable"
      />

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Tracking type</Text>
        <View style={styles.filters}>
          <FilterChip
            label="Weight & Reps"
            active={exerciseType === 'Weight & Reps'}
            onPress={() => setExerciseType('Weight & Reps')}
          />
          <FilterChip
            label="Bodyweight"
            active={exerciseType === 'Bodyweight'}
            onPress={() => setExerciseType('Bodyweight')}
          />
        </View>
      </View>

      {exerciseType === 'Weight & Reps' ? (
        <FormField
          label="Default weight (optional)"
          value={defaultWeight}
          onChangeText={setDefaultWeight}
          placeholder="25"
          keyboardType="decimal-pad"
        />
      ) : null}
      <FormField
        label="Default reps"
        value={defaultReps}
        onChangeText={setDefaultReps}
        placeholder="8"
        keyboardType="number-pad"
      />

      <PrimaryButton label="Create Exercise" onPress={submit} />
      <PrimaryButton label="Cancel" onPress={closeAndReset} variant="secondary" />
    </KeyboardAwareModal>
  );
}

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'decimal-pad' | 'number-pad';
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType}
        inputAccessoryViewID={
          keyboardType === 'decimal-pad' || keyboardType === 'number-pad'
            ? NUMERIC_KEYBOARD_ACCESSORY_ID
            : undefined
        }
        returnKeyType={keyboardType === 'default' ? 'next' : 'done'}
        style={styles.formInput}
      />
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailItem}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function nextOption<T extends string>(options: readonly T[], current: T): T {
  const currentIndex = options.indexOf(current);
  return options[(currentIndex + 1) % options.length];
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
    flexWrap: 'wrap',
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
  filterChipActive: {
    borderColor: colors.primary,
  },
  filterLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  filterLabelActive: {
    color: colors.primary,
  },
  exerciseRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowPressed: {
    opacity: 0.65,
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
    lineHeight: 19,
  },
  chevron: {
    color: colors.textMuted,
    fontSize: 26,
  },
  emptyState: {
    gap: spacing.sm,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    padding: spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '92%',
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  formModalCard: {
    maxWidth: 480,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 25,
    fontWeight: '900',
  },
  modalSubtitle: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '800',
  },
  formHelp: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  formInput: {
    minHeight: 48,
    color: colors.text,
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 16,
  },
  detailGrid: {
    gap: spacing.sm,
  },
  detailItem: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  detailLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  detailValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 3,
  },
});
