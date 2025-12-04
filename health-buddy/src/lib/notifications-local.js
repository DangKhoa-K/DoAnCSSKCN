// Lazy import để tránh auto đăng ký push token khi app vừa mở
async function getNotifications() {
  const mod = await import('expo-notifications');
  return mod;
}

export async function setHandler() {
  const Notifications = await getNotifications();
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
    }),
  });
}

export async function ensurePermissions() {
  const Notifications = await getNotifications();
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    return req.status === 'granted';
  }
  return true;
}

export async function setupAndroidChannel() {
  const Notifications = await getNotifications();
  const { Platform } = await import('react-native');
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('workouts', {
      name: 'Workouts',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }
}

export async function scheduleWeeklyReminder({ weekday, hour, minute, title, body }) {
  const Notifications = await getNotifications();
  await ensurePermissions();
  await setupAndroidChannel();

  const { Platform } = await import('react-native');
  const trigger = { weekday, hour, minute, repeats: true };
  const id = await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: 'default' },
    trigger: Platform.OS === 'android'
      ? { ...trigger, channelId: 'workouts' }
      : trigger,
  });
  return id;
}

export async function cancelAllReminders() {
  const Notifications = await getNotifications();
  await Notifications.cancelAllScheduledNotificationsAsync();
}