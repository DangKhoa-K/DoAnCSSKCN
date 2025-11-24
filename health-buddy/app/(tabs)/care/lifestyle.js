// app/(tabs)/care/lifestyle.js
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { api } from '../../../src/lib/api';

const C = { bg:'#F6F7FB', card:'#fff', b:'#e5e7eb', text:'#0f172a', sub:'#64748b', primary:'#2563eb' };
const today = () => new Date().toISOString().slice(0,10);

export default function Lifestyle() {
  const router = useRouter();
  const [date] = useState(today());
  const [water, setWater] = useState(0);
  const [amount, setAmount] = useState('300');
  const [mood, setMood] = useState(3);     // 1-5
  const [stress, setStress] = useState(2); // 1-5
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    try {
      const h = await api(`/api/hydration/logs?date=${date}`);
      setWater((h||[]).reduce((t,x)=>t+Number(x.amount_ml||0),0));
    } catch (err) { console.warn(err); }
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const goal = 2000;
  const left = useMemo(()=>Math.max(0, goal - water), [goal, water]);

  async function addWater(qty) {
    const v = Number(qty||0);
    if (!v) return Alert.alert('Lỗi','Nhập ml hợp lệ');
    try {
      await api('/api/hydration/logs', { method:'POST', body: JSON.stringify({ date, amount_ml:v }) });
      setAmount('300'); load();
    } catch (err) { Alert.alert('Lỗi', err?.message || 'Không lưu được'); }
  }

  async function saveNote() {
    try {
      const content = `mood:${mood}, stress:${stress}${note?` • ${note}`:''}`;
      await api('/api/health/notes', { method:'POST', body: JSON.stringify({ date, note: content }) });
      setNote('');
      Alert.alert('Đã lưu', 'Đánh giá sinh hoạt đã được ghi.');
    } catch (err) { Alert.alert('Lỗi', err?.message || 'Không lưu được'); }
  }

  return (
    <ScrollView style={{ flex:1, backgroundColor:C.bg, padding:16 }}>
      <Pressable onPress={()=>router.back()}><Text style={{ color:C.primary, marginBottom:8 }}>‹ Quay lại</Text></Pressable>
      <Text style={{ fontSize:22, fontWeight:'800', color:C.text }}>Sinh hoạt & Sức khỏe cá nhân</Text>

      <View style={{ backgroundColor:C.card, borderWidth:1, borderColor:C.b, borderRadius:12, padding:12, marginTop:12 }}>
        <Text style={{ fontWeight:'700', color:C.text }}>Nước uống</Text>
        <Text style={{ color:C.sub, marginTop:4 }}>Hôm nay: {water} ml • Còn lại: {left} ml / {goal/1000}L</Text>
        <View style={{ flexDirection:'row', gap:8, marginTop:10, flexWrap:'wrap' }}>
          {[200,300,500].map(m => (
            <Pressable key={m} onPress={()=>addWater(m)}
              style={{ borderWidth:1, borderColor:'#dbe7ff', backgroundColor:'#eef5ff', borderRadius:10, paddingVertical:8, paddingHorizontal:12 }}>
              <Text style={{ color:C.primary, fontWeight:'700' }}>+{m} ml</Text>
            </Pressable>
          ))}
        </View>
        <View style={{ flexDirection:'row', gap:8, marginTop:10 }}>
          <TextInput value={amount} onChangeText={setAmount} keyboardType="numeric"
            placeholder="ml" placeholderTextColor="#9ca3af"
            style={{ flex:1, borderWidth:1, borderColor:C.b, borderRadius:10, padding:10, backgroundColor:'#fff' }} />
          <Button title="Thêm" onPress={()=>addWater(amount)} />
        </View>
      </View>

      <View style={{ backgroundColor:C.card, borderWidth:1, borderColor:C.b, borderRadius:12, padding:12, marginTop:12 }}>
        <Text style={{ fontWeight:'700', color:C.text }}>Tâm trạng & Căng thẳng</Text>
        <SliderRow label="Tâm trạng" value={mood} onChange={setMood} />
        <SliderRow label="Căng thẳng" value={stress} onChange={setStress} />
        <TextInput
          value={note} onChangeText={setNote} placeholder="Ghi chú (tuỳ chọn)"
          placeholderTextColor="#9ca3af"
          style={{ marginTop:10, borderWidth:1, borderColor:C.b, borderRadius:10, padding:10, backgroundColor:'#fff' }}
        />
        <View style={{ marginTop:10 }}>
          <Button title="Lưu đánh giá" onPress={saveNote} />
        </View>
      </View>

      <View style={{ backgroundColor:C.card, borderWidth:1, borderColor:C.b, borderRadius:12, padding:12, marginTop:12 }}>
        <Text style={{ fontWeight:'700', color:C.text }}>Nhắc nhở gợi ý</Text>
        <Text style={{ color:C.sub, marginTop:4 }}>
          • Uống nước mỗi 2–3 giờ • Giãn cơ 5′ sau 60′ làm việc • Hít thở sâu 3′ trước khi ngủ
        </Text>
      </View>
    </ScrollView>
  );
}

function SliderRow({ label, value, onChange }) {
  return (
    <View style={{ marginTop:10 }}>
      <Text style={{ color:'#64748b' }}>{label}: <Text style={{ fontWeight:'800', color:'#0f172a' }}>{value}/5</Text></Text>
      <View style={{ flexDirection:'row', gap:8, marginTop:6 }}>
        {[1,2,3,4,5].map(n=>(
          <Pressable key={n} onPress={()=>onChange(n)}
            style={{ paddingVertical:8, paddingHorizontal:12, borderRadius:8, borderWidth:1, borderColor:n===value? '#2563eb':'#e5e7eb', backgroundColor:n===value? '#eaf1ff':'#fff' }}>
            <Text style={{ color:n===value?'#2563eb':'#0f172a', fontWeight:'700' }}>{n}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
