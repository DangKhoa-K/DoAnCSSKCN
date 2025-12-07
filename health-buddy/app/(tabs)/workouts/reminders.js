// app/(tabs)/workouts/reminders-screen.js
// Chỉ lưu nhắc cho 1 tuần, và giữ kênh âm thanh mới.

import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { api } from '../../../src/lib/api';
import {
  cancelAllScheduled,
  ensurePermissions,
  listScheduled,
  presentNow,
  scheduleWeeklyAbsolute,
  setHandler,
  setupAndroidChannel,
} from '../../../src/lib/notifications-local';

const C = { bg:'#F0F6FF', card:'#FFFFFF', b:'#DCE7FF', text:'#0F172A', sub:'#64748B', primary:'#2563EB' };
const isIOS = Platform.OS === 'ios';
const isWeb = Platform.OS === 'web';

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

  useEffect(() => { if (!isWeb) setHandler(); }, []);

  const loadPlan = useCallback(async ()=>{
    try {
      if (!planId) return;
      const detail = await api(`/api/workouts/plans/${planId}`).catch(()=>null);
      setPlan(detail);
    } catch (_e) {}
  }, [planId]);

  useEffect(()=>{ loadPlan(); },[loadPlan]);

  function clamp(n,min,max){ const x=Number(n); return Number.isFinite(x)? Math.min(max, Math.max(min, x)) : min; }
  function setRowTime(idx, hour, minute){
    setRows(prev => prev.map((x,i)=> i===idx ? { ...x, hour: clamp(hour,0,23), minute: clamp(minute,0,59) } : x));
  }

  function onAndroidChange(event, selectedDate) {
    const idx = editingIdx;
    if (idx == null) return;
    if (event.type === 'dismissed') { setEditingIdx(null); return; }
    if (selectedDate) {
      const hour = selectedDate.getHours();
      const minute = selectedDate.getMinutes();
      setRowTime(idx, hour, minute);
    }
    setEditingIdx(null);
  }

  function oniOSChange(_event, selectedDate) {
    const idx = editingIdx;
    if (idx == null || !selectedDate) return;
    const hour = selectedDate.getHours();
    const minute = selectedDate.getMinutes();
    setRowTime(idx, hour, minute);
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

      await cancelAllScheduled();

      // Chỉ đặt cho 1 tuần tới
      for (const r of rows) {
        await scheduleWeeklyAbsolute({
          weekday: r.dow, hour: r.hour, minute: r.minute,
          title: 'Tập luyện',
          body: `D${r.dow}: ${String(r.hour).padStart(2,'0')}:${String(r.minute).padStart(2,'0')}`,
          weeksAhead: 1
        });
      }

      // Lưu lên server như cũ
      const payload = rows.map(r => ({
        time_of_day: `${String(r.hour).padStart(2,'0')}:${String(r.minute).padStart(2,'0')}:00`,
        note: `D${r.dow} • kế hoạch ${planId}`,
        plan_id: Number(planId) || null,
        dow: [Number(r.dow)]
      }));
      await api('/api/workouts/reminders', {
        method:'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const scheduled = await listScheduled();
      Alert.alert('Đã đặt nhắc', Array.isArray(scheduled)
        ? `Đặt xong ${scheduled.length} lịch trên thiết bị.`
        : `Đặt xong ${scheduled} lịch trên trình duyệt.`
      );
    } catch (e) {
      Alert.alert('Lỗi', e?.message || 'Không đặt được nhắc');
    } finally {
      setSaving(false);
    }
  }

  async function testNow() {
    const okPerm = await ensurePermissions();
    if (!okPerm) return Alert.alert('Cần quyền', 'Hãy cấp quyền thông báo cho ứng dụng.');
    await setupAndroidChannel();
    await presentNow('Test ngay', 'Thông báo kiểm tra tức thì');
  }

  const title = useMemo(()=> plan ? `Nhắc nhở • ${plan.title}` : 'Nhắc nhở lịch tập', [plan]);

  return (
    <View style={{ flex:1, backgroundColor:C.bg, padding:16 }}>
      <Text style={{ fontSize:22, fontWeight:'800', color:C.text }}>{title}</Text>
      <Text style={{ color:C.sub, marginTop:4 }}>
        Đặt giờ cho từng ngày (chỉ 1 tuần tới). Trên web: nhập HH/MM trực tiếp.
      </Text>

      <View style={{ backgroundColor:C.card, borderWidth:1, borderColor:C.b, borderRadius:16, padding:12, marginTop:12 }}>
        {rows.map((r, idx)=>(
          <View key={r.dow} style={{ flexDirection:'row', alignItems:'center', gap:10, marginBottom:8 }}>
            <Text style={{ width:60, color:C.text, fontWeight:'600' }}>{`D${r.dow}`}</Text>
            {isWeb ? (
              <View style={{ flexDirection:'row', alignItems:'center', gap:8, flex:1 }}>
                <TextInput
                  value={String(r.hour)}
                  onChangeText={(t)=> setRowTime(idx, t.replace(/\D/g,''), r.minute)}
                  keyboardType="numeric"
                  maxLength={2}
                  placeholder="HH"
                  placeholderTextColor={C.sub}
                  style={{ width:60, borderWidth:1, borderColor:C.b, borderRadius:8, paddingVertical:6, paddingHorizontal:10, backgroundColor:'#fff', color:C.text }}
                />
                <Text style={{ color:C.text }}>:</Text>
                <TextInput
                  value={String(r.minute)}
                  onChangeText={(t)=> setRowTime(idx, r.hour, t.replace(/\D/g,''))}
                  keyboardType="numeric"
                  maxLength={2}
                  placeholder="MM"
                  placeholderTextColor={C.sub}
                  style={{ width:60, borderWidth:1, borderColor:C.b, borderRadius:8, paddingVertical:6, paddingHorizontal:10, backgroundColor:'#fff', color:C.text }}
                />
              </View>
            ) : (
              <>
                <Text style={{ flex:1, color:C.sub }}>
                  {String(r.hour).padStart(2,'0')}:{String(r.minute).padStart(2,'0')}
                </Text>
                <Pressable onPress={() => setEditingIdx(idx)} style={{ borderWidth:1, borderColor:C.b, paddingVertical:6, paddingHorizontal:10, borderRadius:8, backgroundColor:'#fff' }}>
                  <Text style={{ color:C.text, fontWeight:'600' }}>Chọn giờ</Text>
                </Pressable>
              </>
            )}
          </View>
        ))}

        <Pressable onPress={saveAll} disabled={saving} style={{ marginTop:8, backgroundColor:C.primary, paddingVertical:10, paddingHorizontal:12, borderRadius:8, opacity:saving?0.7:1 }}>
          <Text style={{ color:'#fff', fontWeight:'700', textAlign:'center' }}>{saving ? 'Đang lưu…' : 'Lưu nhắc cho 1 tuần'}</Text>
        </Pressable>

        

        <Pressable onPress={testNow} style={{ marginTop:8, borderWidth:1, borderColor:'#16A34A', paddingVertical:10, borderRadius:8, backgroundColor:'#ECFDF5' }}>
          <Text style={{ color:'#065F46', fontWeight:'700', textAlign:'center' }}>Bắn thông báo NGAY</Text>
        </Pressable>
      </View>

      {Platform.OS === 'android' && editingIdx != null && (
        <DateTimePicker
          value={new Date(2000, 0, 1, rows[editingIdx].hour, rows[editingIdx].minute)}
          mode="time"
          is24Hour={true}
          display="default"
          onChange={onAndroidChange}
        />
      )}

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