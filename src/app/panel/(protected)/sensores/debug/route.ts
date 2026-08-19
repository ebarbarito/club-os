import { NextResponse } from 'next/server';

// Diagnostico temporal para ver por que fetchSalaSeries devuelve null en
// produccion sin tragarse el error real. Se borra en cuanto se resuelva.
export async function GET() {
  const cfg = {
    url: process.env.INFLUXDB_URL ?? null,
    org: process.env.INFLUXDB_ORG ?? null,
    bucket: process.env.INFLUXDB_BUCKET ?? null,
    hasToken: Boolean(process.env.INFLUXDB_TOKEN),
  };

  if (!cfg.url || !cfg.org || !cfg.bucket || !cfg.hasToken) {
    return NextResponse.json({ ok: false, reason: 'missing_env', cfg });
  }

  const query = `
from(bucket: "${cfg.bucket}")
  |> range(start: -24h)
  |> filter(fn: (r) => r._measurement == "ambiente")
  |> filter(fn: (r) => r.sensor == "SENSOR2")
  |> filter(fn: (r) => r._field == "temperatura" or r._field == "humedad")
  |> aggregateWindow(every: 15m, fn: mean, createEmpty: false)
  |> sort(columns: ["_time"])
`;

  try {
    const res = await fetch(`${cfg.url}/api/v2/query?org=${encodeURIComponent(cfg.org)}`, {
      method: 'POST',
      headers: {
        Authorization: `Token ${process.env.INFLUXDB_TOKEN}`,
        'Content-Type': 'application/vnd.flux',
        Accept: 'application/csv',
      },
      body: query,
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    const text = await res.text();
    return NextResponse.json({ ok: res.ok, status: res.status, cfg, bodyPreview: text.slice(0, 500) });
  } catch (err) {
    return NextResponse.json({ ok: false, reason: 'fetch_threw', cfg, error: String(err) });
  }
}
