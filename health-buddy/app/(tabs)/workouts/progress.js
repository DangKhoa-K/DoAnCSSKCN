import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { api } from '../../../src/lib/api';

const C = { bg:'#F6F7FB', card:'#fff', b:'#e5e7eb', text:'#0f172a', sub:'#64748b', primary:'#2563eb' };

function Bar({label, val, max}) {
  return (
    <View style={{ alignItems:'center', width:40 }}>
      <View style={{ height:120, justifyContent:'flex-end' }}>
        <View style={{ width:18, height: Math.max(4, 110*val/Math.max(1,max)), backgroundColor:C.primary, borderRadius:6 }} />
      </View>
      <Text style={{ color:C.sub, fontSize:10, marginTop:4 }}>{label}</Text>
    </View>
  );
}

export default function Progress(){
  const [w, setW] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api('/api/workouts/progress?range=week').catch(()=>null);
      setW(data);
    } catch (e) {
      console.warn('Load progress error:', e);
    }
  }, []);

  useEffect(()=>{ load(); },[load]);
  useFocusEffect(useCallback(()=>{ load(); }, [load]));

  const maxMin = useMemo(()=>Math.max(1, ...(w?.bars||[]).map(d=>d.minutes||0)), [w]);

  return (
    <ScrollView
      style={{ flex:1, backgroundColor:C.bg, padding:16 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={async()=>{
          setRefreshing(true);
          await load();
          setRefreshing(false);
        }}/>
      }
    >
      <Text style={{ fontSize:22, fontWeight:'800', color:C.text }}>Tiến độ tập luyện</Text>
      <Text style={{ color:C.sub, marginTop:4 }}>Tuần này: {w?.start} → {w?.end}</Text>

      <View style={{ marginTop:12, backgroundColor:C.card, borderWidth:1,borderColor:C.b, borderRadius:12, padding:12 }}>
        <Text style={{ fontWeight:'700', color:C.text }}>Tổng quan tuần</Text>
        <Text style={{ color:C.sub, marginTop:6 }}>
          {`Số buổi: ${w?.sessionsThisWeek||0} • Thời gian: ${w?.totalMinutes||0} phút • Calo: ${w?.totalCalories||0} kcal`}
        </Text>
        <View style={{ flexDirection:'row', gap:8, marginTop:12 }}>
          {(w?.bars||[]).map(d=>(
            <Bar key={d.date} label={d.date?.slice(8,10)} val={d.minutes||0} max={maxMin} />
          ))}
        </View>
        {(!w?.bars || w.bars.length===0) && <Text style={{ color:C.sub, marginTop:8 }}>Chưa có dữ liệu trong tuần.</Text>}
      </View>

      <View style={{ marginTop:12, backgroundColor:C.card, borderWidth:1,borderColor:C.b, borderRadius:12, padding:12 }}>
        <Text style={{ fontWeight:'700', color:C.text }}>Tiến độ theo nhóm cơ (phút)</Text>
        <View style={{ marginTop:10 }}>
          {Object.entries(w?.byMuscle||{}).map(([g,val])=>(
            <View key={g} style={{ marginBottom:8 }}>
              <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
                <Text style={{ color:C.text, fontWeight:'600', textTransform:'capitalize' }}>{g}</Text>
                <Text style={{ color:C.sub }}>{val}’</Text>
              </View>
              <View style={{ height:8, backgroundColor:'#e2e8f0', borderRadius:999, marginTop:6 }}>
                <View style={{ height:8, width: `${Math.min(100, val/ (w?.totalMinutes||1) * 100)}%`, backgroundColor:C.primary, borderRadius:999 }} />
              </View>
            </View>
          ))}
          {Object.keys(w?.byMuscle||{}).length === 0 && <Text style={{ color:C.sub }}>Chưa có phân bố nhóm cơ.</Text>}
        </View>
      </View>
    </ScrollView>
  );
}