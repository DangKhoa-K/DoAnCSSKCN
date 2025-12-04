import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

const C = { bg:'#F0F6FF', card:'#FFFFFF', b:'#DCE7FF', text:'#0F172A', sub:'#64748B', primary:'#2563EB' };

export default function RunScreen() {
  const params = useLocalSearchParams();
  const name = (params?.name && String(params.name)) || 'Bài tập';
  const category = String(params?.category || '').toLowerCase();
  const durationMin = Number(params?.duration_min || 0);
  const sets = Number(params?.sets || 0);
  const reps = Number(params?.reps || 0);
  const restSec = Number(params?.rest_sec || 60);

  function defaultSeconds() {
    if (category === 'cardio' && durationMin > 0) return durationMin * 60;
    if (sets > 0 && reps > 0) {
      const perSetSec = Math.max(30, Math.round((reps * 5) + restSec));
      return sets * perSetSec;
    }
    return 0;
  }

  const [overrideMin, setOverrideMin] = useState('');
  const [remaining, setRemaining] = useState(defaultSeconds());
  const [running, setRunning] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    const m = Number(overrideMin);
    if (!Number.isNaN(m) && m > 0) {
      setRemaining(Math.round(m * 60));
    } else {
      setRemaining(defaultSeconds());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overrideMin]);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setRemaining((t) => {
        if (t <= 1) {
          clearInterval(intervalRef.current);
          Alert.alert('Hoàn thành', 'Bạn đã hoàn thành bài tập!');
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  function toggle() {
    if (remaining <= 0) return Alert.alert('Thông báo', 'Không có thời gian ước tính.');
    setRunning((v) => !v);
  }

  function reset() {
    setRunning(false);
    setOverrideMin('');
    setRemaining(defaultSeconds());
  }

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');

  return (
    <View style={{ flex:1, backgroundColor:C.bg, padding:16 }}>
      <View style={{ backgroundColor:C.card, borderWidth:1, borderColor:C.b, borderRadius:16, padding:16 }}>
        <Text style={{ fontSize:20, fontWeight:'800', color:C.text }}>{name}</Text>
        <Text style={{ color:C.sub, marginTop:4 }}>
          {category==='cardio'
            ? `Cardio • ${durationMin || 20} phút`
            : `Strength • ${sets || 3} hiệp × ${reps || 12} lần • nghỉ ${restSec || 60}s`}
        </Text>

        <View style={{ flexDirection:'row', gap:8, marginTop:12 }}>
          <TextInput
            value={overrideMin}
            onChangeText={setOverrideMin}
            placeholder="Chỉnh phút (tuỳ ý)"
            keyboardType="numeric"
            style={{ flex:1, backgroundColor:'#fff', borderWidth:1, borderColor:C.b, borderRadius:8, padding:8 }}
            placeholderTextColor="#9ca3af"
          />
        </View>

        <View style={{ marginTop:16, alignItems:'center' }}>
          <Text style={{ fontSize:48, fontWeight:'800', color:C.text }}>{mm}:{ss}</Text>
          <View style={{ flexDirection:'row', gap:8, marginTop:12 }}>
            <Pressable onPress={toggle} style={{ backgroundColor:C.primary, paddingVertical:10, paddingHorizontal:16, borderRadius:10 }}>
              <Text style={{ color:'#fff', fontWeight:'700' }}>{running ? 'Tạm dừng' : 'Bắt đầu'}</Text>
            </Pressable>
            <Pressable onPress={reset} style={{ backgroundColor:'#EEF2FF', borderWidth:1, borderColor:'#C7D2FE', paddingVertical:10, paddingHorizontal:16, borderRadius:10 }}>
              <Text style={{ color:'#1E40AF', fontWeight:'700' }}>Đặt lại</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}