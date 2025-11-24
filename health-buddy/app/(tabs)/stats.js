import { useEffect, useState } from 'react';
import { Dimensions, ScrollView, Text, View } from 'react-native';
import { BarChart, LineChart } from 'react-native-chart-kit';
import { api } from '../../src/lib/api';

const w = Dimensions.get('window').width - 32;

export default function Stats() {
  const [wdata, setWdata] = useState([]);
  const [act, setAct] = useState([]);

  useEffect(() => {
    (async () => {
      try { setWdata(await api('/api/progress/weight?days=30')); } catch {}
      try { setAct(await api('/api/progress/activity?days=14')); } catch {}
    })();
  }, []);

  const weightLabels = wdata.map(i => i.date.slice(5)); // mm-dd
  const weightValues = wdata.map(i => Number(i.weight_kg));

  const actLabels = act.map(i => i.date.slice(5));
  const actCals   = act.map(i => Number(i.calories_out || 0));
  const actSteps  = act.map(i => Number(i.steps || 0));

  return (
    <ScrollView contentContainerStyle={{ padding:16 }}>
      <Text style={{ fontSize:22, fontWeight:'800' }}>Biểu đồ tiến độ</Text>

      <View style={{ marginTop:12 }}>
        <Text style={{ fontWeight:'700', marginBottom:6 }}>Cân nặng (30 ngày)</Text>
        {weightValues.length ? (
          <LineChart
            data={{ labels: weightLabels, datasets:[{ data: weightValues }] }}
            width={w} height={220} yAxisSuffix="kg"
            chartConfig={{ backgroundGradientFrom:'#fff', backgroundGradientTo:'#fff', decimalPlaces:1,
              color:(o)=>`rgba(37,99,235,${o.opacity})`, labelColor:()=> '#6b7280' }}
            bezier
            style={{ borderRadius:12 }}
          />
        ) : <Text>Chưa có dữ liệu</Text>}
      </View>

      <View style={{ marginTop:18 }}>
        <Text style={{ fontWeight:'700', marginBottom:6 }}>Calo tiêu hao (14 ngày)</Text>
        {actCals.length ? (
          <BarChart
            data={{ labels: actLabels, datasets:[{ data: actCals }] }}
            width={w} height={220} yAxisSuffix="kcal"
            chartConfig={{ backgroundGradientFrom:'#fff', backgroundGradientTo:'#fff', decimalPlaces:0,
              color:(o)=>`rgba(16,185,129,${o.opacity})`, labelColor:()=> '#6b7280' }}
            style={{ borderRadius:12 }}
          />
        ) : <Text>Chưa có dữ liệu</Text>}
      </View>

      <View style={{ marginTop:18 }}>
        <Text style={{ fontWeight:'700', marginBottom:6 }}>Bước chân (14 ngày)</Text>
        {actSteps.length ? (
          <LineChart
            data={{ labels: actLabels, datasets:[{ data: actSteps }] }}
            width={w} height={220}
            chartConfig={{ backgroundGradientFrom:'#fff', backgroundGradientTo:'#fff', decimalPlaces:0,
              color:(o)=>`rgba(234,179,8,${o.opacity})`, labelColor:()=> '#6b7280' }}
            bezier
            style={{ borderRadius:12 }}
          />
        ) : <Text>Chưa có dữ liệu</Text>}
      </View>
    </ScrollView>
  );
}
