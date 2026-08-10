import { Tabs, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActiveWorkoutBar } from '@/components/ActiveWorkoutBar';
import { TabIcon } from '@/components/TabIcon';
import { colors, spacing } from '@/constants/theme';

export default function TabsLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          headerStyle: styles.header,
          headerTintColor: colors.text,
          headerTitleStyle: styles.headerTitle,
          headerShadowVisible: false,
          sceneStyle: styles.scene,
          tabBarStyle: [
            styles.tabBar,
            {
              height: 56 + insets.bottom,
              paddingBottom: Math.max(insets.bottom, 7),
            },
          ],
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: styles.tabLabel,
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open Settings"
              onPress={() => router.push('/settings')}
              hitSlop={12}
              style={({ pressed }) => [styles.settingsButton, pressed && styles.pressed]}
            >
              <Ionicons color={colors.text} name="settings-outline" size={23} />
            </Pressable>
          ),
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, focused }) => <TabIcon color={color} focused={focused} name={focused ? 'home' : 'home-outline'} />,
          }}
        />
        <Tabs.Screen
          name="exercises"
          options={{
            title: 'Exercises',
            tabBarIcon: ({ color, focused }) => <TabIcon color={color} focused={focused} name={focused ? 'barbell' : 'barbell-outline'} />,
          }}
        />
        <Tabs.Screen
          name="workouts"
          options={{
            title: 'Workouts',
            tabBarIcon: ({ color, focused }) => <TabIcon color={color} focused={focused} name={focused ? 'reader' : 'reader-outline'} />,
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: 'History',
            tabBarIcon: ({ color, focused }) => <TabIcon color={color} focused={focused} name={focused ? 'time' : 'time-outline'} />,
          }}
        />
        <Tabs.Screen
          name="progress"
          options={{
            title: 'Progress',
            tabBarIcon: ({ color, focused }) => <TabIcon color={color} focused={focused} name={focused ? 'trending-up' : 'trending-up-outline'} />,
          }}
        />
      </Tabs>
      <ActiveWorkoutBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scene: {
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.background,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  settingsButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  pressed: {
    opacity: 0.6,
  },
  tabBar: {
    paddingTop: 6,
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
});
