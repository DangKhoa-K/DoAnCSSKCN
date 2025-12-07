import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { api } from '../../../src/lib/api';

const C = { bg:'#F6F7FB', card:'#fff', b:'#eef2ff', text:'#0f172a', sub:'#64748b', primary:'#2563eb' };

function Card({ title, children }) {
  return (
    <View style={{
      backgroundColor:C.card, borderRadius:16, padding:12, marginTop:12,
      borderWidth:1, borderColor:C.b, shadowColor:'#000', shadowOpacity:0.06, shadowRadius:10, shadowOffset:{width:0,height:4}
    }}>
      <Text style={{ fontWeight:'800', color:C.text, marginBottom:8 }}>{title}</Text>
      {children}
    </View>
  );
}

function buildMoodTips(mood){
  if (mood >= 4) return {
    title: 'Tuyệt vời!',
    lines: [
      'Chúc mừng bạn đang có tâm trạng tốt 😊.',
      'Hãy duy trì: ngủ đủ, ăn uống cân bằng, vận động nhẹ 20–30’.',
      'Gợi ý: ghi lại 1 điều bạn biết ơn hôm nay.'
    ]
  };
  if (mood === 3) return {
    title: 'Ổn định',
    lines: [
      'Bạn ở mức trung bình – thử nâng mood một chút.',
      'Gợi ý: đi bộ 10’, nghe nhạc nhẹ, nhắn tin cho bạn thân.',
      'Thử hít thở box breathing 3’.'
    ]
  };
  return {
    title: 'Mọi chuyện sẽ ổn thôi',
    lines: [
      'Tâm trạng thấp – mình ở đây cùng bạn 💙.',
      'Hãy nghỉ ngơi ngắn, hít thở sâu, viết ra điều làm bạn bận tâm.',
      'Nếu tình trạng kéo dài nhiều ngày, cân nhắc trò chuyện với người tin tưởng hoặc chuyên gia.'
    ]
  };
}

export default function Lifestyle() {
  const router = useRouter();
  const [date] = useState(new Date().toISOString().slice(0,10));
  const [mood, setMood] = useState(3);
  const [stress, setStress] = useState(2);
  const [note, setNote] = useState('');

  const [breathSec, setBreathSec] = useState(180);
  const [running, setRunning] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const arr = await api(`/api/health/notes?date=${date}`).catch(()=>[]);
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

  const moodTips = useMemo(() => buildMoodTips(mood), [mood]);

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
      await api('/api/health/notes', { method: 'POST', body: { date, mood_score: mood, stress_score: stress, note } });
      Alert.alert('Đã lưu', 'Đánh giá sinh hoạt đã được ghi.');
    } catch (err) {
      Alert.alert('Lỗi', err?.message || 'Không lưu được');
    }
  }

  return (
    <ScrollView style={{ flex:1, backgroundColor:'#f0f6ff' }} contentContainerStyle={{ padding:16 }}>
      <Pressable onPress={()=>router.back()}><Text style={{ color:C.primary, marginBottom:8 }}>‹ Quay lại</Text></Pressable>
      <View style={{
        backgroundColor:'#fff', borderRadius:18, padding:16,
        borderWidth:1, borderColor:C.b, shadowColor:'#000', shadowOpacity:0.06, shadowRadius:10, shadowOffset:{width:0,height:4}
      }}>
        <Text style={{ fontSize:22, fontWeight:'800', color:C.text }}>Sinh hoạt & Sức khỏe cá nhân</Text>
        <Text style={{ color:C.sub, marginTop:4 }}>Ngày {date}</Text>

        <Card title="Tâm trạng">
          <View style={{ flexDirection:'row', gap:8, flexWrap:'wrap' }}>
            {[1,2,3,4,5].map(n=>(
              <Pressable key={n} onPress={()=>setMood(n)} style={{
                paddingVertical:10, paddingHorizontal:12, borderRadius:8,
                borderWidth:1, borderColor:n===mood ? '#2563eb' : '#e5e7eb', backgroundColor:n===mood ? '#eaf1ff' : '#fff'
              }}>
                <Text style={{ color:n===mood?'#2563eb':'#0f172a', fontWeight:'700' }}>
                  {['😢','😟','😐','🙂','😄'][n-1]}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={{ marginTop:10, backgroundColor:'#F8FAFF', borderWidth:1, borderColor:'#E6ECFF', borderRadius:12, padding:10 }}>
            <Text style={{ fontWeight:'800', color:C.text }}>{moodTips.title}</Text>
            {moodTips.lines.map((t,i)=> <Text key={i} style={{ color:C.sub, marginTop:4 }}>• {t}</Text>)}
          </View>
        </Card>

        <Card title="Căng thẳng">
          <View style={{ flexDirection:'row', gap:8, flexWrap:'wrap' }}>
            {[1,2,3,4,5].map(n=>(
              <Pressable key={n} onPress={()=>setStress(n)} style={{
                paddingVertical:10, paddingHorizontal:12, borderRadius:8,
                borderWidth:1, borderColor:n===stress ? '#2563eb' : '#e5e7eb', backgroundColor:n===stress ? '#eaf1ff' : '#fff'
              }}>
                <Text style={{ color:n===stress?'#2563eb':'#0f172a', fontWeight:'700' }}>{n}</Text>
              </Pressable>
            ))}
          </View>
        </Card>

        <Card title="Ghi chú (tuỳ chọn)">
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Nhập ghi chú ngắn về sinh hoạt hôm nay..."
            placeholderTextColor="#9ca3af"
            multiline
            style={{ marginTop:6, borderWidth:1, borderColor:'#e5e7eb', borderRadius:10, padding:10, backgroundColor:'#fff', minHeight:80 }}
          />
          <View style={{ marginTop:10, flexDirection:'row', justifyContent:'flex-end' }}>
            <Pressable onPress={saveNote} style={{ backgroundColor:C.primary, paddingVertical:10, paddingHorizontal:16, borderRadius:10 }}>
              <Text style={{ color:'#fff', fontWeight:'800' }}>Lưu đánh giá</Text>
            </Pressable>
          </View>
        </Card>

        <Card title="Hít thở 3’ (Meditation)">
          <View style={{ alignItems:'center' }}>
            <Text style={{ color:C.text, fontSize:36, fontWeight:'800', marginTop:4 }}>
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
        </Card>
      </View>
    </ScrollView>
  );
}