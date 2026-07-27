'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
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

export function SensoresView({ salas }: { salas: Sala[] }) {
  const searchParams = useSearchParams();
  const [metric, setMetric] = useState<'temp' | 'hum'>('temp');
  const [range, setRange] = useState('24h');

  const selectedId = searchParams.get('sala') ?? salas[0]?.id;
  const sala = salas.find((s) => s.id === selectedId) ?? salas[0];

  if (!sala) {
    return <p className="text-text-mute text-sm py-10 text-center">Sin salas cargadas todavía.</p>;
  }

  const isTemp = metric === 'temp';
  const color = isTemp ? '#d98a3f' : '#60a5fa';
  const rangeMin = isTemp ? sala.temp_min : sala.hum_min;
  const rangeMax = isTemp ? sala.temp_max : sala.hum_max;
  const etapaMeta = ETAPA[sala.etapa as keyof typeof ETAPA];

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
              href={`/panel/sensores?sala=${s.id}`}
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

      <div className="flex items-center gap-2 mb-4">
        <h2 className="font-display font-bold text-text">{sala.name}</h2>
        <Badge label={etapaMeta.label} color={etapaMeta.color} />
        <span className="text-xs text-text-mute">Día {sala.etapa_dias}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <button
          onClick={() => setMetric('temp')}
          className={`text-left rounded-xl border bg-surface p-4 ${isTemp ? 'border-accent' : 'border-line'}`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-text-soft">Temperatura</span>
            <span className="font-display text-lg font-bold text-text">—°C</span>
          </div>
          <Sparkline values={[]} color="#d98a3f" />
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
            <span className="font-display text-lg font-bold text-text">—%</span>
          </div>
          <Sparkline values={[]} color="#60a5fa" fixedMin={0} fixedMax={100} />
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
          <div className="flex gap-1">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                  range === r ? 'bg-accent text-white' : 'text-text-soft hover:bg-surface-2'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-5 gap-3 mb-4 text-sm">
          <div>
            <p className="text-text-mute text-xs">Mín</p>
            <p className="font-semibold text-text">—</p>
          </div>
          <div>
            <p className="text-text-mute text-xs">Prom</p>
            <p className="font-semibold text-text">—</p>
          </div>
          <div>
            <p className="text-text-mute text-xs">Máx</p>
            <p className="font-semibold text-text">—</p>
          </div>
          <div>
            <p className="text-text-mute text-xs">Rango ideal</p>
            <p className="font-semibold text-accent">
              {rangeMin ?? '—'}–{rangeMax ?? '—'} {isTemp ? '°C' : '%'}
            </p>
          </div>
          <div>
            <p className="text-text-mute text-xs">Estado</p>
            <p className="font-semibold text-text-mute">Sin datos</p>
          </div>
        </div>

        <BigChart values={[]} times={[]} color={color} fixedMin={isTemp ? undefined : 0} fixedMax={isTemp ? undefined : 100} />
      </div>

      <p className="text-text-mute text-xs mt-3">
        {sala.sensor_id ? (
          <>
            Sensor <code className="text-text">{sala.sensor_id}</code> configurado — falta conectar la integración con
            InfluxDB para ver lecturas reales acá.
          </>
        ) : (
          'Esta sala no tiene un sensor físico asignado (configurable desde Salas & Cultivo).'
        )}
      </p>
    </div>
  );
}
