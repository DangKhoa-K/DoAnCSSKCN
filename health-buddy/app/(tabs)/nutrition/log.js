import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, FlatList, RefreshControl, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { api } from '../../../src/lib/api';
import { emit, EVENTS } from '../../../src/lib/events';

const C = { bg:'#F6F7FB', card:'#fff', b:'#e5e7eb', text:'#0f172a', sub:'#64748b', primary:'#2563eb' };
const MEAL_LABEL = { breakfast:'Bữa sáng', lunch:'Bữa trưa', dinner:'Bữa tối', snack:'Bữa phụ' };
const today = () => new Date().toISOString().slice(0,10);
const useDebounced = (v,ms=350)=>{ const [x,setX]=useState(v); useEffect(()=>{ const t=setTimeout(()=>setX(v),ms); return ()=>clearTimeout(t); },[v,ms]); return x; };

function MealRow({ it, onEdit, onDelete }) {
  return (
    <View style={{ paddingVertical:8, borderBottomWidth:1, borderBottomColor:'#f1f5f9' }}>
      <Text style={{ fontWeight:'700', color:C.text }}>
        {it.name} <Text style={{ color:C.sub, fontWeight:'400' }}>• {it.grams} g</Text>
      </Text>
      <Text style={{ color:C.sub, marginTop:4 }}>
        {`${it.kcal} kcal • P ${it.protein_g}g • C ${it.carbs_g}g • F ${it.fat_g}g • Xơ ${it.fiber_g}g`}
      </Text>
      <View style={{ flexDirection:'row', gap:10, marginTop:8 }}>
        <TouchableOpacity onPress={()=>onEdit(it)} style={{ borderWidth:1, borderColor:C.b, borderRadius:8, paddingVertical:6, paddingHorizontal:10 }}>
          <Text style={{ fontWeight:'600' }}>Sửa</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={()=>onDelete(it)} style={{ borderWidth:1, borderColor:'#fca5a5', backgroundColor:'#fee2e2', borderRadius:8, paddingVertical:6, paddingHorizontal:10 }}>
          <Text style={{ fontWeight:'700', color:'#b91c1c' }}>Xoá</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
function MealCard({ meal, onEdit, onDelete }) {
  const sum = k => (meal.items||[]).reduce((s,x)=>s+Number(x[k]||0),0);
  return (
    <View style={{ backgroundColor:C.card, borderWidth:1, borderColor:C.b, borderRadius:14, padding:14, marginBottom:12 }}>
      <Text style={{ fontWeight:'800', color:C.text, fontSize:16 }}>{MEAL_LABEL[meal.meal_type] || meal.meal_type}</Text>
      {(meal.items||[]).length === 0 ? (
        <Text style={{ color:C.sub, marginTop:8 }}>Chưa có món nào.</Text>
      ) : (
        <>
          <View style={{ marginTop:6 }}>
            {meal.items.map(it => <MealRow key={it.id} it={it} onEdit={onEdit} onDelete={onDelete} />)}
          </View>
          <View style={{ flexDirection:'row', justifyContent:'space-between', marginTop:10 }}>
            <Text style={{ color:C.sub }}>Tổng</Text>
            <Text style={{ color:C.text, fontWeight:'800' }}>
              {`${sum('kcal').toFixed(1)} kcal • P ${sum('protein_g').toFixed(1)}g • C ${sum('carbs_g').toFixed(1)}g • F ${sum('fat_g').toFixed(1)}g • Xơ ${sum('fiber_g').toFixed(1)}g`}
            </Text>
          </View>
        </>
      )}
    </View>
  );
}

export default function NutritionLog() {
  const [mealType, setMealType] = useState('lunch');
  const [kw, setKw] = useState('');
  const debKw = useDebounced(kw, 350);
  const [foods, setFoods] = useState([]);
  const [qtyById, setQtyById] = useState({}); // số "khẩu phần" (1 = portion_g)
  const [loading, setLoading] = useState(false);

  const [meals, setMeals] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadMeals = useCallback(async () => {
    const t = await api('/api/meals/today').catch(()=>null);
    setMeals(Array.isArray(t?.meals) ? t.meals : []);
  }, []);
  useFocusEffect(useCallback(()=>{ loadMeals(); }, [loadMeals]));

  const fetchFoods = useCallback(async (q) => {
    setLoading(true);
    try {
      const res = await api(`/api/foods?search=${encodeURIComponent(q||'')}`);
      setFoods(Array.isArray(res) ? res : []);
    } finally { setLoading(false); }
  }, []);
  useEffect(()=>{ fetchFoods(debKw); }, [debKw, fetchFoods]);

  const setQty = useCallback((id, v) => setQtyById(s=>({ ...s, [id]: v })), []);

  const addToMeal = useCallback(async (food) => {
    try {
      const quantity = Number(qtyById[food.id] || 0);
      if (!quantity) return Alert.alert('Nhập số phần hợp lệ (ví dụ 1.5)');
      const meal = await api('/api/meals', { method:'POST', body: JSON.stringify({ meal_type: mealType, date: today() }) });
      await api(`/api/meals/${meal.id}/items`, { method:'POST', body: JSON.stringify({ food_id: food.id, quantity }) });
      setQtyById(s=>({ ...s, [food.id]: '' }));
      await loadMeals();
      Alert.alert('Đã thêm');
    } catch (_e) { Alert.alert('Lỗi', 'Không thể thêm món'); }
  }, [qtyById, mealType, loadMeals]);
  emit(EVENTS.NUTRITION_UPDATED);

  const onEdit = useCallback(async (it) => {
    // sửa bằng đổi quantity theo grams/portion
    const portion = Number(it.portion_g || 100);
    const currentQty = it.grams && portion ? (Number(it.grams)/portion) : 1;
    const next = prompt ? prompt('Số phần mới (ví dụ 1.2):', String(currentQty)) : null;
    if (next == null) return;
    const quantity = Number(next || 0);
    if (!quantity) return Alert.alert('Giá trị không hợp lệ');
    await api(`/api/meal-items/${it.id}`, { method:'PATCH', body: JSON.stringify({ quantity }) });
    await loadMeals();
  }, [loadMeals]);

  const onDelete = useCallback(async (it) => {
    await api(`/api/meal-items/${it.id}`, { method:'DELETE' });
    await loadMeals();
  }, [loadMeals]);
  emit(EVENTS.NUTRITION_UPDATED);

  const header = (
    <View style={{ padding:16 }}>
      <Text style={{ fontSize:22, fontWeight:'800', color:C.text }}>Nhật ký bữa ăn</Text>
      <Text style={{ color:C.sub, marginTop:4 }}>Chọn bữa, tìm món và thêm theo <Text style={{ fontWeight:'700' }}>số phần</Text>.</Text>
      <View style={{ flexDirection:'row', gap:8, marginTop:10, flexWrap:'wrap' }}>
        {['breakfast','lunch','dinner','snack'].map(mt => (
          <TouchableOpacity key={mt} onPress={()=>setMealType(mt)} style={{
            paddingHorizontal:12, paddingVertical:8, borderRadius:999, borderWidth:1,
            borderColor: mt===mealType ? C.primary : C.b, backgroundColor: mt===mealType ? '#eaf1ff' : '#fff'
          }}>
            <Text style={{ fontWeight:'600', color: mt===mealType ? C.primary : C.text }}>
              {MEAL_LABEL[mt]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TextInput
        value={kw} onChangeText={setKw} placeholder="Tìm món: cơm, ức gà, cá hồi…"
        style={{ marginTop:10, backgroundColor:'#fff', borderWidth:1, borderColor:C.b, borderRadius:10, padding:10 }}
        placeholderTextColor="#9ca3af"
      />
    </View>
  );

  return (
    <FlatList
      style={{ flex:1, backgroundColor:C.bg }}
      ListHeaderComponent={header}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async()=>{ setRefreshing(true); await Promise.all([loadMeals(), fetchFoods(debKw)]); setRefreshing(false); }} />}
      data={foods}
      keyExtractor={i=>String(i.id)}
      renderItem={({ item }) => {
        const portion = Number(item.portion_g || 100);
        const qty = Number(qtyById[item.id] || 0);
        const factor = qty || 0;
        const grams = factor ? Math.round(factor * portion) : 0;
        const kcal = factor ? Math.round((item.kcal||0) * factor) : 0;
        const p = factor ? (item.protein_g||0)*factor : 0;
        const c = factor ? (item.carbs_g||0)*factor : 0;
        const f = factor ? (item.fat_g||0)*factor : 0;
        const x = factor ? (item.fiber_g||0)*factor : 0;

        return (
          <View style={{ marginHorizontal:16, marginBottom:12, backgroundColor:'#fff', borderWidth:1, borderColor:C.b, borderRadius:12, padding:12 }}>
            <Text style={{ fontWeight:'700', color:C.text }}>{item.name_vi}</Text>
            <Text style={{ color:C.sub, marginTop:4 }}>{portion} g / 1 phần • {item.kcal} kcal/phần</Text>

            <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginTop:8 }}>
              <Text>Số phần:</Text>
              <TextInput
                value={qtyById[item.id] ?? ''} onChangeText={(v)=>setQty(item.id, v)}
                keyboardType="numeric" placeholder="ví dụ 1.5"
                style={{ width:90, backgroundColor:'#fff', borderWidth:1, borderColor:C.b, borderRadius:8, padding:8 }}
              />
              <Button title={`+ ${MEAL_LABEL[mealType]}`} onPress={()=>addToMeal(item)} />
            </View>

            {!!factor && (
              <Text style={{ color:C.sub, marginTop:6 }}>
                ~ {grams} g • {kcal} kcal | P {p.toFixed(1)}g • C {c.toFixed(1)}g • F {f.toFixed(1)}g • Xơ {x.toFixed(1)}g
              </Text>
            )}
          </View>
        );
      }}
      ListFooterComponent={
        <View style={{ padding:16 }}>
          <Text style={{ fontWeight:'800', color:C.text, marginBottom:8 }}>Bữa hôm nay</Text>
          {meals.map(m => <MealCard key={m.id} meal={m} onEdit={onEdit} onDelete={onDelete} />)}
        </View>
      }
      ListEmptyComponent={<Text style={{ textAlign:'center', color:C.sub, marginTop:30 }}>{loading?'Đang tải…':'Không có món nào.'}</Text>}
    />
  );
}
