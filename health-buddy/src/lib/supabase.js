import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// Phát hiện môi trường
const isWeb = typeof window !== 'undefined';
const isReactNative = typeof navigator !== 'undefined' && navigator.product === 'ReactNative';

// Chỉ nạp polyfill khi đang chạy RN (giữ nguyên Android)
if (isReactNative) {
  require('react-native-get-random-values');
  require('react-native-url-polyfill/auto');
}

// Đọc cấu hình (ưu tiên EXPO_PUBLIC_* cho web)
const URL_ENV =
  (typeof process !== 'undefined' && process.env && process.env.EXPO_PUBLIC_SUPABASE_URL) || undefined;
const KEY_ENV =
  (typeof process !== 'undefined' && process.env && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) || undefined;

const URL_CONST = Constants?.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_URL;
const KEY_CONST = Constants?.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const SUPABASE_URL = URL_ENV || URL_CONST;
const SUPABASE_ANON_KEY = KEY_ENV || KEY_CONST;

// Chọn storage theo môi trường
let storage;

if (isWeb && typeof window.localStorage !== 'undefined') {
  // Web: dùng localStorage (không đụng tới AsyncStorage → không lỗi window)
  storage = {
    getItem: async (k) => window.localStorage.getItem(k),
    setItem: async (k, v) => window.localStorage.setItem(k, v),
    removeItem: async (k) => window.localStorage.removeItem(k),
  };
} else if (isReactNative) {
  // RN/Android: dùng AsyncStorage (giữ nguyên hành vi)
  let AsyncStorageRN = null;
  try {
    AsyncStorageRN = require('@react-native-async-storage/async-storage').default;
  } catch {
    AsyncStorageRN = null;
  }
  storage = AsyncStorageRN
    ? {
        getItem: (k) => AsyncStorageRN.getItem(k),
        setItem: (k, v) => AsyncStorageRN.setItem(k, v),
        removeItem: (k) => AsyncStorageRN.removeItem(k),
      }
    : undefined; // nếu thiếu, Supabase sẽ fallback in-memory nội bộ
} else {
  // Node/SSR: in-memory để tránh "window is not defined"
  const mem = new Map();
  storage = {
    getItem: async (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: async (k, v) => { mem.set(k, v); },
    removeItem: async (k) => { mem.delete(k); },
  };
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage,
    detectSessionInUrl: isWeb, // chỉ cần trên web
  },
});

export default supabase;