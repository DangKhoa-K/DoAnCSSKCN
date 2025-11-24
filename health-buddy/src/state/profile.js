// src/state/profile.js
import { create } from 'zustand';

function recompute(next) {
  const m = { ...next };
  const h = Number(m.height_cm);
  const w = Number(m.weight_kg);
  m.bmi = h && w ? Number((w / ((h / 100) ** 2)).toFixed(1)) : null;

  // Ước tính đơn giản TDEE nếu chưa có server: BMR ~ 24*weight * hệ số hoạt động
  const act = m.activity_level === 'low' ? 1.2 : m.activity_level === 'high' ? 1.7 : 1.45;
  const bmr = w ? 24 * w : null;
  m.tdee = bmr ? Math.round(bmr * act) : null;

  return m;
}

export const useProfile = create((set, get) => ({
  // metrics dùng chung toàn app
  metrics: {
    height_cm: null,
    weight_kg: null,
    bmi: null,
    goal: 'keep',           // 'lose' | 'keep' | 'gain'
    activity_level: 'normal', // 'low' | 'normal' | 'high'
    tdee: null,
  },

  // Cập nhật 1 phần và tự tính lại BMI/TDEE
  setMetrics: (partial) =>
    set((state) => ({ metrics: recompute({ ...state.metrics, ...partial }) })),

  // Chỗ này để sau này fetch từ server nếu bạn có API /api/profile
  refresh: async () => {
    // ví dụ:
    // const p = await api('/api/profile');
    // set({ metrics: recompute({ ...get().metrics, ...p }) });
  },
}));
