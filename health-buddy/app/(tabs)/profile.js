// app/(tabs)/profile.js
import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { api } from '../../src/lib/api';
import { emit, EVENTS } from '../../src/lib/events';
import { useProfile } from '../../src/state/profile';

const C = {
  bg: '#F0F6FF',
  card: '#FFFFFF',
  text: '#0F172A',
  sub: '#64748B',
  border: '#DCE7FF',
  primary: '#2563EB',
  muted: '#9CA3AF',
  good: '#16A34A',
  warn: '#F59E0B',
  danger: '#DC2626',
  chipBg: '#EAF1FF',
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

const SEXES = [
  { key: 'male', label: 'Nam' },
  { key: 'female', label: 'Nữ' },
  { key: 'other', label: 'Khác' },
];

function Pill({ active, onPress, children }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999,
        borderWidth: 1, borderColor: active ? C.primary : C.border,
        backgroundColor: active ? C.chipBg : '#fff', marginRight: 8, marginBottom: 8
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
      borderRadius: R.lg, padding: 14, marginBottom: 12,
      shadowColor: '#93C5FD', shadowOpacity: 0.1, shadowRadius: 6, elevation: 1
    }, style]}>
      {title ? <Text style={{ fontSize: 16, fontWeight: '800', color: C.text }}>{title}</Text> : null}
      {desc ? <Text style={{ color: C.sub, marginTop: 4 }}>{desc}</Text> : null}
      <View style={{ marginTop: title || desc ? 10 : 0 }}>{children}</View>
    </View>
  );
}

function initialsOf(name) {
  const s = String(name || '').trim();
  if (!s) return 'U';
  const parts = s.split(/\s+/);
  const f = parts[0]?.[0] || '';
  const l = parts.length > 1 ? (parts[parts.length - 1]?.[0] || '') : '';
  return (f + l).toUpperCase();
}

export default function ProfileTab() {
  const { metrics, setMetrics } = useProfile();
  const {
    email, display_name, phone,
    height_cm, weight_kg, bmi,
    activity_level, goal, tdee, sex, birth_year
  } = metrics || {};

  // Header & liên hệ
  const [name, setName] = useState(display_name || '');
  const [phoneVal, setPhoneVal] = useState(phone || '');

  // Core
  const [h, setH] = useState(height_cm ? String(height_cm) : '');
  const [w, setW] = useState(weight_kg ? String(weight_kg) : '');
  const [g, setG] = useState(goal ? (goal === 'maintain' ? 'keep' : goal) : 'keep');
  const [act, setAct] = useState(activity_level ? (
    activity_level === 'light' ? 'low' :
    activity_level === 'active' ? 'high' : 'normal'
  ) : 'normal');

  const [sexVal, setSexVal] = useState(sex || 'other');
  const [birth, setBirth] = useState(birth_year ? String(birth_year) : '');

  const liveBMI = useMemo(() => {
    const hn = Number(h), wn = Number(w);
    if (!hn || !wn) return null;
    return Number((wn / ((hn / 100) ** 2)).toFixed(1));
  }, [h, w]);

  const bmiColor = (val) => {
    if (val == null) return C.sub;
    if (val < 18.5) return C.warn;
    if (val < 25) return C.good;
    if (val < 30) return '#FB923C';
    return C.danger;
  };

  const preview = useMemo(() => {
    const wn = Number(w);
    if (!wn) return { tdee: null, target: null };
    const actFactor = act === 'low' ? 1.2 : act === 'high' ? 1.7 : 1.45;
    const bmrSimple = 24 * wn;
    const tdeeEst = Math.round(bmrSimple * actFactor);
    const adj = g === 'lose' ? -300 : g === 'gain' ? 300 : 0;
    const kcal = tdeeEst + adj;
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

  async function save() {
    try {
      const hNum = Number(h);
      const wNum = Number(w);
      const birthNum = birth ? Number(birth) : null;
      if (!hNum || !wNum) return Alert.alert('Lỗi', 'Chiều cao và cân nặng phải > 0');
      if (birth && (!Number.isInteger(birthNum) || birthNum < 1900 || birthNum > new Date().getUTCFullYear())) {
        return Alert.alert('Lỗi', 'Năm sinh không hợp lệ');
      }

      // Map UI -> backend values
      const goalServer = g === 'keep' ? 'maintain' : g;
      const actServer =
        act === 'low' ? 'light' :
        act === 'high' ? 'active' :
        'moderate';

      // Lưu chiều cao / cân nặng
      await api('/api/profile/body', {
        method: 'POST',
        body: JSON.stringify({ height_cm: hNum, weight_kg: wNum })
      });

      // Tính kcal_target theo act + ±300
      const actFactor =
        actServer === 'sedentary' ? 1.2 :
        actServer === 'light'     ? 1.375 :
        actServer === 'moderate'  ? 1.55   :
        actServer === 'active'    ? 1.725  :
                                    1.9;
      const bmrLike = 24 * wNum;
      const base    = Math.round(bmrLike * actFactor);
      const adj     = base + (goalServer === 'lose' ? -300 : goalServer === 'gain' ? 300 : 0);

      // Lưu hồ sơ mở rộng (bổ sung display_name & phone)
      const payload = {
        display_name: name?.trim() || undefined,
        phone: phoneVal?.trim() || undefined,
        goal: goalServer,
        activity_level: actServer,
        kcal_target: adj,
        sex: sexVal,
        birth_year: birthNum || undefined
      };
      await api('/api/profile', {
        method: 'PUT',
        body: JSON.stringify(payload)
      });

      // Lấy lại từ server để đồng bộ UI và state
      const fresh = await api('/api/profile');
      setMetrics({
        email: fresh.email,
        display_name: fresh.display_name,
        phone: fresh.phone,
        height_cm: fresh.height_cm,
        weight_kg: fresh.weight_kg,
        bmi: fresh.bmi,
        activity_level: fresh.activity_level,
        goal: fresh.goal,
        tdee: fresh.tdee,
        sex: fresh.sex,
        birth_year: fresh.birth_year,
        kcal_target: fresh.kcal_target
      });

      emit(EVENTS.NUTRITION_UPDATED);
      Alert.alert('Đã lưu', 'Hồ sơ cá nhân đã cập nhật.');
    } catch (e) {
      console.error('Profile save error:', e);
      Alert.alert('Lỗi', e?.message || String(e));
    }
  }

  const trainingAdvice = useMemo(() => {
    const b = liveBMI ?? bmi;
    if (!b) return 'Nhập chiều cao / cân nặng để nhận gợi ý.';
    if (b < 18.5) return 'Tập sức mạnh toàn thân 3 buổi/tuần, 30–45 phút; tăng tải dần, ưu tiên ăn đủ đạm & carb.';
    if (b < 25) return 'Duy trì 3–4 buổi/tuần: 2 sức mạnh + 1–2 cardio 20–30 phút; giữ đạm cao.';
    if (b < 30) return '4–5 buổi/tuần: 3 cardio (20–40 phút) + 2 sức mạnh toàn thân; theo dõi nhịp tim vùng 2–3.';
    return 'Khởi động nhẹ hằng ngày, đi bộ 20–30 phút, sức mạnh nhẹ 2–3 buổi/tuần; tăng dần, theo dõi huyết áp.';
  }, [liveBMI, bmi]);

  const macro = preview.target || savedTarget;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 16 }}>
      {/* Header gradient với avatar & thông tin nhanh */}
      <LinearGradient
        colors={['#60a5fa', '#2563eb']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ borderRadius: 18, padding: 16, marginBottom: 12 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{
            width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.25)',
            alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)'
          }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 18 }}>
              {initialsOf(name || display_name)}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>
              {name?.trim() || display_name || 'Người dùng'}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.9)', marginTop: 2 }}>
              {email || '(chưa có email)'}
            </Text>
          </View>
        </View>
        {/* Tóm tắt nhanh */}
        <View style={{
          flexDirection: 'row', gap: 12, marginTop: 12,
          borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.25)', paddingTop: 12
        }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: 'rgba(255,255,255,0.9)' }}>BMI</Text>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 18 }}>
              {(liveBMI ?? bmi) ?? '—'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: 'rgba(255,255,255,0.9)' }}>TDEE ước tính</Text>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 18 }}>
              {(preview.tdee ?? tdee) ? `${preview.tdee ?? tdee}` : '—'}
            </Text>
          </View>
        </View>
      </LinearGradient>

      {/* Thông tin liên hệ & cơ bản */}
      <Card title="Thông tin cơ bản">
        <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
          <View style={{ flex: 1, minWidth: 160 }}>
            <Text style={{ color: C.sub, marginBottom: 6 }}>Tên hiển thị</Text>
            <TextInput
              value={name} onChangeText={setName} placeholder="Ví dụ: Khoa Dang"
              placeholderTextColor={C.muted}
              style={{ borderWidth: 1, borderColor: C.border, borderRadius: R.md, padding: 10, backgroundColor: '#fff' }}
            />
          </View>
          <View style={{ flex: 1, minWidth: 160 }}>
            <Text style={{ color: C.sub, marginBottom: 6 }}>Số điện thoại</Text>
            <TextInput
              value={phoneVal} onChangeText={setPhoneVal} keyboardType="phone-pad" placeholder="09xxxxxxxx"
              placeholderTextColor={C.muted}
              style={{ borderWidth: 1, borderColor: C.border, borderRadius: R.md, padding: 10, backgroundColor: '#fff' }}
            />
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
          <View style={{ flex: 1, minWidth: 160 }}>
            <Text style={{ color: C.sub, marginBottom: 6 }}>Email</Text>
            <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: R.md, padding: 10, backgroundColor: '#F8FAFF' }}>
              <Text style={{ color: C.text }}>{email || '(chưa có)'}</Text>
            </View>
          </View>
          <View style={{ width: 140 }}>
            <Text style={{ color: C.sub, marginBottom: 6 }}>Năm sinh</Text>
            <TextInput
              value={birth} onChangeText={setBirth} keyboardType="numeric" placeholder="2000"
              placeholderTextColor={C.muted}
              style={{ borderWidth: 1, borderColor: C.border, borderRadius: R.md, padding: 10, backgroundColor: '#fff' }}
            />
          </View>
          <View style={{ flex: 1, minWidth: 150 }}>
            <Text style={{ color: C.sub, marginBottom: 6 }}>Giới tính</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {SEXES.map(s => (
                <Pill key={s.key} active={sexVal === s.key} onPress={() => setSexVal(s.key)}>{s.label}</Pill>
              ))}
            </View>
          </View>
        </View>
      </Card>

      {/* Thể trạng & mục tiêu */}
      <Card title="Thể trạng & mục tiêu" desc="Nhập chiều cao, cân nặng; chọn mục tiêu & mức độ hoạt động.">
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

      {/* Chỉ số hiện tại */}
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

      {/* Khuyến nghị dinh dưỡng */}
      <Card title="Khuyến nghị dinh dưỡng" desc="Tự động theo mục tiêu & TDEE.">
        {macro ? (
          <View style={{ rowGap: 6 }}>
            <Text>- Năng lượng mục tiêu: <Text style={{ fontWeight: '800' }}>{macro.kcal} kcal/ngày</Text></Text>
            <Text>- Protein: <Text style={{ fontWeight: '800' }}>{macro.protein_g} g</Text> • Carb: <Text style={{ fontWeight: '800' }}>{macro.carbs_g} g</Text> • Fat: <Text style={{ fontWeight: '800' }}>{macro.fat_g} g</Text></Text>
            <Text style={{ color: C.sub, marginTop: 6 }}>
              Gợi ý: Đạm nạc (ức gà, cá, trứng), carb chậm (gạo lứt, khoai, yến mạch), thêm rau xanh & trái cây ít ngọt.
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

      {/* Khuyến nghị tập luyện */}
      <Card title="Khuyến nghị tập luyện" desc="Tuỳ theo BMI hiện tại.">
        <Text style={{ lineHeight: 20 }}>{trainingAdvice}</Text>
        <Text style={{ color: C.sub, marginTop: 8 }}>
          * Lưu lại hồ sơ để đồng bộ gợi ý sang 2 tab Tập luyện và Dinh dưỡng.
        </Text>
      </Card>
    </ScrollView>
  );
}