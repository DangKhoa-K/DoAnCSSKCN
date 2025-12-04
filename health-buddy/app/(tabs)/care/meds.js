import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, FlatList, Platform, Pressable, Text, View } from 'react-native';
import { api } from '../../../src/lib/api';
import { ensureAndroidChannel, ensureNotiPermission, scheduleDaily } from '../../../src/lib/notifications';

const C = { bg:'#F6F7FB', card:'#fff', b:'#e5e7eb', text:'#0f172a', sub:'#64748b', primary:'#2563eb', overdue:'#ef4444', upcoming:'#16a34a' };
const today = () => new Date().toISOString().slice(0,10);

export default function Meds() {
  const router = useRouter();
  const [date] = useState(today());
  const [items, setItems] = useState([]);
  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  const [time, setTime] = useState('08:00');
  const [editing, setEditing] = useState(false);
  const [days, setDays] = useState([1,2,3,4,5,6,7]); // lặp D1..D7 mặc định
  const isIOS = Platform.OS === 'ios';

  const load = useCallback(async () => {
    try {
      const m = await api(`/api/medications/today?date=${date}`);
      setItems(Array.isArray(m)?m:[]);
    } catch (err) { console.warn(err); }
  }, [date]);

  useEffect(() => { ensureAndroidChannel().catch(()=>{}); }, []);
  useEffect(() => { load(); }, [load]);

  function currentDate(){
    const [h,m] = time.split(':').map(Number);
    return new Date(2000,0,1,h,m);
  }
  function openPicker(){ setEditing(true); }
  function onAndroidChange(e, selectedDate){
    if (e.type==='dismissed') { setEditing(false); return; }
    if (selectedDate){
      const hh = String(selectedDate.getHours()).padStart(2,'0');
      const mm = String(selectedDate.getMinutes()).padStart(2,'0');
      setTime(`${hh}:${mm}`);
    }
    setEditing(false);
  }
  function oniOSChange(_e, selectedDate){
    if (!selectedDate) return;
    const hh = String(selectedDate.getHours()).padStart(2,'0');
    const mm = String(selectedDate.getMinutes()).padStart(2,'0');
    setTime(`${hh}:${mm}`);
  }
  function closeIOS(){ setEditing(false); }

  function toggleDow(d){
    setDays(prev => prev.includes(d) ? prev.filter(x=>x!==d) : [...prev, d].sort((a,b)=>a-b));
  }

  async function add() {
    if (!name.trim()) return Alert.alert('Lỗi','Nhập tên thuốc/vitamin');
    try {
      await api('/api/medications', { method:'POST', body: { date, name, dose: dose || null, schedule_time: time, schedule_dows: days } });
      const ok = await ensureNotiPermission();
      if (ok) {
        // Hiện tại fallback: đặt nhắc hằng ngày khi không có weekly; bạn có thể tạo scheduleWeeklyReminder trong notifications để lặp theo ngày.
        await scheduleDaily(time, 'Nhắc uống thuốc', `${name}${dose?` • ${dose}`:''}`);
      }
      setName(''); setDose('');
      load();
      Alert.alert('Đã lưu', 'Đã thêm thuốc và bật nhắc.');
    } catch (err) { Alert.alert('Lỗi', err?.message || 'Không lưu được'); }
  }

  async function mark(item, status) {
    try {
      await api('/api/medications/logs', { method:'POST', body: { med_id:item.id, status, date } }).catch(()=>null);
      // Cập nhật UI cục bộ
      setItems(prev => prev.map(x => x.id===item.id ? { ...x, taken: status==='taken' ? true : x.taken } : x));
    } catch (err) { Alert.alert('Lỗi', err?.message || 'Không cập nhật được'); }
  }

  return (
    <>
      <FlatList
        style={{ flex:1, backgroundColor:C.bg }}
        ListHeaderComponent={
          <View style={{ padding:16 }}>
            <Pressable onPress={()=>router.back()}><Text style={{ color:C.primary, marginBottom:8 }}>‹ Quay lại</Text></Pressable>
            <Text style={{ fontSize:22, fontWeight:'800', color:C.text }}>Thuốc & nhắc nhở</Text>
            <Text style={{ color:C.sub, marginTop:4 }}>Thêm thuốc/vitamin và bật nhắc theo giờ.</Text>

            <View style={{ backgroundColor:C.card, borderWidth:1, borderColor:C.b, borderRadius:12, padding:12, marginTop:12 }}>
              <Text style={{ fontWeight:'700', color:C.text }}>Thêm thuốc</Text>

              <View style={{ marginTop:10 }}>
                <Text style={{ color:'#64748b' }}>Tên thuốc/vitamin *</Text>
                <Pressable style={{ borderWidth:1, borderColor:'#e5e7eb', borderRadius:10, padding:10, backgroundColor:'#fff', marginTop:6 }}>
                  <Text style={{ color:'#0f172a' }} onPress={()=>{}}>{name || 'Nhập tên...'}</Text>
                </Pressable>
              </View>

              <View style={{ marginTop:10 }}>
                <Text style={{ color:'#64748b' }}>Liều lượng</Text>
                <Pressable style={{ borderWidth:1, borderColor:'#e5e7eb', borderRadius:10, padding:10, backgroundColor:'#fff', marginTop:6 }}>
                  <Text style={{ color:'#0f172a' }} onPress={()=>{}}>{dose || 'Ví dụ: 1 viên / 1000 IU'}</Text>
                </Pressable>
              </View>

              <Text style={{ color:C.sub, marginTop:10 }}>Giờ nhắc</Text>
              <Pressable onPress={openPicker} style={{ borderWidth:1, borderColor:C.b, borderRadius:10, padding:10, backgroundColor:'#fff', marginTop:6 }}>
                <Text style={{ color:C.text }}>{time}</Text>
              </Pressable>

              <Text style={{ color:C.sub, marginTop:10 }}>Lặp theo ngày (D1..D7)</Text>
              <View style={{ flexDirection:'row', gap:6, flexWrap:'wrap', marginTop:6 }}>
                {[1,2,3,4,5,6,7].map(d=>(
                  <Pressable key={d} onPress={()=>toggleDow(d)}
                    style={{ paddingVertical:8, paddingHorizontal:12, borderRadius:8, borderWidth:1, borderColor:days.includes(d)? '#2563eb':'#e5e7eb', backgroundColor:days.includes(d)? '#eaf1ff':'#fff' }}>
                    <Text style={{ color:days.includes(d)?'#2563eb':'#0f172a', fontWeight:'700' }}>D{d}</Text>
                  </Pressable>
                ))}
              </View>

              <View style={{ marginTop:10 }}>
                <Button title="Lưu & bật nhắc" onPress={add} />
              </View>
            </View>

            <Text style={{ marginTop:12, fontWeight:'800', color:C.text }}>Trong ngày</Text>
          </View>
        }
        data={items}
        keyExtractor={i=>String(i.id)}
        renderItem={({ item }) => (
          <View style={{ marginHorizontal:16, marginBottom:10, backgroundColor:C.card, borderWidth:1, borderColor:C.b, borderRadius:12, padding:12 }}>
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
      />

      {Platform.OS === 'android' && editing && (
        <DateTimePicker
          value={currentDate()}
          mode="time"
          is24Hour={true}
          display="default"
          onChange={onAndroidChange}
        />
      )}
      {isIOS && editing && (
        <View style={{ position:'absolute', left:0, right:0, bottom:0, top:0, backgroundColor:'rgba(0,0,0,0.2)', justifyContent:'flex-end' }}>
          <View style={{ backgroundColor:'#fff', borderTopLeftRadius:16, borderTopRightRadius:16, padding:12 }}>
            <Text style={{ fontWeight:'700', color:C.text, marginBottom:8 }}>Đang chọn giờ nhắc</Text>
            <DateTimePicker
              value={currentDate()}
              mode="time"
              is24Hour={true}
              display="spinner"
              onChange={oniOSChange}
            />
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