// app/(tabs)/nutrition/foods.js
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { api } from '../../../src/lib/api';
import { emit, EVENTS } from '../../../src/lib/events';

const C = { bg:'#F6F7FB', card:'#fff', b:'#e5e7eb', text:'#0f172a', sub:'#64748b', primary:'#2563eb' };

function PrimaryButton({ title, onPress, disabled }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        backgroundColor: disabled ? '#9ca3af' : C.primary,
        paddingVertical:10, paddingHorizontal:14, borderRadius:10, alignItems:'center'
      }}
    >
      <Text style={{ color:'#fff', fontWeight:'800' }}>{title}</Text>
    </Pressable>
  );
}

function Input({ value, onChangeText, placeholder, keyboardType, style }) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#9ca3af"
      keyboardType={keyboardType}
      style={{ backgroundColor:'#fff', borderWidth:1, borderColor:C.b, borderRadius:10, padding:10, ...style }}
    />
  );
}

export default function Foods() {
  const [q, setQ] = useState('');
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState('');
  const [portion, setPortion] = useState('100');
  const [p, setP] = useState('0');
  const [c, setC] = useState('0');
  const [f, setF] = useState('0');
  const [fib, setFib] = useState('0');

  const kcal = useMemo(() => {
    return (4 * Number(p || 0) + 4 * Number(c || 0) + 9 * Number(f || 0)).toFixed(1);
  }, [p, c, f]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api(`/api/foods?search=${encodeURIComponent(q || '')}`);
      setList(Array.isArray(res) ? res : []);
    } catch (e) {
      console.error('Load foods error:', e);
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => { load(); }, [load]);

  const add = useCallback(async () => {
    try {
      const body = {
        name_vi: name.trim(),
        portion_g: Number(portion || 0),
        protein_g: Number(p || 0),
        carbs_g: Number(c || 0),
        fat_g: Number(f || 0),
        fiber_g: Number(fib || 0),
        kcal: Number(kcal)
      };
      if (!body.name_vi || !body.portion_g) {
        return Alert.alert('Thiếu thông tin', 'Tên món & khẩu phần bắt buộc.');
      }
      await api('/api/foods', { method: 'POST', body });
      setName(''); setPortion('100'); setP('0'); setC('0'); setF('0'); setFib('0');
      await load();
      emit(EVENTS.NUTRITION_UPDATED);
      Alert.alert('Đã thêm món');
    } catch (e) {
      console.error('Add food error:', e);
      Alert.alert('Lỗi', 'Không thể thêm món.');
    }
  }, [name, portion, p, c, f, fib, kcal, load]);

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: C.bg }}
      ListHeaderComponent={
        <View style={{ padding: 16 }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: C.text }}>Kho món ăn</Text>
          <Text style={{ color: C.sub, marginTop: 4 }}>Tìm, xem & thêm món phổ biến.</Text>

          <Input value={q} onChangeText={setQ} placeholder="Tìm kiếm…" style={{ marginTop: 10 }} />

          <View style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: C.b, borderRadius: 14, padding: 12, marginTop: 12 }}>
            <Text style={{ fontWeight: '800', color: C.text }}>Thêm món mới</Text>
            <Input value={name} onChangeText={setName} placeholder="Tên món" style={{ marginTop: 8 }} />
            <Input value={portion} onChangeText={setPortion} keyboardType="numeric" placeholder="Khẩu phần (g)" style={{ marginTop: 8 }} />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <Input value={p} onChangeText={setP} keyboardType="numeric" placeholder="Protein (g)" style={{ flex:1 }} />
              <Input value={c} onChangeText={setC} keyboardType="numeric" placeholder="Carb (g)" style={{ flex:1 }} />
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <Input value={f} onChangeText={setF} keyboardType="numeric" placeholder="Fat (g)" style={{ flex:1 }} />
              <Input value={fib} onChangeText={setFib} keyboardType="numeric" placeholder="Xơ (g)" style={{ flex:1 }} />
            </View>
            <Text style={{ color: C.sub, marginTop: 6 }}>
              ~ Ước tính: <Text style={{ color: C.text, fontWeight: '800' }}>{kcal} kcal</Text> / phần
            </Text>
            <View style={{ marginTop: 10 }}>
              <PrimaryButton title="Lưu món" onPress={add} />
            </View>
          </View>
        </View>
      }
      data={list}
      keyExtractor={i => String(i.id)}
      renderItem={({ item }) => (
        <View style={{ marginHorizontal: 16, marginBottom: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: C.b, borderRadius: 12, padding: 12 }}>
          <Text style={{ fontWeight: '700', color: C.text }}>{item.name_vi}</Text>
          <Text style={{ color: C.sub, marginTop: 4 }}>{item.portion_g} g/phần • {item.kcal} kcal</Text>
          <Text style={{ color: C.sub, marginTop: 4 }}>P {item.protein_g}g • C {item.carbs_g}g • F {item.fat_g}g • Xơ {item.fiber_g}g</Text>
        </View>
      )}
      ListEmptyComponent={<Text style={{ textAlign: 'center', color: C.sub, marginTop: 24 }}>{loading ? 'Đang tải…' : 'Không có dữ liệu'}</Text>}
    />
  );
}