import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { api } from '../../../src/lib/api';
import { ensureAndroidChannel, ensureNotiPermission, scheduleDaily } from '../../../src/lib/notifications';

const C = { bg:'#F6F7FB', card:'#fff', b:'#eef2ff', text:'#0f172a', sub:'#64748b', primary:'#2563eb', overdue:'#ef4444', upcoming:'#16a34a' };
const today = () => new Date().toISOString().slice(0,10);

function Card({ title, children }) {
  return (
    <View style={{
      backgroundColor:C.card, borderRadius:16, padding:12, marginTop:12,
      borderWidth:1, borderColor:C.b, shadowColor:'#000', shadowOpacity:0.06, shadowRadius:10, shadowOffset:{width:0,height:4}
    }}>
      <Text style={{ fontWeight:'800', color:C.text, marginBottom:8 }}>{title}</Text>
      {children}
    </View>
  );
}

// Gợi ý chăm sóc theo bệnh đơn giản
const CONDITION_HINTS = {
  'đau đầu': [
    'Nghỉ ngơi trong không gian yên tĩnh, giảm ánh sáng màn hình trong 30–60 phút.',
    'Uống 200–300 ml nước ấm, tránh cà phê nếu nhức đầu do căng thẳng.',
    'Thử hít thở 4–4–4–4 trong 3 phút (box breathing).',
    'Nếu đau đầu dữ dội kéo dài >24h hoặc kèm sốt cao, cân nhắc liên hệ cơ sở y tế.'
  ],
  'cảm cúm': [
    'Nghỉ ngơi, giữ ấm cơ thể, bổ sung nước ấm (2–2.5L/ngày).',
    'Súc miệng nước muối loãng 2–3 lần/ngày, hạn chế đồ lạnh.',
    'Ăn nhẹ, đủ chất; bổ sung vitamin C nếu phù hợp.',
    'Nếu sốt >38.5°C kéo dài hoặc khó thở, liên hệ cơ sở y tế.'
  ],
  'viêm dạ dày': [
    'Chia nhỏ bữa ăn, tránh cay/nhiều dầu mỡ, hạn chế cà phê/rượu.',
    'Uống nước ấm từng ngụm nhỏ thường xuyên.',
    'Nghỉ ngơi sau ăn 20–30 phút, tránh nằm ngay.',
    'Nếu đau bụng dữ dội, nôn ói nhiều, đi khám sớm.'
  ],
};

const SIMPLE_CONDITIONS = ['đau đầu','cảm cúm','viêm dạ dày','dị ứng nhẹ','mất ngủ'];

export default function Meds() {
  const router = useRouter();
  const [date] = useState(today());
  const [items, setItems] = useState([]);
  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  const [time, setTime] = useState('08:00');
  const [editing, setEditing] = useState(false);
  const [days, setDays] = useState([1,2,3,4,5,6,7]);
  const [condition, setCondition] = useState(''); // loại bệnh đơn giản để gợi ý
  const isIOS = Platform.OS === 'ios';

  const load = useCallback(async () => {
    try { const m = await api(`/api/medications/today?date=${date}`); setItems(Array.isArray(m)?m:[]); } catch {}
  }, [date]);

  useEffect(() => { ensureAndroidChannel().catch(()=>{}); }, []);
  useEffect(() => { load(); }, [load]);

  function currentDate(){ const [h,m] = time.split(':').map(Number); return new Date(2000,0,1,h,m); }
  function openPicker(){ setEditing(true); }
  function onAndroidChange(e, selectedDate){
    if (e.type==='dismissed') { setEditing(false); return; }
    if (selectedDate){ const hh = String(selectedDate.getHours()).padStart(2,'0'); const mm = String(selectedDate.getMinutes()).padStart(2,'0'); setTime(`${hh}:${mm}`); }
    setEditing(false);
  }
  function oniOSChange(_e, selectedDate){
    if (!selectedDate) return; const hh = String(selectedDate.getHours()).padStart(2,'0'); const mm = String(selectedDate.getMinutes()).padStart(2,'0'); setTime(`${hh}:${mm}`);
  }
  function closeIOS(){ setEditing(false); }
  function toggleDow(d){ setDays(prev => prev.includes(d) ? prev.filter(x=>x!==d) : [...prev, d].sort((a,b)=>a-b)); }

  async function add() {
    if (!name.trim()) return Alert.alert('Lỗi','Nhập tên thuốc/vitamin');
    try {
      await api('/api/medications', { method:'POST', body: { date, name, dose: dose || null, schedule_time: time, schedule_dows: days, condition_hint: condition || null } });
      const ok = await ensureNotiPermission();
      if (ok) { await scheduleDaily(time, 'Nhắc uống thuốc', `${name}${dose?` • ${dose}`:''}`); }
      setName(''); setDose(''); load(); Alert.alert('Đã lưu', 'Đã thêm thuốc và bật nhắc.');
    } catch (err) { Alert.alert('Lỗi', err?.message || 'Không lưu được'); }
  }

  async function mark(item, status) {
    try {
      await api('/api/medications/logs', { method:'POST', body: { med_id:item.id, status, date } }).catch(()=>null);
      setItems(prev => prev.map(x => x.id===item.id ? { ...x, taken: status==='taken' ? true : x.taken } : x));
    } catch (err) { Alert.alert('Lỗi', err?.message || 'Không cập nhật được'); }
  }

  const hints = (CONDITION_HINTS[condition?.toLowerCase()] || []);

  return (
    <>
      <View style={{ flex:1, backgroundColor:'#f0f6ff' }}>
        <View style={{ padding:16 }}>
          <Pressable onPress={()=>router.back()}><Text style={{ color:C.primary, marginBottom:8 }}>‹ Quay lại</Text></Pressable>
          <View style={{
            backgroundColor:'#fff', borderRadius:18, padding:16,
            borderWidth:1, borderColor:C.b, shadowColor:'#000', shadowOpacity:0.06, shadowRadius:10, shadowOffset:{width:0,height:4}
          }}>
            <Text style={{ fontSize:22, fontWeight:'800', color:C.text }}>Thuốc & nhắc nhở</Text>
            <Text style={{ color:C.sub, marginTop:4 }}>Thêm thuốc/vitamin, chọn bệnh đơn giản để nhận gợi ý chăm sóc.</Text>

            <Card title="Thêm thuốc">
              <Text style={{ color:C.sub }}>Tên thuốc/vitamin *</Text>
              <TextInput value={name} onChangeText={setName} placeholder="Nhập tên..." placeholderTextColor="#9ca3af"
                style={{ borderWidth:1, borderColor:'#e5e7eb', borderRadius:10, padding:10, backgroundColor:'#fff', marginTop:6 }} />
              <Text style={{ color:C.sub, marginTop:10 }}>Liều lượng</Text>
              <TextInput value={dose} onChangeText={setDose} placeholder="Ví dụ: 1 viên / 1000 IU" placeholderTextColor="#9ca3af"
                style={{ borderWidth:1, borderColor:'#e5e7eb', borderRadius:10, padding:10, backgroundColor:'#fff', marginTop:6 }} />

              <Text style={{ color:C.sub, marginTop:10 }}>Bệnh/triệu chứng đơn giản</Text>
              <View style={{ flexDirection:'row', gap:6, flexWrap:'wrap', marginTop:6 }}>
                {SIMPLE_CONDITIONS.map(c => (
                  <Pressable key={c} onPress={()=>setCondition(c)} style={{
                    paddingVertical:8, paddingHorizontal:12, borderRadius:999,
                    borderWidth:1, borderColor: condition===c ? '#2563eb' : '#e5e7eb',
                    backgroundColor: condition===c ? '#eaf1ff' : '#fff'
                  }}>
                    <Text style={{ color: condition===c ? '#2563eb' : '#0f172a', fontWeight:'700' }}>{c}</Text>
                  </Pressable>
                ))}
              </View>

              {hints.length > 0 && (
                <View style={{ marginTop:10, backgroundColor:'#F8FAFF', borderWidth:1, borderColor:'#E6ECFF', borderRadius:12, padding:10 }}>
                  <Text style={{ fontWeight:'700', color:C.text }}>Gợi ý chăm sóc: {condition}</Text>
                  {hints.map((t,i)=> <Text key={i} style={{ color:C.sub, marginTop:4 }}>• {t}</Text>)}
                </View>
              )}

              <Text style={{ color:C.sub, marginTop:10 }}>Giờ nhắc</Text>
              <Pressable onPress={openPicker} style={{ borderWidth:1, borderColor:'#e5e7eb', borderRadius:10, padding:10, backgroundColor:'#fff', marginTop:6 }}>
                <Text style={{ color:C.text }}>{time}</Text>
              </Pressable>

              <Text style={{ color:C.sub, marginTop:10 }}>Lặp theo ngày (D1..D7)</Text>
              <View style={{ flexDirection:'row', gap:6, flexWrap:'wrap', marginTop:6 }}>
                {[1,2,3,4,5,6,7].map(d=>(
                  <Pressable key={d} onPress={()=>toggleDow(d)} style={{
                    paddingVertical:8, paddingHorizontal:12, borderRadius:8,
                    borderWidth:1, borderColor:days.includes(d)? '#2563eb':'#e5e7eb', backgroundColor:days.includes(d)? '#eaf1ff':'#fff'
                  }}>
                    <Text style={{ color:days.includes(d)?'#2563eb':'#0f172a', fontWeight:'700' }}>D{d}</Text>
                  </Pressable>
                ))}
              </View>

              <View style={{ marginTop:12, flexDirection:'row', justifyContent:'flex-end' }}>
                <Pressable onPress={add} style={{ backgroundColor:C.primary, paddingVertical:10, paddingHorizontal:16, borderRadius:10 }}>
                  <Text style={{ color:'#fff', fontWeight:'800' }}>Lưu & bật nhắc</Text>
                </Pressable>
              </View>
            </Card>

            <Text style={{ marginTop:12, fontWeight:'800', color:C.text }}>Trong ngày</Text>
            <FlatList
              style={{ marginTop:8 }}
              data={items}
              keyExtractor={i=>String(i.id)}
              renderItem={({ item }) => (
                <View style={{ marginBottom:10, backgroundColor:C.card, borderWidth:1, borderColor:C.b, borderRadius:12, padding:12 }}>
                  <Text style={{ fontWeight:'700', color:C.text }}>{item.name}</Text>
                  <Text style={{ color:C.sub, marginTop:4 }}>{item.dose || '—'}</Text>
                  <Text style={{ color:item.taken?C.upcoming:C.overdue, marginTop:4 }}>
                    {item.taken ? 'Đã uống' : 'Chưa uống'}
                  </Text>
                  <View style={{ flexDirection:'row', gap:8, marginTop:8 }}>
                    <Pressable onPress={()=>mark(item,'taken')} style={{ backgroundColor:'#eaf1ff', borderWidth:1, borderColor:'#dbe7ff', paddingVertical:6, paddingHorizontal:10, borderRadius:8 }}>
                      <Text style={{ color:'#2563eb', fontWeight:'700' }}>Đã uống</Text>
                    </Pressable>
                    <Pressable onPress={()=>Alert.alert('Snooze','Nhắc lại sau 10 phút (local)')} style={{ backgroundColor:'#fff7ed', borderWidth:1, borderColor:'#fed7aa', paddingVertical:6, paddingHorizontal:10, borderRadius:8 }}>
                      <Text style={{ color:'#c2410c', fontWeight:'700' }}>Snooze 10’</Text>
                    </Pressable>
                    <Pressable onPress={()=>mark(item,'skipped')} style={{ backgroundColor:'#fee2e2', borderWidth:1, borderColor:'#fecaca', paddingVertical:6, paddingHorizontal:10, borderRadius:8 }}>
                      <Text style={{ color:'#b91c1c', fontWeight:'700' }}>Bỏ qua</Text>
                    </Pressable>
                  </View>
                </View>
              )}
              ListEmptyComponent={<Text style={{ color:C.sub, textAlign:'center', marginTop:10 }}>Chưa có mục hôm nay.</Text>}
            />
          </View>
        </View>
      </View>

      {Platform.OS === 'android' && editing && (
        <DateTimePicker value={currentDate()} mode="time" is24Hour={true} display="default" onChange={onAndroidChange} />
      )}
      {isIOS && editing && (
        <View style={{ position:'absolute', left:0, right:0, bottom:0, top:0, backgroundColor:'rgba(0,0,0,0.2)', justifyContent:'flex-end' }}>
          <View style={{ backgroundColor:'#fff', borderTopLeftRadius:16, borderTopRightRadius:16, padding:12 }}>
            <Text style={{ fontWeight:'700', color:C.text, marginBottom:8 }}>Đang chọn giờ nhắc</Text>
            <DateTimePicker value={currentDate()} mode="time" is24Hour={true} display="spinner" onChange={oniOSChange} />
            <View style={{ flexDirection:'row', gap:8, marginTop:10 }}>
              <Pressable onPress={closeIOS} style={{ flex:1, backgroundColor:C.primary, paddingVertical:10, borderRadius:10 }}>
                <Text style={{ color:'#fff', fontWeight:'700', textAlign:'center' }}>Xong</Text>
              </Pressable>
              <Pressable onPress={closeIOS} style={{ flex:1, backgroundColor:'#EEF2FF', borderWidth:1, borderColor:'#C7D2FE', paddingVertical:10, borderRadius:10 }}>
                <Text style={{ color:'#1E40AF', fontWeight:'700', textAlign:'center' }}>Huỷ</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </>
  );
}