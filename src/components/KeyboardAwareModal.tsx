import type { ReactNode } from 'react';
import {
  InputAccessoryView,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { colors, radius, spacing } from '@/constants/theme';

export const NUMERIC_KEYBOARD_ACCESSORY_ID = 'liftflow-numeric-keyboard-accessory';

export function KeyboardAwareModal({
  visible,
  onClose,
  children,
  onShow,
  cardStyle,
  contentContainerStyle,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  onShow?: () => void;
  cardStyle?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onShow={onShow}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
        style={styles.keyboardRoot}
      >
        <View style={styles.backdrop}>
          <View style={[styles.card, cardStyle]}>
            <ScrollView
              automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
              contentContainerStyle={[styles.content, contentContainerStyle]}
              contentInsetAdjustmentBehavior="automatic"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              showsVerticalScrollIndicator
              style={styles.scroll}
            >
              {children}
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>

      <NumericKeyboardAccessory />
    </Modal>
  );
}

export function NumericKeyboardAccessory() {
  if (Platform.OS !== 'ios') return null;

  return (
    <InputAccessoryView nativeID={NUMERIC_KEYBOARD_ACCESSORY_ID}>
      <View style={styles.keyboardToolbar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Done entering number"
          hitSlop={10}
          onPress={Keyboard.dismiss}
          style={({ pressed }) => [styles.doneButton, pressed && styles.pressed]}
        >
          <Text style={styles.doneLabel}>Done</Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}

const styles = StyleSheet.create({
  keyboardRoot: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '100%',
    flexShrink: 1,
    alignSelf: 'center',
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
  },
  scroll: {
    width: '100%',
    flexShrink: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  keyboardToolbar: {
    minHeight: 46,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  doneButton: {
    minHeight: 36,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  doneLabel: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.65,
  },
});
