// app/(tabs)/care/progress.js
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { api } from '../../../src/lib/api';

const C = { bg:'#F6F7FB', card:'#fff', b:'#e5e7eb', text:'#0f172a', sub:'#64748b', primary:'#2563eb' };

function daysBack(n){ const d=new Date(); d.setDate(d.getDate()-n); return d.toISOString().slice(0,10); }

export default function Progress() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [sleep, setSleep] = useState([]);      // [{date, min}]
  const [water, setWater] = useState([]);      // [{date, ml}]
  const [meds, setMeds]   = useState([]);      // [{date, count}]

  useEffect(() => { (async () => {
    setLoading(true);
    try {
      const last7 = Array.from({length:7}).map((_,i)=>daysBack(6-i));
      const s = [], h = [], m = [];
      for (const d of last7) {
        const sl = await api(`/api/sleep/logs?date=${d}`) || [];
        const hy = await api(`/api/hydration/logs?date=${d}`) || [];
        const me = await api(`/api/medications/today?date=${d}`) || [];
        s.push({ date:d, min: sl.reduce((t,x)=>t+Number(x.duration_min||0),0) });
        h.push({ date:d, ml:  hy.reduce((t,x)=>t+Number(x.amount_ml||0),0) });
        m.push({ date:d, count: me.length });
      }
      setSleep(s); setWater(h); setMeds(m);
    } catch (err) { console.warn(err); }
    setLoading(false);
  })(); }, []);

  const avgSleep = useMemo(()=> (sleep.reduce((t,x)=>t+x.min,0)/7/60).toFixed(1), [sleep]);
  const avgWater = useMemo(()=> Math.round(water.reduce((t,x)=>t+x.ml,0)/7), [water]);

  return (
    <ScrollView style={{ flex:1, backgroundColor:C.bg, padding:16 }}>
      <Text onPress={()=>router.back()} style={{ color:'#2563eb', marginBottom:8 }}>‹ Quay lại</Text>
      <Text style={{ fontSize:22, fontWeight:'800', color:C.text }}>Tiến độ sức khỏe</Text>
      <Text style={{ color:C.sub, marginTop:4 }}>7 ngày gần nhất</Text>

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

          <Card title="Nhận xét nhanh">
            <Text style={{ color:C.sub, marginTop:4 }}>
              {Number(avgSleep) < 7 ? '• Tăng thời lượng ngủ lên ≥7h/đêm.\n' : '• Bạn duy trì giấc ngủ tốt.\n'}
              {avgWater < 1800 ? '• Tăng lượng nước ~2L/ngày.\n' : '• Lượng nước khá ổn.\n'}
              • Duy trì việc uống thuốc/ vitamin đúng giờ.
            </Text>
          </Card>
        </>
      )}
    </ScrollView>
  );
}

function Card({ title, children }) {
  return (
    <View style={{ backgroundColor:C.card, borderWidth:1, borderColor:C.b, borderRadius:14, padding:14, marginTop:12 }}>
      <Text style={{ fontWeight:'800', color:C.text, marginBottom:6 }}>{title}</Text>
      {children}
    </View>
  );
}

function Bars({ data, unit, max }) {
  // bar đơn giản không cần thư viện
  return (
    <View style={{ marginTop:8 }}>
      {data.map((d,i)=> {
        const w = Math.max(4, Math.min(100, (d.value / max) * 100));
        return (
          <View key={i} style={{ flexDirection:'row', alignItems:'center', marginBottom:6 }}>
            <Text style={{ width:42, color:'#64748b' }}>{d.label}</Text>
            <View style={{ flex:1, height:10, backgroundColor:'#eef2ff', borderRadius:6, overflow:'hidden' }}>
              <View style={{ width:`${w}%`, height:'100%', backgroundColor:'#2563eb' }} />
            </View>
            <Text style={{ width:60, textAlign:'right', color:'#64748b' }}>{d.value}{unit}</Text>
          </View>
        );
      })}
    </View>
  );
}
