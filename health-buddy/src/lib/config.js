import Constants from 'expo-constants';
import { Platform } from 'react-native';

const PORT = 8088;
const extra = Constants.expoConfig?.extra || {};

export const API_BASE = (() => {
  if (extra.EXPO_PUBLIC_API_BASE) return extra.EXPO_PUBLIC_API_BASE;
  if (Platform.OS === 'web') {
    const host = (typeof window !== 'undefined' && window.location.hostname) || 'localhost';
    return `http://${host}:${PORT}`;
    // Android emulator tự động dùng 10.0.2.2 ở else phía dưới
  }
  if (Platform.OS === 'android') return `http://10.0.2.2:${PORT}`;
  return `http://localhost:${PORT}`;
})();
