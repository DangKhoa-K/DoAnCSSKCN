// app/(tabs)/care/index.js
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { api } from '../../../src/lib/api';

const C = { bg:'#F6F7FB', card:'#fff', b:'#e5e7eb', text:'#0f172a', sub:'#64748b', primary:'#2563eb' };
const today = () => new Date().toISOString().slice(0,10);

function Card({ title, children, right }) {
  return (
    <View style={{ backgroundColor:C.card, borderWidth:1, borderColor:C.b, borderRadius:14, padding:14, marginBottom:12 }}>
      <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:6 }}>
        <Text style={{ fontWeight:'800', color:C.text }}>{title}</Text>
        {right || null}
      </View>
      {children}
    </View>
  );
}

export default function CareOverview() {
  const date = today();
  const [sleepMin, setSleepMin] = useState(0);
  const [waterMl, setWaterMl] = useState(0);
  const [meds, setMeds] = useState([]);
  const [mood, setMood] = useState(null); // lấy từ notes nếu có “mood: x”

  const load = useCallback(async () => {
    try {
      const s = await api(`/api/sleep/logs?date=${date}`);
      setSleepMin((s||[]).reduce((t,x)=>t+Number(x.duration_min||0),0));
    } catch (err) { console.warn(err); }

    try {
      const h = await api(`/api/hydration/logs?date=${date}`);
      setWaterMl((h||[]).reduce((t,x)=>t+Number(x.amount_ml||0),0));
    } catch (err) { console.warn(err); }

    try {
      const m = await api(`/api/medications/today?date=${date}`);
      setMeds(Array.isArray(m)?m:[]);
    } catch (err) { console.warn(err); }

    try {
      const n = await api(`/api/health/notes?date=${date}`);
      // kiếm chuỗi “mood: N” nếu người dùng từng lưu
      const found = (n||[]).map(x=>String(x.note||'')).find(t=>/mood\s*:\s*\d/i.test(t));
      setMood(found ? Number((found.match(/mood\s*:\s*(\d)/i)||[])[1]) : null);
    } catch (err) { console.warn(err); }
  }, [date]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Đánh giá trạng thái tổng quát
  const status = useMemo(() => {
    const hrs = sleepMin/60;
    if (hrs < 5) return { label:'Thiếu ngủ', color:'#ef4444' };
    if (meds.some(m=>!m.taken)) return { label:'Cần uống thuốc', color:'#f59e0b' };
    if (mood && mood <= 2) return { label:'Cần nghỉ ngơi', color:'#f59e0b' };
    return { label:'Ổn định', color:'#16a34a' };
  }, [sleepMin, meds, mood]);

  const goalWater = 2000;
  const tip = useMemo(() => {
    if (sleepMin/60 < 6) return 'Bạn mới ngủ ~' + (sleepMin/60).toFixed(1) + 'h – thử đi ngủ sớm hơn hôm nay.';
    if (waterMl < goalWater) return `Uống thêm ~${goalWater - waterMl} ml để đủ ${goalWater/1000}L.`;
    return 'Tiếp tục duy trì nhịp sinh hoạt tốt nhé!';
  }, [sleepMin, waterMl]);

  return (
    <ScrollView style={{ flex:1, backgroundColor:C.bg, padding:16 }}>
      <Text style={{ fontSize:22, fontWeight:'800', color:C.text, marginBottom:12 }}>Tổng quan sức khỏe</Text>

      <Card title="Trạng thái hôm nay" right={<Text style={{ color:status.color, fontWeight:'800' }}>{status.label}</Text>}>
        <Text style={{ color:C.sub }}>Ngày {date}</Text>
        <View style={{ height:8 }} />
        <Text style={{ color:C.text }}>{tip}</Text>
      </Card>

      <Card title="Chỉ số hôm nay">
        <Row label="Ngủ" value={`${(sleepMin/60).toFixed(1)} giờ`} link="/(tabs)/care/sleep" />
        <Row label="Nước uống" value={`${waterMl} ml`} link="/(tabs)/care/lifestyle" />
        <Row label="Thuốc/Vitamin" value={`${meds.length} mục`} link="/(tabs)/care/meds" />
        <Row label="Tâm trạng" value={mood ? `${'⭐'.repeat(mood)}` : '—'} link="/(tabs)/care/lifestyle" />
      </Card>

      <Card title="Hành động nhanh">
        <Quick title="Ghi giấc ngủ" to="/(tabs)/care/sleep" />
        <Quick title="Thêm nước 300ml" onPress={async () => {
          try {
            await api('/api/hydration/logs', { method:'POST', body: JSON.stringify({ date, amount_ml:300 }) });
            load();
          } catch (err) { Alert.alert('Lỗi', err?.message || 'Không lưu được'); }
        }} />
        <Quick title="Thêm thuốc" to="/(tabs)/care/meds" />
        <Quick title="Ghi chú sức khỏe" to="/(tabs)/care/lifestyle" />
        <Quick title="Tiến độ" to="/(tabs)/care/progress" />
      </Card>
    </ScrollView>
  );
}

function Row({ label, value, link }) {
  return (
    <Link href={link} asChild>
      <Pressable style={{ paddingVertical:10, flexDirection:'row', justifyContent:'space-between', borderTopWidth:1, borderTopColor:'#F3F4F6' }}>
        <Text style={{ color:C.text, fontWeight:'600' }}>{label}</Text>
        <Text style={{ color:C.sub }}>{value}</Text>
      </Pressable>
    </Link>
  );
}
function Quick({ title, to, onPress }) {
  const body = (
    <View style={{ backgroundColor:'#eef5ff', paddingVertical:10, paddingHorizontal:12, borderRadius:10, borderWidth:1, borderColor:'#dbe7ff', marginRight:8, marginBottom:8 }}>
      <Text style={{ color:C.primary, fontWeight:'700' }}>{title}</Text>
    </View>
  );
  if (to) return <Link href={to}>{body}</Link>;
  return <Pressable onPress={onPress}>{body}</Pressable>;
}
