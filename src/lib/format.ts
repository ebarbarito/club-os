const TZ = 'America/Argentina/Buenos_Aires';

export function money(n: number): string {
  const s = Math.round(Math.abs(n)).toLocaleString('es-AR');
  return (n < 0 ? '-$' : '$') + s;
}

export function fmtDate(s: string | null): string {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('es-AR', { timeZone: TZ });
}

export function fmtDateTime(s: string | null): string {
  if (!s) return '—';
  return new Date(s).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short', timeZone: TZ });
}

const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// key: 'YYYY-MM'
export function monthLabel(key: string): string {
  const [y, m] = key.split('-');
  return `${MONTHS_ES[Number(m) - 1]} ${y}`;
}

// Argentina es UTC-3 fijo (sin horario de verano): la medianoche del 1º en
// ART es las 03:00 UTC del mismo día. Sin este offset, el filtro por mes
// del Balance quedaba corrido ~3hs contra el huso real.
export function monthRange(key: string): { start: string; end: string } {
  const [y, m] = key.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1, 3, 0, 0));
  const end = new Date(Date.UTC(y, m, 1, 3, 0, 0));
  return { start: start.toISOString(), end: end.toISOString() };
}

export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// 'YYYY-MM' del mes actual en Argentina (no en UTC — importan las ~3hs
// de diferencia cerca de la medianoche).
export function currentMonthKeyAR(): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit' }).formatToParts(
    new Date(),
  );
  const year = parts.find((p) => p.type === 'year')!.value;
  const month = parts.find((p) => p.type === 'month')!.value;
  return `${year}-${month}`;
}
