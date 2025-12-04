export function parseHHMM(str) {
  const m = String(str || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Math.max(0, Math.min(23, Number(m[1])));
  const mi = Math.max(0, Math.min(59, Number(m[2])));
  return { hour: h, minute: mi, totalMin: h * 60 + mi };
}

/**
 * Tính chênh lệch phút giữa start và end, hỗ trợ qua nửa đêm.
 * Ví dụ 23:00 -> 06:30 = 450 phút.
 */
export function diffMinutes(startHHMM, endHHMM) {
  const s = parseHHMM(startHHMM);
  const e = parseHHMM(endHHMM);
  if (!s || !e) return null;
  let d = e.totalMin - s.totalMin;
  if (d < 0) d += 24 * 60; // qua nửa đêm
  return d;
}