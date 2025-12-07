import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { api } from '../../../src/lib/api';
import { ensureAndroidChannel, ensureNotiPermission, scheduleDaily } from '../../../src/lib/notifications';

const C = { bg:'#F6F7FB', card:'#fff', b:'#e5e7eb', text:'#0f172a', sub:'#64748b', primary:'#2563eb' };
const goal = 3000; // mục tiêu mẫu
const today = () => new Date().toISOString().slice(0,10);

function Donut({ value, max, size = 200, stroke = 16, color = '#2563eb' }) {
  const pct = Math.max(0, Math.min(1, value/Math.max(1,max))) * 100;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (c * pct) / 100;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={size/2} cy={size/2} r={r} stroke="#E6ECFF" strokeWidth={stroke} fill="none" />
        <Circle
          cx={size/2} cy={size/2} r={r}
          stroke={color} strokeWidth={stroke} fill="none"
          strokeDasharray={`${dash},${c}`} strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`}
        />
      </Svg>
      <View style={{ position:'absolute', left:0, right:0, top:0, bottom:0, alignItems:'center', justifyContent:'center' }}>
        <Text style={{ fontSize: 30, fontWeight: '800', color: C.text }}>{value}</Text>
        <Text style={{ color: C.sub }}>of {max} ml</Text>
      </View>
    </View>
  );
}

export default function Hydration() {
  const router = useRouter();
  const date = today();
  const [water, setWater] = useState(0);
  const [amount, setAmount] = useState('300');
  const [remTime, setRemTime] = useState('09:00');
  const [editing, setEditing] = useState(false);
  const [drinks, setDrinks] = useState([]);

  const load = useCallback(async () => {
    try {
      const h = await api(`/api/hydration/logs?date=${date}`);
      setWater((h||[]).reduce((t,x)=>t+Number(x.amount_ml||0),0));
      setDrinks(Array.isArray(h) ? h : []);
    } catch (err) { console.warn(err); }
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const left = useMemo(()=>Math.max(0, goal - water), [water]);

  async function addWater(qty) {
    const v = Number(qty||0);
    if (!v) return Alert.alert('Lỗi','Nhập ml hợp lệ');

    const payload = { date, amount_ml: v };
    try {
      await api('/api/hydration/logs', {
        method:'POST',
        // headers: { 'Content-Type': 'application/json' }, // không cần, api.js tự set
        body: payload, // để api.js tự stringify
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
    <ScrollView style={{ flex:1, backgroundColor:'#f0f6ff' }} contentContainerStyle={{ padding:16 }}>
      <Pressable onPress={()=>router.back()}><Text style={{ color:C.primary, marginBottom:8 }}>‹ Quay lại</Text></Pressable>

      <View style={{
        backgroundColor:'#fff', borderRadius:18, padding:16,
        shadowColor:'#000', shadowOpacity:0.06, shadowRadius:10, shadowOffset:{width:0, height:4},
        borderWidth:1, borderColor:'#eef2ff'
      }}>
        <Text style={{ fontSize:22, fontWeight:'800', color:C.text }}>Nước uống</Text>
        <Text style={{ color:C.sub, marginTop:4 }}>Mục tiêu hôm nay: {goal} ml</Text>

        <View style={{ alignItems:'center', marginTop:10 }}>
          <Donut value={water} max={goal} />
          <Text style={{ color:C.sub, marginTop:8 }}>Còn lại: {left} ml</Text>
        </View>

        <View style={{ flexDirection:'row', gap:8, marginTop:14, flexWrap:'wrap', justifyContent:'center' }}>
          {[200,300,500].map(m => (
            <Pressable key={m} onPress={()=>addWater(m)}
              style={{ borderWidth:1, borderColor:'#dbe7ff', backgroundColor:'#eef5ff', borderRadius:10, paddingVertical:8, paddingHorizontal:12, minWidth:80, alignItems:'center' }}>
              <Text style={{ color:C.primary, fontWeight:'700' }}>+{m} ml</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ flexDirection:'row', gap:8, marginTop:10 }}>
          <TextInput value={amount} onChangeText={setAmount} keyboardType="numeric"
            placeholder="ml" placeholderTextColor="#9ca3af"
            style={{ flex:1, borderWidth:1, borderColor:C.b, borderRadius:10, padding:10, backgroundColor:'#fff' }} />
          <Pressable onPress={()=>addWater(amount)} style={{ backgroundColor:C.primary, borderRadius:10, paddingVertical:10, paddingHorizontal:16 }}>
            <Text style={{ color:'#fff', fontWeight:'800' }}>Thêm</Text>
          </Pressable>
        </View>

        <View style={{ height:12 }} />
        <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
          <Text style={{ fontWeight:'700', color:C.text }}>Nhắc uống nước hằng ngày</Text>
          <Text style={{ color:'#60a5fa' }}>🔔</Text>
        </View>
        <Pressable onPress={()=>setEditing(true)} style={{ borderWidth:1, borderColor:C.b, borderRadius:10, padding:10, backgroundColor:'#fff', marginTop:6 }}>
          <Text style={{ color:C.text }}>{remTime}</Text>
        </Pressable>
        <View style={{ marginTop:8 }}>
          <Pressable onPress={saveReminder} style={{ backgroundColor:'#EEF2FF', borderWidth:1, borderColor:'#C7D2FE', paddingVertical:10, borderRadius:10 }}>
            <Text style={{ color:'#1E40AF', fontWeight:'700', textAlign:'center' }}>Bật nhắc</Text>
          </Pressable>
        </View>
      </View>

      <View style={{ marginTop:14, backgroundColor:'#fff', borderRadius:18, padding:12, borderWidth:1, borderColor:'#eef2ff',
        shadowColor:'#000', shadowOpacity:0.06, shadowRadius:10, shadowOffset:{width:0, height:4}
      }}>
        <Text style={{ fontWeight:'700', color:C.text }}>Drinks today</Text>
        {drinks.length ? drinks.map(it => (
          <View key={it.id} style={{ flexDirection:'row', justifyContent:'space-between', paddingVertical:10, borderTopWidth:1, borderTopColor:'#F1F5F9' }}>
            <View style={{ flexDirection:'row', gap:8, alignItems:'center' }}>
              <View style={{ width:28, height:28, borderRadius:8, backgroundColor:'#eef5ff', alignItems:'center', justifyContent:'center' }}>
                <Text style={{ color:'#2563eb' }}>🥤</Text>
              </View>
              <View>
                <Text style={{ color:C.text, fontWeight:'700' }}>{it.drink_name || 'Water'}</Text>
                <Text style={{ color:C.sub, fontSize:12 }}>{it.created_at ? new Date(it.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : ''}</Text>
              </View>
            </View>
            <Text style={{ color:C.text }}>{it.amount_ml} ml</Text>
          </View>
        )) : (
          <Text style={{ color:C.sub, marginTop:8 }}>Chưa có log nước hôm nay.</Text>
        )}
      </View>

      <View style={{ position:'absolute', left:0, right:0, bottom:24, alignItems:'center' }}>
        <Pressable onPress={()=>addWater(amount)} style={{ width:64, height:64, borderRadius:32, backgroundColor:'#fff', alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:'#e5e7eb' }}>
          <Text style={{ color:C.primary, fontSize:36, fontWeight:'800' }}>+</Text>
        </Pressable>
      </View>

      {Platform.OS === 'android' && editing && (
        <DateTimePicker value={currentDate()} mode="time" is24Hour={true} display="default" onChange={onAndroidChange} />
      )}
      {Platform.OS === 'ios' && editing && (
        <View style={{ position:'absolute', left:0, right:0, bottom:0, top:0, backgroundColor:'rgba(0,0,0,0.2)', justifyContent:'flex-end' }}>
          <View style={{ backgroundColor:'#fff', borderTopLeftRadius:16, borderTopRightRadius:16, padding:12 }}>
            <Text style={{ fontWeight:'700', color:C.text, marginBottom:8 }}>Chọn giờ nhắc uống nước</Text>
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
    </ScrollView>
  );
}