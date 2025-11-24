// app/(tabs)/nutrition/index.js
import { LinearGradient } from 'expo-linear-gradient';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { api } from '../../../src/lib/api';
import { EVENTS, on } from '../../../src/lib/events';

const C = { bg:'#F6F7FB', card:'#fff', b:'#e5e7eb', text:'#0f172a', sub:'#64748b', primary:'#23c483' };

// ---------- helpers ----------
function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }
function todayISO(){ return new Date().toISOString().slice(0,10); }

// target macro theo mục tiêu + cân nặng
function buildTargets(profile, kcalTarget){
  const goal = (profile?.goal || 'maintain').toLowerCase();
  const kg   = Number(profile?.weight_kg || 60);

  const protPerKg = goal==='lose' ? 2.0 : goal==='gain' ? 1.8 : 1.6; // g/kg
  const p_g = Math.round(protPerKg * kg);

  const fatPct = 0.25;                         // 25% kcal từ fat
  const fat_kcal = Math.round(kcalTarget * fatPct);
  const f_g = Math.round(fat_kcal / 9);

  const remKcal = Math.max(0, kcalTarget - (p_g*4) - fat_kcal);
  const c_g = Math.round(remKcal / 4);

  const fib_g = 30; // mặc định khuyến nghị 25–35 g
  return { p_g, c_g, f_g, fib_g };
}

function Ring({ value, max, size=176, stroke=14, color='#ffffff' }) {
  const pct = clamp((value / Math.max(1,max)) * 100, 0, 100);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (c * pct) / 100;
  return (
    <Svg width={size} height={size}>
      <Circle cx={size/2} cy={size/2} r={r} stroke="rgba(255,255,255,0.28)" strokeWidth={stroke} fill="none" />
      <Circle
        cx={size/2} cy={size/2} r={r}
        stroke={color} strokeWidth={stroke} fill="none"
        strokeDasharray={`${dash},${c}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
      />
    </Svg>
  );
}

// ---------- main ----------
export default function NutritionHome(){
  const [profile, setProfile] = useState(null);
  const [daily,   setDaily]   = useState(null);   // calories_in + macros
  const [summary, setSummary] = useState(null);   // calories_out, nước, ngủ...
  const [meals,   setMeals]   = useState([]);

  const kcalTarget = useMemo(() => {
    if (profile?.kcal_target) return Math.round(profile.kcal_target);
    const goal = (profile?.goal || 'maintain').toLowerCase();
    const kg   = Number(profile?.weight_kg || 60);
    const k    = goal==='lose' ? 28 : goal==='gain' ? 34 : 31; // kcal/kg fallback
    return Math.round(k * kg);
  }, [profile]);

  const macroTarget = useMemo(() => buildTargets(profile, kcalTarget), [profile, kcalTarget]);

  const load = useCallback(async () => {
    try { setProfile(await api('/api/profile')); } catch {}
    try { setDaily(await api(`/api/nutrition/daily?date=${todayISO()}`)); } catch {}
    try { setSummary(await api(`/api/summary/daily?date=${todayISO()}`)); } catch {}
    try {
      const r = await api('/api/meals/today');
      setMeals(Array.isArray(r?.meals) ? r.meals : []);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => on(EVENTS.NUTRITION_UPDATED, load), [load]);

  const kcalIn = Number(daily?.calories_in || 0);
  const kcalOut = Number(summary?.calories_out || 0); // đốt từ tập luyện
  const kcalLeft = clamp(kcalTarget - kcalIn + kcalOut, 0, 9999);

  const p = Number(daily?.protein_g || 0);
  const c = Number(daily?.carbs_g   || 0);
  const f = Number(daily?.fat_g     || 0);
  const fib = Number(daily?.fiber_g || 0);

  const left = {
    p:  Math.max(0, macroTarget.p_g   - p),
    c:  Math.max(0, macroTarget.c_g   - c),
    f:  Math.max(0, macroTarget.f_g   - f),
    fib:Math.max(0, macroTarget.fib_g - fib),
  };

  return (
    <ScrollView style={{ flex:1, backgroundColor: C.bg }} contentContainerStyle={{ paddingBottom: 24 }}>
      {}
      <LinearGradient
        colors={['#45e0b0', '#2ec59c']}
        start={{x:0,y:0}} end={{x:0,y:1}}
        style={{ margin:16, borderRadius:18, padding:18, overflow:'hidden' }}
      >
        <Text style={{ color:'#fff', opacity:0.9, textAlign:'center', letterSpacing:1 }}>
          {(profile?.goal || 'CLASSIC DIETING').toString().toUpperCase()}
        </Text>

        <View style={{ alignItems:'center', marginTop:6 }}>
          <View style={{ width:176, height:176, justifyContent:'center', alignItems:'center' }}>
            <Ring value={kcalLeft} max={kcalTarget} />
            <View style={{ position:'absolute', alignItems:'center' }}>
              <Text style={{ color:'#fff', fontSize:34, fontWeight:'800' }}>{kcalLeft}</Text>
              <Text style={{ color:'rgba(255,255,255,0.9)' }}>KCAL LEFT</Text>
            </View>
          </View>
        </View>

        {/* EATEN - BURNED */}
        <View style={{ flexDirection:'row', justifyContent:'space-between', marginTop:10 }}>
          <View style={{ alignItems:'center', flex:1 }}>
            <Text style={{ color:'#fff', fontWeight:'800' }}>{kcalIn}</Text>
            <Text style={{ color:'rgba(255,255,255,0.85)' }}>EATEN</Text>
          </View>
          <View style={{ alignItems:'center', flex:1 }}>
            <Text style={{ color:'#fff', fontWeight:'800' }}>{kcalOut}</Text>
            <Text style={{ color:'rgba(255,255,255,0.85)' }}>BURNED</Text>
          </View>
        </View>

        {/* CARBS / PROTEIN / FAT LEFT */}
        <View style={{
          flexDirection:'row', justifyContent:'space-between',
          marginTop:14, paddingTop:12, borderTopWidth:1, borderColor:'rgba(255,255,255,0.25)'
        }}>
          <View style={{ alignItems:'center', flex:1 }}>
            <Text style={{ color:'#fff', fontWeight:'800' }}>{left.c}g</Text>
            <Text style={{ color:'rgba(255,255,255,0.9)' }}>CARBS</Text>
          </View>
          <View style={{ alignItems:'center', flex:1 }}>
            <Text style={{ color:'#fff', fontWeight:'800' }}>{left.p}g</Text>
            <Text style={{ color:'rgba(255,255,255,0.9)' }}>PROTEIN</Text>
          </View>
          <View style={{ alignItems:'center', flex:1 }}>
            <Text style={{ color:'#fff', fontWeight:'800' }}>{left.f}g</Text>
            <Text style={{ color:'rgba(255,255,255,0.9)' }}>FAT</Text>
          </View>
        </View>

        {/* Fiber hint nho nhỏ */}
        <Text style={{ textAlign:'center', color:'#fff', marginTop:10 }}>
          Fiber left: <Text style={{ fontWeight:'800' }}>{left.fib} g</Text>
        </Text>
      </LinearGradient>

      {/* ===== Bữa hôm nay (rút gọn & sạch) ===== */}
      <View style={{ marginHorizontal:16, backgroundColor:C.card, borderWidth:1, borderColor:C.b, borderRadius:14, padding:14 }}>
        <Text style={{ fontWeight:'700', color:C.text, marginBottom:6 }}>Bữa hôm nay</Text>
        {meals.length ? meals.map(m=>{
          const sum = k => (m.items||[]).reduce((s,x)=>s+Number(x[k]||0),0);
          const kcal = sum('kcal'), sp=sum('protein_g'), sc=sum('carbs_g'), sf=sum('fat_g');
          const label = m.meal_type==='breakfast'?'Bữa sáng':m.meal_type==='lunch'?'Bữa trưa':m.meal_type==='dinner'?'Bữa tối':m.meal_type==='snack'?'Bữa phụ':m.meal_type;
          return (
            <View key={m.id} style={{ paddingVertical:8, borderTopWidth:1, borderTopColor:'#F3F4F6' }}>
              <Text style={{ fontWeight:'700', color:C.text }}>{label}</Text>
              {Array.isArray(m.items) && m.items.slice(0,3).map(it=>(
                <Text key={it.id} style={{ color:C.sub, marginTop:2 }}>- {it.name} • {it.grams}g</Text>
              ))}
              <Text style={{ color:C.sub, marginTop:4 }}>
                {kcal.toFixed(0)} kcal • P {sp.toFixed(1)}g • C {sc.toFixed(1)}g • F {sf.toFixed(1)}g
              </Text>
            </View>
          );
        }) : <Text style={{ color:C.sub }}>Chưa có bữa nào hôm nay.</Text>}
      </View>

      {/* ===== Lối tắt ===== */}
      <View style={{ flexDirection:'row', gap:10, marginTop:12, marginHorizontal:16, flexWrap:'wrap' }}>
        <Link href="/nutrition/log"   asChild><Pressable style={{ backgroundColor:C.card, borderWidth:1, borderColor:C.b, padding:12, borderRadius:10 }}><Text>Nhật ký bữa ăn</Text></Pressable></Link>
        <Link href="/nutrition/foods" asChild><Pressable style={{ backgroundColor:C.card, borderWidth:1, borderColor:C.b, padding:12, borderRadius:10 }}><Text>Thêm món</Text></Pressable></Link>
        <Link href="/nutrition/plan"  asChild><Pressable style={{ backgroundColor:C.card, borderWidth:1, borderColor:C.b, padding:12, borderRadius:10 }}><Text>Gợi ý thực đơn</Text></Pressable></Link>
        <Link href="/nutrition/stats" asChild><Pressable style={{ backgroundColor:C.card, borderWidth:1, borderColor:C.b, padding:12, borderRadius:10 }}><Text>Thống kê</Text></Pressable></Link>
      </View>
    </ScrollView>
  );
}
