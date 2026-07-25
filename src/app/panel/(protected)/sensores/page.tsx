import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { ETAPA } from '@/lib/status-meta';

const DOT_COLOR: Record<string, string> = {
  green: 'bg-accent',
  purple: 'bg-purple',
  amber: 'bg-amber',
};

export default async function SensoresPage({
  searchParams,
}: {
  searchParams: Promise<{ sala?: string }>;
}) {
  const { sala: salaId } = await searchParams;
  const supabase = await createClient();
  const { data: salas } = await supabase.from('salas').select('*').order('name');

  const selected = salas?.find((s) => s.id === salaId) ?? salas?.[0] ?? null;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-text">Sensores</h1>
      <p className="text-text-soft mb-4">Seguimiento en vivo por sala</p>

      <div className="flex gap-1 mb-4 flex-wrap">
        {(salas ?? []).map((s) => {
          const etapaMeta = ETAPA[s.etapa as keyof typeof ETAPA];
          const active = selected?.id === s.id;
          return (
            <Link
              key={s.id}
              href={`/panel/sensores?sala=${s.id}`}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm border ${
                active ? 'border-accent text-accent font-semibold' : 'border-line-2 text-text-soft hover:border-accent'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${DOT_COLOR[etapaMeta.color]}`} />
              {s.name}
            </Link>
          );
        })}
        {(salas ?? []).length === 0 && <p className="text-text-mute text-sm">Sin salas cargadas todavía.</p>}
      </div>

      {selected && (
        <div className="rounded-xl border border-line bg-surface p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-text">{selected.name}</h2>
            <span className="text-xs text-text-mute">Día {selected.etapa_dias}</span>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="rounded-lg border border-line p-3">
              <p className="text-xs text-text-mute mb-1">Temperatura — rango ideal</p>
              <p className="font-display text-lg font-bold text-text">
                {selected.temp_min ?? '—'}° – {selected.temp_max ?? '—'}°C
              </p>
            </div>
            <div className="rounded-lg border border-line p-3">
              <p className="text-xs text-text-mute mb-1">Humedad — rango ideal</p>
              <p className="font-display text-lg font-bold text-text">
                {selected.hum_min ?? '—'}% – {selected.hum_max ?? '—'}%
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-dashed border-line-2 p-6 text-center text-text-mute text-sm">
            {selected.sensor_id ? (
              <>
                Sensor <code className="text-text">{selected.sensor_id}</code> configurado, pero la conexión con
                InfluxDB todavía no está armada — próximo paso del roadmap.
              </>
            ) : (
              <>Esta sala no tiene un sensor físico asignado (configurable desde Salas & Cultivo).</>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
