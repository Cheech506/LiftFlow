import 'react-native-gesture-handler';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { colors } from '@/constants/theme';
import { ActiveWorkoutProvider } from '@/context/ActiveWorkoutContext';

export default function RootLayout() {
  return (
    <ActiveWorkoutProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: colors.background },
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="settings"
          options={{
            title: 'Settings',
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="active-workout"
          options={{
            headerShown: false,
            presentation: 'fullScreenModal',
            gestureEnabled: true,
          }}
        />
      </Stack>
    </ActiveWorkoutProvider>
  );
}
