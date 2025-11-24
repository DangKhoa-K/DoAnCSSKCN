// app/(tabs)/workouts/plan.js
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { api } from '../../../src/lib/api';

const C = { bg:'#F6F7FB', card:'#fff', b:'#e5e7eb', text:'#0f172a', sub:'#64748b', primary:'#2563eb', success:'#16a34a' };

// Chuẩn hoá dữ liệu gợi ý phòng khi API trả shape khác
function normalizeRec(raw) {
  if (!raw) return null;
  const goal = raw.goal || 'maintain';
  const bmiClass = raw.bmiClass || raw.bmi_class || 'normal';
  const days = Array.isArray(raw.days) ? raw.days : [];
  const normDays = days.map((d, i) => ({
    dow: d?.dow ?? ((i % 7) + 1),
    title: d?.title || d?.note || null,
    note: d?.note || null,
    items: Array.isArray(d?.items)
      ? d.items.map(x => ({
          exercise_id: x.exercise_id ?? x.id,
          sets: Number(x.sets || 3),
          reps: Number(x.reps || 12),
        }))
      : [],
  }));
  return { goal, bmiClass, days: normDays };
}

export default function Plan() {
  const [plans, setPlans] = useState([]);
  const [title, setTitle] = useState('Kế hoạch mới');
  const [goal, setGoal]   = useState('maintain');
  const [rec, setRec]     = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const list = await api('/api/workouts/plans');
      setPlans(Array.isArray(list) ? list : []);
    } catch (e) {
      setPlans([]);
      console.warn('GET /api/workouts/plans', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function gen() {
    try {
      const r = await api('/api/workouts/recommend');
      const n = normalizeRec(r);
      if (!n || !n.days?.length) {
        return Alert.alert('Lỗi', 'Không tạo được gợi ý. Hãy nhập thủ công hoặc thử lại.');
      }
      setRec(n);
      // khớp goal hiển thị
      setGoal(n.goal);
    } catch (e) {
      Alert.alert('Lỗi', e.message || 'Không tạo được gợi ý');
    }
  }

  async function create() {
    try {
      const body = {
        title: title?.trim() || 'Kế hoạch mới',
        goal,
        start_date: new Date().toISOString().slice(0, 10),
        days: (rec?.days || []).map((d, i) => ({
          dow: d.dow ?? ((i % 7) + 1),
          note: d.title || d.note || null,
          items: (d.items || []).map(x => ({
            exercise_id: x.exercise_id,
            sets: Number(x.sets || 3),
            reps: Number(x.reps || 12),
          })),
        })),
      };

      // Quan trọng: gửi JSON đúng chuẩn
      const resp = await api('/api/workouts/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      // Helper `api` thường trả JSON đã parse; không có `ok`.
      if (resp?.error) throw new Error(resp.error);
      if (!resp || (!resp.id && resp.status !== 'ok')) {
        throw new Error('Tạo kế hoạch thất bại');
      }

      Alert.alert('Thành công', 'Đã tạo kế hoạch');
      setRec(null);
      setTitle('Kế hoạch mới');
      setGoal('maintain');
      await load();
    } catch (e) {
      console.warn('POST /api/workouts/plans', e);
      Alert.alert('Lỗi', e.message || 'Không tạo được');
    }
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: C.bg }}
      ListHeaderComponent={
        <View style={{ padding: 16 }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: C.text }}>Kế hoạch tập luyện</Text>

          <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.b, borderRadius: 12, padding: 12, marginTop: 12 }}>
            <Text style={{ fontWeight: '700', color: C.text }}>Gợi ý theo BMI & mục tiêu</Text>
            <Text style={{ color: C.sub, marginTop: 6 }}>Nhấn “Gợi ý” để tạo skeleton lịch 1 tuần</Text>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <Pressable onPress={gen} style={{ backgroundColor: C.primary, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 }}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Gợi ý</Text>
              </Pressable>
            </View>

            {!!rec && (
              <View style={{ marginTop: 12 }}>
                <Text style={{ color: C.sub }}>{`Goal: ${rec.goal} • BMI: ${rec.bmiClass}`}</Text>

                {rec.days.map((d, i) => (
                  <View key={i} style={{ marginTop: 8, borderTopWidth: 1, borderTopColor: C.b, paddingTop: 8 }}>
                    <Text style={{ fontWeight: '700', color: C.text }}>{`D${d.dow}: ${d.title || d.note || ''}`}</Text>
                    {(d.items || []).map((it, ix) => (
                      <Text key={ix} style={{ color: C.sub, marginTop: 2 }}>
                        {`- Ex#${it.exercise_id} • ${it.sets || 3}x${it.reps || 12}`}
                      </Text>
                    ))}
                  </View>
                ))}

                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  <TextInput
                    value={title}
                    onChangeText={setTitle}
                    style={{ flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: C.b, borderRadius: 10, padding: 10 }}
                    placeholder="Tên kế hoạch"
                  />
                  <TextInput
                    value={goal}
                    onChangeText={setGoal}
                    style={{ width: 110, backgroundColor: '#fff', borderWidth: 1, borderColor: C.b, borderRadius: 10, padding: 10 }}
                    placeholder="goal"
                  />
                </View>

                <Pressable onPress={create} style={{ marginTop: 10, backgroundColor: C.success, padding: 12, borderRadius: 10 }}>
                  <Text style={{ color: '#fff', fontWeight: '800', textAlign: 'center' }}>Lưu kế hoạch</Text>
                </Pressable>
              </View>
            )}
          </View>

          <Text style={{ marginTop: 16, fontWeight: '800', color: C.text }}>
            {loading ? 'Đang tải kế hoạch…' : 'Kế hoạch của tôi'}
          </Text>
        </View>
      }
      data={plans}
      keyExtractor={(i) => String(i.id)}
      renderItem={({ item }) => (
        <View
          style={{
            backgroundColor: C.card,
            borderWidth: 1,
            borderColor: C.b,
            borderRadius: 12,
            padding: 12,
            marginHorizontal: 16,
            marginBottom: 12,
          }}
        >
          <Text style={{ fontWeight: '700', color: C.text }}>{item.title}</Text>
          <Text style={{ color: C.sub, marginTop: 4 }}>{`Goal: ${item.goal} • bắt đầu: ${item.start_date}`}</Text>
        </View>
      )}
    />
  );
}
