import { Platform } from 'react-native';

let Notifications = null;
if (Platform.OS !== 'web') {
  try { Notifications = require('expo-notifications'); } catch {}
}

export async function ensureAndroidChannel() {
  if (!Notifications || Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'default',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function ensureNotiPermission() {
  if (!Notifications) return false;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleDaily(timeHHmm, title, body) {
  if (!Notifications) return;
  const [h, m] = timeHHmm.split(':').map(Number);
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: { hour: h, minute: m, repeats: true },
  });
}
