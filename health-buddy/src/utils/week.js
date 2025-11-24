export function weekStartISO(d = new Date()) {
  const x = new Date(d);
  const day = x.getDay(); // 0 CN..6 T7
  const diff = (day === 0 ? -6 : 1 - day);
  x.setDate(x.getDate() + diff);
  return x.toISOString().slice(0,10);
}
