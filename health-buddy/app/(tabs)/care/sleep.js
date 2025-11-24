// app/(tabs)/care/sleep.js
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Button, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { api } from '../../../src/lib/api';

const C = { bg:'#F6F7FB', card:'#fff', b:'#e5e7eb', text:'#0f172a', sub:'#64748b', primary:'#2563eb' };
const today = () => new Date().toISOString().slice(0,10);

export default function Sleep() {
  const router = useRouter();
  const date = today();
  const [start, setStart] = useState('23:00');
  const [end, setEnd] = useState('06:30');
  const [dur, setDur] = useState('390'); // phút
  const [logs, setLogs] = useState([]);

  const load = useCallback(async () => {
    try {
      const s = await api(`/api/sleep/logs?date=${date}`);
      setLogs(Array.isArray(s)?s:[]);
    } catch (err) { console.warn(err); }
  }, [date]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const total = useMemo(() => logs.reduce((t,x)=>t+Number(x.duration_min||0),0), [logs]);

  async function quickAdd(min){
    try {
      await api('/api/sleep/logs', { method:'POST', body: JSON.stringify({ date, duration_min:min }) });
      load();
    } catch (err) { Alert.alert('Lỗi', err?.message || 'Không lưu được'); }
  }

  async function saveFull() {
    const duration_min = Number(dur||0);
    if (!duration_min) return Alert.alert('Lỗi','Nhập phút hợp lệ');
    try {
      await api('/api/sleep/logs', { method:'POST', body: JSON.stringify({ date, start_time:start, end_time:end, duration_min }) });
      load();
    } catch (err) { Alert.alert('Lỗi', err?.message || 'Không lưu được'); }
  }

  return (
    <FlatList
      style={{ flex:1, backgroundColor:C.bg }}
      ListHeaderComponent={
        <View style={{ padding:16 }}>
          <Pressable onPress={()=>router.back()}><Text style={{ color:C.primary, marginBottom:8 }}>‹ Quay lại</Text></Pressable>
          <Text style={{ fontSize:22, fontWeight:'800', color:C.text }}>Giấc ngủ</Text>
          <Text style={{ color:C.sub, marginTop:4 }}>Ghi nhanh hoặc nhập đầy đủ thông tin.</Text>

          <View style={{ backgroundColor:C.card, borderWidth:1, borderColor:C.b, borderRadius:12, padding:12, marginTop:12 }}>
            <Text style={{ fontWeight:'700', color:C.text }}>Ghi nhanh</Text>
            <View style={{ flexDirection:'row', gap:8, marginTop:10, flexWrap:'wrap' }}>
              {[360,420,480].map(m => (
                <Pressable key={m} onPress={()=>quickAdd(m)}
                  style={{ borderWidth:1, borderColor:'#dbe7ff', backgroundColor:'#eef5ff', borderRadius:10, paddingVertical:8, paddingHorizontal:12 }}>
                  <Text style={{ color:C.primary, fontWeight:'700' }}>{m/60} giờ</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={{ backgroundColor:C.card, borderWidth:1, borderColor:C.b, borderRadius:12, padding:12, marginTop:12 }}>
            <Text style={{ fontWeight:'700', color:C.text }}>Nhập chi tiết</Text>
            <Row label="Giờ ngủ" value={start} onChange={setStart} placeholder="HH:mm" />
            <Row label="Giờ thức" value={end} onChange={setEnd} placeholder="HH:mm" />
            <Row label="Tổng phút" value={dur} onChange={setDur} keyboardType="numeric" />
            <Button title="Lưu giấc ngủ" onPress={saveFull} />
          </View>

          <View style={{ backgroundColor:C.card, borderWidth:1, borderColor:C.b, borderRadius:12, padding:12, marginTop:12 }}>
            <Text style={{ fontWeight:'700', color:C.text }}>Tổng hôm nay</Text>
            <Text style={{ color:C.sub, marginTop:4 }}>{(total/60).toFixed(1)} giờ</Text>
          </View>

          <Text style={{ marginTop:12, fontWeight:'800', color:C.text }}>Lịch sử hôm nay</Text>
        </View>
      }
      data={logs}
      keyExtractor={i=>String(i.id)}
      renderItem={({ item }) => (
        <View style={{ marginHorizontal:16, marginBottom:10, backgroundColor:C.card, borderWidth:1, borderColor:C.b, borderRadius:12, padding:12 }}>
          <Text style={{ fontWeight:'700', color:C.text }}>{item.start_time || '---'} → {item.end_time || '---'}</Text>
          <Text style={{ color:C.sub, marginTop:4 }}>{item.duration_min} phút</Text>
        </View>
      )}
    />
  );
}

function Row({ label, value, onChange, placeholder, keyboardType }) {
  return (
    <View style={{ marginTop:10 }}>
      <Text style={{ color:C.sub }}>{label}</Text>
      <TextInput
        value={value} onChangeText={onChange} placeholder={placeholder}
        keyboardType={keyboardType}
        placeholderTextColor="#9ca3af"
        style={{ borderWidth:1, borderColor:C.b, borderRadius:10, padding:10, backgroundColor:'#fff', marginTop:6 }}
      />
    </View>
  );
}
