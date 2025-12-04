import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

const extra = Constants?.expoConfig?.extra || Constants?.manifest?.extra || {};
const API_BASE =
  extra.API_BASE ||
  (Platform.OS === 'android'
    ? (extra.API_BASE_ANDROID || 'http://10.0.2.2:8088')
    : (extra.API_BASE_WEB || 'http://localhost:8088'));

export async function api(path, opts = {}, retry = 0) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const headers = {
    Accept: 'application/json',
    ...(opts.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  let body = opts.body;
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  // Chỉ stringify khi body là object/mảng
  if (body && !isFormData && typeof body !== 'string') {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    try {
      body = JSON.stringify(body);
    } catch (e) {
      // Không gửi chuỗi “[object Object]”; ném lỗi để sửa payload
      const err = new Error(`Không serialize được body sang JSON: ${e?.message || 'unknown'}`);
      err.name = 'ApiJsonSerializeError';
      throw err;
    }
  } else if (typeof body === 'string') {
    // Nếu đã là chuỗi JSON, set Content-Type nếu thiếu
    const t = body.trim();
    if (!isFormData && (t.startsWith('{') || t.startsWith('['))) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    }
  }

  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  let res;
  try {
    res = await fetch(url, { ...opts, headers, body });
  } catch (e) {
    if (retry < 1) {
      console.warn('[api] network error, retrying 1x:', e.message);
      return api(path, { ...opts, headers, body }, retry + 1);
    }
    throw new Error(`Network error calling ${url}: ${e.message}`);
  }

  const raw = await res.text();
  let data;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }

  const ct = res.headers.get('content-type') || '';

  if (!res.ok) {
    const msg =
      (data && typeof data === 'object' && (data.error || data.message)) ||
      raw ||
      `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.body = data;
    err.url = url;
    console.error('[api] error', { url, status: res.status, body: data });
    throw err;
  }

  if (!ct.includes('application/json') && typeof data !== 'object') {
    return { ok: true, raw };
  }

  return data;
}