// Lazy import để tránh auto đăng ký push token khi app mở
async function getNotifications() {
  const mod = await import('expo-notifications');
  return mod;
}

export async function ensureNotiPermission() {
  const Notifications = await getNotifications();
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    return req.status === 'granted';
  }
  return true;
}

export async function ensureAndroidChannel() {
  const Notifications = await getNotifications();
  const { Platform } = await import('react-native');
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('care', {
      name: 'Care',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }
}

export async function scheduleDaily(hhmm, title, body) {
  const Notifications = await getNotifications();
  const { Platform } = await import('react-native');
  const [hh, mm] = String(hhmm).split(':').map(x => Number(x));
  const trigger = { hour: hh, minute: mm, repeats: true };
  return Notifications.scheduleNotificationAsync({
    content: { title, body, sound: 'default' },
    trigger: Platform.OS === 'android' ? { ...trigger, channelId: 'care' } : trigger,
  });
}