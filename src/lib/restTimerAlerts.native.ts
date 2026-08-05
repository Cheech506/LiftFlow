import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

let configured = false;

export async function configureRestTimerAlerts() {
  if (configured) return;
  configured = true;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('rest-timers', {
        name: 'Rest timers',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 120, 250],
      });
    }
  } catch (error) {
    configured = false;
    console.warn('LiftFlow could not configure rest timer alerts.', error);
  }
}

export async function requestRestTimerAlertPermission() {
  try {
    await configureRestTimerAlerts();
    const existing = await Notifications.getPermissionsAsync();
    if (existing.granted) return true;
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
  } catch (error) {
    console.warn('LiftFlow could not request notification permission.', error);
    return false;
  }
}

export async function scheduleRestTimerAlert(seconds: number) {
  try {
    await configureRestTimerAlerts();
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) return undefined;
    const safeSeconds = Math.max(1, Math.round(seconds));
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Rest complete',
        body: 'Your next LiftFlow set is ready.',
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: safeSeconds,
        repeats: false,
        channelId: Platform.OS === 'android' ? 'rest-timers' : undefined,
      },
    });
  } catch (error) {
    console.warn('LiftFlow could not schedule the rest timer alert.', error);
    return undefined;
  }
}

export async function cancelRestTimerAlert(notificationId?: string) {
  if (!notificationId) return;
  await Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => undefined);
}

export async function signalRestTimerComplete(vibrationEnabled: boolean) {
  if (!vibrationEnabled) return;
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}
