import { Link, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { api } from '../../../src/lib/api';

const C = { bg:'#F6F7FB', card:'#fff', b:'#e5e7eb', text:'#0f172a', sub:'#64748b', primary:'#2563eb' };

function Stat({title, value, sub}) {
  return (
    <View style={{ flex:1, minWidth:150, backgroundColor:C.card, borderWidth:1,borderColor:C.b, borderRadius:12, padding:12, marginRight:12, marginBottom:12 }}>
      <Text style={{ color:C.sub, fontSize:12 }}>{title}</Text>
      <Text style={{ color:C.text, fontWeight:'800', fontSize:20, marginTop:4 }}>{value}</Text>
      {sub?<Text style={{ color:C.sub, marginTop:4 }}>{sub}</Text>:null}
    </View>
  );
}

function MiniBars({data}) {
  const max = Math.max(1, ...data.map(d=>d.minutes));
  return (
    <View style={{ flexDirection:'row', alignItems:'flex-end', height:90 }}>
      {data.map((d,i)=>(
        <View key={i} style={{ flex:1, alignItems:'center' }}>
          <View style={{ width:14, height: Math.max(4, 80*d.minutes/max), backgroundColor:C.primary, borderRadius:6 }} />
          <Text style={{ color:C.sub, fontSize:10, marginTop:4 }}>{new Date(d.date).getDate()}</Text>
        </View>
      ))}
    </View>
  );
}

export default function WorkoutsHome(){
  const r = useRouter();
  const [p, setP] = useState(null);

  async function load() {
    const prog = await api('/api/workouts/progress?range=week').catch(()=>null);
    setP(prog);
  }
  useEffect(()=>{ load(); },[]);

  return (
    <ScrollView style={{ flex:1, backgroundColor:C.bg, padding:16 }}>
      <Text style={{ fontSize:22, fontWeight:'800', color:C.text }}>Tập luyện</Text>
      <Text style={{ color:C.sub, marginTop:6 }}>Tổng quan hôm nay</Text>

      <View style={{ marginTop:12, flexDirection:'row', flexWrap:'wrap' }}>
        <Stat title="Calo đã tiêu hao" value={`${p?.totalCalories||0} kcal`} sub="Trong phạm vi đã chọn" />
        <Stat title="Thời gian tập" value={`${p?.totalMinutes||0} phút`} sub="Hôm nay + các buổi đã ghi" />
        <Stat title="Số buổi/tuần" value={`${p?.sessionsThisWeek||0}`} sub="Tính từ đầu tuần" />
      </View>

      <View style={{ backgroundColor:C.card, borderWidth:1, borderColor:C.b, borderRadius:12, padding:12, marginTop:8 }}>
        <Text style={{ fontWeight:'700', color:C.text, marginBottom:8 }}>Tiến độ 7 ngày</Text>
        <MiniBars data={p?.bars || []} />
      </View>

      <View style={{ backgroundColor:C.card, borderWidth:1, borderColor:C.b, borderRadius:12, padding:12, marginTop:12 }}>
        <Text style={{ fontWeight:'700', color:C.text }}>Bài tập kế tiếp</Text>
        <Text style={{ color:C.sub, marginTop:4 }}>Xem từ Kế hoạch của bạn</Text>
        <View style={{ flexDirection:'row', gap:8, marginTop:10 }}>
          <Pressable onPress={()=>r.push('/(tabs)/workouts/plan')}
            style={{ backgroundColor:C.primary, paddingVertical:10,paddingHorizontal:14, borderRadius:10 }}>
            <Text style={{ color:'#fff', fontWeight:'700' }}>Bắt đầu buổi tập mới</Text>
          </Pressable>
          <Pressable onPress={()=>r.push('/(tabs)/workouts/progress')}
            style={{ backgroundColor:'#eef2ff', paddingVertical:10,paddingHorizontal:12, borderRadius:10, borderWidth:1,borderColor:'#c7d2fe' }}>
            <Text style={{ color:'#1e40af', fontWeight:'700' }}>Xem thống kê</Text>
          </Pressable>
        </View>
      </View>

      <View style={{ marginTop:12 }}>
        <Text style={{ fontWeight:'800', color:C.text, marginBottom:8 }}>Hành động nhanh</Text>
        <View style={{ flexDirection:'row', gap:10, flexWrap:'wrap' }}>
          <Link href='/(tabs)/workouts/library' asChild>
            <Pressable style={{ backgroundColor:C.card, borderWidth:1, borderColor:C.b, padding:12, borderRadius:12 }}>
              <Text style={{ fontWeight:'700' }}>Thư viện bài tập</Text>
            </Pressable>
          </Link>
          <Link href='/(tabs)/workouts/plan' asChild>
            <Pressable style={{ backgroundColor:C.card, borderWidth:1, borderColor:C.b, padding:12, borderRadius:12 }}>
              <Text style={{ fontWeight:'700' }}>Kế hoạch</Text>
            </Pressable>
          </Link>
          <Link href='/(tabs)/workouts/progress' asChild>
            <Pressable style={{ backgroundColor:C.card, borderWidth:1, borderColor:C.b, padding:12, borderRadius:12 }}>
              <Text style={{ fontWeight:'700' }}>Biểu đồ</Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </ScrollView>
  );
}

