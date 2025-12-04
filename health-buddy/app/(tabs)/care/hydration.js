import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { api } from '../../../src/lib/api';
import { ensureAndroidChannel, ensureNotiPermission, scheduleDaily } from '../../../src/lib/notifications';

const C = { bg:'#F6F7FB', card:'#fff', b:'#e5e7eb', text:'#0f172a', sub:'#64748b', primary:'#2563eb' };
const today = () => new Date().toISOString().slice(0,10);

function Bar({ value, target }) {
  const pct = Math.max(0, Math.min(1, value/target));
  return (
    <View style={{ marginTop:8 }}>
      <View style={{ height:10, backgroundColor:'#eef2ff', borderRadius:6 }}>
        <View style={{ width:`${pct*100}%`, height:10, backgroundColor:'#2563eb', borderRadius:6 }} />
      </View>
      <Text style={{ color:C.sub, marginTop:6 }}>{value} ml / {target} ml</Text>
    </View>
  );
}

export default function Hydration() {
  const router = useRouter();
  const date = today();
  const [water, setWater] = useState(0);
  const [amount, setAmount] = useState('300');
  const [goal] = useState(2000);
  const [remTime, setRemTime] = useState('09:00');
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    try {
      const h = await api(`/api/hydration/logs?date=${date}`);
      setWater((h||[]).reduce((t,x)=>t+Number(x.amount_ml||0),0));
    } catch (err) { console.warn(err); }
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const left = useMemo(()=>Math.max(0, goal - water), [goal, water]);

  async function addWater(qty) {
    const v = Number(qty||0);
    if (!v) return Alert.alert('Lỗi','Nhập ml hợp lệ');

    const payload = { date, amount_ml: v };
    console.log('[Hydration] POST payload:', payload, JSON.stringify(payload));

    try {
      await api('/api/hydration/logs', {
        method:'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setAmount('300');
      load();
    } catch (err) {
      Alert.alert('Lỗi', err?.message || 'Không lưu được');
    }
  }

  function currentDate(){
    const [h,m] = remTime.split(':').map(Number);
    return new Date(2000,0,1,h,m);
  }
  function onAndroidChange(e, selectedDate){
    if (e.type==='dismissed') { setEditing(false); return; }
    if (selectedDate){
      const hh = String(selectedDate.getHours()).padStart(2,'0');
      const mm = String(selectedDate.getMinutes()).padStart(2,'0');
      setRemTime(`${hh}:${mm}`);
    }
    setEditing(false);
  }
  function oniOSChange(_e, selectedDate){
    if (!selectedDate) return;
    const hh = String(selectedDate.getHours()).padStart(2,'0');
    const mm = String(selectedDate.getMinutes()).padStart(2,'0');
    setRemTime(`${hh}:${mm}`);
  }
  function closeIOS(){ setEditing(false); }

  async function saveReminder() {
    try {
      const ok = await ensureNotiPermission(); await ensureAndroidChannel();
      if (!ok) return Alert.alert('Cần quyền', 'Hãy cấp quyền thông báo.');
      await scheduleDaily(remTime, 'Uống nước', `Nhắc uống nước lúc ${remTime}`);
      Alert.alert('Đã đặt nhắc', `Uống nước hằng ngày lúc ${remTime}.`);
    } catch (e) { Alert.alert('Lỗi', e?.message || 'Không đặt được nhắc'); }
  }

  return (
    <ScrollView style={{ flex:1, backgroundColor:C.bg, padding:16 }}>
      <Pressable onPress={()=>router.back()}><Text style={{ color:C.primary, marginBottom:8 }}>‹ Quay lại</Text></Pressable>
      <Text style={{ fontSize:22, fontWeight:'800', color:C.text }}>Nước uống</Text>

      <View style={{ backgroundColor:C.card, borderWidth:1, borderColor:C.b, borderRadius:12, padding:12, marginTop:12 }}>
        <Text style={{ fontWeight:'700', color:C.text }}>Tiến độ hôm nay</Text>
        <Bar value={water} target={goal} />
        <Text style={{ color:C.sub, marginTop:6 }}>Còn lại: {left} ml</Text>

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

        <View style={{ height:12 }} />
        <Text style={{ fontWeight:'700', color:C.text }}>Nhắc uống nước hằng ngày</Text>
        <Pressable onPress={()=>setEditing(true)} style={{ borderWidth:1, borderColor:C.b, borderRadius:10, padding:10, backgroundColor:'#fff', marginTop:6 }}>
          <Text style={{ color:C.text }}>{remTime}</Text>
        </Pressable>
        <View style={{ marginTop:8 }}>
          <Button title="Bật nhắc" onPress={saveReminder} />
        </View>
      </View>

      {Platform.OS === 'android' && editing && (
        <DateTimePicker
          value={currentDate()}
          mode="time"
          is24Hour={true}
          display="default"
          onChange={onAndroidChange}
        />
      )}
      {Platform.OS === 'ios' && editing && (
        <View style={{ position:'absolute', left:0, right:0, bottom:0, top:0, backgroundColor:'rgba(0,0,0,0.2)', justifyContent:'flex-end' }}>
          <View style={{ backgroundColor:'#fff', borderTopLeftRadius:16, borderTopRightRadius:16, padding:12 }}>
            <Text style={{ fontWeight:'700', color:C.text, marginBottom:8 }}>Chọn giờ nhắc uống nước</Text>
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
    </ScrollView>
  );
}