import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Button, FlatList, Platform, Pressable, Text, View } from 'react-native';
import { api } from '../../../src/lib/api';
import { ensureAndroidChannel, ensureNotiPermission, scheduleDaily } from '../../../src/lib/notifications';
import { diffMinutes } from '../../../src/lib/time-helpers';

const C = { bg:'#F6F7FB', card:'#fff', b:'#e5e7eb', text:'#0f172a', sub:'#64748b', primary:'#2563eb' };
const today = () => new Date().toISOString().slice(0,10);
const GOAL_SLEEP_MIN = 7*60;

export default function Sleep() {
  const router = useRouter();
  const date = today();
  const [start, setStart] = useState('23:00');
  const [end, setEnd] = useState('06:30');
  const [dur, setDur] = useState('390'); // phút
  const [quality, setQuality] = useState(3); // 1-5
  const [awakeCount, setAwakeCount] = useState(0);
  const [logs, setLogs] = useState([]);
  const [editing, setEditing] = useState(null); // 'start' | 'end'
  const isIOS = Platform.OS === 'ios';

  const load = useCallback(async () => {
  try {
    const s = await api(`/api/sleep/logs?date=${date}`);
    setLogs(Array.isArray(s)?s:[]);
  } catch (err) { console.warn(err); }
}, [date]);

// Gọi load với đúng dependency
useFocusEffect(
  useCallback(() => {
    load();
  }, [load]) // <-- thêm load vào đây để hết cảnh báo
);

  function openPicker(which){ setEditing(which); }
  function currentDate(which){
    const hhmm = which==='start'? start : end;
    const [h,m] = hhmm.split(':').map(Number);
    return new Date(2000,0,1,h,m);
  }
  function onAndroidChange(e, selectedDate){
    if (e.type === 'dismissed') { setEditing(null); return; }
    if (selectedDate) {
      const hh = String(selectedDate.getHours()).padStart(2,'0');
      const mm = String(selectedDate.getMinutes()).padStart(2,'0');
      if (editing==='start') setStart(`${hh}:${mm}`); else setEnd(`${hh}:${mm}`);
      const d = diffMinutes(editing==='start'? `${hh}:${mm}` : start, editing==='start'? end : `${hh}:${mm}`);
      if (d != null) setDur(String(d));
    }
    setEditing(null);
  }
  function oniOSChange(_e, selectedDate){
    if (!selectedDate) return;
    const hh = String(selectedDate.getHours()).padStart(2,'0');
    const mm = String(selectedDate.getMinutes()).padStart(2,'0');
    if (editing==='start') setStart(`${hh}:${mm}`); else setEnd(`${hh}:${mm}`);
    const d = diffMinutes(editing==='start'? `${hh}:${mm}` : start, editing==='start'? end : `${hh}:${mm}`);
    if (d != null) setDur(String(d));
  }
  function closeIOS(){ setEditing(null); }

  async function quickAdd(min){
    try {
      await api('/api/sleep/logs', { method:'POST', body: { date, duration_min:min } });
      load();
    } catch (err) { Alert.alert('Lỗi', err?.message || 'Không lưu được'); }
  }

  async function saveFull() {
    const duration_min = Number(dur||0);
    if (!duration_min) return Alert.alert('Lỗi','Nhập phút hợp lệ');
    try {
      await api('/api/sleep/logs', { method:'POST', body: { date, start_time:start, end_time:end, duration_min, quality, awake_count: awakeCount } });
      load();
      Alert.alert('Đã lưu', 'Đã ghi giấc ngủ.');
    } catch (err) { Alert.alert('Lỗi', err?.message || 'Không lưu được'); }
  }

  async function setBedtimeReminder() {
    try {
      const ok = await ensureNotiPermission(); await ensureAndroidChannel();
      if (!ok) return Alert.alert('Cần quyền', 'Hãy cấp quyền thông báo.');
      await scheduleDaily(start, 'Giờ đi ngủ', `Nhắc đi ngủ lúc ${start}`);
      Alert.alert('Đã đặt nhắc', `Đi ngủ lúc ${start} mỗi ngày.`);
    } catch (e) { Alert.alert('Lỗi', e?.message || 'Không đặt được nhắc'); }
  }
  async function setWakeReminder() {
    try {
      const ok = await ensureNotiPermission(); await ensureAndroidChannel();
      if (!ok) return Alert.alert('Cần quyền', 'Hãy cấp quyền thông báo.');
      await scheduleDaily(end, 'Giờ thức dậy', `Nhắc thức dậy lúc ${end}`);
      Alert.alert('Đã đặt nhắc', `Thức dậy lúc ${end} mỗi ngày.`);
    } catch (e) { Alert.alert('Lỗi', e?.message || 'Không đặt được nhắc'); }
  }

  const total = useMemo(() => logs.reduce((t,x)=>t+Number(x.duration_min||0),0), [logs]);
  const delta = Number(dur) - GOAL_SLEEP_MIN;

  return (
    <>
      <FlatList
        style={{ flex:1, backgroundColor:C.bg }}
        ListHeaderComponent={
          <View style={{ padding:16 }}>
            <Pressable onPress={()=>router.back()}><Text style={{ color:C.primary, marginBottom:8 }}>‹ Quay lại</Text></Pressable>
            <Text style={{ fontSize:22, fontWeight:'800', color:C.text }}>Giấc ngủ</Text>
            <Text style={{ color:C.sub, marginTop:4 }}>Ghi nhanh hoặc chọn giờ chi tiết.</Text>

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

              <View style={{ marginTop:10, flexDirection:'row', alignItems:'center', gap:8 }}>
                <Text style={{ color:C.sub, width:100 }}>Giờ đi ngủ</Text>
                <Pressable onPress={()=>openPicker('start')} style={{ flex:1, borderWidth:1, borderColor:C.b, borderRadius:10, padding:10, backgroundColor:'#fff' }}>
                  <Text style={{ color:C.text }}>{start}</Text>
                </Pressable>
                <Pressable onPress={setBedtimeReminder} style={{ borderWidth:1, borderColor:'#dbe7ff', backgroundColor:'#eef5ff', borderRadius:10, paddingVertical:8, paddingHorizontal:12 }}>
                  <Text style={{ color:C.primary, fontWeight:'700' }}>Đặt nhắc</Text>
                </Pressable>
              </View>

              <View style={{ marginTop:10, flexDirection:'row', alignItems:'center', gap:8 }}>
                <Text style={{ color:C.sub, width:100 }}>Giờ thức dậy</Text>
                <Pressable onPress={()=>openPicker('end')} style={{ flex:1, borderWidth:1, borderColor:C.b, borderRadius:10, padding:10, backgroundColor:'#fff' }}>
                  <Text style={{ color:C.text }}>{end}</Text>
                </Pressable>
                <Pressable onPress={setWakeReminder} style={{ borderWidth:1, borderColor:'#dbe7ff', backgroundColor:'#eef5ff', borderRadius:10, paddingVertical:8, paddingHorizontal:12 }}>
                  <Text style={{ color:C.primary, fontWeight:'700' }}>Đặt nhắc</Text>
                </Pressable>
              </View>

              <View style={{ marginTop:10, flexDirection:'row', alignItems:'center', gap:8 }}>
                <Text style={{ color:C.sub, width:100 }}>Tổng phút</Text>
                <View style={{ flex:1, borderWidth:1, borderColor:C.b, borderRadius:10, padding:10, backgroundColor:'#fff' }}>
                  <Text style={{ color:C.text }}>{dur} • {delta>=0?`+${delta}`:`${delta}`} so với mục tiêu {GOAL_SLEEP_MIN}’</Text>
                </View>
              </View>

              <View style={{ marginTop:10 }}>
                <Text style={{ fontWeight:'700', color:C.text }}>Chất lượng giấc ngủ</Text>
                <View style={{ flexDirection:'row', gap:8, marginTop:6 }}>
                  {[1,2,3,4,5].map(n=>(
                    <Pressable key={n} onPress={()=>setQuality(n)} style={{ paddingVertical:8, paddingHorizontal:12, borderRadius:8, borderWidth:1, borderColor:n===quality? '#2563eb':'#e5e7eb', backgroundColor:n===quality? '#eaf1ff':'#fff' }}>
                      <Text style={{ color:n===quality?'#2563eb':'#0f172a', fontWeight:'700' }}>{n}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={{ marginTop:10, flexDirection:'row', alignItems:'center', gap:8 }}>
                <Text style={{ color:C.sub, width:140 }}>Thức giữa đêm (lần)</Text>
                <View style={{ flexDirection:'row', gap:8 }}>
                  {[0,1,2,3].map(n=>(
                    <Pressable key={n} onPress={()=>setAwakeCount(n)} style={{ paddingVertical:8, paddingHorizontal:12, borderRadius:8, borderWidth:1, borderColor:n===awakeCount? '#2563eb':'#e5e7eb', backgroundColor:n===awakeCount? '#eaf1ff':'#fff' }}>
                      <Text style={{ color:n===awakeCount?'#2563eb':'#0f172a', fontWeight:'700' }}>{n}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={{ marginTop:10 }}>
                <Button title="Lưu giấc ngủ" onPress={saveFull} />
              </View>
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
            <Text style={{ color:C.sub, marginTop:4 }}>{item.duration_min} phút • chất lượng {item.quality ?? '—'} • thức giữa đêm {item.awake_count ?? '—'}</Text>
          </View>
        )}
      />

      {Platform.OS === 'android' && editing && (
        <DateTimePicker
          value={currentDate(editing)}
          mode="time"
          is24Hour={true}
          display="default"
          onChange={onAndroidChange}
        />
      )}
      {isIOS && editing && (
        <View style={{ position:'absolute', left:0, right:0, bottom:0, top:0, backgroundColor:'rgba(0,0,0,0.2)', justifyContent:'flex-end' }}>
          <View style={{ backgroundColor:'#fff', borderTopLeftRadius:16, borderTopRightRadius:16, padding:12 }}>
            <Text style={{ fontWeight:'700', color:C.text, marginBottom:8 }}>Đang chọn {editing==='start'?'giờ đi ngủ':'giờ thức dậy'}</Text>
            <DateTimePicker
              value={currentDate(editing)}
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