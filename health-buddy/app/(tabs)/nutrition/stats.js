import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { api } from '../../../src/lib/api';

const C = { bg:'#F6F7FB', card:'#fff', b:'#e5e7eb', text:'#0f172a', sub:'#64748b', primary:'#2563eb' };

function DayBar({ label, value, max, target }) {
  const w = Math.min(100, Math.round((value/Math.max(1,max))*100));
  const t = Math.min(100, Math.round((target/Math.max(1,max))*100));
  return (
    <View style={{ marginBottom:10 }}>
      <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
        <Text style={{ color:C.sub }}>{label}</Text>
        <Text style={{ color:C.sub }}>{Math.round(value)} kcal</Text>
      </View>
      <View style={{ height:12, backgroundColor:'#e5e7eb', borderRadius:999, overflow:'hidden' }}>
        <View style={{ position:'absolute', left:0, top:0, bottom:0, width:`${t}%`, backgroundColor:'#bfdbfe' }}/>
        <View style={{ position:'absolute', left:0, top:0, bottom:0, width:`${w}%`, backgroundColor:C.primary }}/>
      </View>
    </View>
  );
}

export default function NutritionStats(){
  const [profile, setProfile] = useState(null);
  const [days, setDays]       = useState([]); // [{date, calories_in, protein_g, carbs_g, fat_g}]

  useEffect(() => {
    (async () => {
      try { setProfile(await api('/api/profile')); } catch(_e) {}
      const ds = Array.from({length:7}, (_,i)=> {
        const d = new Date(Date.now() - (6-i)*86400000);
        return d.toISOString().slice(0,10);
      });
      try {
        const arr = await Promise.all(ds.map(d => api(`/api/summary/daily?date=${d}`).catch(()=>({date:d}))));
        setDays(arr);
      } catch(_e) { setDays(ds.map(d=>({date:d}))); }
    })();
  }, []);

  const kcalTarget = useMemo(() => {
    const g = (profile?.goal||'maintain').toLowerCase();
    if (profile?.kcal_target) return Math.round(profile.kcal_target);
    const kg = Number(profile?.weight_kg||60);
    const k = g==='lose'?28:g==='gain'?34:31;
    return Math.round(k*kg);
  }, [profile]);

  const maxKcal = Math.max(kcalTarget, ...days.map(d=>Number(d?.calories_in||0))) || 1;

  const todayStr = new Date().toISOString().slice(0,10);
  const today = days.find(d=>d?.date===todayStr) || {};
  const macro = {
    p: Number(today?.protein_g||0),
    c: Number(today?.carbs_g||0),
    f: Number(today?.fat_g||0),
  };
  const macroSum = Math.max(1, macro.p + macro.c + macro.f);

  return (
    <ScrollView style={{ flex:1, backgroundColor:C.bg }} contentContainerStyle={{ padding:16 }}>
      <Text style={{ fontSize:22, fontWeight:'800', color:C.text }}>Thống kê dinh dưỡng</Text>
      <Text style={{ color:C.sub, marginTop:4 }}>Màu xanh nhạt: mục tiêu • Xanh đậm: thực tế</Text>

      <View style={{ marginTop:12, backgroundColor:C.card, borderWidth:1, borderColor:C.b, borderRadius:14, padding:12 }}>
        <Text style={{ fontWeight:'700', color:C.text, marginBottom:8 }}>Kcal 7 ngày</Text>
        {days.map(d=>(
          <DayBar key={d.date} label={d.date.slice(5)} value={Number(d?.calories_in||0)} max={maxKcal} target={kcalTarget}/>
        ))}
      </View>

      <View style={{ marginTop:12, backgroundColor:C.card, borderWidth:1, borderColor:C.b, borderRadius:14, padding:12 }}>
        <Text style={{ fontWeight:'700', color:C.text, marginBottom:8 }}>Macro hôm nay</Text>
        {[
          {label:'Protein', val:macro.p},
          {label:'Carb',    val:macro.c},
          {label:'Fat',     val:macro.f},
        ].map(x=>{
          const pct = Math.round((x.val/macroSum)*100);
          return (
            <View key={x.label} style={{ marginBottom:8 }}>
              <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
                <Text>{x.label}</Text><Text style={{ color:C.sub }}>{x.val.toFixed(1)} g ({pct}%)</Text>
              </View>
              <View style={{ height:10, backgroundColor:'#e5e7eb', borderRadius:999 }}>
                <View style={{ width:`${pct}%`, height:'100%', backgroundColor:C.primary, borderRadius:999 }}/>
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}