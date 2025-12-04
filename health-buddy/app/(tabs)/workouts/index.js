import { Link, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { WorkoutCalorieRing } from '../../../src/components/WorkoutCalorieRing';
import { api } from '../../../src/lib/api';

const C = { bg:'#F0F6FF', card:'#FFFFFF', b:'#DCE7FF', text:'#0F172A', sub:'#64748B', primary:'#2563EB' };

function Header() {
  return (
    <View style={{ marginBottom: 12 }}>
      <View style={{ height: 110, borderRadius: 16, backgroundColor: '#3B82F6' }}>
        <View style={{ flex:1, borderRadius:16, padding:16, justifyContent:'flex-end' }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: '#fff' }}>Tập luyện</Text>
          <Text style={{ color: '#E2E8F0', marginTop: 4 }}>Tổng quan tuần hiện tại</Text>
        </View>
      </View>
    </View>
  );
}

function Stat({ title, value, sub }) {
  return (
    <View style={{
      flex: 1, minWidth: 150,
      backgroundColor: C.card, borderWidth: 1, borderColor: C.b,
      borderRadius: 16, padding: 14, marginRight: 12, marginBottom: 12,
      shadowColor: '#93C5FD', shadowOpacity: 0.08, shadowRadius: 6, elevation: 1
    }}>
      <Text style={{ color: C.sub, fontSize: 12 }}>{title}</Text>
      <Text style={{ color: C.text, fontWeight: '800', fontSize: 20, marginTop: 4 }}>{value}</Text>
      {sub ? <Text style={{ color: C.sub, marginTop: 4 }}>{sub}</Text> : null}
    </View>
  );
}

function MiniBars({ data }) {
  const max = Math.max(1, ...data.map(d => Number(d.minutes || 0)));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 90 }}>
      {data.map((d, i) => (
        <View key={`${d.date}-${i}`} style={{ flex: 1, alignItems: 'center' }}>
          <View style={{ width: 14, height: Math.max(4, 80 * Number(d.minutes || 0) / max), backgroundColor: C.primary, borderRadius: 6 }} />
          <Text style={{ color: C.sub, fontSize: 10, marginTop: 4 }}>{String(d.date || '').slice(8, 10)}</Text>
        </View>
      ))}
    </View>
  );
}

export default function WorkoutsHome() {
  const r = useRouter();

  const [prog, setProg] = useState(null);
  const [dailyBurnTarget, setDailyBurnTarget] = useState(null);
  const [caloriesOutToday, setCaloriesOutToday] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // “Bài tập kế tiếp” từ kế hoạch 7 ngày đã lưu
  const [nextItem, setNextItem] = useState(null);

  const loadProgress = useCallback(async () => {
    try {
      const p = await api('/api/workouts/progress?range=week').catch(() => null);
      setProg(p);
    } catch (_e) {
      setProg(null);
    }
  }, []);

  const loadSummaryToday = useCallback(async () => {
    try {
      const date = new Date().toISOString().slice(0,10);
      const s = await api(`/api/summary/daily?date=${date}`).catch(()=>null);
      setCaloriesOutToday(Number(s?.calories_out || 0));
    } catch (_e) {
      setCaloriesOutToday(0);
    }
  }, []);

  const loadWorkoutRecTarget = useCallback(async () => {
    try {
      const rec = await api('/api/recs/workouts?variant=balanced').catch(()=>null);
      setDailyBurnTarget(rec?.daily_burn_target || null);
    } catch (_e) {
      setDailyBurnTarget(null);
    }
  }, []);

  // Lấy kế hoạch đã lưu gần nhất và chọn bài đầu tiên của ngày hiện tại
  const loadNextFromPlan = useCallback(async () => {
  try {
    const plans = await api('/api/workouts/plans').catch(()=>[]);
    if (!Array.isArray(plans) || plans.length === 0) { setNextItem(null); return; }
    const latest = plans[0];

    // GỌI chi tiết (đã ghép items vào days ở backend)
    const detail = await api(`/api/workouts/plans/${latest.id}`).catch(()=>null);
    const schedule = Array.isArray(detail?.days) ? detail.days : [];
    if (schedule.length === 0) { setNextItem(null); return; }

    // Tính ngày hiện tại trong chu kỳ 7 ngày (so sánh theo yyyy-mm-dd tránh lệch TZ)
    const startKey = (latest.start_date || new Date().toISOString().slice(0,10));
    const todayKey = new Date().toISOString().slice(0,10);
    const diffDays = Math.floor((new Date(todayKey) - new Date(startKey)) / (24*3600*1000));
    const targetDow = ((diffDays % 7) + 7) % 7 + 1; // 1..7

    const day = schedule.find(d => Number(d.dow) === targetDow) || schedule[((targetDow-1) % schedule.length)];
    const first = (day?.items || [])[0] || null;

    setNextItem(first ? { ...first, dayNote: day?.note, planId: latest.id } : null);
  } catch (_e) {
    setNextItem(null);
  }
}, []);
// ...
useEffect(() => {
  loadProgress();
  loadSummaryToday();
  loadWorkoutRecTarget();
  loadNextFromPlan(); // ĐẢM BẢO gọi hàm này
}, [loadProgress, loadSummaryToday, loadWorkoutRecTarget, loadNextFromPlan]);

useFocusEffect(useCallback(() => {
  loadProgress(); loadSummaryToday(); loadNextFromPlan();
}, [loadProgress, loadSummaryToday, loadNextFromPlan]));


  async function onRefresh() {
    try {
      setRefreshing(true);
      await Promise.all([loadProgress(), loadSummaryToday(), loadWorkoutRecTarget(), loadNextFromPlan()]);
    } finally {
      setRefreshing(false);
    }
  }

  function startNext() {
    if (!nextItem) return Alert.alert('Chưa có bài hôm nay', 'Hãy tạo/lưu kế hoạch 7 ngày trước.');
    // Điều hướng đến màn “chạy buổi” với dữ liệu bài đầu
    r.push({ pathname: '/(tabs)/workouts/run', params: {
      name: nextItem.name || `Ex#${nextItem.exercise_id}`,
      category: String(nextItem.category || ''),
      duration_min: nextItem.duration_min || nextItem.minutes || '',
      sets: nextItem.sets || '',
      reps: nextItem.reps || '',
      rest_sec: nextItem.rest_sec || 60,
    }});
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Header />

      {/* 1) Ring: Calo tiêu hao hôm nay */}
      <View style={{
        backgroundColor: C.card, borderWidth:1, borderColor:C.b,
        borderRadius:16, padding:16, marginTop:12, alignItems:'center',
        shadowColor: '#93C5FD', shadowOpacity: 0.08, shadowRadius: 6, elevation: 1
      }}>
        <Text style={{ fontWeight:'700', color:C.text, marginBottom:8 }}>Calo tiêu hao hôm nay</Text>
        <WorkoutCalorieRing value={caloriesOutToday} target={dailyBurnTarget || 300} />
      </View>

      {/* 2) Stats tuần gọn */}
      <View style={{ marginTop: 12, flexDirection: 'row', flexWrap: 'wrap' }}>
        <Stat title="Calo tiêu hao (tuần)" value={`${prog?.totalCalories || 0} kcal`} sub="Trong phạm vi đã chọn" />
        <Stat title="Thời gian tập (tuần)" value={`${prog?.totalMinutes || 0} phút`} sub="Tổng phút tuần" />
        <Stat title="Số buổi/tuần" value={`${prog?.sessionsThisWeek || 0}`} sub="Từ đầu tuần" />
      </View>

      {/* 3) Tiến độ 7 ngày */}
      <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.b, borderRadius: 16, padding: 12, marginTop: 8,
        shadowColor: '#93C5FD', shadowOpacity: 0.06, shadowRadius: 5, elevation: 1 }}>
        <Text style={{ fontWeight: '700', color: C.text, marginBottom: 8 }}>Tiến độ 7 ngày</Text>
        <MiniBars data={prog?.bars || []} />
        {(!prog?.bars || prog.bars.length === 0) && <Text style={{ color: C.sub, marginTop: 8 }}>Chưa có dữ liệu tuần này.</Text>}
      </View>

      {/* 4) Bài tập kế tiếp từ kế hoạch */}
      <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.b, borderRadius: 16, padding: 12, marginTop: 12,
        shadowColor: '#93C5FD', shadowOpacity: 0.06, shadowRadius: 5, elevation: 1 }}>
        <Text style={{ fontWeight: '700', color: C.text }}>Bài tập kế tiếp</Text>
        <Text style={{ color: C.sub, marginTop: 4 }}>
          {nextItem
            ? `${nextItem.name || 'Bài tập'} • ${String(nextItem.category || '').toLowerCase()==='cardio'
                ? `${nextItem.duration_min || nextItem.minutes || 20} phút`
                : `${nextItem.sets || 3}x${nextItem.reps || 12}`} `
            : 'Chưa có kế hoạch hôm nay. Hãy lưu kế hoạch 7 ngày trong mục Kế hoạch.'}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          <Pressable onPress={startNext}
            style={{ backgroundColor: C.primary, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Bắt đầu buổi tập mới</Text>
          </Pressable>
          <Pressable onPress={() => r.push('/(tabs)/workouts/plan')}
            style={{ backgroundColor: '#eef2ff', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#c7d2fe' }}>
            <Text style={{ color: '#1e40af', fontWeight: '700' }}>Xem kế hoạch</Text>
          </Pressable>
        </View>
      </View>

      {/* 5) Hành động nhanh */}
      <View style={{ marginTop: 12 }}>
        <Text style={{ fontWeight: '800', color: C.text, marginBottom: 8 }}>Hành động nhanh</Text>
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          <Link href='/(tabs)/workouts/library' asChild>
            <Pressable style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.b, padding: 12, borderRadius: 16,
              shadowColor: '#93C5FD', shadowOpacity: 0.06, shadowRadius: 5, elevation: 1 }}>
              <Text style={{ fontWeight: '700' }}>Thư viện bài tập</Text>
            </Pressable>
          </Link>
          <Link href='/(tabs)/workouts/reminders' asChild>
            <Pressable style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.b, padding: 12, borderRadius: 16,
              shadowColor: '#93C5FD', shadowOpacity: 0.06, shadowRadius: 5, elevation: 1 }}>
              <Text style={{ fontWeight: '700' }}>Nhắc nhở</Text>
            </Pressable>
          </Link>
          <Link href='/(tabs)/workouts/progress' asChild>
            <Pressable style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.b, padding: 12, borderRadius: 16,
              shadowColor: '#93C5FD', shadowOpacity: 0.06, shadowRadius: 5, elevation: 1 }}>
              <Text style={{ fontWeight: '700' }}>Biểu đồ</Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </ScrollView>
  );
}