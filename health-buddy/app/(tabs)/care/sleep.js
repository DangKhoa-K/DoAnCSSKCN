import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { api } from '../../../src/lib/api';
import { ensureAndroidChannel, ensureNotiPermission, scheduleDaily } from '../../../src/lib/notifications';
import { diffMinutes } from '../../../src/lib/time-helpers';

const C = { bg:'#F6F7FB', card:'#fff', b:'#eef2ff', text:'#0f172a', sub:'#64748b', primary:'#2563eb' };
const today = () => new Date().toISOString().slice(0,10);
const GOAL_SLEEP_MIN = 7*60;

function Donut({ value, max, size = 160, stroke = 12, color = '#2563eb' }) {
  const pct = Math.max(0, Math.min(1, value/Math.max(1,max))) * 100;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (c * pct) / 100;
  return (
    <View style={{ width:size, height:size }}>
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
        <Text style={{ fontSize:22, fontWeight:'800', color:C.text }}>{Math.round(value/60)}h</Text>
        <Text style={{ color:C.sub }}>{Math.round(max/60)}h goal</Text>
      </View>
    </View>
  );
}

function Card({ title, children }) {
  return (
    <View style={{
      backgroundColor:C.card, borderRadius:16, padding:14, marginTop:12,
      borderWidth:1, borderColor:C.b, shadowColor:'#000', shadowOpacity:0.06, shadowRadius:10, shadowOffset:{width:0,height:4}
    }}>
      <Text style={{ fontWeight:'800', color:C.text, marginBottom:8 }}>{title}</Text>
      {children}
    </View>
  );
}

export default function Sleep() {
  const router = useRouter();
  const date = today();
  const [start, setStart] = useState('23:00');
  const [end, setEnd] = useState('06:30');
  const [dur, setDur] = useState('390'); // phút
  const [quality, setQuality] = useState(3); // 1-5
  const [awakeCount, setAwakeCount] = useState(0);
  const [logs, setLogs] = useState([]);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    try { const s = await api(`/api/sleep/logs?date=${date}`); setLogs(Array.isArray(s)?s:[]); } catch {}
  }, [date]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

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
    try { await api('/api/sleep/logs', { method:'POST', body: { date, duration_min:min } }); load(); }
    catch (err) { Alert.alert('Lỗi', err?.message || 'Không lưu được'); }
  }

  async function saveFull() {
    const duration_min = Number(dur||0);
    if (!duration_min) return Alert.alert('Lỗi','Nhập phút hợp lệ');
    try {
      await api('/api/sleep/logs', { method:'POST', body: { date, start_time:start, end_time:end, duration_min, quality, awake_count: awakeCount } });
      load(); Alert.alert('Đã lưu', 'Đã ghi giấc ngủ.');
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
    <View style={{ flex:1, backgroundColor:'#f0f6ff' }}>
      <View style={{ padding:16 }}>
        <Pressable onPress={()=>router.back()}><Text style={{ color:C.primary, marginBottom:8 }}>‹ Quay lại</Text></Pressable>
        <View style={{
          backgroundColor:'#fff', borderRadius:18, padding:16,
          borderWidth:1, borderColor:C.b, shadowColor:'#000', shadowOpacity:0.06, shadowRadius:10, shadowOffset:{width:0,height:4}
        }}>
          <Text style={{ fontSize:22, fontWeight:'800', color:C.text }}>Giấc ngủ</Text>
          <View style={{ alignItems:'center', marginTop:12 }}>
            <Donut value={total} max={GOAL_SLEEP_MIN} />
            <Text style={{ color:C.sub, marginTop:6 }}>{(total/60).toFixed(1)}h hôm nay</Text>
          </View>

          <Card title="Ghi nhanh">
            <View style={{ flexDirection:'row', gap:8, flexWrap:'wrap' }}>
              {[360,420,480].map(m => (
                <Pressable key={m} onPress={()=>quickAdd(m)}
                  style={{ borderWidth:1, borderColor:'#dbe7ff', backgroundColor:'#eef5ff', borderRadius:10, paddingVertical:8, paddingHorizontal:12 }}>
                  <Text style={{ color:C.primary, fontWeight:'700' }}>{m/60} giờ</Text>
                </Pressable>
              ))}
            </View>
          </Card>

          <Card title="Nhập chi tiết">
            <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
              <Text style={{ color:C.sub, width:100 }}>Giờ đi ngủ</Text>
              <Pressable onPress={()=>openPicker('start')} style={{ flex:1, borderWidth:1, borderColor:'#e5e7eb', borderRadius:10, padding:10, backgroundColor:'#fff' }}>
                <Text style={{ color:C.text }}>{start}</Text>
              </Pressable>
              <Pressable onPress={setBedtimeReminder} style={{ borderWidth:1, borderColor:'#dbe7ff', backgroundColor:'#eef5ff', borderRadius:10, paddingVertical:8, paddingHorizontal:12 }}>
                <Text style={{ color:C.primary, fontWeight:'700' }}>Đặt nhắc</Text>
              </Pressable>
            </View>

            <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginTop:10 }}>
              <Text style={{ color:C.sub, width:100 }}>Giờ thức dậy</Text>
              <Pressable onPress={()=>openPicker('end')} style={{ flex:1, borderWidth:1, borderColor:'#e5e7eb', borderRadius:10, padding:10, backgroundColor:'#fff' }}>
                <Text style={{ color:C.text }}>{end}</Text>
              </Pressable>
              <Pressable onPress={setWakeReminder} style={{ borderWidth:1, borderColor:'#dbe7ff', backgroundColor:'#eef5ff', borderRadius:10, paddingVertical:8, paddingHorizontal:12 }}>
                <Text style={{ color:C.primary, fontWeight:'700' }}>Đặt nhắc</Text>
              </Pressable>
            </View>

            <View style={{ marginTop:10 }}>
              <Text style={{ color:C.sub }}>Tổng phút</Text>
              <View style={{ borderWidth:1, borderColor:'#e5e7eb', borderRadius:10, padding:10, backgroundColor:'#fff', marginTop:6 }}>
                <Text style={{ color:C.text }}>{dur} • {delta>=0?`+${delta}`:`${delta}`} so với mục tiêu {GOAL_SLEEP_MIN}’</Text>
              </View>
            </View>

            <View style={{ marginTop:10 }}>
              <Text style={{ fontWeight:'700', color:C.text }}>Chất lượng giấc ngủ</Text>
              <View style={{ flexDirection:'row', gap:8, marginTop:6 }}>
                {[1,2,3,4,5].map(n=>(
                  <Pressable key={n} onPress={()=>setQuality(n)} style={{
                    paddingVertical:8, paddingHorizontal:12, borderRadius:8,
                    borderWidth:1, borderColor:n===quality? '#2563eb':'#e5e7eb', backgroundColor:n===quality? '#eaf1ff':'#fff'
                  }}>
                    <Text style={{ color:n===quality?'#2563eb':'#0f172a', fontWeight:'700' }}>{n}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={{ marginTop:10 }}>
              <Text style={{ color:C.sub }}>Thức giữa đêm (lần)</Text>
              <View style={{ flexDirection:'row', gap:8, marginTop:6 }}>
                {[0,1,2,3].map(n=>(
                  <Pressable key={n} onPress={()=>setAwakeCount(n)} style={{
                    paddingVertical:8, paddingHorizontal:12, borderRadius:8,
                    borderWidth:1, borderColor:n===awakeCount? '#2563eb':'#e5e7eb', backgroundColor:n===awakeCount? '#eaf1ff':'#fff'
                  }}>
                    <Text style={{ color:n===awakeCount?'#2563eb':'#0f172a', fontWeight:'700' }}>{n}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={{ marginTop:12, flexDirection:'row', justifyContent:'flex-end' }}>
              <Pressable onPress={saveFull} style={{ backgroundColor:C.primary, paddingVertical:10, paddingHorizontal:16, borderRadius:10 }}>
                <Text style={{ color:'#fff', fontWeight:'800' }}>Lưu giấc ngủ</Text>
              </Pressable>
            </View>
          </Card>

          <Card title="Lịch sử hôm nay">
            {logs.length ? logs.map(item=>(
              <View key={item.id} style={{ paddingVertical:8, borderTopWidth:1, borderTopColor:'#F1F5F9' }}>
                <Text style={{ fontWeight:'700', color:C.text }}>{item.start_time || '---'} → {item.end_time || '---'}</Text>
                <Text style={{ color:C.sub, marginTop:4 }}>{item.duration_min} phút • chất lượng {item.quality ?? '—'} • thức giữa đêm {item.awake_count ?? '—'}</Text>
              </View>
            )) : <Text style={{ color:C.sub }}>Chưa có log hôm nay.</Text>}
          </Card>
        </View>
      </View>

      {Platform.OS === 'android' && editing && (
        <DateTimePicker value={currentDate(editing)} mode="time" is24Hour={true} display="default" onChange={onAndroidChange} />
      )}
      {Platform.OS === 'ios' && editing && (
        <View style={{ position:'absolute', left:0, right:0, bottom:0, top:0, backgroundColor:'rgba(0,0,0,0.2)', justifyContent:'flex-end' }}>
          <View style={{ backgroundColor:'#fff', borderTopLeftRadius:16, borderTopRightRadius:16, padding:12 }}>
            <Text style={{ fontWeight:'700', color:C.text, marginBottom:8 }}>Đang chọn {editing==='start'?'giờ đi ngủ':'giờ thức dậy'}</Text>
            <DateTimePicker value={currentDate(editing)} mode="time" is24Hour={true} display="spinner" onChange={oniOSChange} />
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
    </View>
  );
}