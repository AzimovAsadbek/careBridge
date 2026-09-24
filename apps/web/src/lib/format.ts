export function age(birthDate: string) {
  const b = new Date(birthDate);
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) a--;
  return a;
}

const dtf = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const dttf = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export const fmtDate = (d: string | number | Date | null | undefined) => (d ? dtf.format(new Date(d)) : '—');
export const fmtDateTime = (d: string | number | Date | null | undefined) => (d ? dttf.format(new Date(d)) : '—');

/** "in 2 days" / "3 h overdue" relative to now. */
export function dueIn(deadline: string) {
  const ms = new Date(deadline).getTime() - Date.now();
  const abs = Math.abs(ms);
  const h = Math.round(abs / 3_600_000);
  const text = h < 48 ? `${h} h` : `${Math.round(h / 24)} days`;
  return ms >= 0 ? { text: `due in ${text}`, overdue: false } : { text: `${text} overdue`, overdue: true };
}

export const humanize = (s: string) => s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

export function uuid() {
  return crypto.randomUUID();
}
