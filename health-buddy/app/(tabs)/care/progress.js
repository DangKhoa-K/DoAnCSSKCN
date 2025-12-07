import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { api } from '../../../src/lib/api';

const C = { bg:'#F0F6FF', card:'#fff', b:'#eef2ff', text:'#0f172a', sub:'#64748b', primary:'#2563eb' };

function daysBack(n){ const d=new Date(); d.setDate(d.getDate()-n); return d.toISOString().slice(0,10); }

function Card({ title, children }) {
  return (
    <View style={{
      backgroundColor:C.card, borderRadius:16, padding:14, marginTop:12,
      borderWidth:1, borderColor:C.b, shadowColor:'#000', shadowOpacity:0.06, shadowRadius:10, shadowOffset:{width:0,height:4}
    }}>
      <Text style={{ fontWeight:'800', color:C.text, marginBottom:6 }}>{title}</Text>
      {children}
    </View>
  );
}

function Bars({ data, unit, max }) {
  return (
    <View style={{ marginTop:8 }}>
      {data.map((d,i)=> {
        const w = Math.max(4, Math.min(100, (d.value / max) * 100));
        return (
          <View key={i} style={{ flexDirection:'row', alignItems:'center', marginBottom:6 }}>
            <Text style={{ width:42, color:C.sub }}>{d.label}</Text>
            <View style={{ flex:1, height:10, backgroundColor:'#eef2ff', borderRadius:6, overflow:'hidden' }}>
              <View style={{ width:`${w}%`, height:'100%', backgroundColor:C.primary }} />
            </View>
            <Text style={{ width:60, textAlign:'right', color:C.sub }}>{d.value}{unit}</Text>
          </View>
        );
      })}
    </View>
  );
}

export default function Progress() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState(7);
  const [sleep, setSleep] = useState([]);
  const [water, setWater] = useState([]);
  const [meds, setMeds]   = useState([]);
  const [mood, setMood]   = useState([]);
  const [stress, setStress] = useState([]);

  useEffect(() => { (async () => {
    setLoading(true);
    try {
      const lastN = Array.from({length:range}).map((_,i)=>daysBack(range-1-i));
      const s = [], h = [], m = [], md = [], st = [];
      for (const d of lastN) {
        const sl = await api(`/api/sleep/logs?date=${d}`).catch(()=>[]);
        const hy = await api(`/api/hydration/logs?date=${d}`).catch(()=>[]);
        const me = await api(`/api/medications/today?date=${d}`).catch(()=>[]);
        const nt = await api(`/api/health/notes?date=${d}`).catch(()=>[]);
        s.push({ date:d, min: sl.reduce((t,x)=>t+Number(x.duration_min||0),0) });
        h.push({ date:d, ml:  hy.reduce((t,x)=>t+Number(x.amount_ml||0),0) });
        m.push({ date:d, count: me.length });
        const n0 = (nt||[]).find(x=>x.mood_score!=null || /mood\s*:\s*\d/i.test(String(x.note||'')));
        const moodVal = n0?.mood_score ?? Number((String(n0?.note||'').match(/mood\s*:\s*(\d)/i)||[])[1] || 0);
        const stressVal = n0?.stress_score ?? Number((String(n0?.note||'').match(/stress\s*:\s*(\d)/i)||[])[1] || 0);
        md.push({ date:d, score:moodVal || 0 });
        st.push({ date:d, score:stressVal || 0 });
      }
      setSleep(s); setWater(h); setMeds(m); setMood(md); setStress(st);
    } catch (err) { console.warn(err); }
    setLoading(false);
  })(); }, [range]);

  const avgSleep = useMemo(()=> (sleep.reduce((t,x)=>t+x.min,0)/Math.max(1,range)/60).toFixed(1), [sleep, range]);
  const avgWater = useMemo(()=> Math.round(water.reduce((t,x)=>t+x.ml,0)/Math.max(1,range)), [water, range]);
  const avgMood = useMemo(()=> (mood.reduce((t,x)=>t+x.score,0)/Math.max(1,range)).toFixed(1), [mood, range]);
  const avgStress = useMemo(()=> (stress.reduce((t,x)=>t+x.score,0)/Math.max(1,range)).toFixed(1), [stress, range]);

  return (
    <ScrollView style={{ flex:1, backgroundColor:C.bg }} contentContainerStyle={{ padding:16 }}>
      <Text onPress={()=>router.back()} style={{ color:C.primary, marginBottom:8 }}>‹ Quay lại</Text>
      <Text style={{ fontSize:22, fontWeight:'800', color:C.text }}>Tiến độ sức khỏe</Text>
      <Text style={{ color:C.sub, marginTop:4 }}>{range} ngày gần nhất</Text>

      <View style={{ flexDirection:'row', gap:8, marginTop:8 }}>
        {[7,30,90].map(n=>(
          <Pressable key={n} onPress={()=>setRange(n)} style={{
            paddingVertical:8, paddingHorizontal:12, borderRadius:999, borderWidth:1,
            borderColor: range===n? C.primary:C.b, backgroundColor: range===n? '#EAF1FF':'#fff'
          }}>
            <Text style={{ color: range===n? C.primary:C.text, fontWeight:'700' }}>{n} ngày</Text>
          </Pressable>
        ))}
      </View>

      {loading ? <ActivityIndicator style={{ marginTop:20 }} /> : (
        <>
          <Card title="Ngủ trung bình">
            <Text style={{ fontWeight:'800', color:C.text }}>{avgSleep} giờ/đêm</Text>
            <Bars data={sleep.map(x=>({ label:x.date.slice(5), value: +(x.min/60).toFixed(1) }))} unit="h" max={10} />
          </Card>

          <Card title="Nước uống trung bình">
            <Text style={{ fontWeight:'800', color:C.text }}>{avgWater} ml/ngày</Text>
            <Bars data={water.map(x=>({ label:x.date.slice(5), value:x.ml }))} unit="ml" max={3000} />
          </Card>

          <Card title="Số mục thuốc mỗi ngày">
            <Bars data={meds.map(x=>({ label:x.date.slice(5), value:x.count }))} unit="" max={5} />
          </Card>

          <Card title="Mood trung bình">
            <Text style={{ fontWeight:'800', color:C.text }}>{avgMood}/5</Text>
            <Bars data={mood.map(x=>({ label:x.date.slice(5), value:x.score }))} unit="" max={5} />
          </Card>

          <Card title="Stress trung bình">
            <Text style={{ fontWeight:'800', color:C.text }}>{avgStress}/5</Text>
            <Bars data={stress.map(x=>({ label:x.date.slice(5), value:x.score }))} unit="" max={5} />
          </Card>

          <Card title="Nhận xét nhanh">
            <Text style={{ color:C.sub, marginTop:4 }}>
              {Number(avgSleep) < 7 ? '• Tăng thời lượng ngủ ≥7h/đêm.\n' : '• Bạn duy trì giấc ngủ tốt.\n'}
              {avgWater < 1800 ? '• Tăng lượng nước ~2L/ngày.\n' : '• Lượng nước khá ổn.\n'}
              {Number(avgMood) < 3 ? '• Cải thiện mood: thử thiền/hít thở 3’.\n' : '• Mood ổn định.\n'}
              {Number(avgStress) >= 3 ? '• Giảm stress: nghỉ ngắn, vận động nhẹ.\n' : '• Stress ở mức an toàn.\n'}
              • Duy trì việc uống thuốc/ vitamin đúng giờ.
            </Text>
          </Card>
        </>
      )}
    </ScrollView>
  );
}