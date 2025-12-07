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
    const kwNorm = kw.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

    let q = service
      .from('foods')
      .select('id,name_vi,portion_g,kcal,protein_g,carbs_g,fiber_g,fat_g,tags')
      .order('name_vi', { ascending: true })
      .limit(limit);

    if (kw) {
      // nếu chưa tạo name_search thì fallback sang ilike 1 trường
      q = q.or(`name_vi.ilike.%${kw}%,name_search.ilike.%${kwNorm}%`);
      // fallback:
      // q = q.ilike('name_vi', `%${kw}%`);
    }

    const { data, error } = await q;
    if (error) throw error;
    res.json(data || []);
  } catch (e) {
    console.error('[GET /api/foods] error:', e);
    res.status(400).json({ error: e.message || 'Internal error' });
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
  try {
    const uid = req.uid;
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const rows = Array.isArray(body) ? body : (body ? [body] : null);
    if (!rows || rows.length === 0) return res.status(400).json({ error: 'expected JSON array' });

    // validate mềm: time_of_day bắt buộc, dow nếu có phải là mảng
    for (const r of rows) {
      if (!r?.time_of_day) return res.status(400).json({ error: 'time_of_day required' });
      if (r?.dow && !Array.isArray(r.dow)) return res.status(400).json({ error: 'dow must be an array of ints' });
    }

    const payload = rows.map(r => ({
      uid,
      time_of_day: r.time_of_day,
      note: r.note || null,
      plan_id: r.plan_id || null,
      dow: r.dow || null
    }));

    const ins = await service.from('workout_reminders').insert(payload).select();
    if (ins.error) throw ins.error;

    res.status(201).json(ins.data || []);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/workouts/reminders/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { error } = await service.from('workout_reminders').delete().eq('id', id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
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
      const prof = await service.from('profiles').select('weight_kg').eq('uid', uid).maybeSingle();
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
    const { date } = req.query;
    const r = await service.from('sleep_logs')
      .select('id,date,duration_min,start_time,end_time,quality,awake_count,note')
      .eq('uid', req.uid)
      .eq('date', date);
    if (r.error) throw r.error;
    res.json(r.data || []);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/sleep/logs', requireAuth, async (req, res) => {
  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const ins = await service.from('sleep_logs').insert({
      uid: req.uid,
      date: b.date,
      duration_min: b.duration_min,
      start_time: b.start_time || null,
      end_time: b.end_time || null,
      quality: b.quality || null,
      awake_count: b.awake_count || null,
      note: b.note || null
    }).select().maybeSingle();
    if (ins.error) throw ins.error;
    res.status(201).json(ins.data);
  } catch (e) { res.status(400).json({ error: e.message }); }
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
      const { date, amount_ml, drink_name } = req.body || {}; // dùng trực tiếp req.body
      if (!date || !amount_ml) {
        return res.status(400).json({ error: 'date & amount_ml required' });
      }

      const { data, error } = await service
        .from('hydration_logs')
        .insert({  uid, date, amount_ml: Number(amount_ml) })
        .select()
        .maybeSingle();

      if (error) throw error;
      res.status(201).json(data);
    } catch (e) {
      res.status(400).json({ error: e.message || 'Bad Request' });
    }
  });

app.post('/api/medications', requireAuth, async (req, res) => {
  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const ins = await service.from('medications').insert({
      uid: req.uid,
      name: b.name,
      dose: b.dose || null,
      schedule_time: b.schedule_time || null,
      schedule_dows: b.schedule_dows || null,
      active: true
    }).select().maybeSingle();
    if (ins.error) throw ins.error;
    res.status(201).json(ins.data);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
app.post('/api/medications/logs', requireAuth, async (req, res) => {
  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const ins = await service.from('medication_logs').insert({
      uid: req.uid,
      med_id: b.med_id,
      date: b.date,
      status: b.status,
      note: b.note || null
    }).select().maybeSingle();
    if (ins.error) throw ins.error;
    res.status(201).json(ins.data);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get('/api/medications/today', requireAuth, async (req, res) => {
  try {
    const { date } = req.query;

    // Lấy danh sách thuốc active
    const medsR = await service.from('medications')
      .select('id,name,dose,schedule_time,schedule_dows,active')
      .eq('uid', req.uid)
      .eq('active', true);
    if (medsR.error) throw medsR.error;
    const meds = medsR.data || [];

    // Lấy trạng thái uống trong ngày từ medication_logs (nếu có)
    const logsR = await service.from('medication_logs')
      .select('med_id,status')
      .eq('uid', req.uid)
      .eq('date', date);
    if (logsR.error) throw logsR.error;
    const byMed = {};
    for (const l of (logsR.data || [])) byMed[l.med_id] = l.status;

    // Lọc theo day-of-week nếu có schedule_dows
    const dow = ((new Date(date).getDay() + 6) % 7) + 1; // Mon=1..Sun=7
    const result = meds
      .filter(m => Array.isArray(m.schedule_dows) ? m.schedule_dows.includes(dow) : true)
      .map(m => ({ ...m, taken: byMed[m.id] === 'taken' }));

    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/health/notes', requireAuth, async (req, res) => {
  try {
    const { date } = req.query;
    const r = await service.from('health_notes')
      .select('id,date,mood_score,stress_score,note')
      .eq('uid', req.uid)
      .eq('date', date);
    if (r.error) throw r.error;
    res.json(r.data || []);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/health/notes', requireAuth, async (req, res) => {
  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const ins = await service.from('health_notes').insert({
      uid: req.uid,
      date: b.date,
      mood_score: b.mood_score || null,
      stress_score: b.stress_score || null,
      note: b.note || null
    }).select().maybeSingle();
    if (ins.error) throw ins.error;
    res.status(201).json(ins.data);
  } catch (e) { res.status(400).json({ error: e.message }); }
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
// ====== API GỢI Ý THỰC ĐƠN THÔNG MINH ======
// Thay THAY ĐOẠN /api/recs/mealplan hiện tại bằng đoạn sau

app.get('/api/recs/mealplan', requireAuth, async (req, res) => {
  try {
    const uid = req.uid;
    const prof = await service
      .from('profiles')
      .select('height_cm,weight_kg,goal,kcal_target')
      .eq('uid', uid)
      .maybeSingle();

    if (prof.error) throw prof.error;
    const p = prof.data || {};
    const h = Number(p.height_cm || 0);
    const w = Number(p.weight_kg || 0);
    if (!h || !w) {
      return res.status(400).json({ error: 'Vui lòng cập nhật chiều cao và cân nặng' });
    }

    const goal = (p.goal || 'maintain').toLowerCase();
    const kcalTarget = p.kcal_target && p.kcal_target > 0
      ? Math.round(p.kcal_target)
      : Math.round((goal === 'lose' ? 28 : goal === 'gain' ? 34 : 31) * w);

    // Macro target ngày (đơn giản)
    const ratio =
      goal === 'gain' ? { p:0.25, c:0.45, f:0.30 } :
      goal === 'lose' ? { p:0.35, c:0.35, f:0.30 } :
                        { p:0.30, c:0.45, f:0.25 };
    const target = {
      p: Math.round((kcalTarget * ratio.p) / 4),
      c: Math.round((kcalTarget * ratio.c) / 4),
      f: Math.round((kcalTarget * ratio.f) / 9),
    };

    // Phân bổ kcal cho bữa
    const mealDefs = [
      { key:'breakfast', name:'Bữa sáng', portion:0.25 },
      { key:'lunch',     name:'Bữa trưa', portion:0.35 },
      { key:'dinner',    name:'Bữa tối',  portion:0.30 },
      { key:'snack',     name:'Bữa phụ',  portion:0.10 },
    ];

    // Lấy toàn bộ foods
    const foodsR = await service
      .from('foods')
      .select('id,name_vi,portion_g,kcal,protein_g,carbs_g,fiber_g,fat_g');
    if (foodsR.error) throw foodsR.error;
    const foods = (foodsR.data || []).filter(f => f.kcal && f.portion_g);

    if (!foods.length) {
      return res.status(400).json({ error: 'Chưa có dữ liệu món ăn' });
    }

    // Phân nhóm động
    const groups = {
      protein: [],
      carb: [],
      fiber: [],
      energy: [],
      balanced: []
    };

    for (const f of foods) {
      const kcal = f.kcal;
      const pG = f.protein_g || 0;
      const cG = f.carbs_g || 0;
      const fiG = f.fiber_g || 0;
      const fatG = f.fat_g || 0;

      const pRatio = pG*4 / (kcal || 1);
      const cRatio = cG*4 / (kcal || 1);

      // Quy tắc đơn giản
      if (pG >= 8 && pRatio >= 0.25) groups.protein.push(f);
      if (cG >= 15 || cRatio >= 0.40) groups.carb.push(f);
      if (fiG >= 2 || (kcal <= 70 && pG < 6 && cG < 10)) groups.fiber.push(f);
      if (fatG >= 10 || kcal >= 180) groups.energy.push(f);

      // Balanced nếu có cả chút protein + carb
      if (pG >= 5 && cG >= 10 && kcal <= 400) groups.balanced.push(f);
    }

    // Hàm trộn random nhẹ (Fisher-Yates)
    function shuffle(arr) {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }

    // Score helper (jitter để thay đổi mỗi lần)
    function scoreProtein(f) {
      return ( (f.protein_g*4)/(f.kcal||1) ) + (f.fiber_g||0)*0.1 - (f.fat_g||0)*0.01 + Math.random()*0.3;
    }
    function scoreCarb(f) {
      return ( (f.carbs_g*4)/(f.kcal||1) ) + (f.fiber_g||0)*0.05 + Math.random()*0.3;
    }
    function scoreFiber(f) {
      return (f.fiber_g||0)*0.6 - (f.kcal||0)*0.002 + Math.random()*0.3;
    }
    function scoreBalanced(f) {
      const p = f.protein_g||0, c = f.carbs_g||0;
      const delta = Math.abs(p - c);
      return ((p*4 + c*4)/(f.kcal||1))*0.5 + (f.fiber_g||0)*0.2 - delta*0.05 + Math.random()*0.3;
    }

    function pickSorted(group, scorer) {
      return shuffle(group).sort((a,b) => scorer(b) - scorer(a));
    }

    const used = new Set();
    const mealsOut = [];

    for (const md of mealDefs) {
      const kcalMeal = kcalTarget * md.portion;
      const items = [];

      // Template chọn theo bữa
      if (md.key === 'breakfast') {
        // Ưu tiên carb + protein + fiber
        const carbList = pickSorted(groups.carb, scoreCarb);
        const protList = pickSorted(groups.protein, scoreProtein);
        const fibList  = pickSorted(groups.fiber, scoreFiber);

        function take(list) {
          for (const f of list) {
            if (used.has(f.id)) continue;
            used.add(f.id);
            items.push(f);
            return;
          }
        }
        take(carbList);
        take(protList);
        take(fibList);
        if (goal === 'gain' && items.length < 4) {
          take(pickSorted(groups.energy, scoreBalanced));
        }
      } else if (md.key === 'lunch') {
        const protList = pickSorted(groups.protein, scoreProtein);
        const carbList = pickSorted(groups.carb, scoreCarb);
        const fibList  = pickSorted(groups.fiber, scoreFiber);
        const balList  = pickSorted(groups.balanced, scoreBalanced);

        const order = [protList, carbList, fibList, balList];
        for (const list of order) {
          for (const f of list) {
            if (items.length >= 3) break;
            if (used.has(f.id)) continue;
            used.add(f.id);
            items.push(f);
            break;
          }
        }
      } else if (md.key === 'dinner') {
        // Protein + Fiber + (gain → energy | maintain/lose → balanced hoặc carb nhỏ)
        const protList = pickSorted(groups.protein, scoreProtein);
        const fibList  = pickSorted(groups.fiber, scoreFiber);
        const energyList = pickSorted(groups.energy, scoreBalanced);
        const balList  = pickSorted(groups.balanced, scoreBalanced);
        const carbList = pickSorted(groups.carb, scoreCarb);

        function take(list) {
          for (const f of list) {
            if (used.has(f.id)) continue;
            used.add(f.id);
            items.push(f);
            return;
          }
        }
        take(protList);
        take(fibList);
        if (goal === 'gain') take(energyList);
        else {
          take(balList.length ? balList : carbList);
        }
      } else { // snack
        // lose: protein/fiber; gain: energy + protein; maintain: balanced/protein
        const protList = pickSorted(groups.protein, scoreProtein);
        const fibList  = pickSorted(groups.fiber, scoreFiber);
        const energyList = pickSorted(groups.energy, scoreBalanced);
        const balList = pickSorted(groups.balanced, scoreBalanced);

        function take(list) {
          for (const f of list) {
            if (used.has(f.id)) continue;
            used.add(f.id);
            items.push(f);
            return;
          }
        }

        if (goal === 'lose') {
          take(protList);
          take(fibList);
        } else if (goal === 'gain') {
          take(energyList);
          take(protList);
        } else {
          take(balList);
          take(protList);
        }
      }

      // Tính tổng kcal hiện tại
      let currentKcal = items.reduce((s,f)=>s + (f.kcal||0), 0);

      // Scale nếu thiếu quá nhiều so với target (không scale rau cực nhỏ)
      if (currentKcal < kcalMeal * 0.75 && currentKcal > 0) {
        const scale = Math.min(1.6, kcalMeal / currentKcal); // tối đa nhân 1.6
        currentKcal = 0;
        for (let i=0;i<items.length;i++) {
          const f = items[i];
            const newGrams = Math.round((f.portion_g || 100) * scale);
            // giữ nguyên macro chỉ cần quy đổi theo scale (cách đơn giản: nhân)
            items[i] = {
              ...f,
              portion_g: newGrams,
              _scaled: true
            };
            currentKcal += (f.kcal||0) * scale;
        }
      }

      // Đưa sang format output
      const outItems = items.map(f => ({
        food: f.name_vi,
        grams: Math.round(f.portion_g || 100),
        kcal: Math.round(f.kcal || 0),
        p: Math.round(f.protein_g || 0),
        c: Math.round(f.carbs_g || 0),
        f: Math.round(f.fat_g || 0),
        fiber: Math.round(f.fiber_g || 0),
        scaled: !!f._scaled
      }));

      mealsOut.push({ name: md.name, items: outItems });
    }

    res.json({
      goal,
      kcal_target: kcalTarget,
      target,
      meals: mealsOut
    });
  } catch (e) {
    console.error('[mealplan improved] error:', e);
    res.status(500).json({ error: e.message || 'Internal error' });
  }
});

// ====== MEAL PLANS: Lưu/Đọc kế hoạch ======
app.post('/api/nutrition/mealplans', requireAuth, async (req, res) => {
  try {
    const uid = req.uid;
    const { title, goal, kcal_target, target, meals } = req.body;
    
    if (!title || !meals || !Array.isArray(meals)) {
      return res.status(400).json({ error: 'title và meals bắt buộc' });
    }
    
    // Tạo plan
    const planR = await service.from('meal_plans').insert({
      uid,
      title: title.trim(),
      goal: goal || 'maintain',
      kcal_target: kcal_target || null,
      protein_target: target?.p || null,
      carbs_target: target?.c || null,
      fat_target: target?.f || null,
    }).select().single();
    
    if (planR.error) throw planR.error;
    const planId = planR.data.id;
    
    // Lưu items
    for (const meal of meals) {
      if (!meal.name || !meal.items || !Array.isArray(meal.items)) continue;
      
      for (const item of meal.items) {
        await service.from('meal_plan_items').insert({
          plan_id: planId,
          meal_type: meal.name,
          food_name: item.food,
          grams: item.grams || 100,
          kcal: item.kcal || 0,
          protein_g: item.p || 0,
          carbs_g: item.c || 0,
          fat_g: item.f || 0,
        });
      }
    }
    
    res.json({ ok: true, id: planId, message: 'Đã lưu kế hoạch' });
    
  } catch (e) {
    console.error('POST /api/nutrition/mealplans', e);
    res.status(500).json({ error: e.message });
  }
});

// Lấy danh sách plans
app.get('/api/nutrition/mealplans', requireAuth, async (req, res) => {
  try {
    const uid = req.uid;
    const limit = Math.min(Number(req.query.limit || 50), 100); // KHAI BÁO 'limit'  <-- thêm dòng này

    const { data, error } = await service
      .from('meal_plans')
      .select('id,title,goal,kcal_target,created_at')
      .eq('uid', uid)
      .order('created_at', { ascending: false })
      .limit(limit); // DÙNG biến đã khai báo

    if (error) throw error;
    res.json(data || []);
  } catch (e) {
    console.error('GET /api/nutrition/mealplans error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Chi tiết 1 plan
app.get('/api/nutrition/mealplans/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const uid = req.uid;
    
    const planR = await service.from('meal_plans')
      .select('*')
      .eq('id', id)
      .eq('uid', uid)
      .single();
    
    if (planR.error) throw planR.error;
    
    const itemsR = await service.from('meal_plan_items')
      .select('*')
      .eq('plan_id', id)
      .order('id');
    
    if (itemsR.error) throw itemsR.error;
    
    // Group theo meal_type
    const meals = {};
    for (const item of itemsR.data || []) {
      const type = item.meal_type || 'Khác';
      if (!meals[type]) meals[type] = { name: type, items: [] };
      meals[type].items.push({
        food: item.food_name,
        grams: item.grams,
        kcal: item.kcal,
        p: item.protein_g,
        c: item.carbs_g,
        f: item.fat_g,
      });
    }
    
    res.json({ ...planR.data, meals: Object.values(meals) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
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



// Cập nhật thể trạng (chiều cao/cân nặng) + tính BMI
app.post('/api/profile/body', requireAuth, async (req, res) => {
  try {
    const uid = req.uid;
    const body = z.object({
      height_cm: z.coerce.number().positive().max(300),
      weight_kg: z.coerce.number().positive().max(500),
      phone: z.string().optional()
    }).parse(req.body);

    const h = body.height_cm;
    const w = body.weight_kg;
    const bmi = h && w ? Number((w / Math.pow(h / 100, 2)).toFixed(1)) : null;
    let bmi_cat = null;
    if (bmi != null) {
      bmi_cat = bmi < 18.5 ? 'gầy'
        : bmi < 23 ? 'bình thường'
        : bmi < 27.5 ? 'thừa cân'
        : 'béo phì';
    }

    const up = await service.from('profiles').upsert({
      uid,
      height_cm: h,
      weight_kg: w,
      bmi,
      bmi_cat,
      phone: body.phone ?? null,
      updated_at: new Date().toISOString()
    }, { onConflict: 'uid' }).select().single();
    if (up.error) throw up.error;

    // Ghi vào weight_logs để theo dõi lịch sử
    await service.from('weight_logs').upsert({
      uid,
      date: new Date().toISOString().slice(0,10),
      weight_kg: w
    }, { onConflict: 'uid,date' });

    res.json({ ...up.data, email: req.user_email });
  } catch (e) {
    console.error('[POST /api/profile/body] error:', e);
    res.status(400).json({ error: e.message });
  }
});

// ====== PROFILE & METRICS ======
// HỢP NHẤT /api/profile — đặt ở vị trí cũ (xóa cả hai bản cũ trước)
app.get('/api/profile', requireAuth, async (req, res) => {
  try {
    const uid = req.uid;
    const ensure = await service
      .from('profiles')
      .upsert({ uid }, { onConflict: 'uid' })
      .select()
      .maybeSingle();
    if (ensure.error) throw ensure.error;

    const { data, error } = await service
      .from('profiles')
      .select('*')
      .eq('uid', uid)
      .maybeSingle();
    if (error) throw error;

    const h = Number(data?.height_cm || 0);
    const w = Number(data?.weight_kg || 0);
    const bmi = h && w ? Number((w / Math.pow(h / 100, 2)).toFixed(1)) : null;

    const act = data.activity_level || 'light';
    const actMult = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725,
      athlete: 1.9,
    }[act] || 1.375;

    let tdee = null;
    if (bmi && data.birth_year && data.sex) {
      const age = new Date().getUTCFullYear() - Number(data.birth_year);
      const sexAdj = data.sex === 'male' ? 5 : data.sex === 'female' ? -161 : -78;
      const bmr = 10 * w + 6.25 * h - 5 * age + sexAdj;
      tdee = Math.round(bmr * actMult);
    }

    res.json({ ...data, bmi, tdee, email: req.user_email || null });
  } catch (e) {
    console.error('[GET /api/profile] error:', e);
    res.status(400).json({ error: e.message });
  }
});


app.put('/api/profile', requireAuth, async (req, res) => {
  try {
    const uid = req.uid;

    const body = z.object({
      display_name: z.string().optional(),
      phone: z.string().optional(),
      height_cm: z.coerce.number().positive().optional(),
      weight_kg: z.coerce.number().positive().optional(),
      sex: z.enum(['male','female','other']).optional(),
      birth_year: z.coerce.number().int().min(1900).max(new Date().getUTCFullYear()).optional(),
      activity_level: z.enum(['sedentary','light','moderate','active','athlete']).optional(),
      goal: z.enum(['lose','maintain','gain']).optional(),
      kcal_target: z.coerce.number().int().positive().optional()
    }).parse(req.body);

    // 1) Upsert các trường gửi lên
    const up = await service
      .from('profiles')
      .upsert({ uid, ...body })
      .select()
      .single();
    if (up.error) throw up.error;

    // 2) Nếu có weight_kg mới → ghi log cân nặng trong ngày
    if (body.weight_kg) {
      await service.from('weight_logs').upsert({
        uid,
        date: new Date().toISOString().slice(0,10),
        weight_kg: body.weight_kg
      }, { onConflict: 'uid,date' });
    }

    // 3) Đọc lại profile đầy đủ và tính BMI/TDEE để trả về
    const prof = await service
      .from('profiles')
      .select('*')
      .eq('uid', uid)
      .maybeSingle();
    if (prof.error) throw prof.error;

    const data = prof.data || {};
    const h = Number(data.height_cm || 0);
    const w = Number(data.weight_kg || 0);
    const bmi = h && w ? Number((w / Math.pow(h / 100, 2)).toFixed(1)) : null;

    const act = data.activity_level || 'light';
    const actMult = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725,
      athlete: 1.9,
    }[act] || 1.375;

    let tdee = null;
    if (bmi && data.birth_year) {
      const age = new Date().getUTCFullYear() - Number(data.birth_year);
      const sexAdj = data.sex === 'male' ? 5 : data.sex === 'female' ? -161 : -78;
      const bmr = 10 * w + 6.25 * h - 5 * age + sexAdj;
      tdee = Math.round(bmr * actMult);
    }

    return res.json({ ...data, bmi, tdee, email: req.user_email || null });
  } catch (e) {
    console.error('PUT /api/profile error:', e);
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
  try {
    const uid = req.uid;
    const variant = (req.query.variant || 'balanced').toString().toLowerCase(); // cardio|strength|balanced

    const profR = await service
      .from('profiles')
      .select('height_cm,weight_kg,goal,sex,birth_year,activity_level')
      .eq('uid', uid)
      .maybeSingle();
    if (profR.error) throw profR.error;
    const p = profR.data || {};

    const h = Number(p.height_cm || 0);
    const w = Number(p.weight_kg || 0);
    const goal = (p.goal || 'maintain').toLowerCase();
    const act = (p.activity_level || 'light').toLowerCase();
    const age = p.birth_year ? (new Date().getUTCFullYear() - Number(p.birth_year)) : null;
    const sexAdj = p.sex === 'male' ? 5 : p.sex === 'female' ? -161 : -78;
    const actFactor = {
      sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, athlete: 1.9
    }[act] || 1.375;

    let bmr = null, tdee = null;
    if (h && w && age && p.sex) {
      bmr = Math.round(10*w + 6.25*h - 5*age + sexAdj);
      tdee = Math.round(bmr * actFactor);
    }
    // Fallback TDEE nếu thiếu
    if (!tdee) {
      tdee = Math.round((24 * w) * actFactor);
      bmr = Math.round(24 * w * 0.7); // gần đúng
    }

    // Calories IN target (nạp)
    const deltaGoal = goal === 'lose' ? -300 : goal === 'gain' ? 300 : 0;
    const dailyConsumeTarget = tdee + deltaGoal;

    // Daily burn target
    let focus = goal === 'lose' ? 0.65 : goal === 'gain' ? 0.45 : 0.55;
    let dailyBurnTarget;
    if (bmr) {
      dailyBurnTarget = Math.round((tdee - bmr) * focus);
    } else {
      const baseMul = goal === 'lose' ? 6 : goal === 'gain' ? 4 : 5;
      dailyBurnTarget = Math.round(w * baseMul);
    }
    if (dailyBurnTarget < 120) dailyBurnTarget = 120; // sàn

    // BMI class (cho đa dạng lịch)
    let bmiClass = 'normal';
    if (h && w) {
      const bmi = w / Math.pow(h/100, 2);
      if (bmi < 18.5) bmiClass = 'under';
      else if (bmi >= 27) bmiClass = 'over';
      else if (bmi >= 25) bmiClass = 'over';
    }

    // Lấy toàn bộ exercises
    const exR = await service
      .from('exercises')
      .select('id,name,muscle_group,category,equipment,met,recommend')
      .limit(600);
    if (exR.error) throw exR.error;
    const all = (exR.data || []).filter(x => x.id);

    // Phân nhóm
    const byCat = {};
    for (const e of all) {
      const k = (e.category || 'other').toLowerCase();
      (byCat[k] || (byCat[k] = [])).push(e);
    }
    function shuffle(a) {
      const s = [...a];
      for (let i=s.length-1;i>0;i--){
        const j = (Math.random()*(i+1))|0;
        [s[i],s[j]]=[s[j],s[i]];
      }
      return s;
    }

    // Chọn danh mục ưu tiên theo variant
    let primaryCatOrder;
    if (variant === 'cardio')      primaryCatOrder = ['cardio','strength','stretch','yoga'];
    else if (variant === 'strength') primaryCatOrder = ['strength','cardio','stretch','yoga'];
    else                            primaryCatOrder = ['strength','cardio','core','stretch','yoga','fullbody'];

    // Template ngày (có thể điều chỉnh theo goal/bmiClass)
    let template = [
      { title:'Ngày 1: Upper / Strength', focus:'strength' },
      { title:'Ngày 2: Cardio / Intervals', focus:'cardio' },
      { title:'Ngày 3: Lower / Strength', focus:'strength' },
      { title:'Ngày 4: Core + Cardio nhẹ', focus:'core' },
      { title:'Ngày 5: Fullbody', focus:'strength' },
      { title:'Ngày 6: Cardio + Stretch', focus:'cardio' },
      { title:'Ngày 7: Stretch/Yoga phục hồi', focus:'stretch' },
    ];
    if (goal === 'lose' || bmiClass === 'over') {
      template[2] = { title:'Ngày 3: Cardio dài + Lower nhẹ', focus:'cardio' };
    } else if (goal === 'gain' || bmiClass === 'under') {
      template[5] = { title:'Ngày 6: Upper phụ + Core', focus:'strength' };
    }

    const usedIds = new Set();
    function pickExercises(cat, n) {
      const list = shuffle(byCat[cat] || []);
      const out = [];
      for (const e of list) {
        if (out.length >= n) break;
        if (usedIds.has(e.id)) continue;
        usedIds.add(e.id);
        out.push(e);
      }
      return out;
    }

    // Ước tính thời lượng mỗi bài (dựa recommend hoặc default)
    function durationOf(e, defaultCardio=20, defaultStrength=12) {
      const rec = typeof e.recommend === 'string'
        ? (JSON.parse(e.recommend || '{}') || {})
        : (e.recommend || {});
      if ((e.category||'').toLowerCase() === 'cardio') {
        return Number(rec.duration_min || defaultCardio);
      }
      const sets = Number(rec.sets || 3);
      const reps = Number(rec.reps || 12);
      const rest = Number(rec.rest_sec || 60);
      // 5s/rep + rest
      const perSet = (reps*5)/60 + rest/60;
      return Math.max(8, Math.round(sets * perSet)); // phút
    }

    // Tạo lịch
    const days = [];
    let dow = 1;
    for (const t of template) {
      let dailyList = [];
      // Quy tắc số bài:
      const isCardio = t.focus === 'cardio';
      const count = isCardio ? 2 : 3;
      if (t.focus === 'core') {
        dailyList = pickExercises('strength', 2).concat(pickExercises('core',1));
      } else if (t.focus === 'stretch') {
        dailyList = pickExercises('stretch', 2).concat(pickExercises('yoga',1));
      } else if (t.focus === 'cardio') {
        dailyList = pickExercises('cardio', count);
        if (dailyList.length < count) dailyList = dailyList.concat(pickExercises('strength', count - dailyList.length));
      } else {
        dailyList = pickExercises('strength', count);
        if (dailyList.length < count) dailyList = dailyList.concat(pickExercises('cardio', count - dailyList.length));
      }

      // Tính tổng kcal ước tính cho buổi (theo MET)
      let totalWorkoutCalories = 0;
      const items = dailyList.map(e => {
        const minutes = durationOf(e);
        const met = Number(e.met || 5);
        const calories = Math.round(met * 3.5 * w / 200 * minutes); // công thức MET
        totalWorkoutCalories += calories;
        return {
          exercise_id: e.id,
          name: e.name,
          category: e.category,
          minutes,
          met,
          calories
        };
      });

      days.push({
        dow,
        note: t.title,
        calories_est: totalWorkoutCalories,
        items
      });
      dow = (dow % 7) + 1;
    }

    const weeklyCaloriesEst = days.reduce((s,d)=>s+d.calories_est,0);

    res.json({
      goal,
      bmiClass,
      variant,
      bmr,
      tdee,
      daily_consume_target: dailyConsumeTarget,
      daily_burn_target: dailyBurnTarget,
      weekly_burn_target: dailyBurnTarget * 5,
      weekly_calories_est: weeklyCaloriesEst,
      days
    });
  } catch (e) {
    console.error('[GET /api/recs/workouts v2] error:', e);
    res.status(400).json({ error: e.message || 'Internal error' });
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
// Route duy nhất cho /api/exercises (lọc + tìm kiếm)
app.get('/api/exercises', requireAuth, async (req, res) => {
  try {
    const q         = (req.query.q || '').toString().trim();
    const muscle    = (req.query.muscle || '').toString().trim();       // back, chest...
    const category  = (req.query.category || '').toString().trim();     // strength|cardio|yoga|stretching
    const equipment = (req.query.equipment || '').toString().trim();    // machine|dumbbell|...
    const level     = (req.query.level || '').toString().trim();        // beginner|intermediate|advanced
    const goal      = (req.query.goal || '').toString().trim();         // nếu sau này có cột goal

    // Map 'stretching' -> 'stretch' nếu DB lưu 'stretch'
    const catNorm = category.toLowerCase() === 'stretching' ? 'stretch' : category.toLowerCase();

    let qb = service
      .from('exercises')
      .select('id,name,met,level,cues,note,muscle_group,category,equipment,recommend');

    // Accent-insensitive (nếu đã có cột name_search tạo bằng trigger unaccent)
    if (q) {
      const qNorm = q.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
      qb = qb.or(`name.ilike.%${q}%,name_search.ilike.%${qNorm}%`);
      // Nếu CHƯA có name_search, dùng fallback:
      // qb = qb.ilike('name', `%${q}%`);
    }
    if (muscle)   qb = qb.ilike('muscle_group', muscle.toLowerCase());
    if (category && catNorm) qb = qb.ilike('category', catNorm);
    if (level)    qb = qb.ilike('level', level.toLowerCase());

    // equipment: lọc hậu kỳ để hỗ trợ CSV/array
    if (equipment) {
      // Chuẩn bị ilike sơ bộ để Supabase PostgREST không trả quá nhiều
      qb = qb.ilike('equipment', `%${equipment.toLowerCase()}%`);
    }

    const { data, error } = await qb.limit(500);
    if (error) throw error;

    // Hậu lọc equipment chuẩn
    let rows = data || [];
    if (equipment) {
      const ek = equipment.toLowerCase();
      rows = rows.filter(r => {
        if (!r.equipment) return ek === 'none';
        if (Array.isArray(r.equipment)) {
          return r.equipment.map(x=>String(x).toLowerCase()).includes(ek);
        }
        return String(r.equipment).toLowerCase().split(/[, ]+/).includes(ek);
      });
    }

    // Chuẩn hóa output
    const toList = v =>
      Array.isArray(v) ? v :
      !v ? [] :
      typeof v === 'string' ? v.split(/[, ]+/).filter(Boolean) :
      typeof v === 'object' ? Object.values(v) : [];

    res.json(rows.map(r => ({
      id: r.id,
      name: r.name,
      met: r.met ?? null,
      level: r.level ?? null,
      cues: r.cues || r.note || null,
      muscle_group: r.muscle_group || null,
      category: r.category || null,
      equipment: toList(r.equipment),
      recommend: r.recommend || null,
    })));
  } catch (e) {
    console.error('[GET /api/exercises] error:', e);
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
    if (!id) return res.status(400).json({ error: 'Invalid id' });

    // Lấy plan
    const planR = await service
      .from('workout_plans')
      .select('id,uid,title,goal,start_date,weeks,progression_rule,created_at')
      .eq('id', id)
      .maybeSingle();
    if (planR.error) throw planR.error;
    const plan = planR.data;
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    if (plan.uid !== req.uid) return res.status(403).json({ error: 'Forbidden' });

    // Lấy days (nếu có bảng)
    let days = [];
    const daysR = await service
      .from('workout_plan_days')
      .select('id,plan_id,dow,note')
      .eq('plan_id', id)
      .order('dow', { ascending: true });
    if (!daysR.error && Array.isArray(daysR.data)) {
      days = daysR.data;
    }

    // Lấy items (KHÔNG chọn cột không tồn tại)
    const itemsR = await service
      .from('workout_plan_items')
      .select('*, exercises(name,muscle_group)')
      .eq('plan_id', id)
      .order('order_no', { ascending: true });
    if (itemsR.error) throw itemsR.error;
    const rawItems = itemsR.data || [];

    // Gom items theo day id hoặc dow
    const byDayId = {};
    const byDow = {};

    for (const it of rawItems) {
      const dayId = it.plan_day_id ?? it.day_id ?? it.plan_day ?? it.day ?? null;
      const dow =
        Number(it.dow ?? it.weekday ?? it.day_of_week ?? (it.day && Number(it.day)) ?? NaN);
      const itemNorm = {
        id: it.id,
        exercise_id: it.exercise_id,
        name: it.exercises?.name || it.name || null,
        // Nếu có duration_min thì xem như cardio; còn lại strength
        category: (it.category || (it.duration_min ? 'cardio' : 'strength')).toLowerCase(),
        sets: it.sets ?? null,
        reps: it.reps ?? null,
        duration_min: it.duration_min ?? null,
        rest_sec: it.rest_sec ?? 60,
        order_no: it.order_no ?? 0,
      };

      if (dayId) {
        (byDayId[dayId] || (byDayId[dayId] = [])).push(itemNorm);
      } else if (!Number.isNaN(dow)) {
        const normDow = ((dow - 1 + 7) % 7) + 1; // 1..7
        (byDow[normDow] || (byDow[normDow] = [])).push(itemNorm);
      }
    }

    // Nếu có bảng days: gán items theo id; nếu không, tạo days từ dow
    let schedule = [];
    if (days.length > 0) {
      schedule = days.map(d => ({
        id: d.id,
        dow: Number(d.dow || 1),
        note: d.note || '',
        items: (byDayId[d.id] || []).sort((a, b) => (a.order_no || 0) - (b.order_no || 0)),
      }));
    } else {
      // fallback: build 1..7 từ byDow
      schedule = Array.from({ length: 7 }, (_, i) => {
        const dow = i + 1;
        return {
          id: null,
          dow,
          note: '',
          items: (byDow[dow] || []).sort((a, b) => (a.order_no || 0) - (b.order_no || 0)),
        };
      }).filter(d => d.items.length > 0);
    }

    // Bảo đảm sắp xếp theo dow tăng dần
    schedule.sort((a, b) => a.dow - b.dow);

    res.json({
      ...plan,
      days: schedule,
    });
  } catch (e) {
    console.error('GET /api/workouts/plans/:id error:', e);
    res.status(400).json({ error: e.message || 'Internal error' });
  }
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
// ===== Workout sets: create / list / update / delete =====
app.post('/api/workouts/sets', requireAuth, async (req, res) => {
  try {
    const uid = req.uid;
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { session_id, exercise_id, set_no, reps, weight_kg, rpe, note } = body;
    // Kiểm tra session thuộc uid
    const s = await service.from('workout_sessions').select('uid').eq('id', session_id).maybeSingle();
    if (s.error || !s.data || s.data.uid !== uid) return res.status(403).json({ error: 'Forbidden' });

    const ins = await service.from('workout_sets')
      .insert({ session_id, exercise_id, set_no, reps, weight_kg, rpe, note })
      .select().maybeSingle();
    if (ins.error) throw ins.error;

    // Cập nhật PR nếu là strength
    if (Number(reps) > 0 && Number(weight_kg) > 0) {
      const est1RM = Number(weight_kg) * (1 + Number(reps)/30);
      const cur = await service.from('pr_records')
        .select('id, weight_kg, reps').eq('uid', uid).eq('exercise_id', exercise_id)
        .order('weight_kg', { ascending: false }).limit(1);
      const shouldUpdate = !cur.error && (!cur.data?.length || est1RM > Number(cur.data[0]?.weight_kg || 0));
      if (shouldUpdate) {
        await service.from('pr_records').insert({
          uid, exercise_id, weight_kg: Number(weight_kg), reps: Number(reps), date: new Date().toISOString().slice(0,10)
        });
      }
    }

    res.status(201).json(ins.data);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get('/api/workouts/sets', requireAuth, async (req, res) => {
  try {
    const session_id = Number(req.query.session_id);
    if (!session_id) return res.status(400).json({ error: 'session_id required' });
    const uid = req.uid;
    const s = await service.from('workout_sessions').select('uid').eq('id', session_id).maybeSingle();
    if (s.error || !s.data || s.data.uid !== uid) return res.status(403).json({ error: 'Forbidden' });

    const rows = await service.from('workout_sets').select('*').eq('session_id', session_id).order('set_no');
    if (rows.error) throw rows.error;
    res.json(rows.data || []);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.patch('/api/workouts/sets/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const set = await service.from('workout_sets').select('session_id').eq('id', id).maybeSingle();
    if (set.error || !set.data) return res.status(404).json({ error: 'Not found' });
    const s = await service.from('workout_sessions').select('uid').eq('id', set.data.session_id).maybeSingle();
    if (s.error || !s.data || s.data.uid !== req.uid) return res.status(403).json({ error: 'Forbidden' });

    const up = await service.from('workout_sets').update(body).eq('id', id).select().maybeSingle();
    if (up.error) throw up.error;
    res.json(up.data);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/workouts/sets/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const set = await service.from('workout_sets').select('session_id').eq('id', id).maybeSingle();
    if (set.error || !set.data) return res.status(404).json({ error: 'Not found' });
    const s = await service.from('workout_sessions').select('uid').eq('id', set.data.session_id).maybeSingle();
    if (s.error || !s.data || s.data.uid !== req.uid) return res.status(403).json({ error: 'Forbidden' });

    const del = await service.from('workout_sets').delete().eq('id', id);
    if (del.error) throw del.error;
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ===== Training program progression preview =====
app.get('/api/workouts/plans/:id/progress', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const p = await service.from('workout_plans').select('uid,weeks,progression_rule').eq('id', id).maybeSingle();
    if (p.error || !p.data || p.data.uid !== req.uid) return res.status(403).json({ error: 'Forbidden' });
    const rule = p.data.progression_rule || { type:'percent', strength_inc:0.03, cardio_inc_min:2 };
    res.json({ weeks: p.data.weeks || 4, rule });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ===== Calendar scheduling =====
app.get('/api/workouts/calendar', requireAuth, async (req, res) => {
  try {
    const uid = req.uid;
    const from = (req.query.from || new Date().toISOString().slice(0,10)).toString();
    const to   = (req.query.to   || from).toString();
    const q = await service.from('workout_calendar').select('*').eq('uid', uid).gte('date', from).lte('date', to).order('date');
    if (q.error) throw q.error;
    res.json(q.data || []);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/workouts/calendar', requireAuth, async (req, res) => {
  try {
    const uid = req.uid;
    const { date, plan_id, note } = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    if (!date) return res.status(400).json({ error: 'date required' });
    const ins = await service.from('workout_calendar').insert({ uid, date, plan_id: plan_id || null, note: note || null }).select().maybeSingle();
    if (ins.error) throw ins.error;
    res.json(ins.data);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/workouts/calendar/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const row = await service.from('workout_calendar').select('uid').eq('id', id).maybeSingle();
    if (row.error || !row.data || row.data.uid !== req.uid) return res.status(403).json({ error: 'Forbidden' });
    const del = await service.from('workout_calendar').delete().eq('id', id);
    if (del.error) throw del.error;
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
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
// ===== PROGRESS (week/month) =====
app.get('/api/workouts/progress', requireAuth, async (req, res) => {
  try {
    const uid = req.uid;
    const range = (req.query.range || 'week').toString(); // week | month

    const today = new Date();
    const start = new Date(today);
    if (range === 'month') {
      start.setDate(1);
    } else {
      // Mon=0..Sun=6
      const d = (today.getDay() + 6) % 7;
      start.setDate(today.getDate() - d);
    }
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    if (range === 'month') end.setMonth(start.getMonth() + 1);
    else end.setDate(start.getDate() + 7);
    const startKey = start.toISOString().slice(0, 10);
    const endKey   = end.toISOString().slice(0, 10);

    // Lấy sessions trong khoảng ngày (dựa vào cột date dạng YYYY-MM-DD)
    const ss = await service
      .from('workout_sessions')
      .select('date, duration_min, calories, exercise_id')
      .eq('uid', uid)
      .gte('date', startKey)
      .lt('date', endKey);

    if (ss.error) throw ss.error;

    // Khởi tạo ngày trống trong khoảng
    const days = {};
    for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      days[key] = { date: key, minutes: 0, calories: 0 };
    }

    let totalMinutes = 0, totalCalories = 0;
    (ss.data || []).forEach(r => {
      const key = typeof r.date === 'string' ? r.date : new Date(r.date).toISOString().slice(0, 10);
      if (!days[key]) days[key] = { date: key, minutes: 0, calories: 0 };
      const m = Number(r.duration_min || 0);
      const c = Number(r.calories || 0);
      days[key].minutes += m;
      days[key].calories += c;
      totalMinutes += m;
      totalCalories += c;
    });

    // Nhóm cơ (dựa trên exercise_id)
    const sessIds = (ss.data || []).map(s => s.exercise_id).filter(Boolean);
    let byMuscle = {};
    if (sessIds.length) {
      const ex = await service.from('exercises').select('id,muscle_group').in('id', sessIds);
      if (ex.error) throw ex.error;
      const map = Object.fromEntries((ex.data || []).map(e => [e.id, e.muscle_group || 'other']));
      (ss.data || []).forEach(s => {
        const g = map[s.exercise_id] || 'other';
        byMuscle[g] = (byMuscle[g] || 0) + Number(s.duration_min || 0);
      });
    }

    // Số buổi trong tuần hiện tại
    const weekStart = new Date();
    weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const weekKeyStart = weekStart.toISOString().slice(0, 10);
    const sessionsThisWeek = (ss.data || []).filter(r => (typeof r.date === 'string' ? r.date : new Date(r.date).toISOString().slice(0, 10)) >= weekKeyStart).length;

    res.json({
      range,
      start: startKey,
      end: endKey,
      totalMinutes,
      totalCalories,
      sessionsThisWeek,
      bars: Object.values(days), // [{date,minutes,calories}]
      byMuscle                   // {chest: 80, back: 40, ...} tính theo phút
    });
  } catch (e) {
    console.error('GET /api/workouts/progress error:', e);
    res.status(400).json({ error: e.message || 'Internal error' });
  }
});
