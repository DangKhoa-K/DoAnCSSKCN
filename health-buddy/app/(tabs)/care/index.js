import { LinearGradient } from 'expo-linear-gradient';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { api } from '../../../src/lib/api';

const C = {
  bg: '#F6F7FB',
  card: '#fff',
  b: '#e5e7eb',
  text: '#0f172a',
  sub: '#64748b',
  primary: '#2563eb'
};
const today = () => new Date().toISOString().slice(0, 10);

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function Donut({ value, max, size = 180, stroke = 14, color = '#2563eb' }) {
  const pct = clamp((value / Math.max(1, max)) * 100, 0, 100);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (c * pct) / 100;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={size/2} cy={size/2} r={r} stroke="#E6ECFF" strokeWidth={stroke} fill="none" />
        <Circle
          cx={size/2} cy={size/2} r={r}
          stroke={color} strokeWidth={stroke} fill="none"
          strokeDasharray={`${dash},${c}`} strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`}
        />
      </Svg>
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 28, fontWeight: '800', color: C.text }}>{Math.round(value)}</Text>
        <Text style={{ color: C.sub }}>of {Math.round(max)}</Text>
      </View>
    </View>
  );
}

function DayHeader({ date, onPrev, onNext }) {
  const d = new Date(date);
  const long = d.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Pressable onPress={onPrev} style={{ padding: 8 }}>
        <Text style={{ fontSize: 20, color: '#fff' }}>{'‹'}</Text>
      </Pressable>
      <View style={{ paddingVertical: 6, paddingHorizontal: 14, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 999 }}>
        <Text style={{ color: '#fff', fontWeight: '700' }}>{long}</Text>
      </View>
      <Pressable onPress={onNext} style={{ padding: 8 }}>
        <Text style={{ fontSize: 20, color: '#fff' }}>{'›'}</Text>
      </Pressable>
    </View>
  );
}

function Card({ title, children, right }) {
  return (
    <View style={{
      backgroundColor: C.card,
      borderRadius: 16,
      padding: 14,
      marginTop: 12,
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      borderWidth: 1, borderColor: '#eef2ff'
    }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={{ fontWeight: '800', color: C.text }}>{title}</Text>
        {right || null}
      </View>
      {children}
    </View>
  );
}

export default function CareOverview() {
  const [date, setDate] = useState(today());
  const [loading, setLoading] = useState(true);
  const [sleepMin, setSleepMin] = useState(0);
  const [waterMl, setWaterMl] = useState(0);
  const [meds, setMeds] = useState([]);
  const [mood, setMood] = useState(null);

  const prevDay = useCallback(() => {
    const d = new Date(date); d.setDate(d.getDate() - 1); setDate(d.toISOString().slice(0,10));
  }, [date]);
  const nextDay = useCallback(() => {
    const d = new Date(date); d.setDate(d.getDate() + 1); setDate(d.toISOString().slice(0,10));
  }, [date]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await api(`/api/sleep/logs?date=${date}`).catch(()=>[]);
      setSleepMin((s||[]).reduce((t,x)=>t+Number(x.duration_min||0),0));
    } catch {}

    try {
      const h = await api(`/api/hydration/logs?date=${date}`).catch(()=>[]);
      setWaterMl((h||[]).reduce((t,x)=>t+Number(x.amount_ml||0),0));
    } catch {}

    try {
      const m = await api(`/api/medications/today?date=${date}`).catch(()=>[]);
      setMeds(Array.isArray(m)?m:[]);
    } catch {}

    try {
      const n = await api(`/api/health/notes?date=${date}`).catch(()=>[]);
      const found = (n||[]).map(x=>String(x.note||'')).find(t=>/mood\s*:\s*\d/i.test(t));
      setMood(found ? Number((found.match(/mood\s*:\s*(\d)/i)||[])[1]) : null);
    } catch {}
    setLoading(false);
  }, [date]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const goalWater = 3000; // theo mẫu ảnh
  const goalSleepMin = 7*60;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ paddingBottom: 24 }}>
      <LinearGradient
        colors={['#60a5fa', '#2563eb']}
        start={{x:0,y:0}} end={{x:0,y:1}}
        style={{ margin: 16, borderRadius: 20, padding: 16 }}
      >
        <DayHeader date={date} onPrev={prevDay} onNext={nextDay} />
        <View style={{ alignItems: 'center', marginTop: 10 }}>
          <Donut value={waterMl} max={goalWater} />
          <Text style={{ color: '#fff', marginTop: 8 }}>Nước hôm nay</Text>
        </View>

        {/* Quick nav giống mẫu: Statistics / + / Settings */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
          <Link href='/(tabs)/care/progress' asChild>
            <Pressable style={{ alignItems: 'center', flex: 1, paddingVertical: 8 }}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>Statistics</Text>
            </Pressable>
          </Link>
          <Link href='/(tabs)/care/hydration' asChild>
            <Pressable style={{
              width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff',
              alignItems: 'center', justifyContent: 'center'
            }}>
              <Text style={{ color: C.primary, fontSize: 30, fontWeight: '800' }}>+</Text>
            </Pressable>
          </Link>
          <Link href='/(tabs)/care/reminders' asChild>
            <Pressable style={{ alignItems: 'center', flex: 1, paddingVertical: 8 }}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>Settings</Text>
            </Pressable>
          </Link>
        </View>
      </LinearGradient>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 12 }} />
      ) : (
        <>
          <Card title="Mục tiêu hôm nay">
            <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
              <View style={{ flex: 1, minWidth: 150 }}>
                <Text style={{ color: C.text, fontWeight: '700' }}>Nước uống</Text>
                <Text style={{ color: C.sub, marginTop: 6 }}>{waterMl} ml / {goalWater} ml</Text>
              </View>
              <View style={{ flex: 1, minWidth: 150 }}>
                <Text style={{ color: C.text, fontWeight: '700' }}>Giấc ngủ</Text>
                <Text style={{ color: C.sub, marginTop: 6 }}>{sleepMin} phút / {goalSleepMin} phút</Text>
              </View>
            </View>
          </Card>

          <Card title="Hôm nay">
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: C.text, fontWeight: '700' }}>Thuốc/Vitamin</Text>
              <Text style={{ color: C.sub }}>{meds.filter(m=>!m.taken).length} chưa uống</Text>
            </View>
            <View style={{ height: 10 }} />
            <Text style={{ color: C.text, fontWeight: '700' }}>Tâm trạng</Text>
            <Link href='/(tabs)/care/lifestyle' asChild>
              <Pressable style={{ marginTop: 6, flexDirection: 'row', gap: 6 }}>
                {[1,2,3,4,5].map(n=>(
                  <View key={n} style={{
                    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1,
                    borderColor: n===(mood||3)?'#2563eb':'#e5e7eb', backgroundColor: n===(mood||3)?'#eaf1ff':'#fff'
                  }}>
                    <Text style={{ color: n===(mood||3)?'#2563eb':'#0f172a' }}>{['😢','😟','😐','🙂','😄'][n-1]}</Text>
                  </View>
                ))}
              </Pressable>
            </Link>
            <View style={{ height: 10 }} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Link href='/(tabs)/care/sleep' asChild>
                <Pressable style={{ flex:1, borderWidth:1, borderColor:'#E6ECFF', backgroundColor:'#F8FAFF', padding:12, borderRadius:12 }}>
                  <Text style={{ textAlign:'center', color: C.primary, fontWeight:'700' }}>Ghi giấc ngủ</Text>
                </Pressable>
              </Link>
              <Link href='/(tabs)/care/hydration' asChild>
                <Pressable style={{ flex:1, borderWidth:1, borderColor:'#E6ECFF', backgroundColor:'#F8FAFF', padding:12, borderRadius:12 }}>
                  <Text style={{ textAlign:'center', color: C.primary, fontWeight:'700' }}>Uống nước</Text>
                </Pressable>
              </Link>
            </View>
          </Card>
        </>
      )}
    </ScrollView>
  );
}