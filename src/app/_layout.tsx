import 'react-native-gesture-handler';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import { ActiveWorkoutProvider } from '@/context/ActiveWorkoutContext';
import { ServerConnectionProvider, useServerConnection } from '@/context/ServerConnectionContext';

export default function RootLayout() {
  return (
    <ServerConnectionProvider>
      <AppNavigator />
    </ServerConnectionProvider>
  );
}

function AppNavigator() {
  const { ready, session } = useServerConnection();
  if (!ready) {
    return (
      <View style={styles.loading}>
        <StatusBar style="light" />
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loadingText}>Opening LiftFlow…</Text>
      </View>
    );
  }

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
        <Stack.Protected guard={!session}>
          <Stack.Screen name="connect" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={Boolean(session)}>
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
        </Stack.Protected>
      </Stack>
    </ActiveWorkoutProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    backgroundColor: colors.background,
  },
  loadingText: { color: colors.textMuted, fontSize: 15, fontWeight: '700' },
});
