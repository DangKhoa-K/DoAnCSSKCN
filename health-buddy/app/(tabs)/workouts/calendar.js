import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { api } from '../../../src/lib/api';

const C = { bg:'#F0F6FF', card:'#fff', b:'#DCE7FF', text:'#0F172A', sub:'#64748B', primary:'#2563EB', danger:'#DC2626' };

export default function WorkoutCalendar() {
  const [items, setItems] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0,10));
  const [note, setNote] = useState('Buổi strength nhẹ');

  const load = useCallback(async () => {
    try {
      const data = await api(`/api/workouts/calendar?from=${date}&to=${date}`);
      setItems(Array.isArray(data) ? data : []);
    } catch (_e) {
      setItems([]);
    }
  }, [date]);

  useEffect(() => { load(); }, [load]);

  async function add() {
    try {
      await api('/api/workouts/calendar', { method: 'POST', body: JSON.stringify({ date, note }) });
      setNote('Buổi strength nhẹ');
      await load();
    } catch (e) {
      Alert.alert('Lỗi', e?.message || 'Không thêm được lịch');
    }
  }

  async function remove(id) {
    try {
      await api(`/api/workouts/calendar/${id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      Alert.alert('Lỗi', e?.message || 'Không xoá được lịch');
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, padding: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: '800', color: C.text }}>Lịch tập</Text>
      <Text style={{ color: C.sub, marginTop: 4 }}>Chọn ngày và tạo lịch/nhắc nhở.</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <TextInput value={date} onChangeText={setDate} style={{ borderWidth: 1, borderColor: C.b, borderRadius: 10, padding: 10, backgroundColor: '#fff', width: 130 }} />
        <TextInput value={note} onChangeText={setNote} style={{ flex: 1, borderWidth: 1, borderColor: C.b, borderRadius: 10, padding: 10, backgroundColor: '#fff' }} placeholder="Ghi chú" />
        <Pressable onPress={add} style={{ backgroundColor: C.primary, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10 }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Thêm</Text>
        </Pressable>
      </View>

      <FlatList
        style={{ marginTop: 12 }}
        data={items}
        keyExtractor={(i) => String(i.id)}
        renderItem={({ item }) => (
          <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.b, borderRadius: 12, padding: 12, marginBottom: 10 }}>
            <Text style={{ fontWeight: '700', color: C.text }}>{item.date}</Text>
            <Text style={{ color: C.sub, marginTop: 4 }}>{item.note || '(không ghi chú)'}</Text>
            <Pressable
              onPress={() => remove(item.id)}
              style={{ marginTop: 8, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#fecaca', backgroundColor: '#fee2e2', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8 }}
            >
              <Text style={{ color: '#b91c1c', fontWeight: '700' }}>Xoá</Text>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={<Text style={{ textAlign: 'center', color: C.sub, marginTop: 24 }}>Không có lịch trong ngày.</Text>}
      />
    </View>
  );
}