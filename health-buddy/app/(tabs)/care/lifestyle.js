// app/(tabs)/care/lifestyle.js
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { api } from '../../../src/lib/api';

const C = { bg:'#F6F7FB', card:'#fff', b:'#e5e7eb', text:'#0f172a', sub:'#64748b', primary:'#2563eb' };

export default function Lifestyle() {
  const router = useRouter();
  const [date] = useState(new Date().toISOString().slice(0,10)); // ngày hiện tại
  const [mood, setMood] = useState(3);     // 1-5
  const [stress, setStress] = useState(2); // 1-5
  const [note, setNote] = useState('');

  // Breathing / Meditation 3 phút
  const [breathSec, setBreathSec] = useState(180);
  const [running, setRunning] = useState(false);
  const timerRef = useRef(null);

  // Tải dữ liệu trước đó nếu có (mood/stress/note)
  useEffect(() => {
    (async () => {
      try {
        const arr = await api(`/api/health/notes?date=${date}`).catch(()=>[]);
        // Ưu tiên dữ liệu có cấu trúc; fallback parse từ note nếu chỉ có chuỗi
        const n0 = (arr || []).find(x => x.mood_score != null || x.stress_score != null || x.note);
        if (n0) {
          if (typeof n0.mood_score === 'number') setMood(n0.mood_score);
          else {
            const mMatch = String(n0.note || '').match(/mood\s*:\s*(\d)/i);
            if (mMatch) setMood(Number(mMatch[1]));
          }
          if (typeof n0.stress_score === 'number') setStress(n0.stress_score);
          else {
            const sMatch = String(n0.note || '').match(/stress\s*:\s*(\d)/i);
            if (sMatch) setStress(Number(sMatch[1]));
          }
          if (n0.note) setNote(n0.note.replace(/mood\s*:\s*\d\s*,?\s*|stress\s*:\s*\d\s*,?\s*/ig, '').trim());
        }
      } catch (_e) {}
    })();
  }, [date]);

  function toggleBreath() {
    if (running) {
      if (timerRef.current) clearInterval(timerRef.current);
      setRunning(false);
      return;
    }
    setRunning(true);
    timerRef.current = setInterval(() => {
      setBreathSec(s => {
        if (s <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setRunning(false);
          Alert.alert('Hoàn thành', 'Hít thở 3’ xong!');
          return 180;
        }
        return s - 1;
      });
    }, 1000);
  }

  function resetBreath() {
    if (timerRef.current) clearInterval(timerRef.current);
    setRunning(false);
    setBreathSec(180);
  }

  async function saveNote() {
    try {
      // Lưu dữ liệu CÓ CẤU TRÚC
      await api('/api/health/notes', {
        method: 'POST',
        body: { date, mood_score: mood, stress_score: stress, note }
      });
      Alert.alert('Đã lưu', 'Đánh giá sinh hoạt đã được ghi.');
    } catch (err) {
      Alert.alert('Lỗi', err?.message || 'Không lưu được');
    }
  }

  return (
    <ScrollView style={{ flex:1, backgroundColor:C.bg, padding:16 }}>
      <Pressable onPress={()=>router.back()}><Text style={{ color:C.primary, marginBottom:8 }}>‹ Quay lại</Text></Pressable>
      <Text style={{ fontSize:22, fontWeight:'800', color:C.text }}>Sinh hoạt & Sức khỏe cá nhân</Text>
      <Text style={{ color:C.sub, marginTop:4 }}>Ngày {date}</Text>

      {/* Mood */}
      <View style={{ backgroundColor:C.card, borderWidth:1, borderColor:C.b, borderRadius:12, padding:12, marginTop:12 }}>
        <Text style={{ fontWeight:'700', color:C.text }}>Tâm trạng</Text>
        <View style={{ flexDirection:'row', gap:8, marginTop:10, flexWrap:'wrap' }}>
          {[1,2,3,4,5].map(n=>(
            <Pressable
              key={n}
              onPress={()=>setMood(n)}
              style={{
                paddingVertical:10, paddingHorizontal:12, borderRadius:8,
                borderWidth:1, borderColor:n===mood ? '#2563eb' : '#e5e7eb',
                backgroundColor:n===mood ? '#eaf1ff' : '#fff'
              }}
            >
              <Text style={{ color:n===mood?'#2563eb':'#0f172a', fontWeight:'700' }}>
                {['😢','😟','😐','🙂','😄'][n-1]}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Stress */}
      <View style={{ backgroundColor:C.card, borderWidth:1, borderColor:C.b, borderRadius:12, padding:12, marginTop:12 }}>
        <Text style={{ fontWeight:'700', color:C.text }}>Căng thẳng</Text>
        <View style={{ flexDirection:'row', gap:8, marginTop:10, flexWrap:'wrap' }}>
          {[1,2,3,4,5].map(n=>(
            <Pressable
              key={n}
              onPress={()=>setStress(n)}
              style={{
                paddingVertical:10, paddingHorizontal:12, borderRadius:8,
                borderWidth:1, borderColor:n===stress ? '#2563eb' : '#e5e7eb',
                backgroundColor:n===stress ? '#eaf1ff' : '#fff'
              }}
            >
              <Text style={{ color:n===stress?'#2563eb':'#0f172a', fontWeight:'700' }}>{n}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Note */}
      <View style={{ backgroundColor:C.card, borderWidth:1, borderColor:C.b, borderRadius:12, padding:12, marginTop:12 }}>
        <Text style={{ fontWeight:'700', color:C.text }}>Ghi chú (tuỳ chọn)</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Nhập ghi chú ngắn về sinh hoạt hôm nay..."
          placeholderTextColor="#9ca3af"
          multiline
          style={{ marginTop:10, borderWidth:1, borderColor:C.b, borderRadius:10, padding:10, backgroundColor:'#fff', minHeight:80 }}
        />
        <View style={{ marginTop:10 }}>
          <Button title="Lưu đánh giá" onPress={saveNote} />
        </View>
      </View>

      {/* Breathing / Meditation 3' */}
      <View style={{ backgroundColor:C.card, borderWidth:1, borderColor:C.b, borderRadius:12, padding:12, marginTop:12, alignItems:'center' }}>
        <Text style={{ fontWeight:'700', color:C.text }}>Hít thở 3’ (Meditation)</Text>
        <Text style={{ color:C.text, fontSize:36, fontWeight:'800', marginTop:8 }}>
          {String(Math.floor(breathSec/60)).padStart(2,'0')}:{String(breathSec%60).padStart(2,'0')}
        </Text>
        <View style={{ flexDirection:'row', gap:8, marginTop:10 }}>
          <Pressable onPress={toggleBreath} style={{ backgroundColor:C.primary, paddingVertical:10, paddingHorizontal:16, borderRadius:10 }}>
            <Text style={{ color:'#fff', fontWeight:'700' }}>{running ? 'Tạm dừng' : 'Bắt đầu'}</Text>
          </Pressable>
          {!running && (
            <Pressable onPress={resetBreath} style={{ backgroundColor:'#EEF2FF', borderWidth:1, borderColor:'#C7D2FE', paddingVertical:10, paddingHorizontal:16, borderRadius:10 }}>
              <Text style={{ color:'#1E40AF', fontWeight:'700' }}>Đặt lại</Text>
            </Pressable>
          )}
        </View>
        <Text style={{ color:C.sub, marginTop:8 }}>Gợi ý: hít vào 4s • nín 4s • thở ra 4s • nghỉ 4s (Box breathing)</Text>
      </View>

      {/* Tips */}
      <View style={{ backgroundColor:C.card, borderWidth:1, borderColor:C.b, borderRadius:12, padding:12, marginTop:12 }}>
        <Text style={{ fontWeight:'700', color:C.text }}>Gợi ý</Text>
        <Text style={{ color:C.sub, marginTop:4 }}>
          • Uống nước mỗi 2–3 giờ • Giãn cơ 5′ sau 60′ làm việc • Hít thở sâu 3′ trước khi ngủ
        </Text>
      </View>
    </ScrollView>
  );
}