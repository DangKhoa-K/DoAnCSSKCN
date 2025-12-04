import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { api } from '../../../src/lib/api';

const C = { bg:'#F0F6FF', card:'#fff', b:'#DCE7FF', text:'#0F172A', sub:'#64748B', primary:'#2563EB', success:'#16A34A', warn:'#F59E0B' };

export default function SessionLog({ sessionId, initialExercises = [] }) {
  const [exercises, setExercises] = useState(initialExercises);
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadSets = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api(`/api/workouts/sets?session_id=${sessionId}`);
      setSets(Array.isArray(data) ? data : []);
    } catch (_e) {
      setSets([]);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => { loadSets(); }, [loadSets]);

  async function addSet(ex) {
    try {
      const payload = {
        session_id: sessionId,
        exercise_id: ex.id,
        set_no: (sets.filter(s => s.exercise_id === ex.id).length + 1),
        reps: ex._reps || 10,
        weight_kg: ex._weight || 20,
        rpe: ex._rpe || 7
      };
      await api('/api/workouts/sets', { method: 'POST', body: JSON.stringify(payload) });
      await loadSets();
      Alert.alert('Đã lưu hiệp');
    } catch (e) {
      Alert.alert('Lỗi', e?.message || 'Không lưu được');
    }
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: C.bg }}
      data={exercises}
      keyExtractor={(i) => String(i.id)}
      renderItem={({ item }) => {
        const prevSets = sets.filter(s => s.exercise_id === item.id);
        return (
          <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.b, borderRadius: 12, padding: 12, margin: 12 }}>
            <Text style={{ fontWeight: '700', color: C.text }}>{item.name}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <TextInput
                placeholder="Reps"
                keyboardType="numeric"
                value={String(item._reps || '')}
                onChangeText={(v) => setExercises(xs => xs.map(x => x.id === item.id ? { ...x, _reps: v } : x))}
                style={{ borderWidth: 1, borderColor: C.b, borderRadius: 8, padding: 8, width: 80, backgroundColor: '#fff' }}
              />
              <TextInput
                placeholder="Weight (kg)"
                keyboardType="numeric"
                value={String(item._weight || '')}
                onChangeText={(v) => setExercises(xs => xs.map(x => x.id === item.id ? { ...x, _weight: v } : x))}
                style={{ borderWidth: 1, borderColor: C.b, borderRadius: 8, padding: 8, width: 120, backgroundColor: '#fff' }}
              />
              <TextInput
                placeholder="RPE"
                keyboardType="numeric"
                value={String(item._rpe || '')}
                onChangeText={(v) => setExercises(xs => xs.map(x => x.id === item.id ? { ...x, _rpe: v } : x))}
                style={{ borderWidth: 1, borderColor: C.b, borderRadius: 8, padding: 8, width: 80, backgroundColor: '#fff' }}
              />
              <Pressable onPress={() => addSet(item)} style={{ backgroundColor: C.primary, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8 }}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>+ Hiệp</Text>
              </Pressable>
            </View>
            <View style={{ marginTop: 10 }}>
              {prevSets.length === 0
                ? <Text style={{ color: C.sub }}>Chưa có hiệp</Text>
                : prevSets.map(s => (
                    <Text key={s.id} style={{ color: C.sub }}>
                      {`Set ${s.set_no}: ${s.reps} reps × ${s.weight_kg} kg • RPE ${s.rpe || '-'}`}
                    </Text>
                  ))
              }
            </View>
          </View>
        );
      }}
      ListEmptyComponent={<Text style={{ textAlign: 'center', color: C.sub, marginTop: 24 }}>{loading ? 'Đang tải…' : 'Chưa có bài trong buổi.'}</Text>}
    />
  );
}