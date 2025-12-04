import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { api } from '../../../src/lib/api';
import { emit, EVENTS } from '../../../src/lib/events'; // [THÊM] phát sự kiện cho Nhật ký

const C = {
  bg: '#F6F7FB',
  card: '#fff',
  b: '#e5e7eb',
  text: '#0f172a',
  sub: '#64748b',
  primary: '#2563eb',
  success: '#16a34a',
  warn: '#f59e0b',
  danger: '#dc2626'
};

export default function MealPlanSuggest() {
  const [profile, setProfile] = useState(null);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fetchingProfile, setFetchingProfile] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      setFetchingProfile(true);
      const p = await api('/api/profile');
      setProfile(p);
    } catch (e) {
      console.error('loadProfile error:', e);
      Alert.alert('Lỗi hồ sơ', e.message || 'Không tải được hồ sơ.');
    } finally {
      setFetchingProfile(false);
    }
  }

  const hasProfileCore = !!profile?.height_cm && !!profile?.weight_kg;

  const kcalTarget = useMemo(() => {
    if (!profile) return 2000;
    const g = (profile.goal || 'maintain').toLowerCase();
    if (profile.kcal_target) return Math.round(profile.kcal_target);
    const kg = Number(profile.weight_kg || 60);
    const k = g === 'lose' ? 28 : g === 'gain' ? 34 : 31;
    return Math.round(k * kg);
  }, [profile]);

  async function makeSuggest() {
    if (!hasProfileCore) {
      Alert.alert('Thiếu dữ liệu', 'Cần nhập chiều cao & cân nặng trong hồ sơ trước.');
      return;
    }
    try {
      setLoading(true);
      console.log('[makeSuggest] profile snapshot:', profile);
      const r = await api('/api/recs/mealplan');
      if (r?.meals?.length) {
        setPlan(r);
      } else {
        Alert.alert('Không có thực đơn', 'Server chưa trả về thực đơn phù hợp.');
      }
    } catch (e) {
      console.error('makeSuggest error:', e);
      Alert.alert('Lỗi tạo gợi ý', e.message || 'Không thể tạo thực đơn.');
    } finally {
      setLoading(false);
    }
  }

  async function savePlan() {
    if (!plan?.meals?.length) {
      Alert.alert('Chưa có dữ liệu', 'Hãy tạo gợi ý trước khi lưu.');
      return;
    }
    try {
      setSaving(true);
      const body = {
        title: `Kế hoạch ${plan.goal} - ${new Date().toLocaleDateString('vi-VN')}`,
        goal: plan.goal,
        kcal_target: plan.kcal_target,
        target: plan.target,
        meals: plan.meals
      };
      const resp = await api('/api/nutrition/mealplans', {
        method: 'POST',
        body: JSON.stringify(body)
      });
      if (resp?.ok || resp?.id) {
        // [THÊM] Báo cho Nhật ký bữa ăn reload và ưu tiên món trong kế hoạch vừa lưu
        emit(EVENTS.NUTRITION_UPDATED);

        Alert.alert('Đã lưu', 'Kế hoạch thực đơn đã được lưu.');
        setPlan(null);
      } else {
        throw new Error(resp?.error || 'Lưu thất bại.');
      }
    } catch (e) {
      console.error('savePlan error:', e);
      Alert.alert('Lỗi lưu', e.message || 'Không thể lưu kế hoạch.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ padding: 16 }}
    >
      <Text style={{ fontSize: 22, fontWeight: '800', color: C.text }}>Gợi ý thực đơn</Text>
      <Text style={{ color: C.sub, marginTop: 4 }}>
        Cá nhân hoá theo chiều cao, cân nặng và mục tiêu.
      </Text>

      <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable
          onPress={loadProfile}
          disabled={fetchingProfile}
          style={{
            backgroundColor: fetchingProfile ? '#9ca3af' : C.primary,
            paddingVertical: 10,
            paddingHorizontal: 16,
            borderRadius: 8
          }}
        >
          {fetchingProfile ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontWeight: '700' }}>🔄 Làm mới hồ sơ</Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => {
            setPlan(null);
            makeSuggest();
          }}
          disabled={loading || !hasProfileCore}
          style={{
            backgroundColor: loading || !hasProfileCore ? '#9ca3af' : C.success,
            paddingVertical: 10,
            paddingHorizontal: 16,
            borderRadius: 8
          }}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontWeight: '700' }}>✨ Tạo gợi ý</Text>
          )}
        </Pressable>
      </View>

      {profile && (
        <View style={{
          marginTop: 12,
          backgroundColor: C.card,
          borderWidth: 1,
          borderColor: C.b,
          padding: 12,
          borderRadius: 10
        }}>
          <Text style={{ fontWeight: '700', color: C.text }}>
            Hồ sơ: {profile.display_name || '(Chưa đặt tên)'}
          </Text>
          <Text style={{ color: hasProfileCore ? C.primary : C.danger, marginTop: 4 }}>
            {hasProfileCore
              ? `✓ ${profile.weight_kg}kg • ${profile.height_cm}cm • Ước tính ${kcalTarget} kcal/ngày`
              : '⚠️ Thiếu chiều cao hoặc cân nặng'}
          </Text>
          <Text style={{ color: C.sub, marginTop: 4 }}>
            Mục tiêu: {profile.goal || 'maintain'} • Hoạt động: {profile.activity_level || 'light'}
          </Text>
        </View>
      )}

      {plan && (
        <View style={{
          marginTop: 16,
          backgroundColor: C.card,
          borderWidth: 1,
          borderColor: C.b,
          borderRadius: 10,
          padding: 12
        }}>
          <Text style={{ fontWeight: '700', color: C.text }}>
            🎯 Kế hoạch ngày: {plan.kcal_target} kcal • Goal: {plan.goal}
          </Text>
          <Text style={{ color: C.sub, marginTop: 4 }}>
            Macro: P {plan.target?.p}g • C {plan.target?.c}g • F {plan.target?.f}g
          </Text>

            {plan.meals.map((m, i) => (
              <View key={i} style={{ marginTop: 12 }}>
                <Text style={{ fontWeight: '700', color: C.text }}>{m.name}</Text>
                {m.items.map((it, idx) => (
                  <Text
                    key={idx}
                    style={{ marginTop: 4, color: C.sub, fontSize: 13 }}
                  >
                    • {it.food} ({it.grams}g) – {it.kcal} kcal (P {it.p}g • C {it.c}g • F {it.f}g)
                  </Text>
                ))}
              </View>
            ))}

          <Pressable
            onPress={savePlan}
            disabled={saving}
            style={{
              marginTop: 16,
              backgroundColor: saving ? '#9ca3af' : C.primary,
              padding: 14,
              borderRadius: 10
            }}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: '#fff', fontWeight: '800', textAlign: 'center' }}>
                💾 Lưu kế hoạch
              </Text>
            )}
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}