import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, Text, View } from 'react-native';
import { api } from '../../../src/lib/api';
import { ensurePermissions, scheduleWeeklyReminder, setHandler, setupAndroidChannel } from '../../../src/lib/notifications-local';

const C = { bg:'#F0F6FF', card:'#FFFFFF', b:'#DCE7FF', text:'#0F172A', sub:'#64748B', primary:'#2563EB' };

function initRows() {
  return [
    { dow:1, hour:6, minute:30 },{ dow:2, hour:6, minute:30 },{ dow:3, hour:6, minute:30 },
    { dow:4, hour:6, minute:30 },{ dow:5, hour:6, minute:30 },{ dow:6, hour:8, minute:0 },{ dow:7, hour:8, minute:0 },
  ];
}

export default function RemindersScreen() {
  const { planId } = useLocalSearchParams();
  const [plan, setPlan] = useState(null);
  const [rows, setRows] = useState(initRows());
  const [saving, setSaving] = useState(false);
  const [editingIdx, setEditingIdx] = useState(null);
  const isIOS = Platform.OS === 'ios';

  useEffect(() => { setHandler(); }, []);

  const loadPlan = useCallback(async ()=>{
    try {
      if (!planId) return;
      const detail = await api(`/api/workouts/plans/${planId}`).catch(()=>null);
      setPlan(detail);
    } catch (_e) {}
  }, [planId]);

  useEffect(()=>{ loadPlan(); },[loadPlan]);

  function openPicker(idx) {
    setEditingIdx(idx);
  }

  function onAndroidChange(event, selectedDate) {
    const idx = editingIdx;
    if (idx == null) return;
    if (event.type === 'dismissed') { setEditingIdx(null); return; }
    if (selectedDate) {
      const hour = selectedDate.getHours();
      const minute = selectedDate.getMinutes();
      setRows(prev => prev.map((x,i) => i===idx ? { ...x, hour, minute } : x));
    }
    setEditingIdx(null);
  }

  function oniOSChange(_event, selectedDate) {
    const idx = editingIdx;
    if (idx == null || !selectedDate) return;
    const hour = selectedDate.getHours();
    const minute = selectedDate.getMinutes();
    setRows(prev => prev.map((x,i) => i===idx ? { ...x, hour, minute } : x));
  }

  function closeIOSPicker() {
    setEditingIdx(null);
  }

  async function saveAll() {
    try {
      setSaving(true);
      setEditingIdx(null);

      const okPerm = await ensurePermissions();
      if (!okPerm) return Alert.alert('Cần quyền', 'Hãy cấp quyền thông báo cho ứng dụng.');
      await setupAndroidChannel();

      // Local notifications lặp hàng tuần
      for (const r of rows) {
        await scheduleWeeklyReminder({
          weekday: r.dow, hour: r.hour, minute: r.minute,
          title: 'Tập luyện',
          body: `Ngày D${r.dow}: Bắt đầu tập lúc ${String(r.hour).padStart(2,'0')}:${String(r.minute).padStart(2,'0')}`
        });
      }

      // Gửi MẢNG JSON lên backend
      const payload = rows.map(r => ({
        time_of_day: `${String(r.hour).padStart(2,'0')}:${String(r.minute).padStart(2,'0')}:00`,
        note: `D${r.dow} • kế hoạch ${planId}`,
        plan_id: Number(planId) || null,
        dow: r.dow
      }));

      await api('/api/workouts/reminders', {
        method:'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      Alert.alert('Đã đặt nhắc', 'Nhắc lịch tập đã được thiết lập hàng tuần và lưu trên server.');
    } catch (e) {
      Alert.alert('Lỗi', e?.message || 'Không đặt được nhắc');
    } finally {
      setSaving(false);
    }
  }

  const title = useMemo(()=> plan ? `Nhắc nhở • ${plan.title}` : 'Nhắc nhở lịch tập', [plan]);

  return (
    <View style={{ flex:1, backgroundColor:C.bg, padding:16 }}>
      <Text style={{ fontSize:22, fontWeight:'800', color:C.text }}>{title}</Text>
      <Text style={{ color:C.sub, marginTop:4 }}>Chọn giờ bắt đầu cho từng ngày (lặp hàng tuần).</Text>

      <View style={{ backgroundColor:C.card, borderWidth:1, borderColor:C.b, borderRadius:16, padding:12, marginTop:12 }}>
        {rows.map((r, idx)=>(
          <View key={r.dow} style={{ flexDirection:'row', alignItems:'center', gap:10, marginBottom:8 }}>
            <Text style={{ width:60, color:C.text, fontWeight:'600' }}>{`D${r.dow}`}</Text>
            <Text style={{ flex:1, color:C.sub }}>
              {String(r.hour).padStart(2,'0')}:{String(r.minute).padStart(2,'0')}
            </Text>
            <Pressable onPress={() => openPicker(idx)} style={{ borderWidth:1, borderColor:C.b, paddingVertical:6, paddingHorizontal:10, borderRadius:8, backgroundColor:'#fff' }}>
              <Text style={{ color:C.text, fontWeight:'600' }}>Chọn giờ</Text>
            </Pressable>
          </View>
        ))}

        <Pressable onPress={saveAll} disabled={saving} style={{ marginTop:8, backgroundColor:C.primary, paddingVertical:10, paddingHorizontal:12, borderRadius:8, opacity:saving?0.7:1 }}>
          <Text style={{ color:'#fff', fontWeight:'700', textAlign:'center' }}>{saving ? 'Đang lưu…' : 'Lưu nhắc cho 7 ngày'}</Text>
        </Pressable>
      </View>

      {/* Android: dialog picker */}
      {Platform.OS === 'android' && editingIdx != null && (
        <DateTimePicker
          value={new Date(2000, 0, 1, rows[editingIdx].hour, rows[editingIdx].minute)}
          mode="time"
          is24Hour={true}
          display="default"
          onChange={onAndroidChange}
        />
      )}

      {/* iOS: overlay picker */}
      {isIOS && editingIdx != null && (
        <View style={{
          position:'absolute', left:0, right:0, bottom:0, top:0,
          backgroundColor:'rgba(0,0,0,0.2)', justifyContent:'flex-end'
        }}>
          <View style={{ backgroundColor:'#fff', borderTopLeftRadius:16, borderTopRightRadius:16, padding:12, borderWidth:1, borderColor:'#E5E7EB' }}>
            <Text style={{ color:C.text, fontWeight:'700', marginBottom:8 }}>Đang chọn giờ cho D{rows[editingIdx].dow}</Text>
            <DateTimePicker
              value={new Date(2000, 0, 1, rows[editingIdx].hour, rows[editingIdx].minute)}
              mode="time"
              is24Hour={true}
              display="spinner"
              onChange={oniOSChange}
              style={{ alignSelf:'center' }}
            />
            <View style={{ flexDirection:'row', gap:8, marginTop:10 }}>
              <Pressable onPress={closeIOSPicker} style={{ flex:1, backgroundColor:C.primary, paddingVertical:10, borderRadius:10 }}>
                <Text style={{ color:'#fff', fontWeight:'700', textAlign:'center' }}>Xong</Text>
              </Pressable>
              <Pressable onPress={closeIOSPicker} style={{ flex:1, backgroundColor:'#EEF2FF', borderWidth:1, borderColor:'#C7D2FE', paddingVertical:10, borderRadius:10 }}>
                <Text style={{ color:'#1E40AF', fontWeight:'700', textAlign:'center' }}>Huỷ</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      <FlatList
        style={{ marginTop:12 }}
        data={(plan?.days || []).map(d=>({ id:`${planId}-${d.dow}`, text:`D${d.dow} • ${d.note || ''}` }))}
        keyExtractor={(i)=>String(i.id)}
        renderItem={({ item })=>(
          <View style={{ backgroundColor:C.card, borderWidth:1, borderColor:C.b, borderRadius:12, padding:12, marginBottom:10 }}>
            <Text style={{ color:C.sub }}>{item.text}</Text>
          </View>
        )}
        ListEmptyComponent={null}
      />
    </View>
  );
}