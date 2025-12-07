import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { api } from '../../../src/lib/api';
import { EVENTS, on } from '../../../src/lib/events';

const C = { bg:'#F6F7FB', card:'#fff', b:'#e5e7eb', text:'#0f172a', sub:'#64748b', primary:'#2563eb' };
const MEAL_LABEL = { breakfast:'Bữa sáng', lunch:'Bữa trưa', dinner:'Bữa tối', snack:'Bữa phụ' };
const today = () => new Date().toISOString().slice(0,10);
const useDebounced = (v,ms=350)=>{ const [x,setX]=useState(v); useEffect(()=>{ const t=setTimeout(()=>setX(v),ms); return ()=>clearTimeout(t); },[v,ms]); return x; };

// bỏ dấu/chuẩn hóa để so tên
const norm = (s) => (s||'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().trim();

function PrimaryButton({ title, onPress }) {
  return (
    <Pressable onPress={onPress} style={{ backgroundColor:C.primary, paddingVertical:10, paddingHorizontal:14, borderRadius:10 }}>
      <Text style={{ color:'#fff', fontWeight:'800' }}>{title}</Text>
    </Pressable>
  );
}

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
  const [qtyById, setQtyById] = useState({});
  const [loading, setLoading] = useState(false);

  const [meals, setMeals] = useState([]);

  // BOOST từ kế hoạch
  const [boostedIds, setBoostedIds] = useState(new Set());
  const [boostedFoods, setBoostedFoods] = useState([]); // mảng foods được boost để hiển thị quick-add

  const loadMeals = useCallback(async () => {
    const t = await api('/api/meals/today').catch(()=>null);
    setMeals(Array.isArray(t?.meals) ? t.meals : []);
  }, []);

  // Lấy kế hoạch mới nhất và map ra foods để boost
  const loadBoostFromPlan = useCallback(async () => {
    try {
      const plans = await api('/api/nutrition/mealplans?limit=1'); // lấy plan mới nhất
      if (!Array.isArray(plans) || !plans.length) {
        setBoostedIds(new Set());
        setBoostedFoods([]);
        return;
      }
      const lastId = plans[0].id;
      const detail = await api(`/api/nutrition/mealplans/${lastId}`);
      const planNames = new Set();
      (detail?.meals || []).forEach(m => (m.items || []).forEach(it => planNames.add(norm(it.food))));

      const all = await api('/api/foods?limit=500').catch(()=>[]);
      const ids = new Set();
      const picked = [];
      (Array.isArray(all) ? all : []).forEach(f => {
        if (planNames.has(norm(f.name_vi))) {
          ids.add(f.id);
          picked.push(f);
        }
      });
      setBoostedIds(ids);
      picked.sort((a,b)=> a.name_vi.localeCompare(b.name_vi,'vi'));
      setBoostedFoods(picked.slice(0, 12));
    } catch (e) {
      console.error('loadBoostFromPlan error:', e);
      setBoostedIds(new Set());
      setBoostedFoods([]);
    }
  }, []);

  // Tải foods theo từ khóa
  const fetchFoods = useCallback(async (q) => {
    setLoading(true);
    try {
      const res = await api(`/api/foods?search=${encodeURIComponent(q||'')}`);
      setFoods(Array.isArray(res) ? res : []);
    } finally { setLoading(false); }
  }, []);

  // Khởi tạo / cập nhật khi focus hoặc khi có sự kiện cập nhật
  useFocusEffect(useCallback(() => { loadMeals(); loadBoostFromPlan(); fetchFoods(debKw); }, [loadMeals, loadBoostFromPlan, fetchFoods, debKw]));
  useEffect(() => on(EVENTS.NUTRITION_UPDATED, async () => {
    await loadBoostFromPlan();
    await fetchFoods(debKw);
  }), [loadBoostFromPlan, fetchFoods, debKw]);

  const setQty = useCallback((id, v) => setQtyById(s=>({ ...s, [id]: v })), []);

  const addToMeal = useCallback(async (food, quantityOverride) => {
    try {
      const quantity = Number(quantityOverride ?? qtyById[food.id] ?? 0);
      if (!quantity) return Alert.alert('Nhập số phần hợp lệ (ví dụ 1.5)');
      const meal = await api('/api/meals', { method:'POST', body: { meal_type: mealType, date: today() } });
      await api(`/api/meals/${meal.id}/items`, { method:'POST', body: { food_id: food.id, quantity } });
      setQtyById(s=>({ ...s, [food.id]: '' }));
      await loadMeals();
      Alert.alert('Đã thêm');
    } catch (_e) { Alert.alert('Lỗi', 'Không thể thêm món'); }
  }, [qtyById, mealType, loadMeals]);

  // Danh sách foods đã reorder: boosted lên trước
  const viewFoods = useMemo(() => {
    const ids = boostedIds;
    const arr = [...foods];
    arr.sort((a,b) => {
      const ba = ids.has(a.id) ? 1 : 0;
      const bb = ids.has(b.id) ? 1 : 0;
      if (ba !== bb) return bb - ba; // true trước
      return a.name_vi.localeCompare(b.name_vi, 'vi');
    });
    return arr;
  }, [foods, boostedIds]);

  // Quick add 1 phần cho món boosted
  const quickAdd = useCallback(async (food) => {
    await addToMeal(food, 1);
  }, [addToMeal]);

  const header = (
    <View style={{ padding:16 }}>
      <Text style={{ fontSize:22, fontWeight:'800', color:C.text }}>Nhật ký bữa ăn</Text>
      <Text style={{ color:C.sub, marginTop:4 }}>Chọn bữa, tìm món và thêm theo <Text style={{ fontWeight:'700' }}>số phần</Text>.</Text>

      {/* Boosted từ kế hoạch vừa lưu */}
      {boostedFoods.length > 0 && (
        <View style={{ marginTop:10, backgroundColor:'#fff', borderWidth:1, borderColor:C.b, borderRadius:12, padding:10 }}>
          <Text style={{ fontWeight:'700', color:C.text, marginBottom:6 }}>Gợi ý từ kế hoạch</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {boostedFoods.map(f => (
              <TouchableOpacity key={f.id} onPress={()=>quickAdd(f)}
                style={{ marginRight:8, borderWidth:1, borderColor:C.b, borderRadius:10, paddingVertical:8, paddingHorizontal:10, backgroundColor:'#f8fafc' }}>
                <Text style={{ fontWeight:'600', color:C.text }}>{f.name_vi}</Text>
                <Text style={{ color:C.sub, fontSize:12 }}>{f.portion_g}g • {f.kcal} kcal</Text>
                <Text style={{ color:C.sub, fontSize:12 }}>P {f.protein_g} • C {f.carbs_g} • F {f.fat_g}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={{ color:C.sub, marginTop:6, fontSize:12 }}>Chạm để thêm nhanh 1 phần vào {MEAL_LABEL[mealType]}.</Text>
        </View>
      )}

      <View style={{ flexDirection:'row', gap:8, marginTop:10, flexWrap:'wrap' }}>
        {['breakfast','lunch','dinner','snack'].map(mt => (
          <TouchableOpacity key={mt} onPress={()=>setMealType(mt)} style={{
            paddingHorizontal:12, paddingVertical:8, borderRadius:999, borderWidth:1,
            borderColor: mt===mealType ? C.primary : C.b, backgroundColor: mt===mealType ? '#eaf1ff' : '#fff'
          }}>
            <Text style={{ fontWeight:'700', color: mt===mealType ? C.primary : C.text }}>
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

  const [refreshingState, setRefreshingState] = useState(false);

  return (
    <FlatList
      style={{ flex:1, backgroundColor:C.bg }}
      ListHeaderComponent={header}
      refreshControl={
        <RefreshControl refreshing={refreshingState} onRefresh={async()=>{
          setRefreshingState(true);
          await Promise.all([loadMeals(), loadBoostFromPlan(), fetchFoods(debKw)]);
          setRefreshingState(false);
        }} />
      }
      data={viewFoods}
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
        const boosted = boostedIds.has(item.id);

        return (
          <View style={{ marginHorizontal:16, marginBottom:12, backgroundColor:'#fff', borderWidth:2, borderColor: boosted ? '#bfdbfe' : C.b, borderRadius:12, padding:12 }}>
            <Text style={{ fontWeight:'700', color:C.text }}>
              {boosted ? '⭐ ' : ''}{item.name_vi}
            </Text>
            <Text style={{ color:C.sub, marginTop:4 }}>{portion} g / 1 phần • {item.kcal} kcal/phần</Text>

            <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginTop:10 }}>
              <Text>Số phần:</Text>
              <TextInput
                value={qtyById[item.id] ?? ''} onChangeText={(v)=>setQty(item.id, v)}
                keyboardType="numeric" placeholder="ví dụ 1.5"
                style={{ width:100, backgroundColor:'#fff', borderWidth:1, borderColor:C.b, borderRadius:10, padding:10 }}
                placeholderTextColor="#9ca3af"
              />
              <PrimaryButton title={`+ ${MEAL_LABEL[mealType]}`} onPress={()=>addToMeal(item)} />
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
          {meals.map(m => <MealCard key={m.id} meal={m} onEdit={()=>{}} onDelete={async(it)=>{ await api(`/api/meal-items/${it.id}`, { method:'DELETE' }); await loadMeals(); }} />)}
        </View>
      }
      ListEmptyComponent={<Text style={{ textAlign:'center', color:C.sub, marginTop:30 }}>{loading?'Đang tải…':'Không có món nào.'}</Text>}
    />
  );
}