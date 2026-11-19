export function dateISO(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function calendarMonday(iso: string): string {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export function calendarDay(iso: string): number {
  return (new Date(iso + 'T12:00:00Z').getUTCDay() + 6) % 7;
}

export function calendarGap(a: string, b: string): number {
  return Math.round(
    (new Date(a + 'T12:00:00Z').getTime() - new Date(b + 'T12:00:00Z').getTime()) / 86400000,
  );
}

export function nextMonday(d = new Date()): string {
  const day = d.getDay();
  const delta = day === 1 ? 0 : (8 - day) % 7;
  const x = new Date(d);
  x.setDate(d.getDate() + delta);
  return dateISO(x);
}

export function fmtDate(s: string): string {
  return new Date(s + 'T12:00:00Z').toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

export function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

export function programDateFor(start: string, day: number, week = 1): Date {
  const d = new Date(start + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + (week - 1) * 7 + day);
  return d;
}

export function cycleDaysFor(frequency: 3 | 4): number[] {
  return frequency === 4 ? [0, 2, 4, 6] : [0, 2, 4];
}

export function cycleLetter(day: number): string {
  if (day === 0) return 'А';
  if (day === 2) return 'Б';
  if (day === 4) return 'В';
  if (day === 6) return 'Г';
  return '—';
}
