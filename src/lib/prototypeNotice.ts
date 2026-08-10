import { Alert, Platform } from 'react-native';

export function showPrototypeNotice(title: string, message: string) {
  if (Platform.OS === 'web') {
    const alertFunction = (globalThis as { alert?: (value: string) => void }).alert;
    if (alertFunction) {
      alertFunction(`${title}\n\n${message}`);
      return;
    }
  }

  Alert.alert(title, message);
}
