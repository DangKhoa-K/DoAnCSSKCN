// app/(tabs)/home.js
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import RingProgress from '../../src/components/RingProgress';
import Section from '../../src/components/Section';
import StatCard from '../../src/components/StatCard';
import { api } from '../../src/lib/api';
import { radius, spacing, colors as themeColors } from '../../src/theme';

const colors = {
  bg: '#F6F7FB',
  card: '#fff',
  border: '#e5e7eb',
  text: (themeColors?.text ?? '#111'),
  subtext: (themeColors?.subtext ?? '#6b7280'),
  primary: (themeColors?.primary ?? '#3B82F6'),
  success: (themeColors?.success ?? '#16A34A'),
  warning: (themeColors?.warning ?? '#F59E0B'),
  muted: (themeColors?.muted ?? '#E5E7EB'),
};

const R = {
  lg: (radius?.lg ?? 16),
};

const S = {
  xs: (spacing?.xs ?? 6),
  sm: (spacing?.sm ?? 10),
  md: (spacing?.md ?? 14),
  lg: (spacing?.lg ?? 20),
};

export default function Home() {
  const [sum, setSum] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [errorText, setErrorText] = useState('');

  // Mục tiêu mặc định (có thể đọc từ DB user nếu bạn muốn)
  const CAL_TARGET = 2000;        // kcal nạp
  const OUT_TARGET = 500;         // kcal tiêu hao
  const WATER_TARGET = 2000;      // ml
  const SLEEP_TARGET_MIN = 8 * 60; // phút

  const fetchSummary = useCallback(async () => {
    try {
      setErrorText('');
      const res = await api('/api/summary/daily');
      setSum(res || {});
    } catch (e) {
      console.warn('summary error:', e);
      setErrorText('Không tải được dữ liệu tổng quan.');
    }
  }, []);

  // Lần đầu mount
  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  // Mỗi lần quay lại tab Home → reload
  useFocusEffect(
    useCallback(() => {
      fetchSummary();
    }, [fetchSummary])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchSummary();
    setRefreshing(false);
  }, [fetchSummary]);

  // Rà số liệu an toàn
  const calIn  = Math.round(sum?.calories_in  || 0);
  const calOut = Math.round(sum?.calories_out || 0);
  const water  = Math.round(sum?.water_ml     || 0);
  const sleep  = Math.round(sum?.sleep_min    || 0);

  const p   = Number(sum?.protein_g || 0).toFixed(1);
  const c   = Number(sum?.carbs_g   || 0).toFixed(1);
  const fib = Number(sum?.fiber_g   || 0).toFixed(1);
  const f   = Number(sum?.fat_g     || 0).toFixed(1);

  const calInProg  = Math.min(calIn  / CAL_TARGET, 1);
  const calOutProg = Math.min(calOut / OUT_TARGET, 1);
  const waterProg  = Math.min(water  / WATER_TARGET, 1);
  const sleepProg  = Math.min(sleep  / SLEEP_TARGET_MIN, 1);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: S.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Tiêu đề */}
        <View style={{ marginBottom: S.lg }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>
            Tổng quan hôm nay
          </Text>
          <Text style={{ color: colors.subtext, marginTop: 4 }}>
            Theo dõi nạp/tiêu hao, nước, ngủ và vi chất chính
          </Text>
          {errorText ? (
            <Text style={{ color: '#DC2626', marginTop: 6 }}>{errorText}</Text>
          ) : null}
        </View>

        {/* Năng lượng hôm nay */}
        <Section title="Năng lượng hôm nay">
          <View style={{ flexDirection: 'row', gap: S.md }}>
            {/* Nạp vào */}
            <View style={{
              flex: 1, backgroundColor: colors.card, borderRadius: R.lg,
              padding: S.md, borderWidth: 1, borderColor: colors.border
            }}>
              <Text style={{ fontWeight: '700', marginBottom: S.sm }}>Nạp</Text>
              <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: S.sm }}>
                <RingProgress
                  size={120}
                  thickness={14}
                  progress={calInProg}
                  color={colors.primary}
                  bgColor={colors.muted}
                >
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 18, fontWeight: '800' }}>{calIn}</Text>
                    <Text style={{ color: colors.subtext }}>kcal / {CAL_TARGET}</Text>
                  </View>
                </RingProgress>
              </View>
              <Text style={{ color: colors.subtext, textAlign: 'center' }}>
                Tổng calo đã nạp
              </Text>
            </View>

            {/* Tiêu hao */}
            <View style={{
              flex: 1, backgroundColor: colors.card, borderRadius: R.lg,
              padding: S.md, borderWidth: 1, borderColor: colors.border
            }}>
              <Text style={{ fontWeight: '700', marginBottom: S.sm }}>Tiêu hao</Text>
              <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: S.sm }}>
                <RingProgress
                  size={120}
                  thickness={14}
                  progress={calOutProg}
                  color={colors.success}
                  bgColor={colors.muted}
                >
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 18, fontWeight: '800' }}>{calOut}</Text>
                    <Text style={{ color: colors.subtext }}>kcal / {OUT_TARGET}</Text>
                  </View>
                </RingProgress>
              </View>
              <Text style={{ color: colors.subtext, textAlign: 'center' }}>
                Ước tính từ bài tập
              </Text>
            </View>
          </View>
        </Section>

        {/* Vi chất chính */}
        <Section title="Vi chất chính (g)">
          <View style={{ flexDirection: 'row', gap: S.md }}>
            <StatCard label="Protein" value={`${p} g`} sub="Ưu tiên đủ protein" tone="primary" />
            <StatCard label="Carb"    value={`${c} g`} sub="Tối ưu theo lịch tập" />
          </View>
          <View style={{ flexDirection: 'row', gap: S.md, marginTop: S.md }}>
            <StatCard label="Chất xơ" value={`${fib} g`} sub="Khuyến nghị 25–35 g/ngày" />
            <StatCard label="Béo"     value={`${f} g`} sub="Ưu tiên chất béo tốt" />
          </View>
        </Section>

        {/* Nước & Ngủ */}
        <Section title="Chăm sóc hôm nay">
          <View style={{ flexDirection: 'row', gap: S.md }}>
            {/* Nước */}
            <View style={{
              flex: 1, backgroundColor: colors.card, borderRadius: R.lg,
              padding: S.md, borderWidth: 1, borderColor: colors.border
            }}>
              <Text style={{ fontWeight: '700', marginBottom: S.xs }}>Uống nước</Text>
              <View style={{ alignItems: 'center', paddingVertical: S.sm }}>
                <RingProgress
                  size={100}
                  thickness={10}
                  progress={waterProg}
                  color={colors.primary}
                  bgColor={colors.muted}
                >
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontWeight: '800' }}>{water} ml</Text>
                    <Text style={{ color: colors.subtext }}>/ {WATER_TARGET}</Text>
                  </View>
                </RingProgress>
              </View>
              <Text style={{ color: colors.subtext, textAlign: 'center' }}>
                Nhớ uống đều cả ngày
              </Text>
            </View>

            {/* Ngủ */}
            <View style={{
              flex: 1, backgroundColor: colors.card, borderRadius: R.lg,
              padding: S.md, borderWidth: 1, borderColor: colors.border
            }}>
              <Text style={{ fontWeight: '700', marginBottom: S.xs }}>Giấc ngủ</Text>
              <View style={{ alignItems: 'center', paddingVertical: S.sm }}>
                <RingProgress
                  size={100}
                  thickness={10}
                  progress={sleepProg}
                  color={colors.warning}
                  bgColor={colors.muted}
                >
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontWeight: '800' }}>
                      {Math.floor(sleep / 60)}h {sleep % 60}m
                    </Text>
                    <Text style={{ color: colors.subtext }}>
                      / {Math.floor(SLEEP_TARGET_MIN / 60)}h
                    </Text>
                  </View>
                </RingProgress>
              </View>
              <Text style={{ color: colors.subtext, textAlign: 'center' }}>
                Mục tiêu 7–8h/ngày
              </Text>
            </View>
          </View>
        </Section>

        {/* Tóm tắt nhanh */}
        <Section title="Hôm nay">
          <View style={{ flexDirection: 'row', gap: S.md }}>
            <StatCard label="Nạp" value={`${calIn} kcal`} sub="Tổng calo ăn" />
            <StatCard label="Tiêu hao" value={`${calOut} kcal`} sub="Tập luyện" />
          </View>
          <View style={{ flexDirection: 'row', gap: S.md, marginTop: S.md }}>
            <StatCard label="Nước" value={`${water} ml`} sub={`Mục tiêu ${WATER_TARGET} ml`} />
            <StatCard label="Ngủ" value={`${Math.floor(sleep/60)}h ${sleep%60}m`} sub="Khuyến nghị 7–8h" />
          </View>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}
