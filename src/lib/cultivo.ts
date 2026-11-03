// Recorrido del cultivo: madres y esquejes → vege → flora → secado → stock.
// El lote nace al entrar a flora y viaja entero hasta stock (ver migración
// 0064_cultivo_lotes.sql).

export type TipoSala = 'madres' | 'vege' | 'flora' | 'secado';

export const TIPOS_SALA: { value: TipoSala; label: string; etapa: 'vegetativo' | 'floracion' | 'secado' }[] = [
  { value: 'madres', label: 'Madres y esquejes', etapa: 'vegetativo' },
  { value: 'vege', label: 'Vegetativo', etapa: 'vegetativo' },
  { value: 'flora', label: 'Floración', etapa: 'floracion' },
  { value: 'secado', label: 'Secado y manicura', etapa: 'secado' },
];

export function tipoLabel(tipo: string) {
  return TIPOS_SALA.find((t) => t.value === tipo)?.label ?? tipo;
}

export const TIPO_COLOR: Record<string, 'green' | 'blue' | 'purple' | 'amber'> = {
  madres: 'blue',
  vege: 'green',
  flora: 'purple',
  secado: 'amber',
};

// A qué tipo de sala se pueden pasar las plantas desde cada tipo.
export const DESTINOS: Record<string, TipoSala[]> = {
  madres: ['vege', 'flora'],
  vege: ['flora'],
};

export function codigoLote(numero: number) {
  return `L-${String(numero).padStart(3, '0')}`;
}

// Fecha de hoy en Argentina, "YYYY-MM-DD".
export function hoyAR(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
}

function aUTC(fecha: string) {
  const [y, m, d] = fecha.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

// Día de la etapa: el día de ingreso es el día 1.
export function diaDeEtapa(inicio: string | null | undefined): number {
  if (!inicio) return 0;
  return Math.max(1, Math.round((aUTC(hoyAR()) - aUTC(inicio)) / 86_400_000) + 1);
}

export function diasEntre(desde: string, hasta: string): number {
  return Math.max(0, Math.round((aUTC(hasta) - aUTC(desde)) / 86_400_000));
}

export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(aUTC(fecha) + dias * 86_400_000);
  return d.toISOString().slice(0, 10);
}

// "2026-11-03" → "03/11/2026", sin pasar por zonas horarias.
export function fmtFecha(fecha: string | null | undefined): string {
  if (!fecha) return '—';
  const [y, m, d] = fecha.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export function fmtGramos(g: number | null | undefined): string {
  if (g == null) return '—';
  if (g >= 1000) return `${(g / 1000).toLocaleString('es-AR', { maximumFractionDigits: 2 })} kg`;
  return `${g.toLocaleString('es-AR', { maximumFractionDigits: 1 })} g`;
}

// Fila de plantas de una sala (tabla sala_strains).
export type GrupoPlantas = {
  id: string;
  strainId: string;
  strainName: string;
  plants: number;
  loteId: string | null;
  esMadre: boolean;
  ingresoAt: string;
};

export type LoteResumen = {
  id: string;
  numero: number;
  estado: 'flora' | 'secado' | 'cerrado';
  salaId: string | null;
  floraInicio: string;
  diasFlora: number;
  secadoInicio: string | null;
  notas: string | null;
};

// Cosecha de una genética: lo que va a secado y lo que se deriva.
export type ItemCosecha = {
  strainId: string;
  pesoHumedo: number | null;
  extraccionPlantas: number;
  extraccionPeso: number | null;
  aceitePlantas: number;
  aceitePeso: number | null;
};
