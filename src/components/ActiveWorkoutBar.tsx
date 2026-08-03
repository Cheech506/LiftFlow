import { useRouter } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/constants/theme';
import { useActiveWorkout } from '@/context/ActiveWorkoutContext';

export function ActiveWorkoutBar() {
  const router = useRouter();
  const { workout, completedSetCount, totalSetCount } = useActiveWorkout();

  if (!workout) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Resume ${workout.name}`}
      onPress={() => router.push('/active-workout')}
      style={({ pressed }) => [styles.bar, pressed && styles.pressed]}
    >
      <View style={styles.copy}>
        <Text numberOfLines={1} style={styles.name}>
          {workout.name}
        </Text>
        <Text style={styles.detail}>
          {completedSetCount} of {totalSetCount} sets complete
        </Text>
      </View>
      <Text style={styles.resume}>Resume →</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: spacing.sm,
    right: spacing.sm,
    bottom: 69,
    minHeight: 58,
    zIndex: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.primary,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 10px rgba(0, 0, 0, 0.28)',
      },
      android: {
        elevation: 8,
      },
      default: {
        shadowColor: '#000000',
        shadowOpacity: 0.28,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
      },
    }),
  },
  pressed: {
    opacity: 0.82,
  },
  copy: {
    flex: 1,
  },
  name: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  detail: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  resume: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '800',
    marginLeft: spacing.md,
  },
});
