// app/(tabs)/home.js
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
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
  // Apple‑style rings: rõ ràng và phân biệt
  inBlue:   '#2563EB',  // Nạp
  outRed:   '#EF4444',  // Tiêu hao
  waterOrange: '#F59E0B', // Nước
  sleepYellow: '#FACC15', // Ngủ
  track: (themeColors?.muted ?? '#E5E7EB'),
};

const R = { lg: (radius?.lg ?? 16) };
const S = { xs: (spacing?.xs ?? 6), sm: (spacing?.sm ?? 10), md: (spacing?.md ?? 14), lg: (spacing?.lg ?? 20) };

/**
 * ActivityRings — Apple‑style concentric rings
 * rings: [{ label, value, target, color }]
 */
function ActivityRings({ size = 260, thickness = 16, gap = 10, rings }) {
  // Tính bán kính cho từng ring (từ ngoài vào trong)
  const outerRadius = size / 2 - thickness / 2;
  const layout = rings.map((r, idx) => {
    const radius = outerRadius - idx * (thickness + gap);
    const circumference = 2 * Math.PI * radius;
    const pct = Math.max(0, Math.min(1, r.target > 0 ? r.value / r.target : 0));
    const dash = pct * circumference;
    const gapLen = Math.max(0, circumference - dash);
    return { ...r, radius, circumference, pct, dash, gapLen };
  }).filter(x => x.radius > thickness / 2); // lọc nếu size không đủ

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {/* Tracks (nền xám) */}
        {layout.map((r, i) => (
          <Circle
            key={`track-${i}`}
            cx={size / 2}
            cy={size / 2}
            r={r.radius}
            stroke={colors.track}
            strokeWidth={thickness}
            fill="none"
          />
        ))}
        {/* Progress rings */}
        {layout.map((r, i) => (
          <Circle
            key={`ring-${i}`}
            cx={size / 2}
            cy={size / 2}
            r={r.radius}
            stroke={r.color}
            strokeWidth={thickness}
            strokeDasharray={`${r.dash} ${r.gapLen}`}
            strokeLinecap="round"
            fill="none"
            transform={`rotate(-90 ${size / 2} ${size / 2})`} // bắt đầu từ đỉnh
          />
        ))}
      </Svg>

      {/* Trung tâm hiển thị tổng quan */}
      <View style={{
        position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
        alignItems: 'center', justifyContent: 'center'
      }}>
        <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>Hoạt động hôm nay</Text>
        <Text style={{ color: colors.subtext, marginTop: 2 }}>Nạp • Tiêu hao • Nước • Ngủ</Text>
      </View>
    </View>
  );
}

export default function Home() {
  const [sum, setSum] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [errorText, setErrorText] = useState('');

  // Mục tiêu (có thể lấy từ profile trong tương lai)
  const CAL_TARGET = 2000;          // kcal nạp
  const OUT_TARGET = 500;           // kcal tiêu hao
  const WATER_TARGET = 2000;        // ml
  const SLEEP_TARGET_MIN = 8 * 60;  // phút

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

  useEffect(() => { fetchSummary(); }, [fetchSummary]);
  useFocusEffect(useCallback(() => { fetchSummary(); }, [fetchSummary]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchSummary();
    setRefreshing(false);
  }, [fetchSummary]);

  // Số liệu
  const calIn  = Math.round(sum?.calories_in  || 0);
  const calOut = Math.round(sum?.calories_out || 0);
  const water  = Math.round(sum?.water_ml     || 0);
  const sleep  = Math.round(sum?.sleep_min    || 0);

  // Dữ liệu cho Apple‑style rings (ngoài -> trong)
  const rings = [
    { key: 'in',    label: 'Nạp',     value: calIn,  target: CAL_TARGET,        color: colors.inBlue   },
    { key: 'out',   label: 'Tiêu hao',value: calOut, target: OUT_TARGET,        color: colors.outRed   },
    { key: 'water', label: 'Nước',    value: water,  target: WATER_TARGET,      color: colors.waterOrange },
    { key: 'sleep', label: 'Ngủ',     value: sleep,  target: SLEEP_TARGET_MIN,  color: colors.sleepYellow },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: S.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Tiêu đề */}
        <View style={{ marginBottom: S.lg }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>Tổng quan hôm nay</Text>
          <Text style={{ color: colors.subtext, marginTop: 4 }}>Theo dõi nạp/tiêu hao, nước, ngủ</Text>
          {errorText ? <Text style={{ color: '#DC2626', marginTop: 6 }}>{errorText}</Text> : null}
        </View>

        {/* Apple‑style concentric rings */}
        <View style={{
          backgroundColor: colors.card, borderRadius: R.lg, padding: S.md,
          borderWidth: 1, borderColor: colors.border
        }}>
          <Text style={{ fontWeight: '700', marginBottom: S.sm }}>Vòng hoạt động</Text>

          <View style={{ alignItems: 'center', paddingVertical: S.sm }}>
            <ActivityRings
              size={280}
              thickness={16}
              gap={10}
              rings={rings.map(r => ({ label: r.label, value: r.value, target: r.target, color: r.color }))}
            />
          </View>

          {/* Chú thích màu (legend) */}
          <View style={{ marginTop: S.sm }}>
            {rings.map(t => (
              <View key={t.key} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: t.color, marginRight: 8 }} />
                <Text style={{ color: colors.text, fontWeight: '600', minWidth: 80 }}>{t.label}</Text>
                <Text style={{ color: colors.subtext }}>
                  {t.value}{t.key === 'water' ? ' ml' : t.key === 'sleep' ? ' phút' : ' kcal'}
                  {' / '}
                  {t.target}{t.key === 'water' ? ' ml' : t.key === 'sleep' ? ' phút' : ' kcal'}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Hôm nay (tóm tắt nhanh) */}
        <Section title="Hôm nay" style={{ marginTop: S.lg }}>
          <View style={{ flexDirection: 'row', gap: S.md }}>
            <StatCard label="Nạp" value={`${calIn} kcal`} sub={`Mục tiêu ${CAL_TARGET} kcal`} />
            <StatCard label="Tiêu hao" value={`${calOut} kcal`} sub={`Mục tiêu ${OUT_TARGET} kcal`} />
          </View>
          <View style={{ flexDirection: 'row', gap: S.md, marginTop: S.md }}>
            <StatCard label="Nước" value={`${water} ml`} sub={`Mục tiêu ${WATER_TARGET} ml`} />
            <StatCard label="Ngủ" value={`${Math.floor(sleep/60)}h ${sleep%60}m`} sub={`Mục tiêu ${Math.floor(SLEEP_TARGET_MIN/60)}h`} />
          </View>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}