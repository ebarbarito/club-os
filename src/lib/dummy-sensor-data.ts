// Datos de EJEMPLO (dummy) para pre-visualizar la pantalla de Sensores
// antes de conectar la integración real con InfluxDB. Random-walk simple
// alrededor del rango ideal configurado en la sala — mismo approach que
// el prototipo original (genSensorHistory en club-core.js).
export type SeriesPoint = { time: Date; value: number };

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export function genDummySeries(idealMin: number, idealMax: number, count: number, stepMs: number): SeriesPoint[] {
  const now = new Date();
  let value = (idealMin + idealMax) / 2;
  const jitter = (idealMax - idealMin) * 0.08 || 0.5;
  const points: SeriesPoint[] = [];

  for (let i = count - 1; i >= 0; i--) {
    value += (Math.random() - 0.5) * jitter;
    value = clamp(value, idealMin - jitter * 3, idealMax + jitter * 3);
    points.push({ time: new Date(now.getTime() - i * stepMs), value: Number(value.toFixed(1)) });
  }
  return points;
}

export const RANGE_CONFIG: Record<string, { count: number; stepMs: number }> = {
  '1h': { count: 12, stepMs: 5 * 60 * 1000 },
  '6h': { count: 24, stepMs: 15 * 60 * 1000 },
  '24h': { count: 24, stepMs: 60 * 60 * 1000 },
  '36h': { count: 36, stepMs: 60 * 60 * 1000 },
  '7d': { count: 42, stepMs: 4 * 60 * 60 * 1000 },
  '30d': { count: 30, stepMs: 24 * 60 * 60 * 1000 },
};
