export function money(n: number): string {
  const s = Math.round(Math.abs(n)).toLocaleString('es-AR');
  return (n < 0 ? '-$' : '$') + s;
}

export function fmtDate(s: string | null): string {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('es-AR');
}

export function fmtDateTime(s: string | null): string {
  if (!s) return '—';
  return new Date(s).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
}

const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// key: 'YYYY-MM'
export function monthLabel(key: string): string {
  const [y, m] = key.split('-');
  return `${MONTHS_ES[Number(m) - 1]} ${y}`;
}

export function monthRange(key: string): { start: string; end: string } {
  const [y, m] = key.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { start: start.toISOString(), end: end.toISOString() };
}

export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
