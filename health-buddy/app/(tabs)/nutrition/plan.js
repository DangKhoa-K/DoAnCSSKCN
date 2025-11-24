import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { api } from '../../../src/lib/api';

const C = { bg:'#F6F7FB', card:'#fff', b:'#e5e7eb', text:'#0f172a', sub:'#64748b', primary:'#2563eb' };

export default function MealPlanSuggest(){
  const [profile, setProfile] = useState(null);
  const [plan, setPlan]       = useState(null); // {kcal_target, goal, target:{p,c,f}, meals:[{name,items:[...]}]}

  useEffect(() => {
    (async () => { try { setProfile(await api('/api/profile')); } catch(_e) {} })();
  }, []);

  const kcalTarget = useMemo(() => {
    const g = (profile?.goal||'maintain').toLowerCase();
    if (profile?.kcal_target) return Math.round(profile.kcal_target);
    const kg = Number(profile?.weight_kg||60);
    const k = g==='lose'?28:g==='gain'?34:31;
    return Math.round(k*kg);
  }, [profile]);

  async function makeSuggest(){
    // Ưu tiên server nếu đã có
    try {
      const r = await api('/api/recs/mealplan');
      if (r?.meals) { setPlan(r); return; }
    } catch(_e) {}

    // Fallback client
    const g = (profile?.goal||'maintain').toLowerCase();
    const ratio = g==='gain' ? {p:.25,c:.45,f:.30} : g==='lose' ? {p:.35,c:.35,f:.30} : {p:.30,c:.45,f:.25};
    const target = {
      p: Math.round((kcalTarget*ratio.p)/4),
      c: Math.round((kcalTarget*ratio.c)/4),
      f: Math.round((kcalTarget*ratio.f)/9),
    };
    setPlan({
      goal: g, kcal_target: kcalTarget, target,
      meals: [
        { name:'Bữa sáng', items:[{food:'Yến mạch + sữa chua', grams:200, kcal:320, p:18, c:50, f:6}]},
        { name:'Bữa trưa', items:[{food:'Cơm + ức gà + rau', grams:350, kcal:550, p:40, c:65, f:12}]},
        { name:'Bữa tối',  items:[{food:'Cá hồi + khoai lang', grams:300, kcal:520, p:35, c:40, f:20}]},
        { name:'Bữa phụ',  items:[{food:'Chuối + whey', grams:150, kcal:250, p:25, c:30, f:2}]},
      ]
    });
  }

  return (
    <ScrollView style={{ flex:1, backgroundColor:C.bg }} contentContainerStyle={{ padding:16 }}>
      <Text style={{ fontSize:22, fontWeight:'800', color:C.text }}>Gợi ý thực đơn</Text>
      <Text style={{ color:C.sub, marginTop:4 }}>Cá nhân hoá từ hồ sơ (mục tiêu & kcal).</Text>

      <Pressable onPress={makeSuggest}
        style={{ marginTop:12, backgroundColor:C.primary, padding:12, borderRadius:10, alignSelf:'flex-start' }}>
        <Text style={{ color:'#fff', fontWeight:'700' }}>Tạo gợi ý</Text>
      </Pressable>

      {plan && (
        <View style={{ marginTop:12, backgroundColor:C.card, borderWidth:1, borderColor:C.b, borderRadius:12, padding:12 }}>
          <Text style={{ fontWeight:'700', color:C.text }}>
            Mục tiêu: {plan.goal} • {plan.kcal_target} kcal/ngày
          </Text>
          {plan.target && (
            <Text style={{ color:C.sub, marginTop:4 }}>
              Macro mục tiêu: P {plan.target.p}g • C {plan.target.c}g • F {plan.target.f}g
            </Text>
          )}

          {plan.meals.map((m, i) => (
            <View key={i} style={{ marginTop:10, borderTopWidth:1, borderTopColor:'#F3F4F6', paddingTop:8 }}>
              <Text style={{ fontWeight:'700', color:C.text }}>{m.name}</Text>
              {m.items.map((it,ix)=>(
                <Text key={ix} style={{ color:C.sub, marginTop:4 }}>
                  - {it.food} • {it.grams}g • {it.kcal} kcal (P {it.p}g • C {it.c}g • F {it.f}g)
                </Text>
              ))}
            </View>
          ))}

          <Pressable
            onPress={() => Alert.alert('Đã lưu', 'Bạn có thể tuỳ chỉnh ở mục Nhật ký bữa ăn.')}
            style={{ marginTop:12, backgroundColor:'#16a34a', padding:12, borderRadius:10 }}>
            <Text style={{ color:'#fff', fontWeight:'800', textAlign:'center' }}>Lưu kế hoạch</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}
