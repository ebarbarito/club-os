'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/badge';
import { Sparkline, BigChart } from '@/components/sensor-charts';
import { ETAPA } from '@/lib/status-meta';

const DOT_COLOR: Record<string, string> = { green: 'bg-accent', purple: 'bg-purple', amber: 'bg-amber' };
const RANGES = ['1h', '6h', '24h', '36h', '7d', '30d'];

type Sala = {
  id: string;
  name: string;
  etapa: string;
  etapa_dias: number;
  sensor_id: string | null;
  temp_min: number | null;
  temp_max: number | null;
  hum_min: number | null;
  hum_max: number | null;
  strainName: string | null;
};

type SeriesPoint = { time: Date; value: number };
type SalaSeries = { temp: SeriesPoint[]; hum: SeriesPoint[] };

function stats(points: SeriesPoint[]) {
  if (points.length === 0) return { min: 0, max: 0, avg: 0, last: 0 };
  const values = points.map((p) => p.value);
  return {
    min: Math.min(...values),
    max: Math.max(...values),
    avg: values.reduce((a, b) => a + b, 0) / values.length,
    last: values[values.length - 1],
  };
}

function fmtTime(d: Date, range: string) {
  return range === '7d' || range === '30d'
    ? d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
    : d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

export function SensoresView({
  salas,
  selectedId,
  range,
  series,
}: {
  salas: Sala[];
  selectedId: string | null;
  range: string;
  series: SalaSeries | null;
}) {
  const [metric, setMetric] = useState<'temp' | 'hum'>('temp');

  const sala = salas.find((s) => s.id === selectedId) ?? salas[0];

  if (!sala) {
    return (
      <div>
        <h1 className="font-display text-2xl font-bold text-text">Sensores</h1>
        <p className="text-text-soft mb-1">Seguimiento en vivo por sala</p>
        <p className="text-text-mute text-sm py-10 text-center">
          Ninguna sala tiene un sensor físico conectado todavía (se configura desde Salas & Cultivo).
        </p>
      </div>
    );
  }

  const isTemp = metric === 'temp';
  const color = isTemp ? '#d98a3f' : '#60a5fa';
  const rangeMin = isTemp ? sala.temp_min : sala.hum_min;
  const rangeMax = isTemp ? sala.temp_max : sala.hum_max;
  const etapaMeta = ETAPA[sala.etapa as keyof typeof ETAPA];

  const tempSlice = series?.temp ?? [];
  const humSlice = series?.hum ?? [];
  const activeSlice = isTemp ? tempSlice : humSlice;
  const hasData = activeSlice.length > 0;
  const activeStats = stats(activeSlice);
  const alert = hasData && rangeMin != null && rangeMax != null && (activeStats.last < rangeMin || activeStats.last > rangeMax);
  const times = activeSlice.map((p) => fmtTime(p.time, range));

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-text">Sensores</h1>
      <p className="text-text-soft mb-4">Seguimiento en vivo por sala</p>

      <div className="flex gap-1 mb-4 flex-wrap">
        {salas.map((s) => {
          const meta = ETAPA[s.etapa as keyof typeof ETAPA];
          const active = s.id === sala.id;
          return (
            <Link
              key={s.id}
              href={`/panel/sensores?sala=${s.id}&range=${range}`}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm border ${
                active ? 'border-accent text-accent font-semibold' : 'border-line-2 text-text-soft hover:border-accent'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${DOT_COLOR[meta.color]}`} />
              {s.name}
              <span className="text-xs text-text-mute">{meta.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <h2 className="font-display font-bold text-text">{sala.name}</h2>
        <Badge label={etapaMeta.label} color={etapaMeta.color} />
        <span className="text-xs text-text-mute">Día {sala.etapa_dias}</span>
        <span className="text-xs text-text-mute">· sensor <code className="text-text-soft">{sala.sensor_id}</code></span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <button
          onClick={() => setMetric('temp')}
          className={`text-left rounded-xl border bg-surface p-4 ${isTemp ? 'border-accent' : 'border-line'}`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-text-soft">Temperatura</span>
            <span className="font-display text-lg font-bold text-text">
              {tempSlice.length > 0 ? stats(tempSlice).last.toFixed(1) : '—'}°C
            </span>
          </div>
          <Sparkline values={tempSlice.map((p) => p.value)} color="#d98a3f" />
          <p className="text-xs text-text-mute mt-1">
            {etapaMeta.label} · {sala.strainName ?? 'sin genética'}
          </p>
        </button>

        <button
          onClick={() => setMetric('hum')}
          className={`text-left rounded-xl border bg-surface p-4 ${!isTemp ? 'border-accent' : 'border-line'}`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-text-soft">Humedad</span>
            <span className="font-display text-lg font-bold text-text">
              {humSlice.length > 0 ? Math.round(stats(humSlice).last) : '—'}%
            </span>
          </div>
          <Sparkline values={humSlice.map((p) => p.value)} color="#60a5fa" fixedMin={0} fixedMax={100} />
          <p className="text-xs text-text-mute mt-1">
            {etapaMeta.label} · {sala.strainName ?? 'sin genética'}
          </p>
        </button>
      </div>

      <div className="rounded-xl border border-line bg-surface p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h3 className="font-display font-bold text-text">Sensor {isTemp ? 'Temperatura' : 'Humedad'}</h3>
            <p className="text-xs text-text-mute">
              {isTemp ? 'Temperatura' : 'Humedad'} · {sala.name}
            </p>
          </div>
          <div className="flex gap-1 flex-wrap">
            {RANGES.map((r) => (
              <Link
                key={r}
                href={`/panel/sensores?sala=${sala.id}&range=${r}`}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                  range === r ? 'bg-accent text-white' : 'text-text-soft hover:bg-surface-2'
                }`}
              >
                {r}
              </Link>
            ))}
          </div>
        </div>

        {hasData ? (
          <>
            <div className="grid grid-cols-5 gap-3 mb-4 text-sm">
              <div>
                <p className="text-text-mute text-xs">Mín</p>
                <p className="font-semibold text-text">{activeStats.min.toFixed(1)}</p>
              </div>
              <div>
                <p className="text-text-mute text-xs">Prom</p>
                <p className="font-semibold text-text">{activeStats.avg.toFixed(1)}</p>
              </div>
              <div>
                <p className="text-text-mute text-xs">Máx</p>
                <p className="font-semibold text-text">{activeStats.max.toFixed(1)}</p>
              </div>
              <div>
                <p className="text-text-mute text-xs">Rango ideal</p>
                <p className="font-semibold text-accent">
                  {rangeMin ?? '—'}–{rangeMax ?? '—'} {isTemp ? '°C' : '%'}
                </p>
              </div>
              <div>
                <p className="text-text-mute text-xs">Estado</p>
                <Badge label={alert ? 'Alerta' : 'Óptimo'} color={alert ? 'amber' : 'green'} />
              </div>
            </div>

            <BigChart
              values={activeSlice.map((p) => p.value)}
              times={times}
              color={color}
              fixedMin={isTemp ? undefined : 0}
              fixedMax={isTemp ? undefined : 100}
            />
          </>
        ) : (
          <p className="text-text-mute text-sm py-10 text-center">
            Sin lecturas del sensor <code className="text-text-soft">{sala.sensor_id}</code> en este rango — puede ser que
            esté desconectado o que InfluxDB no responda ahora mismo.
          </p>
        )}
      </div>
    </div>
  );
}
