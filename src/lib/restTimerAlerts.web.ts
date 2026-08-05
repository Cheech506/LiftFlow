export async function configureRestTimerAlerts() {}
export async function requestRestTimerAlertPermission() { return false; }
export async function scheduleRestTimerAlert(_seconds: number) { return undefined; }
export async function cancelRestTimerAlert(_notificationId?: string) {}
export async function signalRestTimerComplete(vibrationEnabled: boolean) {
  if (!vibrationEnabled) return;
  const navigatorWithVibrate = globalThis.navigator as Navigator & { vibrate?: (pattern: number | number[]) => boolean };
  navigatorWithVibrate?.vibrate?.([250, 120, 250]);
}
