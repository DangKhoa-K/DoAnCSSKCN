// src/lib/api.js
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

const extra = Constants?.expoConfig?.extra || Constants?.manifest?.extra || {};

// Ưu tiên đọc từ app.json -> extra.API_BASE_*
// Nếu chưa cấu hình, mặc định theo nền tảng
const API_BASE =
  extra.API_BASE
  || (Platform.OS === 'android' ? (extra.API_BASE_ANDROID || 'http://10.0.2.2:8088')
                                : (extra.API_BASE_WEB     || 'http://localhost:8088'));

export async function api(path, opts = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const headers = {
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  // Server trả HTML (Expo dev) => đây là dấu hiệu sai BASE
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await res.text();
    throw new Error(text);
  }

  const json = await res.json();
  if (!res.ok) throw new Error(typeof json === 'object' ? JSON.stringify(json) : String(json));
  return json;
}
