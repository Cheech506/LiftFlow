import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
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
import {
  CreateExerciseInput,
  CreateTemplateInput,
  UpdateTemplateInput,
  useActiveWorkout,
  WorkoutExercise,
  WorkoutFolder,
  WorkoutSet,
  WorkoutTemplate,
} from '@/context/ActiveWorkoutContext';
import {
  EXERCISE_TYPE_OPTIONS,
  exerciseTypeUsesDistance,
  exerciseTypeUsesDuration,
  exerciseTypeUsesReps,
  exerciseTypeUsesWeight,
  formatSetMetrics,
  getMetricSlots,
  type WorkoutMetricField,
} from '@/lib/exerciseTracking';
import { showPrototypeNotice } from '@/lib/prototypeNotice';

export default function WorkoutsScreen() {
  const router = useRouter();
  const {
    exercises,
    folders,
    templates,
    createExercise,
    createFolder,
    renameFolder,
    deleteFolder,
    moveFolder,
    createTemplate,
    updateTemplate,
    duplicateTemplate,
    moveTemplate,
    moveTemplateToFolder,
    setTemplateArchived,
    deleteTemplate,
    startWorkout,
    workout,
    restTimerSettings,
  } = useActiveWorkout();
  const [selectedTemplate, setSelectedTemplate] = useState<WorkoutTemplate | null>(null);
  const [createVisible, setCreateVisible] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WorkoutTemplate | null>(null);
  const [templateActions, setTemplateActions] = useState<WorkoutTemplate | null>(null);
  const [folderActions, setFolderActions] = useState<WorkoutFolder | null>(null);
  const [folderEditor, setFolderEditor] = useState<WorkoutFolder | 'new' | null>(null);
  const [moveTarget, setMoveTarget] = useState<WorkoutTemplate | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const availableExercises = useMemo(
    () => exercises.filter((exercise) => !exercise.archived),
    [exercises],
  );
  const activeTemplates = useMemo(
    () => templates.filter((template) => !template.archived),
    [templates],
  );
  const archivedTemplates = useMemo(
    () => templates.filter((template) => template.archived),
    [templates],
  );

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
        !template.archived &&
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
    setSelectedTemplate(null);
    setEditingTemplate(template);
    return true;
  };

  const saveUpdatedTemplate = (input: UpdateTemplateInput) => {
    const duplicate = templates.some(
      (template) =>
        template.id !== input.id &&
        !template.archived &&
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

    const updated = updateTemplate(input);
    if (!updated) {
      showPrototypeNotice(
        'Template could not be saved',
        'Keep at least one exercise and give the template a name.',
      );
      return false;
    }

    setEditingTemplate(null);
    setSelectedTemplate(updated);
    return true;
  };

  const editTemplate = (template: WorkoutTemplate) => {
    setTemplateActions(null);
    setSelectedTemplate(null);
    setEditingTemplate(template);
  };

  const removeTemplate = (template: WorkoutTemplate) => {
    confirmAction(
      `Delete ${template.name}?`,
      'This permanently removes only the saved template. Exercises and completed workout history stay untouched.',
      'Delete Template',
      () => {
        const deleted = deleteTemplate(template.id);
        if (!deleted) {
          showPrototypeNotice('Template was not deleted', 'LiftFlow could not find that template.');
          return;
        }
        if (selectedTemplate?.id === template.id) setSelectedTemplate(null);
        if (editingTemplate?.id === template.id) setEditingTemplate(null);
        setTemplateActions(null);
      },
    );
  };

  const duplicate = (template: WorkoutTemplate) => {
    const copy = duplicateTemplate(template.id);
    setTemplateActions(null);
    if (!copy) {
      showPrototypeNotice('Template was not duplicated', 'LiftFlow could not find that template.');
      return;
    }
    setSelectedTemplate(copy);
  };

  const archive = (template: WorkoutTemplate) => {
    setTemplateArchived(template.id, true);
    setTemplateActions(null);
    setSelectedTemplate(null);
  };

  const restore = (template: WorkoutTemplate) => {
    setTemplateArchived(template.id, false);
  };

  const saveFolder = (name: string) => {
    if (folderEditor === 'new') {
      const created = createFolder(name);
      if (!created) {
        showPrototypeNotice('Folder could not be created', 'Use a unique folder name.');
        return false;
      }
      setFolderEditor(null);
      return true;
    }
    if (!folderEditor) return false;
    const renamed = renameFolder(folderEditor.id, name);
    if (!renamed) {
      showPrototypeNotice('Folder could not be renamed', 'Use a unique folder name.');
      return false;
    }
    setFolderEditor(null);
    setFolderActions(null);
    return true;
  };

  const removeFolder = (folder: WorkoutFolder) => {
    confirmAction(
      `Delete ${folder.name}?`,
      'Only empty folders can be deleted. Move, archive, or delete its templates first.',
      'Delete Folder',
      () => {
        if (!deleteFolder(folder.id)) {
          showPrototypeNotice('Folder is not empty', 'Move, archive, or delete every template in this folder first.');
          return;
        }
        setFolderActions(null);
      },
    );
  };

  const recentTemplates = activeTemplates.slice(-2).reverse();

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
                onManage={() => setTemplateActions(template)}
                onStart={() => begin(template)}
              />
            ))}
          </SectionCard>
        ) : null}

        {folders.map((folder) => {
          const folderTemplates = activeTemplates.filter((template) => template.folder === folder.name);
          return (
            <SectionCard
              key={folder.id}
              title={folder.name}
              headerRight={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Manage ${folder.name} folder`}
                  onPress={() => setFolderActions(folder)}
                  hitSlop={8}
                  style={({ pressed }) => [styles.folderManageButton, pressed && styles.pressed]}
                >
                  <Text style={styles.folderManageLabel}>•••</Text>
                </Pressable>
              }
            >
              {folderTemplates.length > 0 ? folderTemplates.map((template) => (
                <WorkoutRow
                  key={template.id}
                  template={template}
                  onPreview={() => setSelectedTemplate(template)}
                  onManage={() => setTemplateActions(template)}
                  onStart={() => begin(template)}
                />
              )) : <Text style={styles.emptyFolderText}>No templates in this folder yet.</Text>}
            </SectionCard>
          );
        })}

        <PrimaryButton label="+ New Folder" onPress={() => setFolderEditor('new')} variant="secondary" />
        <PrimaryButton label="+ New Template" onPress={() => setCreateVisible(true)} variant="secondary" />

        {archivedTemplates.length > 0 ? (
          <SectionCard title={`Archived Templates · ${archivedTemplates.length}`}>
            <PrimaryButton
              label={showArchived ? 'Hide Archived Templates' : 'Show Archived Templates'}
              onPress={() => setShowArchived((current) => !current)}
              variant="secondary"
            />
            {showArchived ? archivedTemplates.map((template) => (
              <View key={template.id} style={styles.archivedRow}>
                <View style={styles.workoutCopy}>
                  <Text style={styles.workoutName}>{template.name}</Text>
                  <Text style={styles.workoutDetail}>{template.folder} · {template.detail}</Text>
                </View>
                <Pressable onPress={() => restore(template)} style={styles.compactActionButton}>
                  <Text style={styles.compactActionLabel}>Restore</Text>
                </Pressable>
                <Pressable onPress={() => removeTemplate(template)} style={[styles.compactActionButton, styles.compactDangerButton]}>
                  <Text style={styles.compactDangerLabel}>Delete</Text>
                </Pressable>
              </View>
            )) : null}
          </SectionCard>
        ) : null}
      </ScrollView>

      <TemplatePreviewModal
        template={selectedTemplate}
        onClose={() => setSelectedTemplate(null)}
        onStart={() => selectedTemplate && begin(selectedTemplate)}
        onEdit={() => selectedTemplate && editTemplate(selectedTemplate)}
        onDelete={() => selectedTemplate && removeTemplate(selectedTemplate)}
      />

      <TemplateActionsModal
        template={templateActions}
        onClose={() => setTemplateActions(null)}
        onPreview={() => {
          if (!templateActions) return;
          setSelectedTemplate(templateActions);
          setTemplateActions(null);
        }}
        onEdit={() => templateActions && editTemplate(templateActions)}
        onDuplicate={() => templateActions && duplicate(templateActions)}
        onMove={() => {
          if (!templateActions) return;
          setMoveTarget(templateActions);
          setTemplateActions(null);
        }}
        onMoveUp={() => {
          if (!templateActions) return;
          moveTemplate(templateActions.id, 'up');
          setTemplateActions(null);
        }}
        onMoveDown={() => {
          if (!templateActions) return;
          moveTemplate(templateActions.id, 'down');
          setTemplateActions(null);
        }}
        onArchive={() => templateActions && archive(templateActions)}
        onDelete={() => templateActions && removeTemplate(templateActions)}
      />

      <FolderActionsModal
        folder={folderActions}
        onClose={() => setFolderActions(null)}
        onRename={() => folderActions && setFolderEditor(folderActions)}
        onMoveUp={() => {
          if (!folderActions) return;
          moveFolder(folderActions.id, 'up');
          setFolderActions(null);
        }}
        onMoveDown={() => {
          if (!folderActions) return;
          moveFolder(folderActions.id, 'down');
          setFolderActions(null);
        }}
        onDelete={() => folderActions && removeFolder(folderActions)}
      />

      <FolderNameModal
        mode={folderEditor === 'new' ? 'create' : 'rename'}
        folder={folderEditor === 'new' ? null : folderEditor}
        visible={Boolean(folderEditor)}
        onClose={() => setFolderEditor(null)}
        onSave={saveFolder}
      />

      <MoveTemplateModal
        template={moveTarget}
        folders={folders}
        onClose={() => setMoveTarget(null)}
        onMove={(folderName) => {
          if (!moveTarget) return;
          moveTemplateToFolder(moveTarget.id, folderName);
          setMoveTarget(null);
        }}
      />

      <CreateTemplateModal
        exercises={availableExercises}
        visible={createVisible}
        onClose={() => setCreateVisible(false)}
        onCreateExercise={saveExercise}
        onSave={saveTemplate}
      />

      <TemplateEditorModal
        exercises={availableExercises}
        template={editingTemplate}
        globalDefaultRestSeconds={restTimerSettings.defaultSeconds}
        onClose={() => setEditingTemplate(null)}
        onSave={saveUpdatedTemplate}
      />
    </>
  );
}

function WorkoutRow({
  template,
  onPreview,
  onManage,
  onStart,
}: {
  template: WorkoutTemplate;
  onPreview: () => void;
  onManage: () => void;
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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Manage ${template.name}`}
        onPress={onManage}
        hitSlop={8}
        style={({ pressed }) => [styles.manageButton, pressed && styles.pressed]}
      >
        <Text style={styles.manageButtonLabel}>•••</Text>
      </Pressable>
      <PrimaryButton label="Start" onPress={onStart} style={styles.startButton} />
    </View>
  );
}

function TemplatePreviewModal({
  template,
  onClose,
  onStart,
  onEdit,
  onDelete,
}: {
  template: WorkoutTemplate | null;
  onClose: () => void;
  onStart: () => void;
  onEdit: () => void;
  onDelete: () => void;
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
                    {exercise.sets.map((set, index) => (
                      <Text key={set.id} style={styles.previewSetText}>
                        {getSetDisplayName(exercise.sets, index)}: {formatTemplateSet(set, exercise.exerciseType)}
                      </Text>
                    ))}
                  </View>
                ))}
              </ScrollView>
              <PrimaryButton label="Edit Template" onPress={onEdit} variant="secondary" />
              <PrimaryButton label="Start Workout" onPress={onStart} />
              <PrimaryButton label="Delete Template" onPress={onDelete} variant="danger" />
              <PrimaryButton label="Close" onPress={onClose} variant="secondary" />
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function TemplateActionsModal({
  template,
  onClose,
  onPreview,
  onEdit,
  onDuplicate,
  onMove,
  onMoveUp,
  onMoveDown,
  onArchive,
  onDelete,
}: {
  template: WorkoutTemplate | null;
  onClose: () => void;
  onPreview: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onMove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  return (
    <Modal transparent visible={Boolean(template)} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.actionsCard} onPress={(event) => event.stopPropagation()}>
          {template ? (
            <>
              <Text style={styles.actionsTitle}>{template.name}</Text>
              <Text style={styles.actionsSubtitle}>{template.folder}</Text>
              <PrimaryButton label="Preview Template" onPress={onPreview} variant="secondary" />
              <PrimaryButton label="Edit Template" onPress={onEdit} />
              <PrimaryButton label="Duplicate Template" onPress={onDuplicate} variant="secondary" />
              <PrimaryButton label="Move to Folder" onPress={onMove} variant="secondary" />
              <View style={styles.twoButtonRow}>
                <PrimaryButton label="Move Up" onPress={onMoveUp} variant="secondary" style={styles.halfButton} />
                <PrimaryButton label="Move Down" onPress={onMoveDown} variant="secondary" style={styles.halfButton} />
              </View>
              <PrimaryButton label="Archive Template" onPress={onArchive} variant="secondary" />
              <PrimaryButton label="Delete Template" onPress={onDelete} variant="danger" />
              <PrimaryButton label="Cancel" onPress={onClose} variant="secondary" />
            </>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function FolderActionsModal({ folder, onClose, onRename, onMoveUp, onMoveDown, onDelete }: {
  folder: WorkoutFolder | null;
  onClose: () => void;
  onRename: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}) {
  return (
    <Modal transparent visible={Boolean(folder)} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.actionsCard} onPress={(event) => event.stopPropagation()}>
          {folder ? (
            <>
              <Text style={styles.actionsTitle}>{folder.name}</Text>
              <Text style={styles.actionsSubtitle}>Folder controls</Text>
              <PrimaryButton label="Rename Folder" onPress={onRename} />
              <View style={styles.twoButtonRow}>
                <PrimaryButton label="Move Up" onPress={onMoveUp} variant="secondary" style={styles.halfButton} />
                <PrimaryButton label="Move Down" onPress={onMoveDown} variant="secondary" style={styles.halfButton} />
              </View>
              <PrimaryButton label="Delete Empty Folder" onPress={onDelete} variant="danger" />
              <PrimaryButton label="Cancel" onPress={onClose} variant="secondary" />
            </>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function FolderNameModal({ mode, folder, visible, onClose, onSave }: {
  mode: 'create' | 'rename';
  folder: WorkoutFolder | null;
  visible: boolean;
  onClose: () => void;
  onSave: (name: string) => boolean;
}) {
  const [name, setName] = useState('');
  const value = visible && mode === 'rename' && !name ? folder?.name ?? '' : name;
  const close = () => { setName(''); onClose(); };
  return (
    <KeyboardAwareModal visible={visible} onClose={close} cardStyle={styles.smallModalCard}>
      <Text style={styles.modalTitle}>{mode === 'create' ? 'New Folder' : 'Rename Folder'}</Text>
      <Text style={styles.modalDetail}>Folders organize templates without changing workout history.</Text>
      <TextInput
        value={value}
        onChangeText={setName}
        placeholder="Upper / Lower"
        placeholderTextColor={colors.textMuted}
        autoFocus
        style={styles.formInput}
      />
      <PrimaryButton label={mode === 'create' ? 'Create Folder' : 'Save Folder Name'} onPress={() => { if (onSave(value)) setName(''); }} />
      <PrimaryButton label="Cancel" onPress={close} variant="secondary" />
    </KeyboardAwareModal>
  );
}

function MoveTemplateModal({ template, folders, onClose, onMove }: {
  template: WorkoutTemplate | null;
  folders: WorkoutFolder[];
  onClose: () => void;
  onMove: (folderName: string) => void;
}) {
  return (
    <Modal transparent visible={Boolean(template)} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.actionsCard} onPress={(event) => event.stopPropagation()}>
          {template ? (
            <>
              <Text style={styles.actionsTitle}>Move {template.name}</Text>
              <Text style={styles.actionsSubtitle}>Current folder: {template.folder}</Text>
              <ScrollView style={styles.folderChoiceList}>
                {folders.map((folder) => (
                  <Pressable
                    key={folder.id}
                    disabled={folder.name === template.folder}
                    onPress={() => onMove(folder.name)}
                    style={({ pressed }) => [
                      styles.folderChoice,
                      folder.name === template.folder && styles.folderChoiceSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.folderChoiceLabel, folder.name === template.folder && styles.folderChoiceLabelSelected]}>
                      {folder.name}{folder.name === template.folder ? ' · Current' : ''}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              <PrimaryButton label="Cancel" onPress={onClose} variant="secondary" />
            </>
          ) : null}
        </Pressable>
      </Pressable>
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
  const [newDefaultDurationSeconds, setNewDefaultDurationSeconds] = useState('60');
  const [newDefaultDistance, setNewDefaultDistance] = useState('');
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
    setNewDefaultDurationSeconds('60');
    setNewDefaultDistance('');
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

    const reps = newDefaultReps.trim() ? Number(newDefaultReps) : undefined;
    const weight = newDefaultWeight.trim() ? Number(newDefaultWeight) : undefined;
    const durationSeconds = newDefaultDurationSeconds.trim()
      ? Number(newDefaultDurationSeconds)
      : undefined;
    const distance = newDefaultDistance.trim() ? Number(newDefaultDistance) : undefined;

    if (exerciseTypeUsesReps(newExerciseType) && (!Number.isFinite(reps) || (reps ?? 0) <= 0)) {
      showPrototypeNotice('Invalid reps', 'Default reps must be greater than zero.');
      return;
    }
    if (
      exerciseTypeUsesWeight(newExerciseType) &&
      weight !== undefined &&
      (!Number.isFinite(weight) || weight < 0)
    ) {
      showPrototypeNotice('Invalid weight', 'Default weight must be zero or greater.');
      return;
    }
    if (
      exerciseTypeUsesDuration(newExerciseType) &&
      (!Number.isFinite(durationSeconds) || (durationSeconds ?? 0) <= 0)
    ) {
      showPrototypeNotice('Invalid duration', 'Default duration must be greater than zero seconds.');
      return;
    }
    if (
      exerciseTypeUsesDistance(newExerciseType) &&
      distance !== undefined &&
      (!Number.isFinite(distance) || distance < 0)
    ) {
      showPrototypeNotice('Invalid distance', 'Default distance must be zero or greater.');
      return;
    }

    const created = onCreateExercise({
      name: newExerciseName,
      primaryMuscle: newPrimaryMuscle,
      equipment: newEquipment,
      exerciseType: newExerciseType,
      defaultWeight: exerciseTypeUsesWeight(newExerciseType) ? weight : undefined,
      defaultReps: exerciseTypeUsesReps(newExerciseType) ? reps : undefined,
      defaultDurationSeconds: exerciseTypeUsesDuration(newExerciseType)
        ? durationSeconds
        : undefined,
      defaultDistance: exerciseTypeUsesDistance(newExerciseType) ? distance : undefined,
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
    <KeyboardAwareModal
      visible={visible}
      onClose={closeAndReset}
      cardStyle={styles.createModalCard}
      contentContainerStyle={styles.createModalContent}
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
              {EXERCISE_TYPE_OPTIONS.map((option) => (
                <TypeChoice
                  key={option}
                  label={option}
                  selected={newExerciseType === option}
                  onPress={() => setNewExerciseType(option)}
                />
              ))}
            </View>
          </View>

          {exerciseTypeUsesWeight(newExerciseType) ? (
            <FormField
              label={
                newExerciseType === 'Bodyweight + Added Weight'
                  ? 'Default added weight (optional)'
                  : newExerciseType === 'Assisted Bodyweight'
                    ? 'Default assistance weight (optional)'
                    : 'Default weight (optional)'
              }
              value={newDefaultWeight}
              onChangeText={setNewDefaultWeight}
              placeholder="25"
              keyboardType="decimal-pad"
            />
          ) : null}
          {exerciseTypeUsesReps(newExerciseType) ? (
            <FormField
              label="Default reps"
              value={newDefaultReps}
              onChangeText={setNewDefaultReps}
              placeholder="8"
              keyboardType="number-pad"
            />
          ) : null}
          {exerciseTypeUsesDistance(newExerciseType) ? (
            <FormField
              label="Default distance (optional)"
              value={newDefaultDistance}
              onChangeText={setNewDefaultDistance}
              placeholder="1.0"
              keyboardType="decimal-pad"
            />
          ) : null}
          {exerciseTypeUsesDuration(newExerciseType) ? (
            <FormField
              label="Default duration (seconds)"
              value={newDefaultDurationSeconds}
              onChangeText={setNewDefaultDurationSeconds}
              placeholder="60"
              keyboardType="number-pad"
            />
          ) : null}

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
                  {exercise.detail} · {exercise.exerciseType}
                  {exercise.isCustom ? ' · Custom' : ''}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <PrimaryButton label="Create Template" onPress={submit} />
      <PrimaryButton label="Cancel" onPress={closeAndReset} variant="secondary" />
    </KeyboardAwareModal>
  );
}

function TemplateEditorModal({
  exercises,
  template,
  globalDefaultRestSeconds,
  onClose,
  onSave,
}: {
  exercises: ExerciseDefinition[];
  template: WorkoutTemplate | null;
  globalDefaultRestSeconds: number;
  onClose: () => void;
  onSave: (input: UpdateTemplateInput) => boolean;
}) {
  const [name, setName] = useState('');
  const [folder, setFolder] = useState('My Workouts');
  const [draftExercises, setDraftExercises] = useState<WorkoutExercise[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');

  const resetFromTemplate = (nextTemplate: WorkoutTemplate | null) => {
    setName(nextTemplate?.name ?? '');
    setFolder(nextTemplate?.folder ?? 'My Workouts');
    setDraftExercises(
      nextTemplate?.exercises.map((exercise) => ({
        ...exercise,
        sets: exercise.sets.map((set) => ({
          ...set,
          setType: set.setType ?? 'normal',
        })),
      })) ?? [],
    );
    setPickerOpen(false);
    setQuery('');
  };

  const visible = Boolean(template);

  // Modal content is recreated whenever the selected template changes through this key.
  const editorKey = template?.id ?? 'closed';

  const updateSet = (
    exerciseId: string,
    setId: string,
    field: WorkoutMetricField | 'rpe' | 'rir',
    value: number | undefined,
  ) => {
    setDraftExercises((current) =>
      current.map((exercise) =>
        exercise.id !== exerciseId
          ? exercise
          : {
              ...exercise,
              sets: exercise.sets.map((set) => {
                if (set.id !== setId) return set;
                if (field === 'rpe') return { ...set, rpe: value, rir: undefined };
                if (field === 'rir') return { ...set, rir: value, rpe: undefined };
                return { ...set, [field]: value };
              }),
            },
      ),
    );
  };

  const cycleEffort = (exerciseId: string, setId: string) => {
    setDraftExercises((current) =>
      current.map((exercise) =>
        exercise.id !== exerciseId
          ? exercise
          : {
              ...exercise,
              sets: exercise.sets.map((set) => {
                if (set.id !== setId) return set;
                if (set.rpe !== undefined) return { ...set, rpe: undefined, rir: 2 };
                if (set.rir !== undefined) return { ...set, rpe: undefined, rir: undefined };
                return { ...set, rpe: 8, rir: undefined };
              }),
            },
      ),
    );
  };

  const toggleSetType = (exerciseId: string, setId: string) => {
    setDraftExercises((current) =>
      current.map((exercise) =>
        exercise.id !== exerciseId
          ? exercise
          : {
              ...exercise,
              sets: exercise.sets.map((set) =>
                set.id === setId
                  ? {
                      ...set,
                      setType: (set.setType ?? 'normal') === 'warmup' ? 'normal' : 'warmup',
                    }
                  : set,
              ),
            },
      ),
    );
  };

  const updateExerciseRest = (exerciseId: string, seconds: number) => {
    const safeSeconds = Math.max(15, Math.min(3600, Math.round(seconds)));
    setDraftExercises((current) =>
      current.map((exercise) =>
        exercise.id === exerciseId ? { ...exercise, restSeconds: safeSeconds } : exercise,
      ),
    );
  };

  const addSetToExercise = (exerciseId: string) => {
    setDraftExercises((current) =>
      current.map((exercise) => {
        if (exercise.id !== exerciseId) return exercise;
        const last = exercise.sets.at(-1);
        return {
          ...exercise,
          sets: [
            ...exercise.sets,
            {
              id: `${exercise.id}-template-set-${Date.now()}`,
              weight: last?.weight,
              reps: last?.reps,
              durationSeconds: last?.durationSeconds,
              distance: last?.distance,
              rpe: last?.rpe,
              rir: last?.rir,
              setType: 'normal',
              completed: false,
            },
          ],
        };
      }),
    );
  };

  const removeSetFromExercise = (exerciseId: string, setId: string) => {
    setDraftExercises((current) =>
      current.map((exercise) =>
        exercise.id !== exerciseId || exercise.sets.length <= 1
          ? exercise
          : { ...exercise, sets: exercise.sets.filter((set) => set.id !== setId) },
      ),
    );
  };

  const moveExercise = (exerciseId: string, direction: 'up' | 'down') => {
    setDraftExercises((current) => {
      const currentIndex = current.findIndex((exercise) => exercise.id === exerciseId);
      if (currentIndex < 0) return current;

      const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (nextIndex < 0 || nextIndex >= current.length) return current;

      const reordered = [...current];
      [reordered[currentIndex], reordered[nextIndex]] = [
        reordered[nextIndex],
        reordered[currentIndex],
      ];
      return reordered;
    });
  };

  const removeExerciseFromTemplate = (exerciseId: string) => {
    setDraftExercises((current) => current.filter((exercise) => exercise.id !== exerciseId));
  };

  const addExerciseToTemplate = (definition: ExerciseDefinition) => {
    if (draftExercises.some((exercise) => exercise.name === definition.name)) return;
    const stamp = Date.now();
    setDraftExercises((current) => [
      ...current,
      {
        id: `${template?.id ?? 'template'}-${definition.id}-${stamp}`,
        exerciseDefinitionId: definition.id,
        name: definition.name,
        exerciseType: definition.exerciseType,
        restSeconds: definition.defaultRestSeconds ?? globalDefaultRestSeconds,
        sets: Array.from({ length: 3 }, (_, index) => ({
          id: `${definition.id}-${stamp}-${index + 1}`,
          weight: exerciseTypeUsesWeight(definition.exerciseType)
            ? definition.defaultWeight
            : undefined,
          reps: exerciseTypeUsesReps(definition.exerciseType)
            ? definition.defaultReps ?? 8
            : undefined,
          durationSeconds: exerciseTypeUsesDuration(definition.exerciseType)
            ? definition.defaultDurationSeconds ?? 60
            : undefined,
          distance: exerciseTypeUsesDistance(definition.exerciseType)
            ? definition.defaultDistance
            : undefined,
          setType: 'normal',
          completed: false,
        })),
      },
    ]);
    setPickerOpen(false);
    setQuery('');
  };

  const filteredExercises = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return exercises.filter(
      (exercise) =>
        !draftExercises.some((draft) => draft.name === exercise.name) &&
        (!normalized ||
          exercise.name.toLowerCase().includes(normalized) ||
          exercise.detail.toLowerCase().includes(normalized)),
    );
  }, [draftExercises, exercises, query]);

  const submit = () => {
    if (!template) return;
    if (!name.trim()) {
      showPrototypeNotice('Template name required', 'Enter a name for this template.');
      return;
    }
    if (draftExercises.length === 0) {
      showPrototypeNotice('Add an exercise', 'A template needs at least one exercise.');
      return;
    }
    onSave({ id: template.id, name, folder, exercises: draftExercises });
  };

  return (
    <KeyboardAwareModal
      key={editorKey}
      visible={visible}
      onClose={onClose}
      onShow={() => resetFromTemplate(template)}
      cardStyle={styles.editorModalCard}
      contentContainerStyle={styles.editorContent}
    >
      <Text style={styles.modalTitle}>Edit Template</Text>
      <Text style={styles.modalDetail}>
        Set the planned values and optional RPE or RIR target for every set. The input columns change automatically for each exercise tracking type. Tap a set label to change its set type.
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

      {draftExercises.map((exercise, exerciseIndex) => (
        <View key={exercise.id} style={styles.templateExerciseCard}>
          <View style={styles.templateExerciseHeader}>
            <View style={styles.workoutCopy}>
              <Text style={styles.exerciseName}>{exercise.name}</Text>
              <Text style={styles.workoutDetail}>
                {exercise.exerciseType} · {exercise.sets.length} planned set{exercise.sets.length === 1 ? '' : 's'}
              </Text>
            </View>
            <View style={styles.templateExerciseActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Move ${exercise.name} up`}
                accessibilityState={{ disabled: exerciseIndex === 0 }}
                disabled={exerciseIndex === 0}
                onPress={() => moveExercise(exercise.id, 'up')}
                style={({ pressed }) => [
                  styles.moveExerciseButton,
                  exerciseIndex === 0 && styles.disabledControl,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.moveExerciseButtonLabel}>↑</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Move ${exercise.name} down`}
                accessibilityState={{ disabled: exerciseIndex === draftExercises.length - 1 }}
                disabled={exerciseIndex === draftExercises.length - 1}
                onPress={() => moveExercise(exercise.id, 'down')}
                style={({ pressed }) => [
                  styles.moveExerciseButton,
                  exerciseIndex === draftExercises.length - 1 && styles.disabledControl,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.moveExerciseButtonLabel}>↓</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${exercise.name} from template`}
                onPress={() => removeExerciseFromTemplate(exercise.id)}
                style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}
              >
                <Text style={styles.removeButtonLabel}>Remove</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.templateRestRow}>
            <Text style={styles.templateRestLabel}>Rest after sets</Text>
            <View style={styles.templateRestControls}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Decrease ${exercise.name} rest time by 15 seconds`}
                onPress={() => updateExerciseRest(exercise.id, (exercise.restSeconds ?? globalDefaultRestSeconds) - 15)}
                style={({ pressed }) => [styles.restStepButton, pressed && styles.pressed]}
              >
                <Text style={styles.restStepLabel}>−15</Text>
              </Pressable>
              <Text style={styles.templateRestValue}>{formatRestTime(exercise.restSeconds ?? globalDefaultRestSeconds)}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Increase ${exercise.name} rest time by 15 seconds`}
                onPress={() => updateExerciseRest(exercise.id, (exercise.restSeconds ?? globalDefaultRestSeconds) + 15)}
                style={({ pressed }) => [styles.restStepButton, pressed && styles.pressed]}
              >
                <Text style={styles.restStepLabel}>+15</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.templateSetHeader}>
            <Text style={[styles.templateColumnLabel, styles.templateSetNumberColumn]}>SET</Text>
            {getMetricSlots(exercise.exerciseType).map((slot, slotIndex) => (
              <Text
                key={`${exercise.id}-header-${slotIndex}`}
                style={[styles.templateColumnLabel, styles.templateInputColumn]}
              >
                {slot?.label ?? ''}
              </Text>
            ))}
            <Text style={[styles.templateColumnLabel, styles.templateEffortColumn]}>RPE/RIR</Text>
            <Text style={[styles.templateColumnLabel, styles.templateRemoveColumn]}> </Text>
          </View>

          {exercise.sets.map((set, index) => (
            <View key={set.id} style={styles.templateSetRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${getSetDisplayName(exercise.sets, index)}. Tap to switch working or warm-up set.`}
                onPress={() => toggleSetType(exercise.id, set.id)}
                style={({ pressed }) => [
                  styles.templateSetNumberColumn,
                  styles.setTypeButton,
                  (set.setType ?? 'normal') === 'warmup' && styles.warmupSetTypeButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.templateSetNumber,
                    (set.setType ?? 'normal') === 'warmup' && styles.warmupSetNumber,
                  ]}
                >
                  {getSetLabel(exercise.sets, index)}
                </Text>
              </Pressable>
              {getMetricSlots(exercise.exerciseType).map((slot, slotIndex) =>
                slot ? (
                  <CompactNumberInput
                    key={`${set.id}-${slot.field}`}
                    value={set[slot.field]}
                    decimal={slot.decimal}
                    onCommit={(value) => updateSet(exercise.id, set.id, slot.field, value)}
                  />
                ) : (
                  <View
                    key={`${set.id}-empty-${slotIndex}`}
                    style={styles.templateInputColumn}
                  />
                ),
              )}
              <View style={styles.templateEffortColumn}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => cycleEffort(exercise.id, set.id)}
                  style={({ pressed }) => [
                    styles.effortModeButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.effortModeLabel}>
                    {set.rpe !== undefined ? 'RPE' : set.rir !== undefined ? 'RIR' : 'None'}
                  </Text>
                </Pressable>
                {set.rpe !== undefined ? (
                  <CompactNumberInput
                    value={set.rpe}
                    decimal
                    narrow
                    onCommit={(value) => updateSet(exercise.id, set.id, 'rpe', value)}
                  />
                ) : set.rir !== undefined ? (
                  <CompactNumberInput
                    value={set.rir}
                    decimal
                    narrow
                    onCommit={(value) => updateSet(exercise.id, set.id, 'rir', value)}
                  />
                ) : null}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove set ${index + 1}`}
                onPress={() => removeSetFromExercise(exercise.id, set.id)}
                disabled={exercise.sets.length <= 1}
                style={({ pressed }) => [
                  styles.templateRemoveColumn,
                  styles.removeSetButton,
                  exercise.sets.length <= 1 && styles.disabledControl,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.removeSetLabel}>×</Text>
              </Pressable>
            </View>
          ))}

          <PrimaryButton
            label="+ Add Set"
            onPress={() => addSetToExercise(exercise.id)}
            variant="secondary"
          />
        </View>
      ))}

      <PrimaryButton
        label={pickerOpen ? 'Close Exercise Picker' : '+ Add Exercise'}
        onPress={() => setPickerOpen((current) => !current)}
        variant="secondary"
      />

      {pickerOpen ? (
        <View style={styles.editorPicker}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search exercises..."
            placeholderTextColor={colors.textMuted}
            style={styles.formInput}
          />
          {filteredExercises.map((exercise) => (
            <Pressable
              key={exercise.id}
              accessibilityRole="button"
              onPress={() => addExerciseToTemplate(exercise)}
              style={({ pressed }) => [styles.selectionRow, pressed && styles.pressed]}
            >
              <View style={styles.workoutCopy}>
                <Text style={styles.exerciseName}>{exercise.name}</Text>
                <Text style={styles.workoutDetail}>{exercise.detail} · {exercise.exerciseType}</Text>
              </View>
              <Text style={styles.addExerciseLabel}>Add</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <PrimaryButton label="Save Template" onPress={submit} />
      <PrimaryButton label="Cancel" onPress={onClose} variant="secondary" />
    </KeyboardAwareModal>
  );
}

function CompactNumberInput({
  value,
  onCommit,
  decimal = false,
  narrow = false,
}: {
  value?: number;
  onCommit: (value: number | undefined) => void;
  decimal?: boolean;
  narrow?: boolean;
}) {
  const [text, setText] = useState(value === undefined ? '' : String(value));

  const commit = () => {
    const normalized = text.trim().replace(',', '.');
    if (!normalized) {
      onCommit(undefined);
      return;
    }
    const parsed = decimal ? Number.parseFloat(normalized) : Number.parseInt(normalized, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setText(value === undefined ? '' : String(value));
      return;
    }
    onCommit(parsed);
    setText(String(parsed));
  };

  return (
    <View style={[styles.templateInputColumn, narrow && styles.narrowInputColumn]}>
      <TextInput
        value={text}
        onChangeText={setText}
        onBlur={commit}
        onSubmitEditing={commit}
        inputMode={decimal ? 'decimal' : 'numeric'}
        keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
        inputAccessoryViewID={NUMERIC_KEYBOARD_ACCESSORY_ID}
        returnKeyType="done"
        selectTextOnFocus
        placeholder="—"
        placeholderTextColor={colors.textMuted}
        style={styles.compactInput}
      />
    </View>
  );
}

function getSetLabel(sets: WorkoutSet[], index: number) {
  const set = sets[index];
  if ((set.setType ?? 'normal') === 'warmup') return 'W';

  return String(
    sets
      .slice(0, index + 1)
      .filter((candidate) => (candidate.setType ?? 'normal') === 'normal').length,
  );
}

function getSetDisplayName(sets: WorkoutSet[], index: number) {
  const label = getSetLabel(sets, index);
  return label === 'W' ? 'Warm-up' : `Set ${label}`;
}

function formatRestTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatTemplateSet(set: WorkoutSet, exerciseType: ExerciseType) {
  const effort =
    set.rpe !== undefined ? ` · RPE ${set.rpe}` : set.rir !== undefined ? ` · RIR ${set.rir}` : '';
  return `${formatSetMetrics(exerciseType, set)}${effort}`;
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

function getEmptyWorkoutName() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Morning Workout';
  if (hour < 17) return 'Afternoon Workout';
  return 'Evening Workout';
}

function confirmAction(
  title: string,
  message: string,
  confirmLabel: string,
  onConfirm: () => void,
) {
  if (Platform.OS === 'web') {
    const confirmFunction = (globalThis as { confirm?: (value: string) => boolean }).confirm;
    if (confirmFunction?.(`${title}\n\n${message}`)) onConfirm();
    return;
  }

  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
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
  manageButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.surfaceElevated,
  },
  manageButtonLabel: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: -5,
  },
  startButton: {
    minHeight: 40,
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
  actionsCard: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  actionsTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  actionsSubtitle: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: spacing.xs,
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
    maxWidth: 520,
  },
  createModalContent: {
    paddingBottom: spacing.xl,
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
  previewSetText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 4,
  },
  editorModalCard: {
    maxWidth: 620,
  },
  editorContent: {
    paddingBottom: spacing.xl,
  },
  templateExerciseCard: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.surfaceElevated,
  },
  templateExerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  templateRestRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginBottom: spacing.sm, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  templateRestLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  templateRestControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  restStepButton: { minWidth: 46, minHeight: 34, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border },
  restStepLabel: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  templateRestValue: { minWidth: 52, color: colors.text, fontSize: 14, fontWeight: '900', textAlign: 'center' },
  templateExerciseActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  moveExerciseButton: {
    width: 34,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.surface,
  },
  moveExerciseButtonLabel: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '900',
  },
  removeButton: {
    minHeight: 36,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderColor: colors.danger,
    borderWidth: 1,
  },
  removeButtonLabel: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '800',
  },
  templateSetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  templateSetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  templateColumnLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '800',
    textAlign: 'center',
  },
  templateSetNumberColumn: {
    width: 36,
  },
  templateInputColumn: {
    width: 58,
  },
  narrowInputColumn: {
    width: 48,
  },
  templateEffortColumn: {
    minWidth: 104,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  templateRemoveColumn: {
    width: 28,
  },
  templateSetNumber: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  setTypeButton: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.background,
  },
  warmupSetTypeButton: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceElevated,
  },
  warmupSetNumber: {
    color: colors.primary,
  },
  compactInput: {
    width: '100%',
    minHeight: 42,
    paddingHorizontal: 4,
    color: colors.text,
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.sm,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  effortModeButton: {
    minHeight: 34,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderRadius: radius.sm,
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.background,
  },
  effortModeLabel: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '900',
  },
  removeSetButton: {
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeSetLabel: {
    color: colors.danger,
    fontSize: 22,
    fontWeight: '900',
  },
  disabledControl: {
    opacity: 0.25,
  },
  editorPicker: {
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderColor: colors.border,
    borderWidth: 1,
  },
  addExerciseLabel: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
  },

  folderManageButton: {
    width: 34,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.surfaceElevated,
  },
  folderManageLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: -4,
  },
  emptyFolderText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    paddingVertical: spacing.sm,
  },
  archivedRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  compactActionButton: {
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.surfaceElevated,
  },
  compactActionLabel: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  compactDangerButton: {
    borderColor: colors.danger,
  },
  compactDangerLabel: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '900',
  },
  twoButtonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  halfButton: {
    flex: 1,
  },
  smallModalCard: {
    maxWidth: 420,
  },
  folderChoiceList: {
    maxHeight: 320,
  },
  folderChoice: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  folderChoiceSelected: {
    opacity: 0.55,
  },
  folderChoiceLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  folderChoiceLabelSelected: {
    color: colors.primary,
  },

});
