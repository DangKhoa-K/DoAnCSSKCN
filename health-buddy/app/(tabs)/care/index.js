import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { api } from '../../../src/lib/api';

const C = { bg:'#F6F7FB', card:'#fff', b:'#e5e7eb', text:'#0f172a', sub:'#64748b', primary:'#2563eb', good:'#16a34a', warn:'#f59e0b', bad:'#ef4444' };
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
function Bar({ value, target, unit }) {
  const pct = Math.max(0, Math.min(1, target ? value/target : 0));
  return (
    <View style={{ marginTop:8 }}>
      <View style={{ height:10, backgroundColor:'#eef2ff', borderRadius:6 }}>
        <View style={{ width:`${pct*100}%`, height:10, backgroundColor:'#2563eb', borderRadius:6 }} />
      </View>
      <Text style={{ color:C.sub, marginTop:6 }}>{value}{unit} / {target}{unit}</Text>
    </View>
  );
}

export default function CareOverview() {
  const date = today();
  const [loading, setLoading] = useState(true);
  const [sleepMin, setSleepMin] = useState(0);
  const [waterMl, setWaterMl] = useState(0);
  const [meds, setMeds] = useState([]);
  const [mood, setMood] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await api(`/api/sleep/logs?date=${date}`).catch(()=>[]);
      setSleepMin((s||[]).reduce((t,x)=>t+Number(x.duration_min||0),0));
    } catch (err) { console.warn(err); }

    try {
      const h = await api(`/api/hydration/logs?date=${date}`).catch(()=>[]);
      setWaterMl((h||[]).reduce((t,x)=>t+Number(x.amount_ml||0),0));
    } catch (err) { console.warn(err); }

    try {
      const m = await api(`/api/medications/today?date=${date}`).catch(()=>[]);
      setMeds(Array.isArray(m)?m:[]);
    } catch (err) { console.warn(err); }

    try {
      const n = await api(`/api/health/notes?date=${date}`).catch(()=>[]);
      const found = (n||[]).map(x=>String(x.note||'')).find(t=>/mood\s*:\s*\d/i.test(t));
      setMood(found ? Number((found.match(/mood\s*:\s*(\d)/i)||[])[1]) : null);
    } catch (err) { console.warn(err); }
    setLoading(false);
  }, [date]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const status = useMemo(() => {
    const hrs = sleepMin/60;
    if (hrs < 5) return { label:'Thiếu ngủ', color:C.bad };
    if (meds.some(m=>!m.taken)) return { label:'Cần uống thuốc', color:C.warn };
    if (mood && mood <= 2) return { label:'Cần nghỉ ngơi', color:C.warn };
    return { label:'Ổn định', color:C.good };
  }, [sleepMin, meds, mood]);

  const goalWater = 2000;
  const goalSleepMin = 7*60;

  const coaching = useMemo(() => {
    const hrs = sleepMin/60;
    const tips = [];
    if (hrs < 6.5) tips.push(`• Bạn ngủ ~${hrs.toFixed(1)}h: thử đặt giờ đi ngủ sớm hơn 30’ và hạn chế màn hình trước khi ngủ.`);
    if (waterMl < goalWater) tips.push(`• Uống thêm ~${goalWater - waterMl} ml để đạt ${goalWater/1000}L.`);
    if (meds.some(m=>!m.taken)) tips.push(`• Có ${meds.filter(m=>!m.taken).length} mục thuốc chưa uống hôm nay.`);
    if (mood && mood <=2) tips.push(`• Tâm trạng thấp: thử hít thở sâu 3’ hoặc đi bộ nhẹ 10’.`);
    if (tips.length===0) tips.push('• Tiếp tục duy trì nhịp sinh hoạt tốt nhé!');
    return tips.join('\n');
  }, [sleepMin, waterMl, meds, mood]);

  return (
    <ScrollView style={{ flex:1, backgroundColor:C.bg, padding:16 }}>
      <Text style={{ fontSize:22, fontWeight:'800', color:C.text, marginBottom:12 }}>Tổng quan sức khỏe</Text>

      {loading ? (
        <ActivityIndicator style={{ marginTop:12 }} />
      ) : (
        <>
          <Card title="Trạng thái hôm nay" right={<Text style={{ color:status.color, fontWeight:'800' }}>{status.label}</Text>}>
            <Text style={{ color:C.sub }}>Ngày {date}</Text>
            <View style={{ height:8 }} />
            <Text style={{ color:C.text, whiteSpace:'pre-line' }}>{coaching}</Text>
          </Card>

          <Card title="Mục tiêu hôm nay">
            <Text style={{ color:C.text, fontWeight:'700' }}>Nước uống</Text>
            <Bar value={waterMl} target={goalWater} unit=" ml" />

            <View style={{ height:10 }} />
            <Text style={{ color:C.text, fontWeight:'700' }}>Giấc ngủ đêm qua</Text>
            <Bar value={sleepMin} target={goalSleepMin} unit=" phút" />
            <Text style={{ color:C.sub, marginTop:6 }}>
              {sleepMin >= goalSleepMin ? 'Đạt mục tiêu' : `Thiếu ${goalSleepMin - sleepMin} phút`}
            </Text>

            <View style={{ height:10 }} />
            <Text style={{ color:C.text, fontWeight:'700' }}>Thuốc/Vitamin</Text>
            <Text style={{ color:C.sub, marginTop:6 }}>
              {meds.length} mục • {meds.filter(m=>!m.taken).length} chưa uống
            </Text>

            <View style={{ height:10 }} />
            <Text style={{ color:C.text, fontWeight:'700' }}>Tâm trạng</Text>
            <Link href='/(tabs)/care/lifestyle' asChild>
              <Pressable style={{ marginTop:6, flexDirection:'row', gap:6 }}>
                {[1,2,3,4,5].map(n=>(
                  <View key={n} style={{ paddingHorizontal:10, paddingVertical:6, borderRadius:999, borderWidth:1, borderColor:n===(mood||3)?'#2563eb':'#e5e7eb', backgroundColor:n===(mood||3)?'#eaf1ff':'#fff' }}>
                    <Text style={{ color:n===(mood||3)?'#2563eb':'#0f172a' }}>{['😢','😟','😐','🙂','😄'][n-1]}</Text>
                  </View>
                ))}
              </Pressable>
            </Link>
          </Card>

          <Card title="Chỉ số hôm nay">
            <Row label="Ngủ" value={`${(sleepMin/60).toFixed(1)} giờ`} link="/(tabs)/care/sleep" />
            <Row label="Nước uống" value={`${waterMl} ml`} link="/(tabs)/care/hydration" />
            <Row label="Thuốc/Vitamin" value={`${meds.length} mục`} link="/(tabs)/care/meds" />
            <Row label="Tâm trạng" value={mood ? `${'⭐'.repeat(mood)}` : '—'} link="/(tabs)/care/lifestyle" />
          </Card>
        </>
      )}
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