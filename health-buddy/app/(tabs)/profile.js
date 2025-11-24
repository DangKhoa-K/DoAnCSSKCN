// app/(tabs)/profile.js
import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useProfile } from '../../src/state/profile';

// màu/bo góc gọn
const C = {
  bg: '#F6F7FB',
  card: '#fff',
  text: '#111827',
  sub: '#6b7280',
  border: '#E5E7EB',
  primary: '#2563EB',
  muted: '#9CA3AF',
  good: '#16a34a',
  warn: '#f59e0b',
  danger: '#dc2626',
};
const R = { md: 12, lg: 16 };

const GOALS = [
  { key: 'lose', label: 'Giảm cân' },
  { key: 'keep', label: 'Giữ cân' },
  { key: 'gain', label: 'Tăng cân' },
];

const ACTIVITIES = [
  { key: 'low', label: 'Ít vận động' },
  { key: 'normal', label: 'Bình thường' },
  { key: 'high', label: 'Nhiều vận động' },
];

function Pill({ active, onPress, children }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999,
        borderWidth: 1, borderColor: active ? C.primary : C.border,
        backgroundColor: active ? '#E6F0FF' : '#fff', marginRight: 8, marginBottom: 8
      }}
    >
      <Text style={{ color: active ? C.primary : C.text, fontWeight: '600' }}>{children}</Text>
    </TouchableOpacity>
  );
}

function Card({ title, desc, children, style }) {
  return (
    <View style={[{
      backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
      borderRadius: R.lg, padding: 14, marginBottom: 12
    }, style]}>
      {title ? <Text style={{ fontSize: 16, fontWeight: '800', color: C.text }}>{title}</Text> : null}
      {desc ? <Text style={{ color: C.sub, marginTop: 4 }}>{desc}</Text> : null}
      <View style={{ marginTop: title || desc ? 10 : 0 }}>{children}</View>
    </View>
  );
}

export default function ProfileTab() {
  const { metrics, setMetrics } = useProfile();
  const {
    height_cm, weight_kg, bmi, activity_level, goal, tdee,
  } = metrics || {};

  // local form
  const [h, setH] = useState(height_cm ? String(height_cm) : '');
  const [w, setW] = useState(weight_kg ? String(weight_kg) : '');
  const [g, setG] = useState(goal || 'keep');
  const [act, setAct] = useState(activity_level || 'normal');

  // BMI hiển thị tức thì theo input
  const liveBMI = useMemo(() => {
    const hn = Number(h), wn = Number(w);
    if (!hn || !wn) return null;
    return Number((wn / ((hn / 100) ** 2)).toFixed(1));
  }, [h, w]);

  const bmiColor = (val) => {
    if (val == null) return C.sub;
    if (val < 18.5) return C.warn;
    if (val < 25) return C.good;
    if (val < 30) return '#fb923c';
    return C.danger;
  };

  // TDEE & macro gợi ý (từ store – đã tính trong setMetrics; nhưng tính nhanh theo live input để xem trước)
  const preview = useMemo(() => {
    const wn = Number(w);
    if (!wn) return { tdee: null, target: null };
    const actFactor = act === 'low' ? 1.2 : act === 'high' ? 1.7 : 1.45;
    const bmr = 24 * wn;
    const tdeeEst = Math.round(bmr * actFactor);
    const kcal = tdeeEst + (g === 'lose' ? -300 : g === 'gain' ? 300 : 0);
    const target = {
      kcal,
      protein_g: Math.round((kcal * 0.30) / 4),
      carbs_g: Math.round((kcal * 0.40) / 4),
      fat_g: Math.round((kcal * 0.30) / 9),
    };
    return { tdee: tdeeEst, target };
  }, [w, act, g]);

  const savedTarget = useMemo(() => {
    if (!tdee) return null;
    const kcal = tdee + (goal === 'lose' ? -300 : goal === 'gain' ? 300 : 0);
    return {
      kcal,
      protein_g: Math.round((kcal * 0.30) / 4),
      carbs_g: Math.round((kcal * 0.40) / 4),
      fat_g: Math.round((kcal * 0.30) / 9),
    };
  }, [tdee, goal]);

  const save = () => {
    try {
      const hNum = Number(h);
      const wNum = Number(w);
      if (!hNum || !wNum) return Alert.alert('Lỗi', 'Chiều cao và cân nặng phải > 0');
      setMetrics({
        height_cm: hNum,
        weight_kg: wNum,
        goal: g,
        activity_level: act,
      });
      Alert.alert('Đã lưu', 'Thông số cá nhân đã cập nhật');
    } catch (e) {
      Alert.alert('Lỗi', e?.message || String(e));
    }
  };

  // gợi ý tập theo BMI
  const trainingAdvice = useMemo(() => {
    const b = liveBMI ?? bmi;
    if (!b) return 'Nhập chiều cao / cân nặng để nhận gợi ý.';
    if (b < 18.5) return 'Tập sức mạnh toàn thân 3 buổi/tuần, 30–45 phút; tăng tải dần, ưu tiên ăn đủ đạm & carb.';
    if (b < 25) return 'Duy trì 3–4 buổi/tuần: 2 sức mạnh + 1–2 cardio 20–30 phút; giữ đạm cao.';
    if (b < 30) return '4–5 buổi/tuần: 3 cardio (20–40 phút) + 2 sức mạnh toàn thân; theo dõi nhịp tim vùng 2–3.';
    return 'Khởi động nhẹ hằng ngày, đi bộ 20–30 phút, sức mạnh nhẹ 2–3 buổi/tuần; tăng dần, theo dõi huyết áp.';
  }, [liveBMI, bmi]);

  // gợi ý dinh dưỡng theo target hiện tại
  const macro = preview.target || savedTarget;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 16 }}>
      {/* Thông số cá nhân */}
      <Card title="Hồ sơ sức khỏe" desc="Nhập chiều cao, cân nặng; chọn mục tiêu & mức độ hoạt động.">
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.sub, marginBottom: 6 }}>Chiều cao (cm)</Text>
            <TextInput
              value={h} onChangeText={setH} keyboardType="numeric"
              placeholder="170"
              placeholderTextColor={C.muted}
              style={{ borderWidth: 1, borderColor: C.border, borderRadius: R.md, padding: 10, backgroundColor: '#fff' }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.sub, marginBottom: 6 }}>Cân nặng (kg)</Text>
            <TextInput
              value={w} onChangeText={setW} keyboardType="numeric"
              placeholder="65"
              placeholderTextColor={C.muted}
              style={{ borderWidth: 1, borderColor: C.border, borderRadius: R.md, padding: 10, backgroundColor: '#fff' }}
            />
          </View>
        </View>

        <Text style={{ color: C.sub, marginTop: 12, marginBottom: 6 }}>Mục tiêu</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {GOALS.map(it => (
            <Pill key={it.key} active={g === it.key} onPress={() => setG(it.key)}>{it.label}</Pill>
          ))}
        </View>

        <Text style={{ color: C.sub, marginTop: 12, marginBottom: 6 }}>Mức độ hoạt động</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {ACTIVITIES.map(it => (
            <Pill key={it.key} active={act === it.key} onPress={() => setAct(it.key)}>{it.label}</Pill>
          ))}
        </View>

        <TouchableOpacity
          onPress={save}
          style={{ marginTop: 12, backgroundColor: C.primary, borderRadius: R.md, paddingVertical: 12, alignItems: 'center' }}
        >
          <Text style={{ color: '#fff', fontWeight: '800' }}>LƯU</Text>
        </TouchableOpacity>
      </Card>

      {/* Tính toán hiện tại */}
      <Card title="Chỉ số hiện tại">
        <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
          <View style={{ flex: 1, minWidth: 150 }}>
            <Text style={{ color: C.sub }}>BMI (xem trước)</Text>
            <Text style={{ fontSize: 22, fontWeight: '800', color: bmiColor(liveBMI ?? bmi) }}>
              {(liveBMI ?? bmi) ?? '—'}
            </Text>
          </View>
          <View style={{ flex: 1, minWidth: 150 }}>
            <Text style={{ color: C.sub }}>TDEE ước tính</Text>
            <Text style={{ fontSize: 22, fontWeight: '800' }}>
              {(preview.tdee ?? tdee) ? `${preview.tdee ?? tdee} kcal` : '—'}
            </Text>
          </View>
        </View>
      </Card>

      {/* Gợi ý dinh dưỡng */}
      <Card title="Khuyến nghị dinh dưỡng" desc="Tự động theo mục tiêu & TDEE.">
        {macro ? (
          <View style={{ rowGap: 6 }}>
            <Text>- Năng lượng mục tiêu: <Text style={{ fontWeight: '800' }}>{macro.kcal} kcal/ngày</Text></Text>
            <Text>- Protein: <Text style={{ fontWeight: '800' }}>{macro.protein_g} g</Text> • Carb: <Text style={{ fontWeight: '800' }}>{macro.carbs_g} g</Text> • Fat: <Text style={{ fontWeight: '800' }}>{macro.fat_g} g</Text></Text>
            <Text style={{ color: C.sub, marginTop: 6 }}>
              Gợi ý: Ưu tiên đạm nạc (ức gà, cá, trứng), carb chậm (gạo lứt, khoai, yến mạch), thêm rau xanh & trái cây ít ngọt.
            </Text>
          </View>
        ) : (
          <Text style={{ color: C.sub }}>Nhập cân nặng để tính TDEE và macro gợi ý.</Text>
        )}
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
          <Link href="/(tabs)/nutrition" asChild>
            <TouchableOpacity style={{ flex: 1, padding: 12, borderWidth: 1, borderColor: C.border, borderRadius: R.md, alignItems: 'center' }}>
              <Text style={{ fontWeight: '700' }}>Tới Dinh dưỡng</Text>
            </TouchableOpacity>
          </Link>
          <Link href="/(tabs)/workouts" asChild>
            <TouchableOpacity style={{ flex: 1, padding: 12, borderWidth: 1, borderColor: C.border, borderRadius: R.md, alignItems: 'center' }}>
              <Text style={{ fontWeight: '700' }}>Tới Tập luyện</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </Card>

      {/* Gợi ý tập luyện */}
      <Card title="Khuyến nghị tập luyện" desc="Tuỳ theo BMI hiện tại.">
        <Text style={{ lineHeight: 20 }}>{trainingAdvice}</Text>
        <Text style={{ color: C.sub, marginTop: 8 }}>
          * Lưu lại hồ sơ để đồng bộ gợi ý sang 2 tab Tập luyện và Dinh dưỡng.
        </Text>
      </Card>
    </ScrollView>
  );
}
