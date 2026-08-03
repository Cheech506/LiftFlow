import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { SectionCard } from '@/components/SectionCard';
import { ExerciseDefinition, ExerciseType } from '@/constants/exercises';
import { colors, radius, spacing } from '@/constants/theme';
import {
  CreateExerciseInput,
  CreateTemplateInput,
  useActiveWorkout,
  WorkoutTemplate,
} from '@/context/ActiveWorkoutContext';
import { showPrototypeNotice } from '@/lib/prototypeNotice';

export default function WorkoutsScreen() {
  const router = useRouter();
  const {
    exercises,
    templates,
    createExercise,
    createTemplate,
    startWorkout,
    workout,
  } = useActiveWorkout();
  const [selectedTemplate, setSelectedTemplate] = useState<WorkoutTemplate | null>(null);
  const [createVisible, setCreateVisible] = useState(false);

  const begin = (template: WorkoutTemplate) => {
    if (workout) {
      setSelectedTemplate(null);
      showPrototypeNotice(
        'Workout already in progress',
        `${workout.name} is still active. Resume or discard it before starting another workout.`,
      );
      router.push('/active-workout');
      return;
    }

    startWorkout(template.name, template.id);
    setSelectedTemplate(null);
    router.push('/active-workout');
  };

  const startEmpty = () => {
    if (workout) {
      showPrototypeNotice(
        'Workout already in progress',
        `${workout.name} is still active. Resume or discard it before starting another workout.`,
      );
      router.push('/active-workout');
      return;
    }

    startWorkout(getEmptyWorkoutName());
    router.push('/active-workout');
  };

  const saveExercise = (input: CreateExerciseInput) => {
    const duplicate = exercises.some(
      (exercise) => exercise.name.trim().toLowerCase() === input.name.trim().toLowerCase(),
    );

    if (duplicate) {
      showPrototypeNotice(
        'Exercise already exists',
        'Choose the existing exercise from the list or use a different name.',
      );
      return null;
    }

    return createExercise(input);
  };

  const saveTemplate = (input: CreateTemplateInput) => {
    const duplicate = templates.some(
      (template) =>
        template.name.trim().toLowerCase() === input.name.trim().toLowerCase() &&
        template.folder.trim().toLowerCase() === input.folder.trim().toLowerCase(),
    );

    if (duplicate) {
      showPrototypeNotice(
        'Template already exists',
        'A template with that name already exists in this folder.',
      );
      return false;
    }

    const template = createTemplate(input);
    setCreateVisible(false);
    setSelectedTemplate(template);
    return true;
  };

  const recentTemplates = templates.slice(-2).reverse();
  const folders = Array.from(new Set(templates.map((template) => template.folder)));

  return (
    <>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <PrimaryButton label="Start Empty Workout" onPress={startEmpty} />

        {recentTemplates.length > 0 ? (
          <SectionCard title="Recent">
            {recentTemplates.map((template) => (
              <WorkoutRow
                key={`recent-${template.id}`}
                template={template}
                onPreview={() => setSelectedTemplate(template)}
                onStart={() => begin(template)}
              />
            ))}
          </SectionCard>
        ) : null}

        {folders.map((folder) => (
          <SectionCard key={folder} title={folder}>
            {templates
              .filter((template) => template.folder === folder)
              .map((template) => (
                <WorkoutRow
                  key={template.id}
                  template={template}
                  onPreview={() => setSelectedTemplate(template)}
                  onStart={() => begin(template)}
                />
              ))}
          </SectionCard>
        ))}

        <PrimaryButton
          label="+ New Folder"
          onPress={() =>
            showPrototypeNotice(
              'Folders are created with templates',
              'Tap New Template and type any folder name. LiftFlow will create that folder automatically.',
            )
          }
          variant="secondary"
        />
        <PrimaryButton
          label="+ New Template"
          onPress={() => setCreateVisible(true)}
          variant="secondary"
        />
      </ScrollView>

      <TemplatePreviewModal
        template={selectedTemplate}
        onClose={() => setSelectedTemplate(null)}
        onStart={() => selectedTemplate && begin(selectedTemplate)}
      />

      <CreateTemplateModal
        exercises={exercises}
        visible={createVisible}
        onClose={() => setCreateVisible(false)}
        onCreateExercise={saveExercise}
        onSave={saveTemplate}
      />
    </>
  );
}

function WorkoutRow({
  template,
  onPreview,
  onStart,
}: {
  template: WorkoutTemplate;
  onPreview: () => void;
  onStart: () => void;
}) {
  return (
    <View style={styles.workoutRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Preview ${template.name}`}
        onPress={onPreview}
        style={({ pressed }) => [styles.workoutCopy, pressed && styles.pressed]}
      >
        <Text style={styles.workoutName}>{template.name}</Text>
        <Text style={styles.workoutDetail}>{template.detail}</Text>
        <Text style={styles.previewHint}>Tap for preview</Text>
      </Pressable>
      <PrimaryButton label="Start" onPress={onStart} style={styles.startButton} />
    </View>
  );
}

function TemplatePreviewModal({
  template,
  onClose,
  onStart,
}: {
  template: WorkoutTemplate | null;
  onClose: () => void;
  onStart: () => void;
}) {
  return (
    <Modal transparent visible={Boolean(template)} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          {template ? (
            <>
              <Text style={styles.modalTitle}>{template.name}</Text>
              <Text style={styles.folder}>{template.folder}</Text>
              <Text style={styles.modalDetail}>{template.detail}</Text>

              <ScrollView style={styles.exerciseList}>
                {template.exercises.map((exercise) => (
                  <View key={exercise.id} style={styles.previewExercise}>
                    <Text style={styles.exerciseName}>{exercise.name}</Text>
                    <Text style={styles.workoutDetail}>
                      {exercise.sets.length} planned set{exercise.sets.length === 1 ? '' : 's'}
                    </Text>
                  </View>
                ))}
              </ScrollView>

              <PrimaryButton label="Start Workout" onPress={onStart} />
              <PrimaryButton label="Close" onPress={onClose} variant="secondary" />
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function CreateTemplateModal({
  exercises,
  visible,
  onClose,
  onCreateExercise,
  onSave,
}: {
  exercises: ExerciseDefinition[];
  visible: boolean;
  onClose: () => void;
  onCreateExercise: (input: CreateExerciseInput) => ExerciseDefinition | null;
  onSave: (input: CreateTemplateInput) => boolean;
}) {
  const [name, setName] = useState('');
  const [folder, setFolder] = useState('My Workouts');
  const [query, setQuery] = useState('');
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<string[]>([]);
  const [setCount, setSetCount] = useState(3);
  const [showCreateExercise, setShowCreateExercise] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [newPrimaryMuscle, setNewPrimaryMuscle] = useState('Other');
  const [newEquipment, setNewEquipment] = useState('Other');
  const [newExerciseType, setNewExerciseType] =
    useState<ExerciseType>('Weight & Reps');
  const [newDefaultWeight, setNewDefaultWeight] = useState('');
  const [newDefaultReps, setNewDefaultReps] = useState('8');
  const [createdMessage, setCreatedMessage] = useState<string | null>(null);

  const filteredExercises = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return exercises;
    return exercises.filter(
      (exercise) =>
        exercise.name.toLowerCase().includes(normalized) ||
        exercise.detail.toLowerCase().includes(normalized),
    );
  }, [exercises, query]);

  const resetExerciseDraft = () => {
    setNewExerciseName('');
    setNewPrimaryMuscle('Other');
    setNewEquipment('Other');
    setNewExerciseType('Weight & Reps');
    setNewDefaultWeight('');
    setNewDefaultReps('8');
  };

  const closeAndReset = () => {
    setName('');
    setFolder('My Workouts');
    setQuery('');
    setSelectedExerciseIds([]);
    setSetCount(3);
    setShowCreateExercise(false);
    setCreatedMessage(null);
    resetExerciseDraft();
    onClose();
  };

  const toggleExercise = (exerciseId: string) => {
    setSelectedExerciseIds((current) =>
      current.includes(exerciseId)
        ? current.filter((id) => id !== exerciseId)
        : [...current, exerciseId],
    );
  };

  const submitNewExercise = () => {
    if (!newExerciseName.trim()) {
      showPrototypeNotice('Exercise name required', 'Enter a name for the exercise.');
      return;
    }
    if (!newPrimaryMuscle.trim() || !newEquipment.trim()) {
      showPrototypeNotice(
        'Exercise details required',
        'Enter a primary muscle and equipment type.',
      );
      return;
    }

    const reps = Number(newDefaultReps);
    const weight = newDefaultWeight.trim() ? Number(newDefaultWeight) : undefined;

    if (!Number.isFinite(reps) || reps <= 0) {
      showPrototypeNotice('Invalid reps', 'Default reps must be greater than zero.');
      return;
    }
    if (weight !== undefined && (!Number.isFinite(weight) || weight < 0)) {
      showPrototypeNotice('Invalid weight', 'Default weight must be zero or greater.');
      return;
    }

    const created = onCreateExercise({
      name: newExerciseName,
      primaryMuscle: newPrimaryMuscle,
      equipment: newEquipment,
      exerciseType: newExerciseType,
      defaultWeight: weight,
      defaultReps: reps,
    });

    if (!created) return;

    setSelectedExerciseIds((current) =>
      current.includes(created.id) ? current : [...current, created.id],
    );
    setQuery('');
    setCreatedMessage(`${created.name} was created and added to this template.`);
    setShowCreateExercise(false);
    resetExerciseDraft();
  };

  const submit = () => {
    if (!name.trim()) {
      showPrototypeNotice('Template name required', 'Enter a name for the workout template.');
      return;
    }
    if (!folder.trim()) {
      showPrototypeNotice('Folder required', 'Enter a folder or split name.');
      return;
    }
    if (selectedExerciseIds.length === 0) {
      showPrototypeNotice('Choose exercises', 'Select at least one exercise for the template.');
      return;
    }

    const saved = onSave({
      name,
      folder,
      exerciseIds: selectedExerciseIds,
      setCount,
    });

    if (saved) closeAndReset();
  };

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={closeAndReset}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalBackdrop}
      >
        <View style={[styles.modalCard, styles.createModalCard]}>
          <ScrollView
            contentContainerStyle={styles.createModalContent}
            keyboardShouldPersistTaps="handled"
            style={styles.createModalScroll}
          >
            <Text style={styles.modalTitle}>New Template</Text>
            <Text style={styles.modalDetail}>
              Choose a name, folder, exercises, and the starting number of sets.
            </Text>

            <FormField
              label="Template name"
              value={name}
              onChangeText={setName}
              placeholder="Upper A"
            />
            <FormField
              label="Folder / split"
              value={folder}
              onChangeText={setFolder}
              placeholder="Upper / Lower"
            />

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Sets per exercise</Text>
              <View style={styles.stepper}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setSetCount((current) => Math.max(1, current - 1))}
                  style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}
                >
                  <Text style={styles.stepLabel}>−</Text>
                </Pressable>
                <Text style={styles.stepValue}>{setCount}</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setSetCount((current) => Math.min(10, current + 1))}
                  style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}
                >
                  <Text style={styles.stepLabel}>+</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Exercises · {selectedExerciseIds.length} selected
              </Text>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search exercises..."
                placeholderTextColor={colors.textMuted}
                style={styles.formInput}
              />
            </View>

            <PrimaryButton
              label={showCreateExercise ? 'Hide New Exercise Form' : '+ Create New Exercise'}
              onPress={() => {
                setCreatedMessage(null);
                setShowCreateExercise((current) => !current);
              }}
              variant="secondary"
            />

            {showCreateExercise ? (
              <View style={styles.inlineExerciseForm}>
                <Text style={styles.inlineFormTitle}>Create and add an exercise</Text>
                <Text style={styles.modalDetail}>
                  The new exercise will be saved to My Exercises and selected for this template.
                </Text>

                <FormField
                  label="Exercise name"
                  value={newExerciseName}
                  onChangeText={setNewExerciseName}
                  placeholder="Cable Y Raise"
                />
                <FormField
                  label="Primary muscle"
                  value={newPrimaryMuscle}
                  onChangeText={setNewPrimaryMuscle}
                  placeholder="Shoulders"
                />
                <FormField
                  label="Equipment"
                  value={newEquipment}
                  onChangeText={setNewEquipment}
                  placeholder="Cable"
                />

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Tracking type</Text>
                  <View style={styles.typeChoices}>
                    <TypeChoice
                      label="Weight & Reps"
                      selected={newExerciseType === 'Weight & Reps'}
                      onPress={() => setNewExerciseType('Weight & Reps')}
                    />
                    <TypeChoice
                      label="Bodyweight"
                      selected={newExerciseType === 'Bodyweight'}
                      onPress={() => setNewExerciseType('Bodyweight')}
                    />
                  </View>
                </View>

                {newExerciseType === 'Weight & Reps' ? (
                  <FormField
                    label="Default weight (optional)"
                    value={newDefaultWeight}
                    onChangeText={setNewDefaultWeight}
                    placeholder="25"
                    keyboardType="decimal-pad"
                  />
                ) : null}
                <FormField
                  label="Default reps"
                  value={newDefaultReps}
                  onChangeText={setNewDefaultReps}
                  placeholder="8"
                  keyboardType="number-pad"
                />

                <PrimaryButton label="Save & Add Exercise" onPress={submitNewExercise} />
                <PrimaryButton
                  label="Cancel Exercise"
                  onPress={() => {
                    setShowCreateExercise(false);
                    resetExerciseDraft();
                  }}
                  variant="secondary"
                />
              </View>
            ) : null}

            {createdMessage ? <Text style={styles.successMessage}>{createdMessage}</Text> : null}

            <View style={styles.selectionList}>
              {filteredExercises.map((exercise) => {
                const selected = selectedExerciseIds.includes(exercise.id);
                return (
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    key={exercise.id}
                    onPress={() => toggleExercise(exercise.id)}
                    style={({ pressed }) => [
                      styles.selectionRow,
                      selected && styles.selectionRowSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                      <Text style={styles.checkboxLabel}>{selected ? '✓' : ''}</Text>
                    </View>
                    <View style={styles.workoutCopy}>
                      <Text style={styles.exerciseName}>{exercise.name}</Text>
                      <Text style={styles.workoutDetail}>
                        {exercise.detail}
                        {exercise.isCustom ? ' · Custom' : ''}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <PrimaryButton label="Create Template" onPress={submit} />
            <PrimaryButton label="Cancel" onPress={closeAndReset} variant="secondary" />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function TypeChoice({
  label,
  selected,
  onPress,
}: {
  label: ExerciseType;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.typeChoice,
        selected && styles.typeChoiceSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.typeChoiceLabel, selected && styles.typeChoiceLabelSelected]}>
        {label}
      </Text>
    </Pressable>
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
        style={styles.formInput}
      />
    </View>
  );
}

function getEmptyWorkoutName() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Morning Workout';
  if (hour < 17) return 'Afternoon Workout';
  return 'Evening Workout';
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    paddingBottom: 150,
    gap: spacing.md,
  },
  workoutRow: {
    minHeight: 72,
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
  pressed: {
    opacity: 0.65,
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
  previewHint: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 4,
  },
  startButton: {
    minHeight: 38,
    minWidth: 70,
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
    maxHeight: '88%',
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '900',
  },
  folder: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  modalDetail: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  exerciseList: {
    maxHeight: 280,
  },
  previewExercise: {
    paddingVertical: spacing.sm,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  exerciseName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  createModalCard: {
    maxHeight: '92%',
    padding: 0,
    overflow: 'hidden',
  },
  createModalScroll: {
    width: '100%',
  },
  createModalContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
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
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  stepButton: {
    width: 48,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderWidth: 1,
  },
  stepLabel: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  stepValue: {
    minWidth: 32,
    color: colors.primary,
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
  },
  inlineExerciseForm: {
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderColor: colors.primary,
    borderWidth: 1,
    backgroundColor: colors.surfaceElevated,
  },
  inlineFormTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  typeChoices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  typeChoice: {
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.surface,
  },
  typeChoiceSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  typeChoiceLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  typeChoiceLabelSelected: {
    color: colors.primary,
  },
  successMessage: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  selectionList: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  selectionRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  selectionRowSelected: {
    backgroundColor: colors.surfaceElevated,
  },
  checkbox: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
    borderColor: colors.border,
    borderWidth: 1,
  },
  checkboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxLabel: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '900',
  },
});
