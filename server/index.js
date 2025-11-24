// index.js — Express backend cho Health Buddy (khớp cấu trúc cũ + thêm Create Food + grams)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { z } = require('zod');
const { createClient } = require('@supabase/supabase-js');
// làm tròn 1 chữ số thập phân
const r1 = (n) => Math.round((Number(n) || 0) * 10) / 10;


const app = express();
app.use(express.json());

// ===== CORS DEV (web + Android emulator) =====
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));
app.use((req, res, next) => { if (req.method === 'OPTIONS') return res.sendStatus(204); next(); });
app.use(express.json({ limit: '10mb' }));

// ===== Logger =====
app.use((req, _res, next) => { console.log(new Date().toISOString(), req.method, req.url); next(); });

// ===== Supabase =====
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('[WARN] Missing Supabase envs');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const service  = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// ===== Auth middleware (đừng đặt tên 'auth' để tránh undefined) =====
async function requireAuth(req, res, next) {
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'No token' });
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ error: 'Invalid token' });
    req.uid = data.user.id;
    req.user_email = data.user.email || null;
    next();
  } catch (e) {
    console.error('Auth error:', e);
    res.status(401).json({ error: 'Auth failed' });
  }
}

// ===== Healthcheck =====
app.get('/api/ping', (_req, res) => res.json({ ok: true, from: 'backend', time: new Date().toISOString() }));

/* ======================================================================
   FOODS
   - GET /api/foods?search=... (tìm có dấu/không dấu; trả thêm fiber_g)
   - POST /api/foods (tạo món mới; auto kcal nếu không truyền)
   YÊU CẦU DB: bảng foods có các cột: name_vi, portion_g, protein_g, carbs_g, fiber_g, fat_g, kcal, name_search
   Có trigger name_search = lower(unaccent(name_vi))
   ====================================================================== */
app.get('/api/foods', requireAuth, async (req, res) => {
  try {
    const kw = (req.query.search || '').toString().trim();
    const limit = Math.min(Number(req.query.limit || 30), 100);

    // chuẩn hoá để tìm không dấu
    const kwNorm = kw.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

    let q = service
      .from('foods')
      .select('id,name_vi,portion_g,kcal,protein_g,carbs_g,fiber_g,fat_g,tags')
      .order('name_vi', { ascending: true })
      .limit(limit);

    if (kw) q = q.or(`name_vi.ilike.%${kw}%,name_search.ilike.%${kwNorm}%`);

    const { data, error } = await q;
    if (error) throw error;
    res.json(data || []);
  } catch (e) {
    console.error('GET /api/foods', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

app.get('/api/foods', requireAuth, async (req, res) => {
  try {
    const kw = (req.query.search || '').toString().trim();
    const limit = Math.min(Number(req.query.limit || 30), 100);

    // chuẩn hoá không dấu (an toàn với Node 22)
    const kwNorm = kw.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

    let q = service
      .from('foods')
      .select('id,name_vi,portion_g,kcal,protein_g,carbs_g,fiber_g,fat_g,tags')
      .order('name_vi', { ascending: true })
      .limit(limit);

    if (kw) {
      // Nếu DB CHƯA có cột name_search => comment dòng .or(...) và dùng 1 điều kiện ilike
      q = q.or(`name_vi.ilike.%${kw}%,name_search.ilike.%${kwNorm}%`);
      // q = q.ilike('name_vi', `%${kw}%`); // <-- fallback an toàn nếu name_search chưa tạo
    }

    const { data, error } = await q;
    if (error) return res.status(400).json({ error: error.message });
    res.json(data || []);
  } catch (e) {
    console.error('GET /api/foods', e);
    res.status(500).json({ error: e.message || 'Internal error' });
  }
});
// ===== Foods: CREATE =====
app.post('/api/foods', requireAuth, async (req, res) => {
  try {
    const body = z.object({
      name_vi:   z.string().min(2),
      portion_g: z.coerce.number().positive(),
      // có thể bỏ trống kcal, sẽ tự tính từ macros nếu thiếu
      kcal:      z.coerce.number().nonnegative().optional(),
      protein_g: z.coerce.number().nonnegative().optional(),
      carbs_g:   z.coerce.number().nonnegative().optional(),
      fiber_g:   z.coerce.number().nonnegative().optional(),
      fat_g:     z.coerce.number().nonnegative().optional(),
      tags:      z.array(z.string()).optional()
    }).parse(req.body);

    const kcal = (body.kcal != null)
      ? Number(body.kcal)
      : Number(4*(body.protein_g||0) + 4*(body.carbs_g||0) + 9*(body.fat_g||0));

    const { data, error } = await service.from('foods').insert({
      name_vi:   body.name_vi.trim(),
      portion_g: body.portion_g,
      kcal,
      protein_g: body.protein_g ?? 0,
      carbs_g:   body.carbs_g   ?? 0,
      fiber_g:   body.fiber_g   ?? 0,
      fat_g:     body.fat_g     ?? 0,
      tags:      body.tags      ?? null
    }).select().single();

    if (error) throw error;
    res.json(data);
  } catch (e) {
    console.error('POST /api/foods', e);
    res.status(400).json({ error: e.message || 'Internal error' });
  }
});

// GET /api/meals/today?date=YYYY-MM-DD
// Danh sách món đã ăn hôm nay (group theo bữa) — quantity là số "khẩu phần"
// Trả về meals[] để khớp Nutrition.js hiện tại
// GET /api/meals/today  -> { meals: [{ id, meal_type, items: [...] }] }
app.get('/api/meals/today', requireAuth, async (req, res) => {
  try {
    const uid  = req.uid;
    const date = (req.query.date || new Date().toISOString().slice(0,10)).toString();
    const start = new Date(`${date}T00:00:00.000Z`).toISOString();
    const end   = new Date(new Date(`${date}T00:00:00.000Z`).getTime() + 86400000).toISOString();

    // 1) Lấy các bữa trong NGÀY (ưu tiên cột date, fallback created_at)
    let mealsR = await service
      .from('meals')
      .select('id,meal_type,date,created_at')
      .eq('uid', uid)
      .eq('date', date);

    if (mealsR.error && /column .*date.* does not exist/i.test(mealsR.error.message)) {
      mealsR = await service
        .from('meals')
        .select('id,meal_type,created_at')
        .eq('uid', uid)
        .gte('created_at', start)
        .lt('created_at', end);
    }
    if (mealsR.error) throw mealsR.error;

    const meals = mealsR.data || [];
    if (!meals.length) return res.json({ meals: [] });

    const mealIds = meals.map(m => m.id);

    // 2) Lấy items thô (KHÔNG embed) -> id, meal_id, food_id, quantity
    const itemsR = await service
      .from('meal_items')
      .select('id,meal_id,food_id,quantity')
      .in('meal_id', mealIds);

    if (itemsR.error) throw itemsR.error;
    const items = itemsR.data || [];
    if (!items.length) {
      // Không có món thì trả rỗng theo bữa
      return res.json({
        meals: meals.map(m => ({ id: m.id, meal_type: m.meal_type, items: [] }))
      });
    }

    // 3) Lấy thông tin foods cho các food_id đã dùng
    const foodIds = [...new Set(items.map(it => it.food_id).filter(Boolean))];
    let foodsMap = new Map();
    if (foodIds.length) {
      const foodsR = await service
        .from('foods')
        .select('id,name_vi,portion_g,kcal,protein_g,carbs_g,fiber_g,fat_g')
        .in('id', foodIds);
      if (foodsR.error) throw foodsR.error;
      for (const f of (foodsR.data || [])) foodsMap.set(f.id, f);
    }

    // 4) Ráp items + foods, tính grams và macro theo quantity
    const itemsByMeal = new Map(meals.map(m => [m.id, []]));
    for (const it of items) {
      const f = foodsMap.get(it.food_id);
      if (!f) continue;
      const qty = Number(it.quantity || 1);
      const portion = Number(f.portion_g || 100);
      const grams = portion * qty;

      itemsByMeal.get(it.meal_id)?.push({
        id: it.id,
        food_id: f.id,
        name: f.name_vi,
        portion_g: portion,
        grams: Number(grams.toFixed(1)),
        kcal:      Number((Number(f.kcal      || 0) * qty).toFixed(1)),
        protein_g: Number((Number(f.protein_g || 0) * qty).toFixed(1)),
        carbs_g:   Number((Number(f.carbs_g   || 0) * qty).toFixed(1)),
        fiber_g:   Number((Number(f.fiber_g   || 0) * qty).toFixed(1)),
        fat_g:     Number((Number(f.fat_g     || 0) * qty).toFixed(1)),
      });
    }

    // 5) Trả theo từng bữa
    res.json({
      meals: meals.map(m => ({
        id: m.id,
        meal_type: m.meal_type,
        items: itemsByMeal.get(m.id) || []
      }))
    });
  } catch (e) {
    console.error('GET /api/meals/today', e);
    res.status(400).json({ error: e.message || 'Internal error' });
  }
});

/* ======================================================================
   MEALS
   - POST /api/meals  { meal_type }  -> tạo bữa
   - POST /api/meals/:id/items  { food_id, grams? | quantity? }
     Nếu truyền grams -> auto quantity = grams / portion_g (4 chữ số thập phân)
   YÊU CẦU DB: bảng meal_items(meal_id, food_id, quantity)
   ====================================================================== */
app.post('/api/meals', requireAuth, async (req, res) => {
  try {
    const uid = req.uid;
    const body = z.object({
      meal_type: z.enum(['breakfast','lunch','dinner','snack']),
      date: z.string().optional() // tùy DB có cột date hay không
    }).parse(req.body);

    const payloadWithDate = { uid, meal_type: body.meal_type, date: body.date ?? new Date().toISOString().slice(0,10) };
    let ins = await service.from('meals').insert(payloadWithDate).select().single();

    if (ins.error && /column .*date.* does not exist/i.test(ins.error.message)) {
      // retry không có 'date'
      ins = await service.from('meals').insert({ uid, meal_type: body.meal_type }).select().single();
    }
    if (ins.error) throw ins.error;
    res.json(ins.data);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
// ===== Thêm món vào bữa ăn =====
// Đặt schema tái dùng ở đầu file (gần các import)
const GramsSchema = z.preprocess((v) => {
  if (typeof v === 'string') v = v.trim().replace(',', '.');
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined; // undefined => fail
}, z.number().positive());

const QtySchema = z.preprocess((v) => {
  if (typeof v === 'string') v = v.trim().replace(',', '.');
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}, z.number().positive());

// ===== Thêm món vào bữa ăn (hỗ trợ grams hoặc quantity) =====
app.post('/api/meals/:mealId/items', requireAuth, async (req, res) => {
  try {
    const meal_id = Number(req.params.mealId);
    if (!meal_id) return res.status(400).json({ error: 'mealId không hợp lệ' });

    const body = z.object({
      food_id: z.coerce.number().int().positive(),
      quantity: z.preprocess((v) => {
        if (typeof v === 'string') v = v.trim().replace(',', '.');
        const n = Number(v);
        return Number.isFinite(n) ? n : undefined;
      }, z.number().positive())
    }).parse(req.body);

    const { data, error } = await service
      .from('meal_items')
      .insert({ meal_id, food_id: body.food_id, quantity: body.quantity })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (e) {
    console.error('POST /api/meals/:mealId/items', e, 'req.body=', req.body);
    res.status(400).json({ error: e.message || 'Internal error' });
  }
});


// (tuỳ chọn) Lấy danh sách items của 1 meal để debug nhanh
app.get('/api/meals/:mealId/items', requireAuth, async (req, res) => {
  const meal_id = Number(req.params.mealId);
  const { data, error } = await service
    .from('meal_items')
    .select('id, grams, foods(name_vi, kcal, protein_g, carbs_g, fiber_g, fat_g)')
    .eq('meal_id', meal_id)
    .order('id', { ascending: true });

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});




app.patch('/api/meal-items/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const body = z.object({
      quantity: z.coerce.number().positive().optional(),
      grams: z.coerce.number().positive().optional()
    }).refine(v => v.quantity || v.grams, { message: 'quantity or grams required' }).parse(req.body);

    // lấy meal_item
    const { data: mi, error: e1 } = await service
      .from('meal_items')
      .select('id, meal_id, food_id')
      .eq('id', id)
      .single();
    if (e1 || !mi) return res.status(404).json({ error: 'Item not found' });

    // kiểm tra quyền: item thuộc bữa của user
    const { data: meal, error: e2 } = await service
      .from('meals')
      .select('uid')
      .eq('id', mi.meal_id)
      .single();
    if (e2 || !meal || meal.uid !== req.uid) return res.status(403).json({ error: 'Forbidden' });

    let quantity = body.quantity;
    if (!quantity && body.grams) {
      // cần portion_g để convert grams -> quantity
      const { data: food, error: e3 } = await service
        .from('foods')
        .select('portion_g')
        .eq('id', mi.food_id)
        .single();
      if (e3 || !food) return res.status(400).json({ error: 'Food missing' });
      const portion = Number(food.portion_g || 100);
      quantity = Number(body.grams) / portion;
    }

    const { data, error } = await service
      .from('meal_items')
      .update({ quantity })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    res.json(data);
  } catch (e) {
    console.error('PATCH /api/meal-items/:id', e);
    res.status(400).json({ error: e.message || 'Internal error' });
  }
});
// DELETE /api/meal-items/:id
app.delete('/api/meal-items/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);

    // lấy meal_item
    const { data: mi, error: e1 } = await service
      .from('meal_items')
      .select('id, meal_id')
      .eq('id', id)
      .single();
    if (e1 || !mi) return res.status(404).json({ error: 'Item not found' });

    // kiểm tra quyền
    const { data: meal, error: e2 } = await service
      .from('meals')
      .select('uid')
      .eq('id', mi.meal_id)
      .single();
    if (e2 || !meal || meal.uid !== req.uid) return res.status(403).json({ error: 'Forbidden' });

    const { error } = await service.from('meal_items').delete().eq('id', id);
    if (error) throw error;

    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/meal-items/:id', e);
    res.status(400).json({ error: e.message || 'Internal error' });
  }
});


/* ======================================================================
   EXERCISES / WORKOUTS
   ====================================================================== */
function estimateCalories(met, weightKg, minutes) {
  const w = Number(weightKg || 60);
  const m = Number(minutes || 0);
  return Number((met * w * (m/60)).toFixed(1));
}

/* ========== WORKOUT REMINDERS ========== */
app.get('/api/workouts/reminders', requireAuth, async (req, res) => {
  const uid = req.uid;
  const { data, error } = await service
    .from('workout_reminders')
    .select('*')
    .eq('uid', uid)
    .order('time_of_day');
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

app.post('/api/workouts/reminders', requireAuth, async (req, res) => {
  const uid = req.uid;
  const { time_of_day, dow = [1,2,3,4,5,6,7], note } = req.body || {};
  if (!time_of_day) return res.status(400).json({ error: 'time_of_day required' });
  const { data, error } = await service
    .from('workout_reminders')
    .insert({ uid, time_of_day, dow, note })
    .select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

app.delete('/api/workouts/reminders/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { error } = await service.from('workout_reminders').delete().eq('id', id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
});


app.get('/api/exercises', requireAuth, async (_req, res) => {
  const { data, error } = await service.from('exercises').select('*').order('id');
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

app.post('/api/workouts/sessions', requireAuth, async (req, res) => {
  try {
    const uid = req.uid;
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const {
      exercise_id,
      duration_min,     // cardio gửi phút; strength có thể bỏ trống
      sets, reps, rest_sec,
      weight_kg,        // nếu không gửi, sẽ lấy từ profiles, fallback = 60
      date              // client có thể truyền today() dạng 'YYYY-MM-DD'
    } = body;

    // 1) Lấy bài tập để biết MET & category
    const exR = await service
      .from('exercises')
      .select('id, met, category')
      .eq('id', exercise_id)
      .maybeSingle();
    if (exR.error || !exR.data) throw new Error('Exercise not found');
    const ex = exR.data;

    // 2) Quy ước thời lượng
    const isCardio = (ex.category || '').toLowerCase() === 'cardio';
    const dNum = Number(duration_min);
    let dur = Number.isFinite(dNum) && dNum > 0
      ? dNum
      : (isCardio
          ? 20 // cardio mặc định 20 phút
          : Math.max(
              10,
              (Number(sets) || 3) * ((Number(reps) || 12) * 5 / 60 + (Number(rest_sec) || 60) / 60)
            ));
            // strength ước lượng: 5s/rep + rest giữa hiệp; tối thiểu 10'

    // 3) Cân nặng
    let w = Number(weight_kg);
    if (!Number.isFinite(w) || w <= 0) {
      const prof = await service.from('profiles').select('weight_kg').eq('id', uid).maybeSingle();
      if (!prof.error && prof.data?.weight_kg) w = Number(prof.data.weight_kg);
    }
    if (!Number.isFinite(w) || w <= 0) w = 60; // fallback

    // 4) MET & calories
    const met = Number(ex.met) || (isCardio ? 7 : 5);
    const calories = Math.round(met * 3.5 * w / 200 * dur); // công thức chuẩn MET

    // 5) Ghim ngày cho đúng màn hình Tổng quan
    const useDate = (date || new Date().toISOString().slice(0, 10)).toString();

    // 6) Lưu
    const ins = await service
      .from('workout_sessions')
      .insert({
        uid,
        date: useDate,
        exercise_id,
        duration_min: dur,
        sets: Number(sets) || null,
        reps: Number(reps) || null,
        rest_sec: Number(rest_sec) || null,
        weight_kg: w,
        calories
      })
      .select()
      .maybeSingle();

    if (ins.error) throw ins.error;
    res.json(ins.data);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});


app.get('/api/workouts/sessions', requireAuth, async (req, res) => {
  const uid = req.uid;
  const { from, to } = req.query;
  let q = service.from('workout_sessions').select('*').eq('uid', uid).order('date', { ascending: false });
  if (from) q = q.gte('date', from);
  if (to)   q = q.lte('date', to);
  const { data, error } = await q;
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

/* ======================================================================
   CARE (nước, ngủ)
   ====================================================================== */
/* ===== Body metrics: weight / height / BMI ===== */
app.post('/api/metrics/weight', requireAuth, async (req, res) => {
  try {
    const uid = req.uid;
    const body = z.object({
      weight_kg: z.coerce.number().positive(),
      height_cm: z.coerce.number().positive().optional(),
      date: z.string().optional()
    }).parse(req.body);

    const { data, error } = await service
      .from('weight_logs')
      .insert({
        uid,
        weight_kg: body.weight_kg,
        height_cm: body.height_cm ?? null,
        date: body.date ?? new Date().toISOString().slice(0,10)
      })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get('/api/metrics/weight', requireAuth, async (req, res) => {
  const uid = req.uid;
  const limit = Math.min(Number(req.query.limit || 30), 180);
  const { data, error } = await service
    .from('weight_logs')
    .select('*').eq('uid', uid)
    .order('date', { ascending: false })
    .limit(limit);
  if (error) return res.status(400).json({ error: error.message });

  // Tính BMI cho record mới nhất (nếu có height)
  const latest = data?.[0];
  let bmi = null, bmi_class = null;
  if (latest?.height_cm) {
    const h = Number(latest.height_cm) / 100;
    if (h > 0) {
      bmi = Number((Number(latest.weight_kg)/ (h*h)).toFixed(1));
      bmi_class =
        bmi < 18.5 ? 'Thiếu cân' :
        bmi < 23   ? 'Bình thường (chuẩn châu Á)' :
        bmi < 25   ? 'Thừa cân (tiền béo phì)' :
        bmi < 30   ? 'Béo phì độ I' :
        bmi < 35   ? 'Béo phì độ II' : 'Béo phì độ III';
    }
  }
  res.json({ items: data, bmi, bmi_class });
});
// ===== Symptoms (triệu chứng) =====
app.post('/api/symptoms', requireAuth, async (req, res) => {
  try {
    const uid = req.uid;
    const body = z.object({
      code: z.string().min(2),                // ví dụ: 'dau_dau'
      severity: z.coerce.number().int().min(1).max(5).optional(),
      note: z.string().optional(),
      date: z.string().optional()             // 'YYYY-MM-DD' (mặc định hôm nay)
    }).parse(req.body);

    const { data, error } = await service
      .from('symptoms')
      .insert({
        uid,
        code: body.code,
        severity: body.severity ?? null,
        note: body.note ?? null,
        date: body.date ?? new Date().toISOString().slice(0,10)
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (e) {
    console.error('POST /api/symptoms', e);
    res.status(400).json({ error: e.message || 'Internal error' });
  }
});

app.get('/api/symptoms/history', requireAuth, async (req, res) => {
  try {
    const uid = req.uid;
    const limit = Math.min(Number(req.query.limit || 30), 200);
    const { data, error } = await service
      .from('symptoms')
      .select('*')
      .eq('uid', uid)
      .order('date', { ascending: false })
      .limit(limit);
    if (error) throw error;
    res.json(data || []);
  } catch (e) {
    console.error('GET /api/symptoms/history', e);
    res.status(400).json({ error: e.message || 'Internal error' });
  }
});

// (tuỳ chọn) hôm nay
app.get('/api/symptoms/today', requireAuth, async (req, res) => {
  const uid = req.uid;
  const today = new Date().toISOString().slice(0,10);
  const { data, error } = await service
    .from('symptoms')
    .select('*')
    .eq('uid', uid).eq('date', today)
    .order('created_at', { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data || []);
});


/* ===== Sleep: history ===== */
// ===== CARE API (tối thiểu) =====
app.get('/api/sleep/logs', requireAuth, async (req, res) => {
  try {
    const uid = req.uid;
    const date = (req.query.date || new Date().toISOString().slice(0,10)).toString();
    const { data, error } = await service.from('sleep_logs')
      .select('id,date,start_time,end_time,duration_min')
      .eq('uid', uid)
      .eq('date', date)
      .order('id', { ascending:false });
    if (error) throw error;
    res.json(data || []);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/sleep/logs', requireAuth, async (req, res) => {
  try {
    const uid = req.uid;
    const { date, duration_min, start_time, end_time } = JSON.parse(req.body || '{}');
    if (!date || !duration_min) throw new Error('date & duration_min required');
    const { data, error } = await service.from('sleep_logs')
      .insert({ uid, date, duration_min, start_time, end_time })
      .select()
      .maybeSingle();
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/hydration/logs', requireAuth, async (req, res) => {
  try {
    const uid = req.uid;
    const date = (req.query.date || new Date().toISOString().slice(0,10)).toString();
    const { data, error } = await service.from('hydration_logs')
      .select('id,date,amount_ml')
      .eq('uid', uid).eq('date', date).order('id', { ascending:false });
    if (error) throw error;
    res.json(data || []);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/hydration/logs', requireAuth, async (req, res) => {
  try {
    const uid = req.uid;
    const { date, amount_ml } = JSON.parse(req.body || '{}');
    if (!date || !amount_ml) throw new Error('date & amount_ml required');
    const { data, error } = await service.from('hydration_logs')
      .insert({ uid, date, amount_ml: Number(amount_ml) })
      .select()
      .maybeSingle();
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/medications', requireAuth, async (req, res) => {
  try {
    const uid = req.uid;
    const { date, name, dose } = JSON.parse(req.body || '{}');
    if (!date || !name) throw new Error('date & name required');
    const { data, error } = await service.from('medications')
      .insert({ uid, date, name, dose: dose || null })
      .select()
      .maybeSingle();
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/medications/today', requireAuth, async (req, res) => {
  try {
    const uid = req.uid;
    const date = (req.query.date || new Date().toISOString().slice(0,10)).toString();
    const { data, error } = await service.from('medications')
      .select('id,date,name,dose')
      .eq('uid', uid).eq('date', date).order('id', { ascending:false });
    if (error) throw error;
    res.json(data || []);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/health/notes', requireAuth, async (req, res) => {
  try {
    const uid = req.uid;
    const date = (req.query.date || new Date().toISOString().slice(0,10)).toString();
    const { data, error } = await service.from('health_notes')
      .select('id,date,note')
      .eq('uid', uid).eq('date', date).order('id', { ascending:false });
    if (error) throw error;
    res.json(data || []);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/health/notes', requireAuth, async (req, res) => {
  try {
    const uid = req.uid;
    const { date, note } = JSON.parse(req.body || '{}');
    if (!date || !note) throw new Error('date & note required');
    const { data, error } = await service.from('health_notes')
      .insert({ uid, date, note })
      .select()
      .maybeSingle();
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});


app.get('/api/sleep', requireAuth, async (req, res) => {
  const uid = req.uid;
  const limit = Math.min(Number(req.query.limit || 30), 180);
  const { data, error } = await service
    .from('sleep_logs')
    .select('*').eq('uid', uid)
    .order('date', { ascending: false })
    .limit(limit);
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});


/* ===== Symptoms: history ===== */
app.get('/api/symptoms/history', requireAuth, async (req, res) => {
  const uid = req.uid;
  const limit = Math.min(Number(req.query.limit || 30), 180);
  const { data, error } = await service
    .from('symptoms')
    .select('*').eq('uid', uid)
    .order('date', { ascending: false })
    .limit(limit);
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

app.post('/api/hydration', requireAuth, async (req, res) => {
  try {
    const uid = req.uid;
    const body = z.object({ amount_ml: z.coerce.number().int().positive(), date: z.string().optional() }).parse(req.body);
    const { data, error } = await service.from('hydration_logs')
      .insert({ uid, amount_ml: body.amount_ml, date: body.date ?? new Date().toISOString().slice(0,10) })
      .select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/sleep', requireAuth, async (req, res) => {
  try {
    const uid = req.uid;
    const body = z.object({
      duration_min: z.coerce.number().int().positive(),
      date: z.string().optional(),
      quality: z.string().optional()
    }).parse(req.body);

    const { data, error } = await service.from('sleep_logs')
      .insert({ uid, duration_min: body.duration_min, date: body.date ?? new Date().toISOString().slice(0,10), quality: body.quality ?? null })
      .select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
// ví dụ server
app.get('/api/nutrition/suggest', requireAuth, (req,res)=>{
  const goal = (req.query.goal||'lose').toString();
  res.json({
    goal,
    days: [
      { note:'Ưu tiên giàu đạm', meals: [
        { title:'Sáng', items:['Yến mạch + sữa chua Hy Lạp + chuối'] },
        { title:'Trưa', items:['Cơm 150g + ức gà 150g + rau luộc'] },
        { title:'Tối', items:['Cá hồi 120g + khoai lang 150g + salad'] },
      ]},
    ]
  });
});

app.get('/api/nutrition/daily', requireAuth, async (req, res) => {
  try {
    const uid  = req.uid;
    const date = (req.query.date || new Date().toISOString().slice(0, 10)).toString();

    // 1) view nếu có
    let viewR = await service
      .from('vw_daily_nutrition')
      .select('uid,date,calories_in,protein_g,carbs_g,fiber_g,fat_g')
      .eq('uid', uid).eq('date', date).maybeSingle();

    if (!viewR.error && viewR.data) {
      const out = {
        uid, date,
        calories_in: Number(viewR.data.calories_in || 0),
        protein_g:   Number(viewR.data.protein_g   || 0),
        carbs_g:     Number(viewR.data.carbs_g     || 0),
        fiber_g:     Number(viewR.data.fiber_g     || 0),
        fat_g:       Number(viewR.data.fat_g       || 0),
      };
      return res.json(out);
    }

    // 2) fallback lọc đúng theo NGÀY
    const start = new Date(`${date}T00:00:00.000Z`).toISOString();
    const end   = new Date(new Date(`${date}T00:00:00.000Z`).getTime() + 86400000).toISOString();

    let mealsR = await service.from('meals').select('id').eq('uid', uid).eq('date', date);
    if (mealsR.error && /column .*date.* does not exist/i.test(mealsR.error.message)) {
      mealsR = await service.from('meals').select('id,created_at').eq('uid', uid)
        .gte('created_at', start).lt('created_at', end);
    }
    if (mealsR.error) throw mealsR.error;

    const mealIds = (mealsR.data || []).map(m => m.id);
    if (!mealIds.length) return res.json({ uid, date, calories_in:0, protein_g:0, carbs_g:0, fiber_g:0, fat_g:0 });

    const itemsR = await service
      .from('meal_items')
      .select('quantity, foods(kcal,protein_g,carbs_g,fiber_g,fat_g)')
      .in('meal_id', mealIds);
    if (itemsR.error) throw itemsR.error;

    const sum = { calories_in:0, protein_g:0, carbs_g:0, fiber_g:0, fat_g:0 };
    for (const it of (itemsR.data || [])) {
      const q = Number(it.quantity || 1);
      const f = it.foods || {};
      sum.calories_in += q * Number(f.kcal      || 0);
      sum.protein_g   += q * Number(f.protein_g || 0);
      sum.carbs_g     += q * Number(f.carbs_g   || 0);
      sum.fiber_g     += q * Number(f.fiber_g   || 0);
      sum.fat_g       += q * Number(f.fat_g     || 0);
    }
    Object.keys(sum).forEach(k => (sum[k] = Number((sum[k] || 0).toFixed(1))));
    res.json({ uid, date, ...sum });
  } catch (e) {
    console.error('GET /api/nutrition/daily', e);
    res.status(400).json({ error: e.message || 'Internal error' });
  }
});



app.get('/api/summary/daily', requireAuth, async (req, res) => {
  const uid  = req.uid;
  const date = (req.query.date || new Date().toISOString().slice(0,10)).toString();

  // 1) Ưu tiên view nếu có
  let view = await service
    .from('vw_daily_summary')
    .select('*')
    .eq('uid', uid)
    .eq('date', date)
    .maybeSingle();

  if (!view.error && view.data) {
    return res.json(view.data);
  }

  // 2) Fallback CHUẨN (lọc đúng theo ngày, không lẫn dữ liệu cũ)
  try {
    // calories_in qua meals + meal_items + foods (quantity)
    const { data: meals, error: eMeals } = await service
      .from('meals')
      .select('id')
      .eq('uid', uid)
      .eq('date', date);

    if (eMeals) throw eMeals;

    let calories_in = 0, protein_g = 0, carbs_g = 0, fiber_g = 0, fat_g = 0;
    if ((meals || []).length) {
      const mealIds = meals.map(m => m.id);
      const { data: items, error: eItems } = await service
        .from('meal_items')
        .select('quantity, foods(kcal,protein_g,carbs_g,fiber_g,fat_g)')
        .in('meal_id', mealIds);

      if (eItems) throw eItems;

      for (const it of (items || [])) {
        const q = Number(it.quantity || 1);
        const f = it.foods || {};
        calories_in += q * Number(f.kcal || 0);
        protein_g   += q * Number(f.protein_g || 0);
        carbs_g     += q * Number(f.carbs_g || 0);
        fiber_g     += q * Number(f.fiber_g || 0);
        fat_g       += q * Number(f.fat_g || 0);
      }
    }

    // calories_out từ workout_sessions (lọc đúng ngày)
    const w = await service
      .from('workout_sessions')
      .select('calories')
      .eq('uid', uid)
      .eq('date', date);
    if (w.error) throw w.error;
    const calories_out = (w.data || []).reduce((s, r) => s + Number(r.calories || 0), 0);

    // nước trong ngày
    const h = await service
      .from('hydration_logs')
      .select('amount_ml')
      .eq('uid', uid)
      .eq('date', date);
    if (h.error) throw h.error;
    const water_ml = (h.data || []).reduce((s, r) => s + Number(r.amount_ml || 0), 0);

    // ngủ trong ngày (CHÚ Ý: lọc theo cột date, KHÔNG gom tất cả như bản cũ)
    const s = await service
      .from('sleep_logs')
      .select('duration_min')
      .eq('uid', uid)
      .eq('date', date);
    if (s.error) throw s.error;
    const sleep_min = (s.data || []).reduce((t, r) => t + Number(r.duration_min || 0), 0);

    // làm tròn 1 chữ số thập phân cho macro, calo_out giữ nguyên số nguyên
    const r1 = v => Number((v || 0).toFixed(1));
    return res.json({
      uid,
      date,
      calories_in: r1(calories_in),
      protein_g:   r1(protein_g),
      carbs_g:     r1(carbs_g),
      fiber_g:     r1(fiber_g),
      fat_g:       r1(fat_g),
      calories_out: Math.round(calories_out),
      water_ml,
      sleep_min
    });
  } catch (e) {
    console.error('SUMMARY FALLBACK ERROR', e);
    return res.status(400).json({ error: e.message || 'Internal error' });
  }
});
/* ========== PROGRESS (for charts) ========== */
// Cân nặng 30 ngày gần nhất (hoặc ?days=)
app.get('/api/progress/weight', requireAuth, async (req, res) => {
  const uid = req.uid;
  const days = Math.min(Number(req.query.days || 30), 180);
  const since = new Date(Date.now() - days*86400000).toISOString().slice(0,10);
  const { data, error } = await service
    .from('body_weights').select('date,weight_kg')
    .eq('uid', uid).gte('date', since).order('date');
  if (error) return res.status(400).json({ error: error.message });
  res.json(data || []);
});

// Hoạt động 14 ngày gần nhất (bước & kcal)
app.get('/api/progress/activity', requireAuth, async (req, res) => {
  const uid = req.uid;
  const days = Math.min(Number(req.query.days || 14), 90);
  const since = new Date(Date.now() - days*86400000).toISOString().slice(0,10);
  const { data, error } = await service
    .from('daily_activity').select('date,steps,calories_out')
    .eq('uid', uid).gte('date', since).order('date');
  if (error) return res.status(400).json({ error: error.message });
  res.json(data || []);
});


const PORT = process.env.PORT || 8088;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`API running at http://localhost:${PORT}`);
});


// ---------- BMI & Khuyến nghị ----------
function bmiOf(weightKg, heightCm) {
  const h = Number(heightCm || 0) / 100;
  const w = Number(weightKg || 0);
  if (!h || !w) return null;
  return Number((w / (h * h)).toFixed(1));
}
// WHO Asian cut-offs
function bmiCategory(bmi) {
  if (bmi == null) return null;
  if (bmi < 18.5) return 'gầy';
  if (bmi < 23)   return 'bình thường';
  if (bmi < 27.5) return 'thừa cân';
  return 'béo phì';
}

// Lấy hồ sơ (kèm email)
app.get('/api/profile', requireAuth, async (req, res) => {
  try {
    const uid = req.uid;
    // đảm bảo có record
    const up = await service.from('profiles').upsert(
      { uid }, { onConflict: 'uid' }
    ).select().single();

    if (up.error && up.error.code !== '23505') throw up.error;

    const { data, error } = await service
      .from('profiles')
      .select('uid,display_name,avatar_url,phone,height_cm,weight_kg,bmi,bmi_cat,updated_at')
      .eq('uid', uid)
      .maybeSingle();

    if (error) throw error;
    res.json({ ...(data||{}), email: req.user_email });
  } catch (e) {
    console.error('GET /api/profile', e);
    res.status(400).json({ error: e.message });
  }
});

// Cập nhật thể trạng (chiều cao/cân nặng) + tính BMI
app.post('/api/profile/body', requireAuth, async (req, res) => {
  try {
    const uid = req.uid;
    const body = z.object({
      height_cm: z.coerce.number().positive().max(300),
      weight_kg: z.coerce.number().positive().max(500),
      phone: z.string().optional()
    }).parse(req.body);

    const bmi = bmiOf(body.weight_kg, body.height_cm);
    const cat = bmiCategory(bmi);

    const { data, error } = await service.from('profiles').upsert({
      uid,
      height_cm: body.height_cm,
      weight_kg: body.weight_kg,
      phone: body.phone ?? null,
      bmi: bmi,
      bmi_cat: cat,
      updated_at: new Date().toISOString()
    }, { onConflict: 'uid' }).select().single();

    if (error) throw error;
    res.json({ ...data, email: req.user_email });
  } catch (e) {
    console.error('POST /api/profile/body', e);
    res.status(400).json({ error: e.message });
  }
});

// ====== PROFILE & METRICS ======
app.get('/api/profile', requireAuth, async (req, res) => {
  const uid = req.uid;
  let { data, error } = await service.from('profiles').select('*').eq('uid', uid).maybeSingle();
  if (error) return res.status(400).json({ error: error.message });
  if (!data) {
    // tạo hồ sơ trống nếu chưa có
    const ins = await service.from('profiles').insert({ uid }).select().single();
    if (ins.error) return res.status(400).json({ error: ins.error.message });
    data = ins.data;
  }
  // tính BMI & TDEE sơ bộ (server-side để nhất quán)
  const h = Number(data.height_cm||0), w = Number(data.weight_kg||0);
  const bmi = h>0 ? Number((w / Math.pow(h/100,2)).toFixed(1)) : null;
  const act = data.activity_level || 'light';
  const actMult = {sedentary:1.2, light:1.375, moderate:1.55, active:1.725, athlete:1.9}[act] || 1.375;

  // Nếu thiếu tuổi/giới thì bỏ qua BMR, trả null
  let tdee = null;
  if (h>0 && w>0 && data.birth_year) {
    const age = new Date().getUTCFullYear() - Number(data.birth_year);
    const sex = data.sex || 'other';
    // Mifflin-St Jeor (nếu 'other' thì dùng trung vị nam/nữ)
    const s = sex==='male' ? 5 : sex==='female' ? -161 : (-78);
    const bmr = 10*w + 6.25*h - 5*age + s;
    tdee = Math.round(bmr * actMult);
  }
  res.json({ ...data, bmi, tdee });
});

app.put('/api/profile', requireAuth, async (req, res) => {
  const uid = req.uid;
  try {
    const body = z.object({
      display_name: z.string().optional(),
      phone: z.string().optional(),
      height_cm: z.coerce.number().positive().optional(),
      weight_kg: z.coerce.number().positive().optional(),
      sex: z.enum(['male','female','other']).optional(),
      birth_year: z.coerce.number().int().min(1900).max(new Date().getUTCFullYear()).optional(),
      activity_level: z.enum(['sedentary','light','moderate','active','athlete']).optional(),
      goal: z.enum(['lose','maintain','gain']).optional()
    }).parse(req.body);

    // upsert
    const { data, error } = await service
      .from('profiles')
      .upsert({ uid, ...body })
      .select()
      .single();
    if (error) throw error;

    // ghi log cân nặng nếu có
    if (body.weight_kg) {
      await service.from('weight_logs').upsert({
        uid,
        date: new Date().toISOString().slice(0,10),
        weight_kg: body.weight_kg
      });
    }

    // trả lại với BMI/TDEE như GET
    req.body = body; // reuse
    return app._router.handle({ ...req, method: 'GET', url: '/api/profile' }, res, () => {});
  } catch (e) {
    return res.status(400).json({ error: e.message || 'Invalid data' });
  }
});

// ====== RECOMMENDATIONS: FOODS ======
// Trả gợi ý theo bữa và theo goal/BMI (đơn giản nhưng hữu ích)
app.get('/api/recs/foods', requireAuth, async (req, res) => {
  const uid = req.uid;
  const mealType = (req.query.meal_type || 'lunch').toString();

  const prof = await service.from('profiles').select('*').eq('uid', uid).maybeSingle();
  const p = prof.data || {};
  const h = Number(p.height_cm||0), w = Number(p.weight_kg||0);
  const bmi = h>0 ? (w/Math.pow(h/100,2)) : null;
  const goal = p.goal || 'maintain';

  // lấy 120 món top để chấm điểm
  const foods = await service.from('foods')
    .select('id,name_vi,portion_g,kcal,protein_g,carbs_g,fiber_g,fat_g,tags')
    .limit(120);

  if (foods.error) return res.status(400).json({ error: foods.error.message });

  function scoreProtein(f){
    // Ưu tiên protein/calo cao, béo thấp
    const pc = Number(f.protein_g||0)*4, kc = Number(f.kcal||1);
    const fat = Number(f.fat_g||0);
    return (pc/kc) - fat*0.02;
  }
  function scoreFiber(f){
    // Ưu tiên chất xơ cao, kcal vừa
    const fiber = Number(f.fiber_g||0);
    const kcal  = Number(f.kcal||1);
    return fiber*1.0 - (kcal>180 ? 0.3 : 0);
  }
  function scoreBalanced(f){
    // cân bằng protein/carb vừa phải, kcal < 250
    const kcal = Number(f.kcal||999);
    const p = Number(f.protein_g||0), c = Number(f.carbs_g||0), fat = Number(f.fat_g||0);
    const delta = Math.abs((p*4) - (c*4)); // lệch P/C
    return (kcal<=250 ? 1 : 0) + (fat<12 ? 0.6 : 0) - delta*0.005;
  }

  let protein = [...(foods.data||[])].sort((a,b)=>scoreProtein(b)-scoreProtein(a)).slice(0,12);
  let fiber   = [...(foods.data||[])].sort((a,b)=>scoreFiber(b)-scoreFiber(a)).slice(0,12);
  let balanced= [...(foods.data||[])].sort((a,b)=>scoreBalanced(b)-scoreBalanced(a)).slice(0,12);

  // điều chỉnh theo BMI/goal
  if (bmi && bmi >= 27 || goal==='lose') {
    // giảm cân: đẩy mạnh protein & fiber
    balanced = balanced.slice(0,8);
  } else if (bmi && bmi < 18.5 || goal==='gain') {
    // tăng cân: giảm ưu tiên fiber quá cao
    fiber = fiber.slice(0,8);
  }

  res.json({
    meal_type: mealType,
    groups: {
      protein,
      fiber,
      balanced
    }
  });
});

// ====== RECOMMENDATIONS: WORKOUTS ======
app.get('/api/recs/workouts', requireAuth, async (req, res) => {
  const uid = req.uid;
  const prof = await service.from('profiles').select('*').eq('uid', uid).maybeSingle();
  const p = prof.data || {};
  const h = Number(p.height_cm||0), w = Number(p.weight_kg||0);
  const bmi = h>0 ? (w/Math.pow(h/100,2)) : null;
  const goal = p.goal || 'maintain';
  const act  = p.activity_level || 'light';

  // đích phút/ngày (đơn giản hóa theo BMI/goal)
  let minutes = 30;
  if (goal==='lose') minutes = 45;
  if (bmi && bmi>=27) minutes = 50;
  if (bmi && bmi<18.5 && goal!=='lose') minutes = 25;

  // cường độ mục tiêu (MET)
  let metMin=3, metMax=8;
  if (goal==='lose' || (bmi&&bmi>=27)) { metMin=4; metMax=9; }

  const ex = await service.from('exercises').select('id,name,met,note').order('met',{ascending:true});
  if (ex.error) return res.status(400).json({ error: ex.error.message });

  const light   = (ex.data||[]).filter(e=>e.met>=2.5 && e.met<4.5).slice(0,8);
  const medium  = (ex.data||[]).filter(e=>e.met>=4.5 && e.met<7.5).slice(0,8);
  const vigorous= (ex.data||[]).filter(e=>e.met>=7.5).slice(0,8);

  res.json({
    plan: { minutes_target: minutes, met_range: [metMin,metMax], days_per_week: 5 },
    buckets: { light, medium, vigorous }
  });
});
// ===== PROGRESS (week/month) =====
app.get('/api/workouts/progress', requireAuth, async (req, res) => {
  try {
    const uid = req.uid;
    const range = (req.query.range || 'week').toString(); // week | month

    const today = new Date();
    const start = new Date(today);
    if (range === 'month') start.setDate(1);
    else {
      const d = (today.getDay() + 6) % 7; // Mon=0..Sun=6
      start.setDate(today.getDate() - d);
    }
    start.setHours(0,0,0,0);
    const end = new Date(start);
    if (range === 'month') end.setMonth(start.getMonth()+1);
    else end.setDate(start.getDate()+7);
    const startIso = start.toISOString();
    const endIso = end.toISOString();

    // sessions in range
    const ss = await service
      .from('workout_sessions')
      .select('date, duration_min, calories, exercise_id')
      .eq('uid', uid)
      .gte('date', startIso.slice(0,10))
      .lt('date', endIso.slice(0,10));

    if (ss.error) throw ss.error;

    // Tổng hợp theo ngày
    const days = {};
    for (let d=new Date(start); d<end; d.setDate(d.getDate()+1)) {
      const key = d.toISOString().slice(0,10);
      days[key] = { date:key, minutes:0, calories:0 };
    }
    let totalMinutes = 0, totalCalories = 0;
    (ss.data||[]).forEach(r=>{
      const k = (typeof r.date==='string'? r.date : new Date(r.date).toISOString()).slice(0,10);
      if (!days[k]) days[k] = { date:k, minutes:0, calories:0 };
      days[k].minutes += Number(r.duration_min||0);
      days[k].calories += Number(r.calories||0);
      totalMinutes += Number(r.duration_min||0);
      totalCalories += Number(r.calories||0);
    });

    // nhóm cơ (dựa trên sessions join exercises)
    const sessIds = (ss.data||[]).map(s=>s.exercise_id).filter(Boolean);
    let byMuscle = {};
    if (sessIds.length) {
      const ex = await service.from('exercises')
        .select('id,muscle_group')
        .in('id', sessIds);
      if (ex.error) throw ex.error;
      const map = Object.fromEntries((ex.data||[]).map(e=>[e.id, e.muscle_group || 'other']));
      (ss.data||[]).forEach(s=>{
        const g = map[s.exercise_id] || 'other';
        byMuscle[g] = (byMuscle[g]||0) + Number(s.duration_min||0);
      });
    }

    // số buổi trong tuần hiện tại
    const weekStart = new Date();
    weekStart.setDate(today.getDate() - ((today.getDay()+6)%7));
    const weekKeyStart = weekStart.toISOString().slice(0,10);
    const thisWeekCount = (ss.data||[]).filter(r => r.date >= weekKeyStart).length;

    res.json({
      range,
      start: startIso.slice(0,10),
      end: endIso.slice(0,10),
      totalMinutes, totalCalories,
      sessionsThisWeek: thisWeekCount,
      bars: Object.values(days),        // [{date,minutes,calories}]
      byMuscle                           // {chest: 80, back: 40, ...} (tính theo phút)
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});
// ===== EXERCISES: search + filter =====
const toList = v =>
  Array.isArray(v) ? v
  : v == null ? []
  : typeof v === 'string' ? v.split(',').map(s=>s.trim()).filter(Boolean)
  : typeof v === 'object' ? Object.values(v)
  : [];

const norm = s => String(s || '').trim().toLowerCase();

// ===== DB-ONLY FILTER (không dùng catalog) =====
app.get('/api/exercises', requireAuth, async (req, res) => {
  try {
    // client gửi: muscle, category, equipment, level, q, goal (goal là optional)
    const q         = (req.query.q || '').toString().trim();
    const muscle    = (req.query.muscle || '').toString().trim();      // ex: back
    const category  = (req.query.category || '').toString().trim();    // strength|cardio|yoga...
    const equipment = (req.query.equipment || '').toString().trim();   // machine|cable|...
    const level     = (req.query.level || '').toString().trim();       // beginner|...
    const goal      = (req.query.goal || '').toString().trim();        // nếu bảng bạn KHÔNG có cột goals, sẽ bị bỏ qua

    // Query phần chắc chắn bằng SQL
    let qb = service.from('exercises')
      .select('id,name,met,level,cues,note,muscle_group,category,equipment,recommend');

    if (q)        qb = qb.ilike('name', `%${q}%`);
    if (muscle)   qb = qb.ilike('muscle_group', norm(muscle));             // case-insensitive
    if (category) qb = qb.ilike('category',     norm(category));
    if (level)    qb = qb.ilike('level',        norm(level));
    if (equipment)qb = qb.ilike('equipment',    `%${norm(equipment)}%`);   // hỗ trợ CSV/string

    const { data, error } = await qb.limit(500);
    if (error) throw error;

    // Hậu lọc bổ sung (trường hợp equipment lưu dạng CSV/json/array)
    const rows = (data || []).filter(r => {
      if (equipment) {
        const eq = toList(r.equipment).map(norm);
        if (!eq.includes(norm(equipment))) return false;
      }
      // goal: chỉ lọc nếu bảng có cột 'goals' (ở schema bạn hiện tại KHÔNG có), nên bỏ qua
      return true;
    });

    // Chuẩn hoá output cho client
    res.json(rows.map(r => ({
      id: r.id,
      name: r.name,
      met: r.met ?? null,
      level: r.level ?? null,
      cues: r.cues ?? r.note ?? null,
      muscle_group: r.muscle_group,
      category: r.category,
      equipment: toList(r.equipment),
      recommend: r.recommend || null,
    })));
  } catch (e) {
    console.error('GET /api/exercises', e);
    res.status(400).json({ error: e.message || 'Internal error' });
  }
});


// Favorite toggle
app.post('/api/exercises/:id/favorite', requireAuth, async (req, res) => {
  try {
    const uid = req.uid, id = Number(req.params.id);
    const chk = await service.from('exercise_favorites').select('*').eq('uid', uid).eq('exercise_id', id).maybeSingle();
    if (!chk.error && chk.data) {
      const del = await service.from('exercise_favorites').delete().eq('uid', uid).eq('exercise_id', id);
      if (del.error) throw del.error;
      return res.json({ ok: true, favorite: false });
    }
    const ins = await service.from('exercise_favorites').insert({ uid, exercise_id: id }).select().maybeSingle();
    if (ins.error) throw ins.error;
    res.json({ ok: true, favorite: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});
// ===== PLANS: list / create / detail =====
app.get('/api/workouts/plans', requireAuth, async (req, res) => {
  try {
    const uid = req.uid;
    const q = await service.from('workout_plans')
      .select('id,title,goal,start_date,is_active,created_at')
      .eq('uid', uid).order('created_at', { ascending:false });
    if (q.error) throw q.error;
    res.json(q.data||[]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get('/api/workouts/plans/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const plan = await service.from('workout_plans').select('*').eq('id', id).maybeSingle();
    if (plan.error) throw plan.error;
    const days = await service.from('workout_plan_days').select('*').eq('plan_id', id);
    if (days.error) throw days.error;
    const items = await service.from('workout_plan_items').select('*, exercises(name,muscle_group)').eq('plan_id', id).order('order_no');
    if (items.error) throw items.error;
    res.json({ ...plan.data, days: days.data||[], items: items.data||[] });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/workouts/plans', requireAuth, async (req, res) => {
  try {
    const uid = req.uid;

    // Nếu body là string thì parse, còn lại dùng thẳng object
    const payload =
      typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

    const {
      title,
      goal = 'maintain',
      start_date,
      days = [],
    } = payload;

    // Tạo plan
    const p = await service
      .from('workout_plans')
      .insert({ uid, title, goal, start_date })
      .select()
      .single();

    if (p.error) throw p.error;
    const planId = p.data.id;

    // days: [{ dow, note, items:[{ exercise_id, sets, reps, duration_min, rest_sec, order_no }] }]
    for (const [idx, d] of (Array.isArray(days) ? days : []).entries()) {
      const dayIns = await service
        .from('workout_plan_days')
        .insert({
          plan_id: planId,
          dow: d?.dow ?? ((idx % 7) + 1),
          note: d?.note ?? null,
        })
        .select()
        .single();

      if (dayIns.error) throw dayIns.error;
      const dayId = dayIns.data.id;

      for (const [iIdx, i] of (Array.isArray(d?.items) ? d.items : []).entries()) {
        const row = {
          plan_id: planId,
          day_id: dayId,
          exercise_id: i.exercise_id,
          sets: i.sets ?? 3,
          reps: i.reps ?? 12,
          duration_min: i.duration_min ?? null,
          rest_sec: i.rest_sec ?? 60,
          order_no: i.order_no ?? (iIdx + 1),
        };
        const it = await service.from('workout_plan_items').insert(row);
        if (it.error) throw it.error;
      }
    }

    res.json({ ok: true, id: planId });
  } catch (e) {
    console.error('POST /api/workouts/plans', e);
    res.status(400).json({ error: e.message || 'Internal error' });
  }
});

// ===== RECOMMENDATION from BMI & goal =====
app.get('/api/workouts/recommend', requireAuth, async (req, res) => {
  try {
    const uid = req.uid;
    const prof = await service.from('profiles').select('height_cm,weight_kg,goal').eq('uid', uid).maybeSingle();
    const h = Number(prof.data?.height_cm||0)/100, w = Number(prof.data?.weight_kg||0);
    const goal = (prof.data?.goal||'maintain');

    let bmiClass = 'normal';
    if (h>0 && w>0) {
      const bmi = w/(h*h);
      if (bmi < 18.5) bmiClass='under';
      else if (bmi>=25) bmiClass='over';
    }

    // cực gọn: map sang template ngày
    const by = (g) => ({category: g});
    let program;
    if (bmiClass==='over' || goal==='lose') {
      program = [
        { title:'Ngày 1: Cardio + Core', items:[ by('cardio'), by('cardio'), by('stretch') ]},
        { title:'Ngày 2: Fullbody nhẹ', items:[ by('strength'), by('strength'), by('stretch') ]},
        { title:'Ngày 3: Nghỉ/Stretch', items:[ by('stretch') ]},
        { title:'Ngày 4: Cardio Intervals', items:[ by('cardio'), by('cardio') ]},
        { title:'Ngày 5: Upper', items:[ by('strength'), by('strength') ]},
      ];
    } else if (bmiClass==='under' || goal==='gain') {
      program = [
        { title:'Ngày 1: Push (Ngực-Vai-Tay sau)', items:[ by('strength'), by('strength') ]},
        { title:'Ngày 2: Pull (Lưng-Tay trước)', items:[ by('strength'), by('strength') ]},
        { title:'Ngày 3: Legs', items:[ by('strength'), by('strength') ]},
        { title:'Ngày 4: Core + Stretch', items:[ by('stretch') ]},
      ];
    } else {
      program = [
        { title:'Ngày 1: Upper', items:[ by('strength'), by('strength') ]},
        { title:'Ngày 2: Cardio nhẹ', items:[ by('cardio') ]},
        { title:'Ngày 3: Lower', items:[ by('strength'), by('strength') ]},
        { title:'Ngày 4: Stretch/Yoga', items:[ by('stretch') ]},
      ];
    }

    // pick exercises theo category
    async function pick(category, n=1){
      const q = await service.from('exercises').select('id').eq('category', category).limit(20);
      const arr = (q.data||[]).map(x=>x.id);
      const out = [];
      for (let i=0;i<n;i++) if (arr.length) out.push(arr[(Math.random()*arr.length)|0]);
      return out;
    }
    const days = [];
    let dow = 1;
    for (const d of program) {
      const chosen = [];
      for (const it of d.items) {
        const ids = await pick(it.category, 1);
        if (ids[0]) chosen.push({ exercise_id: ids[0], sets: 3, reps: 12 });
      }
      days.push({ dow, note: d.title, items: chosen });
      dow = (dow%7)+1;
    }

    res.json({ goal, bmiClass, days });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

