

import { Platform } from 'react-native';

const CHANNEL_ID = 'reminders-audio-v2'; // kênh mới với âm thanh

let NotificationsMod = null;
async function getNative() {
  if (Platform.OS === 'web') return null;
  if (NotificationsMod) return NotificationsMod;
  NotificationsMod = await import('expo-notifications');
  return NotificationsMod;
}

export async function setHandler() {
  if (Platform.OS === 'web') return;
  const Notifications = await getNative();
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

// Quyền
export async function ensurePermissions() {
  if (Platform.OS === 'web') {
    const status = await Notification.requestPermission();
    return status === 'granted';
  }
  const Notifications = await getNative();
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    return req.status === 'granted';
  }
  return true;
}

// Tạo kênh Android với âm thanh và độ ưu tiên tối đa
export async function setupAndroidChannel() {
  if (Platform.OS !== 'android') return;
  const Notifications = await getNative();

  // Xóa kênh cũ nếu tồn tại để đảm bảo âm thanh được bật theo cấu hình mới
  try {
    await Notifications.deleteNotificationChannelAsync(CHANNEL_ID);
  } catch (_) {}

  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Nhắc nhở có âm thanh',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default', // âm thanh mặc định của hệ thống
    vibrationPattern: [0, 250, 250, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    enableVibrate: true,
  });
}

// Bắn thông báo ngay (để test chuông)
export async function presentNow(title = 'Thông báo', body = 'Kiểm tra chuông') {
  if (Platform.OS === 'web') {
    const ok = await ensurePermissions();
    if (!ok) return false;
    new Notification(title, { body });
    return true;
  }
  const Notifications = await getNative();
  await setupAndroidChannel();
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: 'default', vibrate: [0, 200, 200, 200], channelId: CHANNEL_ID },
    trigger: null, // hiển thị ngay
  });
  return true;
}

// Hẹn sau N giây
export async function scheduleTestInSeconds(sec = 5, title = 'Test', body = 'Thông báo thử') {
  if (Platform.OS === 'web') {
    const ok = await ensurePermissions();
    if (!ok) return false;
    setTimeout(() => new Notification(title, { body }), sec * 1000);
    return true;
  }
  const Notifications = await getNative();
  await setupAndroidChannel();
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: 'default', vibrate: [0, 200, 200, 200], channelId: CHANNEL_ID },
    trigger: { seconds: sec },
  });
  return true;
}

// Hẹn theo thời điểm tuyệt đối
export async function scheduleAtDate({ date, title, body }) {
  if (Platform.OS === 'web') {
    const ok = await ensurePermissions();
    if (!ok) return false;
    const delay = Math.max(0, date.getTime() - Date.now());
    setTimeout(() => new Notification(title, { body }), delay);
    return true;
  }
  const Notifications = await getNative();
  await setupAndroidChannel();
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: 'default', vibrate: [0, 200, 200, 200], channelId: CHANNEL_ID },
    trigger: { date },
  });
  return true;
}

// Tính thời điểm kế tiếp
function nextDailyDate(hour, minute) {
  const now = new Date();
  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setHours(hour, minute, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next;
}
function nextWeeklyDate(weekdayMon1to7, hour, minute) {
  const now = new Date();
  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setHours(hour, minute, 0, 0);
  const targetJS = (weekdayMon1to7 === 7) ? 0 : weekdayMon1to7;
  let addDays = (targetJS - now.getDay() + 7) % 7;
  if (addDays === 0 && next <= now) addDays = 7;
  next.setDate(now.getDate() + addDays);
  return next;
}

// Đặt hằng ngày/tuần (tuyệt đối)
export async function scheduleDailyAbsolute({ hour, minute, title, body, daysAhead = 7 }) {
  const first = nextDailyDate(hour, minute);
  await scheduleAtDate({ date: first, title, body });
  for (let i = 1; i < daysAhead; i++) {
    const d = new Date(first);
    d.setDate(d.getDate() + i);
    await scheduleAtDate({ date: d, title, body });
  }
  return true;
}
export async function scheduleWeeklyAbsolute({ weekday, hour, minute, title, body, weeksAhead = 12 }) {
  for (let i = 0; i < weeksAhead; i++) {
    const d = nextWeeklyDate(weekday, hour, minute);
    d.setDate(d.getDate() + i * 7);
    await scheduleAtDate({ date: d, title, body });
  }
  return true;
}

// Debug
export async function listScheduled() {
  if (Platform.OS === 'web') return 'web';
  const Notifications = await getNative();
  return await Notifications.getAllScheduledNotificationsAsync();
}
export async function cancelAllScheduled() {
  if (Platform.OS === 'web') return true;
  const Notifications = await getNative();
  await Notifications.cancelAllScheduledNotificationsAsync();
  return true;
}