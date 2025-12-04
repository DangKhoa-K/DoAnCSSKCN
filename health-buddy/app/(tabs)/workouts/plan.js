import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { api } from '../../../src/lib/api';

const C = { bg:'#F0F6FF', card:'#FFFFFF', b:'#DCE7FF', text:'#0F172A', sub:'#64748B', primary:'#2563EB', success:'#16A34A' };

function normalizeRec(raw) {
  if (!raw) return null;
  const goal = raw.goal || 'maintain';
  const bmiClass = raw.bmiClass || raw.bmi_class || 'normal';
  const variant = raw.variant || 'balanced';
  const days = Array.isArray(raw.days) ? raw.days : [];
  return { goal, bmiClass, variant, ...raw, days };
}

export default function Plan() {
  const r = useRouter();

  const [title, setTitle] = useState('Kế hoạch 7 ngày');
  const [variant, setVariant] = useState('balanced'); // balanced|cardio|strength
  const [rec, setRec] = useState(null);
  const [goalOverride, setGoalOverride] = useState('maintain');
  const [loadingSave, setLoadingSave] = useState(false);

  async function gen() {
    try {
      const rj = await api(`/api/recs/workouts?variant=${variant}`);
      const n = normalizeRec(rj);
      if (!n || !n.days?.length) {
        return Alert.alert('Lỗi', 'Không tạo được gợi ý. Hãy thử lại hoặc kiểm tra dữ liệu bài tập.');
      }
      setRec(n);
      setGoalOverride(n.goal || 'maintain');
    } catch (e) {
      Alert.alert('Lỗi', e.message || 'Không tạo được gợi ý');
    }
  }

  async function save7Days() {
    try {
      if (!rec?.days?.length) return Alert.alert('Lỗi', 'Chưa có gợi ý để lưu.');
      setLoadingSave(true);

      const start = new Date().toISOString().slice(0,10);
      const body = {
        title: title?.trim() || 'Kế hoạch 7 ngày',
        goal: goalOverride || rec.goal || 'maintain',
        start_date: start,
        days: rec.days.map((d, i) => ({
          dow: d.dow ?? ((i % 7) + 1),
          note: d.note || null,
          items: (d.items || []).map(x => ({
            exercise_id: x.exercise_id || x.id,
            sets: x.sets ?? (String(x.category||'').toLowerCase()==='cardio' ? null : 3),
            reps: x.reps ?? (String(x.category||'').toLowerCase()==='cardio' ? null : 12),
            duration_min: x.duration_min ?? (String(x.category||'').toLowerCase()==='cardio' ? (x.minutes ?? 20) : null),
            rest_sec: x.rest_sec ?? 60,
          })),
        })),
      };

      const resp = await api('/api/workouts/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (resp?.error) throw new Error(resp.error);
      const planId = resp?.id || resp?.plan_id || null;
      if (!planId) throw new Error('Tạo kế hoạch thất bại');

      Alert.alert('Thành công', 'Đã lưu kế hoạch 7 ngày. Đặt giờ tập cho từng ngày.');
      r.replace({ pathname: '/(tabs)/workouts/reminders', params: { planId } });
    } catch (e) {
      Alert.alert('Lỗi', e.message || 'Không lưu được kế hoạch');
    } finally {
      setLoadingSave(false);
    }
  }

  function updateItem(dayIndex, itemIndex, patch) {
    const days = [...(rec?.days || [])];
    const d = days[dayIndex] || {};
    const items = [...(d.items || [])];
    items[itemIndex] = { ...items[itemIndex], ...patch };
    days[dayIndex] = { ...d, items };
    setRec({ ...rec, days });
  }
  function reorderItem(dayIndex, itemIndex, dir) {
    const days = [...(rec?.days || [])];
    const d = days[dayIndex] || {};
    const items = [...(d.items || [])];
    if (dir === 'up' && itemIndex > 0) {
      [items[itemIndex - 1], items[itemIndex]] = [items[itemIndex], items[itemIndex - 1]];
    } else if (dir === 'down' && itemIndex < items.length - 1) {
      [items[itemIndex + 1], items[itemIndex]] = [items[itemIndex], items[itemIndex + 1]];
    }
    days[dayIndex] = { ...d, items };
    setRec({ ...rec, days });
  }
  function removeItem(dayIndex, itemIndex) {
    const days = [...(rec?.days || [])];
    const d = days[dayIndex] || {};
    const items = (d.items || []).filter((_, j) => j !== itemIndex);
    days[dayIndex] = { ...d, items };
    setRec({ ...rec, days });
  }

  return (
    <ScrollView style={{ flex:1, backgroundColor:C.bg }} contentContainerStyle={{ padding:16 }}>
      <View style={{ marginBottom: 12 }}>
        <View style={{ height: 110, borderRadius: 16, backgroundColor: '#3B82F6' }}>
          <View style={{ flex:1, borderRadius:16, padding:16, justifyContent:'flex-end' }}>
            <Text style={{ fontSize:22, fontWeight:'800', color:'#fff' }}>Kế hoạch 7 ngày</Text>
            <Text style={{ color:'#E2E8F0', marginTop:4 }}>Gợi ý theo BMI & mục tiêu</Text>
          </View>
        </View>
      </View>

      <View style={{ backgroundColor: C.card, borderWidth:1, borderColor:C.b, borderRadius:16, padding:12,
        shadowColor:'#93C5FD', shadowOpacity:0.06, shadowRadius:5, elevation:1 }}>
        <Text style={{ fontWeight:'700', color:C.text }}>Chọn kiểu chương trình</Text>
        <Text style={{ color:C.sub, marginTop:6 }}>Nhấn “Gợi ý” để tạo lịch 7 ngày</Text>

        <View style={{ flexDirection:'row', flexWrap:'wrap', marginTop:8 }}>
          {['balanced','cardio','strength'].map(v => (
            <Pressable key={v} onPress={()=>setVariant(v)} style={{
              paddingHorizontal:12, paddingVertical:8, borderRadius:999,
              borderWidth:1, borderColor: variant===v ? C.primary : C.b,
              backgroundColor: variant===v ? '#EAF1FF' : '#fff',
              marginRight:8, marginBottom:8
            }}>
              <Text style={{ color: variant===v ? C.primary : C.text, fontWeight:'600' }}>
                {v==='balanced' ? 'Cân bằng' : v==='cardio' ? 'Cardio ưu tiên' : 'Strength ưu tiên'}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={{ flexDirection:'row', gap:8, marginTop:10 }}>
          <Pressable onPress={gen} style={{ backgroundColor:C.primary, paddingVertical:10, paddingHorizontal:14, borderRadius:10 }}>
            <Text style={{ color:'#fff', fontWeight:'700' }}>Gợi ý</Text>
          </Pressable>
        </View>
      </View>

      {!!rec && (
        <View style={{ marginTop:12 }}>
          <View style={{ backgroundColor:C.card, borderWidth:1, borderColor:C.b, borderRadius:16, padding:12,
            shadowColor:'#93C5FD', shadowOpacity:0.06, shadowRadius:5, elevation:1 }}>
            <Text style={{ color:C.sub }}>
              {`Goal: ${rec.goal} • BMI: ${rec.bmiClass} • Daily burn target: ${rec.daily_burn_target} kcal`}
            </Text>
            <Text style={{ color:C.sub, marginTop:4 }}>
              {`Weekly dự kiến: ${rec.weekly_calories_est} kcal • Weekly target: ${rec.weekly_burn_target} kcal`}
            </Text>
          </View>

          {rec.days.map((d, i) => {
            const estDay = d.calories_est ?? (d.items || []).reduce((s, x) => s + Number(x.calories || 0), 0);
            return (
              <View key={i} style={{ marginTop:8, backgroundColor:C.card, borderWidth:1, borderColor:C.b, borderRadius:16, padding:12,
                shadowColor:'#93C5FD', shadowOpacity:0.06, shadowRadius:5, elevation:1 }}>
                <Text style={{ fontWeight:'700', color:C.text }}>{`D${d.dow}: ${d.note}`}</Text>
                <Text style={{ color:C.sub, marginTop:2 }}>Ước tính buổi: {estDay} kcal</Text>

                {(d.items || []).map((it, ix) => {
                  const isCardio = String(it.category || '').toLowerCase() === 'cardio';
                  return (
                    <View key={ix} style={{ marginTop:8, padding:8, borderWidth:1, borderColor:C.b, borderRadius:10, backgroundColor:'#F8FAFF' }}>
                      <Text style={{ color:C.text, fontWeight:'600' }}>
                        {it.name || `Ex#${it.exercise_id}`} • {isCardio ? 'Cardio' : 'Strength'}
                      </Text>

                      <View style={{ flexDirection:'row', gap:8, marginTop:6 }}>
                        <Pressable onPress={()=>reorderItem(i, ix, 'up')}
                          style={{ borderWidth:1, borderColor:C.b, paddingVertical:6, paddingHorizontal:10, borderRadius:8, backgroundColor:'#fff' }}>
                          <Text>↑ Lên</Text>
                        </Pressable>
                        <Pressable onPress={()=>reorderItem(i, ix, 'down')}
                          style={{ borderWidth:1, borderColor:C.b, paddingVertical:6, paddingHorizontal:10, borderRadius:8, backgroundColor:'#fff' }}>
                          <Text>↓ Xuống</Text>
                        </Pressable>
                        <Pressable onPress={()=>removeItem(i, ix)}
                          style={{ borderWidth:1, borderColor:'#fecaca', paddingVertical:6, paddingHorizontal:10, borderRadius:8, backgroundColor:'#fee2e2' }}>
                          <Text style={{ color:'#b91c1c', fontWeight:'700' }}>Xoá</Text>
                        </Pressable>
                      </View>

                      {isCardio ? (
                        <View style={{ flexDirection:'row', gap:8, marginTop:8 }}>
                          <TextInput
                            value={String(it.duration_min ?? it.minutes ?? '')}
                            onChangeText={(v) => updateItem(i, ix, { duration_min: Number(v) || null })}
                            keyboardType="numeric"
                            placeholder="Thời lượng (phút)"
                            style={{ flex:1, borderWidth:1, borderColor:C.b, borderRadius:8, padding:8, backgroundColor:'#fff' }}
                          />
                        </View>
                      ) : (
                        <View style={{ flexDirection:'row', gap:8, marginTop:8, flexWrap:'wrap' }}>
                          <TextInput
                            value={String(it.sets ?? '')}
                            onChangeText={(v) => updateItem(i, ix, { sets: Number(v) || null })}
                            keyboardType="numeric"
                            placeholder="Hiệp (sets)"
                            style={{ flex:1, minWidth:90, borderWidth:1, borderColor:C.b, borderRadius:8, padding:8, backgroundColor:'#fff' }}
                          />
                          <TextInput
                            value={String(it.reps ?? '')}
                            onChangeText={(v) => updateItem(i, ix, { reps: Number(v) || null })}
                            keyboardType="numeric"
                            placeholder="Số lần (reps)"
                            style={{ flex:1, minWidth:90, borderWidth:1, borderColor:C.b, borderRadius:8, padding:8, backgroundColor:'#fff' }}
                          />
                          <TextInput
                            value={String(it.rest_sec ?? '')}
                            onChangeText={(v) => updateItem(i, ix, { rest_sec: Number(v) || null })}
                            keyboardType="numeric"
                            placeholder="Nghỉ (giây)"
                            style={{ flex:1, minWidth:90, borderWidth:1, borderColor:C.b, borderRadius:8, padding:8, backgroundColor:'#fff' }}
                          />
                        </View>
                      )}

                      <Text style={{ color:C.sub, marginTop:6 }}>
                        {`~${it.calories || 0} kcal • ${isCardio ? `${it.minutes || it.duration_min || 20} phút` : `${it.sets || 3}x${it.reps || 12}`}`}
                      </Text>
                    </View>
                  );
                })}
              </View>
            );
          })}

          <View style={{ marginTop:12, backgroundColor:C.card, borderWidth:1, borderColor:C.b, borderRadius:16, padding:12 }}>
            <View style={{ flexDirection:'row', gap:8 }}>
              <TextInput
                value={title}
                onChangeText={setTitle}
                style={{ flex:1, backgroundColor:'#fff', borderWidth:1, borderColor:C.b, borderRadius:10, padding:10 }}
                placeholder="Tên kế hoạch (7 ngày)"
              />
              <TextInput
                value={goalOverride}
                onChangeText={setGoalOverride}
                style={{ width:120, backgroundColor:'#fff', borderWidth:1, borderColor:C.b, borderRadius:10, padding:10 }}
                placeholder="goal"
              />
            </View>

            <Pressable onPress={save7Days} disabled={loadingSave}
              style={{ marginTop:10, backgroundColor:C.success, padding:12, borderRadius:10, opacity: loadingSave?0.7:1 }}>
              <Text style={{ color:'#fff', fontWeight:'800', textAlign:'center' }}>
                {loadingSave ? 'Đang lưu…' : 'Lưu kế hoạch 7 ngày'}
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </ScrollView>
  );
}