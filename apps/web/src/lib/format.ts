import { getDict, getLocale, intlLocale } from './i18n';

export function age(birthDate: string) {
  const b = new Date(birthDate);
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) a--;
  return a;
}

/* Browsers ship incomplete ICU data for Uzbek (e.g. "M09 25"), so Uzbek dates are formatted here. */
const UZ_MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];
const UZ_DAYS = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'];
const pad = (n: number) => String(n).padStart(2, '0');
const time = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Dates follow the selected UI language (uz / ru / en). */
export function fmtDate(v: string | number | Date | null | undefined) {
  if (!v) return '—';
  const d = new Date(v);
  if (getLocale() === 'uz') return `${d.getDate()}-${UZ_MONTHS[d.getMonth()]}, ${d.getFullYear()}`;
  return new Intl.DateTimeFormat(intlLocale(), { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}

export function fmtDateTime(v: string | number | Date | null | undefined) {
  if (!v) return '—';
  const d = new Date(v);
  if (getLocale() === 'uz') return `${d.getDate()}-${UZ_MONTHS[d.getMonth()]}, ${time(d)}`;
  return new Intl.DateTimeFormat(intlLocale(), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d);
}

/** "Friday 25 September" / "25-sentyabr, juma" / "пятница, 25 сентября". */
export function fmtToday(d = new Date()) {
  if (getLocale() === 'uz') return `${d.getDate()}-${UZ_MONTHS[d.getMonth()]}, ${UZ_DAYS[d.getDay()]}`;
  return new Intl.DateTimeFormat(intlLocale(), { weekday: 'long', day: 'numeric', month: 'long' }).format(d);
}

/** "due in 2 days" / "3 h overdue" relative to now, localised. */
export function dueIn(deadline: string) {
  const t = getDict();
  const ms = new Date(deadline).getTime() - Date.now();
  const h = Math.round(Math.abs(ms) / 3_600_000);
  const span = h < 48 ? t.time.hours(h) : t.time.days(Math.round(h / 24));
  return ms >= 0 ? { text: t.time.dueIn(span), overdue: false } : { text: t.time.overdueBy(span), overdue: true };
}

export function ago(ts: number) {
  const t = getDict();
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return t.time.justNow;
  if (s < 3600) return t.time.minAgo(Math.round(s / 60));
  return t.time.hAgo(Math.round(s / 3600));
}

export const humanize = (s: string) => s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

export function uuid() {
  return crypto.randomUUID();
}
