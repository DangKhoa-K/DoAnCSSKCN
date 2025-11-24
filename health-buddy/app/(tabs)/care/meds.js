// app/(tabs)/care/meds.js
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { api } from '../../../src/lib/api';
import { ensureAndroidChannel, ensureNotiPermission, scheduleDaily } from '../../../src/lib/notifications';

const C = { bg:'#F6F7FB', card:'#fff', b:'#e5e7eb', text:'#0f172a', sub:'#64748b', primary:'#2563eb' };
const today = () => new Date().toISOString().slice(0,10);

export default function Meds() {
  const router = useRouter();
  const [date] = useState(today());
  const [items, setItems] = useState([]);
  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  const [time, setTime] = useState('08:00');

  const load = useCallback(async () => {
    try {
      const m = await api(`/api/medications/today?date=${date}`);
      setItems(Array.isArray(m)?m:[]);
    } catch (err) { console.warn(err); }
  }, [date]);

  useEffect(() => { ensureAndroidChannel().catch(()=>{}); }, []);
  useEffect(() => { load(); }, [load]);

  async function add() {
    if (!name.trim()) return Alert.alert('Lỗi','Nhập tên thuốc/vitamin');
    try {
      await api('/api/medications', { method:'POST', body: JSON.stringify({ date, name, dose: dose || null }) });
      setName(''); setDose('');
      // Nhắc giờ uống (nếu có dev build)
      const ok = await ensureNotiPermission();
      if (ok) await scheduleDaily(time, 'Nhắc uống thuốc', `${name}${dose?` • ${dose}`:''}`);
      load();
    } catch (err) { Alert.alert('Lỗi', err?.message || 'Không lưu được'); }
  }

  return (
    <FlatList
      style={{ flex:1, backgroundColor:C.bg }}
      ListHeaderComponent={
        <View style={{ padding:16 }}>
          <Pressable onPress={()=>router.back()}><Text style={{ color:C.primary, marginBottom:8 }}>‹ Quay lại</Text></Pressable>
          <Text style={{ fontSize:22, fontWeight:'800', color:C.text }}>Thuốc & nhắc nhở</Text>
          <Text style={{ color:C.sub, marginTop:4 }}>Thêm thuốc/vitamin và bật nhắc theo giờ.</Text>

          <View style={{ backgroundColor:C.card, borderWidth:1, borderColor:C.b, borderRadius:12, padding:12, marginTop:12 }}>
            <Text style={{ fontWeight:'700', color:C.text }}>Thêm thuốc</Text>
            <Input label="Tên thuốc/vitamin *" value={name} onChange={setName} placeholder="Vitamin D3" />
            <Input label="Liều lượng" value={dose} onChange={setDose} placeholder="1 viên / 1000 IU" />
            <Input label="Giờ nhắc (HH:mm)" value={time} onChange={setTime} placeholder="08:00" />
            <Button title="Lưu & bật nhắc" onPress={add} />
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
        </View>
      )}
    />
  );
}

function Input({ label, value, onChange, placeholder }) {
  return (
    <View style={{ marginTop:10 }}>
      <Text style={{ color:'#64748b' }}>{label}</Text>
      <TextInput
        value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor="#9ca3af"
        style={{ borderWidth:1, borderColor:'#e5e7eb', borderRadius:10, padding:10, backgroundColor:'#fff', marginTop:6 }}
      />
    </View>
  );
}
