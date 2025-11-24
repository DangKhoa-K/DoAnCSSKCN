// app/(tabs)/insights.js
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Section from '../../src/components/Section';
import { api } from '../../src/lib/api';
import { colors, radius, spacing } from '../../src/theme';

export default function Insights() {
  const [sessions, setSessions] = useState([]);

  useEffect(()=>{
    api('/api/workouts/sessions').then(setSessions).catch(()=>{});
  }, []);

  const totalWorkouts = sessions.length;
  const totalMinutes = sessions.reduce((a,b)=>a+Number(b.duration_min||0),0);
  const totalKcal = Math.round(sessions.reduce((a,b)=>a+Number(b.calories||0),0));

  return (
    <ScrollView style={{ flex:1, padding: spacing.lg, backgroundColor:'#F9FAFB' }}>
      <Text style={{ fontSize:22, fontWeight:'700', marginBottom: spacing.md }}>Thống kê</Text>

      <Section title="Tập luyện">
        <View style={{ backgroundColor:'#fff', borderWidth:1, borderColor:'#E5E7EB', borderRadius: radius.md, padding: spacing.md }}>
          <Text style={{ fontSize:16, fontWeight:'700', marginBottom:6 }}>Tổng quan</Text>
          <Text style={{ color: colors.muted }}>Số phiên: {totalWorkouts}</Text>
          <Text style={{ color: colors.muted }}>Phút luyện tập: {totalMinutes}</Text>
          <Text style={{ color: colors.muted }}>Kcal ước tính: {totalKcal}</Text>
        </View>
      </Section>
    </ScrollView>
  );
}
