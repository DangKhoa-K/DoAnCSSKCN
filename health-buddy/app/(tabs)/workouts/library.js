// app/(tabs)/workouts/library.js
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { api } from '../../../src/lib/api';

const C = { bg:'#F6F7FB', card:'#fff', b:'#e5e7eb', text:'#0f172a', sub:'#64748b', primary:'#2563eb' };


// ----- filter options (khớp DB) -----
const GROUPS = [
  { key:'all', label:'Tất cả' },
  { key:'back', label:'Lưng' },
  { key:'chest', label:'Ngực' },
  { key:'shoulders', label:'Vai' },
  { key:'arms', label:'Tay' },
  { key:'legs', label:'Chân' },
  { key:'core', label:'Bụng' },
  { key:'fullbody', label:'Toàn thân (cardio)' },
];

const GOALS = [
  { key:'all', label:'Tất cả' },
  { key:'lose', label:'Giảm mỡ' },
  { key:'gain', label:'Tăng cơ' },
  { key:'maintain', label:'Giữ dáng' },
  { key:'endurance', label:'Sức bền' },
];

const TYPES = [
  { key:'all', label:'Tất cả' },
  { key:'strength', label:'Tạ/kháng lực' },
  { key:'cardio', label:'Cardio' },
  { key:'yoga', label:'Yoga' },
  { key:'stretching', label:'Giãn cơ' },
];

const EQUIPS = [
  { key:'all', label:'Tất cả' },
  { key:'none', label:'Không dụng cụ' },
  { key:'machine', label:'Machine' },
  { key:'dumbbell', label:'Dumbbell' },
  { key:'barbell', label:'Barbell' },
  { key:'cable', label:'Cable' },
  { key:'band', label:'Band' },
  { key:'bench', label:'Bench' },
  { key:'bar', label:'Pull-up bar' },
  { key:'rope', label:'Rope' },
];

function Chip({ active, onPress, children }) {
  return (
    <Pressable onPress={onPress}
      style={{
        paddingHorizontal:12, paddingVertical:8, borderRadius:999,
        borderWidth:1, borderColor: active ? C.primary : C.b,
        backgroundColor: active ? '#eaf1ff' : '#fff', marginRight:8, marginBottom:8
      }}>
      <Text style={{ color: active ? C.primary : C.text, fontWeight:'600' }}>{children}</Text>
    </Pressable>
  );
}

// small debounce hook
function useDebounced(value, ms=350){
  const [v,setV] = useState(value);
  useEffect(()=>{ const t=setTimeout(()=>setV(value), ms); return ()=>clearTimeout(t); },[value,ms]);
  return v;
}

export default function Library() {
  // filters
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState('all');
  const [goal, setGoal]     = useState('all');
  const [category, setCategory] = useState('all');
  const [equipment, setEquipment] = useState('all');

  const qDeb = useDebounced(q, 350);

  // data
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);

  // compose query string (only gửi param khác 'all' / khác rỗng)
  const queryString = useMemo(() => {
    const p = [];
    if (muscle !== 'all')   p.push(`muscle=${encodeURIComponent(muscle)}`);
    if (goal !== 'all')     p.push(`goal=${encodeURIComponent(goal)}`);
    if (category !== 'all') p.push(`category=${encodeURIComponent(category)}`);
    if (equipment !== 'all')p.push(`equipment=${encodeURIComponent(equipment)}`);
    if (qDeb)               p.push(`q=${encodeURIComponent(qDeb)}`);
    return p.length ? `?${p.join('&')}` : '';
  }, [muscle, goal, category, equipment, qDeb]);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api(`/api/exercises${queryString}`);
      setItems(Array.isArray(res) ? res : []);
    } catch (e) {
      console.warn('GET /api/exercises', e);
      setItems([]);
      Alert.alert('Lỗi', 'Không tải được thư viện bài tập');
    } finally { setLoading(false); }
  }, [queryString]);

  useEffect(() => { fetchList(); }, [fetchList]);

  // Helper
const today = () => new Date().toISOString().slice(0,10);
const toNum = (v, fb) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fb;
};

  // ---------- ACTION: Thêm vào hôm nay ----------
  const addToday = useCallback(async (ex) => {
  try {
    // recommend có thể là string JSON trong DB
    const rec = typeof ex.recommend === 'string'
      ? (JSON.parse(ex.recommend || '{}') || {})
      : (ex.recommend || {});
    const category = String(ex.category || ex.type || '').toLowerCase();

    const payload = { date: today(), exercise_id: ex.id };

    if (category === 'cardio') {
      // chỉ cardio mới có duration_min
      const rawDur = rec.duration_min ?? rec.duration ?? rec.time ?? null;
      const dur = toNum(rawDur, 20);            // fallback 20'
      payload.duration_min = dur;
      // tuyệt đối không gửi sets/reps nếu là cardio
    } else {
      // strength / yoga / stretching
      if (rec.hold_sec != null) {
        payload.sets     = toNum(rec.sets, 3);
        payload.hold_sec = toNum(rec.hold_sec, 45);
        payload.rest_sec = toNum(rec.rest_sec, 45);
      } else {
        payload.sets     = toNum(rec.sets, 3);
        payload.reps     = toNum(rec.reps, 12);
        payload.rest_sec = toNum(rec.rest_sec, 60);
      }
      // tuyệt đối không gửi duration_min cho non-cardio
    }

    await api('/api/workouts/sessions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    Alert.alert('Đã thêm', `Đã thêm "${ex.name}" vào buổi tập hôm nay.`);
  } catch (e) {
    console.warn('POST /api/workouts/sessions', e);
    Alert.alert('Lỗi', e?.message || 'Không thể thêm vào hôm nay.');
  }
}, []);

  // ---------- ACTION: Thêm vào kế hoạch (giữ nguyên) ----------
  const addToPlan = useCallback((ex) => {
    Alert.alert('Thêm vào kế hoạch', `Bài "${ex.name}" sẽ được gắn ở màn hình Kế hoạch.`);
  }, []);

  // header
  const header = (
    <View style={{ padding:16 }}>
      <Text style={{ fontSize:22, fontWeight:'800', color:C.text }}>Thư viện bài tập</Text>
      <Text style={{ color:C.sub, marginTop:4 }}>Lọc theo nhóm cơ, mục tiêu, loại bài và thiết bị.</Text>

      <TextInput
        value={q} onChangeText={setQ} placeholder="Tìm: lat pulldown, squat, plank…"
        style={{ marginTop:12, backgroundColor:'#fff', borderWidth:1, borderColor:C.b, borderRadius:12, padding:12 }}
        placeholderTextColor="#9ca3af"
      />

      <Text style={{ marginTop:14, fontWeight:'700', color:C.text }}>Nhóm cơ</Text>
      <View style={{ flexDirection:'row', flexWrap:'wrap', marginTop:8 }}>
        {GROUPS.map(g => (
          <Chip key={g.key} active={muscle===g.key} onPress={()=>setMuscle(g.key)}>{g.label}</Chip>
        ))}
      </View>

      <Text style={{ marginTop:8, fontWeight:'700', color:C.text }}>Mục tiêu</Text>
      <View style={{ flexDirection:'row', flexWrap:'wrap', marginTop:8 }}>
        {GOALS.map(g => (
          <Chip key={g.key} active={goal===g.key} onPress={()=>setGoal(g.key)}>{g.label}</Chip>
        ))}
      </View>

      <Text style={{ marginTop:8, fontWeight:'700', color:C.text }}>Loại bài</Text>
      <View style={{ flexDirection:'row', flexWrap:'wrap', marginTop:8 }}>
        {TYPES.map(g => (
          <Chip key={g.key} active={category===g.key} onPress={()=>setCategory(g.key)}>{g.label}</Chip>
        ))}
      </View>

      <Text style={{ marginTop:8, fontWeight:'700', color:C.text }}>Thiết bị</Text>
      <View style={{ flexDirection:'row', flexWrap:'wrap', marginTop:8 }}>
        {EQUIPS.map(g => (
          <Chip key={g.key} active={equipment===g.key} onPress={()=>setEquipment(g.key)}>{g.label}</Chip>
        ))}
      </View>
    </View>
  );

  return (
    <FlatList
      style={{ flex:1, backgroundColor:C.bg }}
      ListHeaderComponent={header}
      data={items}
      keyExtractor={(it)=>String(it.id)}
      ListEmptyComponent={
        <Text style={{ textAlign:'center', color:C.sub, marginTop:30 }}>
          {loading ? 'Đang tải…' : 'Không có bài phù hợp với bộ lọc.'}
        </Text>
      }
      renderItem={({ item }) => {
        const rec = item.recommend || {};
        const equipText = item.equipment || 'none';
        const muscleText = item.muscle_group || '-';
        const typeText = item.category || '-';
        const cue = item.cues;

        const recText =
          typeof rec.duration_min === 'number'
            ? `${rec.duration_min} phút`
            : `${rec.sets||3} hiệp × ${rec.reps||12} reps${rec.rest_sec?` • nghỉ ${rec.rest_sec}s`:''}`;

        return (
          <View style={{
            marginHorizontal:16, marginBottom:12,
            backgroundColor:C.card, borderWidth:1, borderColor:C.b, borderRadius:12, padding:12
          }}>
            <Text style={{ fontWeight:'700', color:C.text }}>{item.name}</Text>
            <Text style={{ color:C.sub, marginTop:4 }}>
              Nhóm cơ: {muscleText} • Loại: {typeText} • Thiết bị: {equipText}
            </Text>
            <Text style={{ color:C.sub, marginTop:4 }}>Gợi ý: {recText}</Text>
            {cue ? <Text style={{ color:C.sub, marginTop:4 }}>Lưu ý: {cue}</Text> : null}

            <View style={{ flexDirection:'row', gap:10, marginTop:10, flexWrap:'wrap' }}>
              <Pressable
                onPress={()=>addToday(item)}
                style={{ backgroundColor:C.primary, paddingVertical:10, paddingHorizontal:14, borderRadius:10 }}
              >
                <Text style={{ color:'#fff', fontWeight:'700' }}>Thêm vào hôm nay</Text>
              </Pressable>

              <Pressable
                onPress={()=>addToPlan(item)}
                style={{ backgroundColor:'#eaf1ff', paddingVertical:10, paddingHorizontal:14, borderRadius:10, borderWidth:1, borderColor:C.primary }}
              >
                <Text style={{ color:C.primary, fontWeight:'700' }}>Thêm vào kế hoạch</Text>
              </Pressable>
            </View>
          </View>
        );
      }}
    />
  );
}
