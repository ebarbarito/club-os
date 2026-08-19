// Lee temperatura/humedad reales desde el InfluxDB del proyecto Sensores
// (measurement "ambiente", tag "sensor", fields "temperatura"/"humedad").
// Un solo sensor puede aparecer en varias salas/tenants a la vez —
// alcanza con el sensor_id (tag) configurado en cada sala.
export type SeriesPoint = { time: Date; value: number };
export type SalaSeries = { temp: SeriesPoint[]; hum: SeriesPoint[] };

const START_MAP: Record<string, string> = {
  '1h': '-1h',
  '6h': '-6h',
  '24h': '-24h',
  '36h': '-36h',
  '7d': '-7d',
  '30d': '-30d',
};

const WINDOW_MAP: Record<string, string> = {
  '1h': '1m',
  '6h': '5m',
  '24h': '15m',
  '36h': '20m',
  '7d': '1h',
  '30d': '6h',
};

export const RANGE_KEYS = Object.keys(START_MAP);

function env() {
  const url = process.env.INFLUXDB_URL;
  const org = process.env.INFLUXDB_ORG;
  const bucket = process.env.INFLUXDB_BUCKET;
  const token = process.env.INFLUXDB_TOKEN;
  if (!url || !org || !bucket || !token) return null;
  return { url, org, bucket, token };
}

// InfluxDB devuelve "annotated CSV": puede traer varias tablas (una por
// _field agrupado), cada una con su propia fila de encabezado — hay que
// releer los índices de columna en cada una en vez de asumir uno fijo.
function parseSeriesByField(csv: string): Record<string, SeriesPoint[]> {
  const byField: Record<string, SeriesPoint[]> = {};
  let timeIdx = -1;
  let valueIdx = -1;
  let fieldIdx = -1;

  for (const rawLine of csv.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const cols = line.split(',');
    const ti = cols.indexOf('_time');
    const vi = cols.indexOf('_value');
    const fi = cols.indexOf('_field');
    if (ti !== -1 && vi !== -1) {
      timeIdx = ti;
      valueIdx = vi;
      fieldIdx = fi;
      continue;
    }

    if (timeIdx === -1 || valueIdx === -1 || fieldIdx === -1) continue;
    const field = cols[fieldIdx];
    const t = new Date(cols[timeIdx]).getTime();
    const v = parseFloat(cols[valueIdx]);
    if (!field || isNaN(t) || isNaN(v)) continue;
    (byField[field] ??= []).push({ time: new Date(t), value: v });
  }

  for (const points of Object.values(byField)) points.sort((a, b) => a.time.getTime() - b.time.getTime());
  return byField;
}

// Devuelve null si falta config o la consulta falla — el caller decide
// cómo mostrar "sin datos" en vez de romper la pantalla.
export async function fetchSalaSeries(sensorId: string, rangeKey: string): Promise<SalaSeries | null> {
  const cfg = env();
  if (!cfg) return null;

  const query = `
from(bucket: "${cfg.bucket}")
  |> range(start: ${START_MAP[rangeKey] ?? '-24h'})
  |> filter(fn: (r) => r._measurement == "ambiente")
  |> filter(fn: (r) => r.sensor == "${sensorId}")
  |> filter(fn: (r) => r._field == "temperatura" or r._field == "humedad")
  |> aggregateWindow(every: ${WINDOW_MAP[rangeKey] ?? '15m'}, fn: mean, createEmpty: false)
  |> sort(columns: ["_time"])
`;

  try {
    const res = await fetch(`${cfg.url}/api/v2/query?org=${encodeURIComponent(cfg.org)}`, {
      method: 'POST',
      headers: {
        Authorization: `Token ${cfg.token}`,
        'Content-Type': 'application/vnd.flux',
        Accept: 'application/csv',
      },
      body: query,
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;

    const byField = parseSeriesByField(await res.text());
    return { temp: byField.temperatura ?? [], hum: byField.humedad ?? [] };
  } catch {
    return null;
  }
}
