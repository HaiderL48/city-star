export type Lang = 'en' | 'gu';

export function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function round3(n: number) {
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}

export function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function todayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function num(value: string) {
  const n = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

function groupIndian(whole: string) {
  if (whole.length <= 3) return whole;
  const head = whole.slice(0, -3);
  const tail = whole.slice(-3);
  return `${head.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${tail}`;
}

export function formatMoney(n: number) {
  const v = Number.isFinite(n) ? round2(n) : 0;
  const sign = v < 0 ? '-' : '';
  const [whole, frac] = Math.abs(v).toFixed(2).split('.');
  return `${sign}₹${groupIndian(whole ?? '0')}.${frac}`;
}

export function formatQty(n: number) {
  const r = round3(n);
  return String(r);
}

const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const GU_MONTHS = ['જાન્યુ', 'ફેબ્રુ', 'માર્ચ', 'એપ્રિ', 'મે', 'જૂન', 'જુલાઈ', 'ઑગસ્ટ', 'સપ્ટે', 'ઑક્ટો', 'નવે', 'ડિસે'];
const EN_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const GU_DAYS = ['રવિ', 'સોમ', 'મંગળ', 'બુધ', 'ગુરુ', 'શુક્ર', 'શનિ'];

export function formatDate(isoDate: string, lang: Lang) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const months = lang === 'gu' ? GU_MONTHS : EN_MONTHS;
  return `${d} ${months[(m ?? 1) - 1]} ${y}`;
}

export function formatToday(lang: Lang, d = new Date()) {
  const days = lang === 'gu' ? GU_DAYS : EN_DAYS;
  return `${days[d.getDay()]}, ${formatDate(todayKey(d), lang)}`;
}

export function formatWhen(iso: string, lang: Lang) {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${formatDate(todayKey(d), lang)} ${hh}:${mm}`;
}

export function greetingKey(d = new Date()) {
  const h = d.getHours();
  if (h < 12) return 'greetingMorning' as const;
  if (h < 17) return 'greetingAfternoon' as const;
  return 'greetingEvening' as const;
}

export function localizedName(item: { name: string; nameGu?: string }, lang: Lang) {
  if (lang === 'gu' && item.nameGu?.trim()) return item.nameGu.trim();
  return item.name;
}

export function shopTitle(settings: { shopName: string; shopNameGu: string }, lang: Lang) {
  if (lang === 'gu' && settings.shopNameGu.trim()) return settings.shopNameGu.trim();
  return settings.shopName;
}

export function rangeFor(preset: 'today' | 'week' | 'month') {
  const now = new Date();
  const end = todayKey(now);
  if (preset === 'today') return { start: end, end };
  if (preset === 'month') {
    const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    return { start, end };
  }
  const d = new Date(now);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return { start: todayKey(d), end };
}

export function last7Days() {
  const days: string[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(todayKey(d));
  }
  return days;
}

export function waLink(phone: string, text: string) {
  const digits = phone.replace(/\D/g, '');
  const num = digits.length === 10 ? `91${digits}` : digits;
  const encoded = encodeURIComponent(text);
  return num ? `https://wa.me/${num}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
