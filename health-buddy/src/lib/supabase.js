// src/lib/supabase.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import 'react-native-get-random-values'; // <- thêm dòng này
import 'react-native-url-polyfill/auto';

const url  = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_URL;
const anon = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: {
      getItem: (k) => AsyncStorage.getItem(k),
      setItem: (k, v) => AsyncStorage.setItem(k, v),
      removeItem: (k) => AsyncStorage.removeItem(k),
    },
  },
});
