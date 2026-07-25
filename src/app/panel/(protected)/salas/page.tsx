import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth/get-session-profile';
import { Badge } from '@/components/badge';
import { ModalTrigger } from '@/components/modal-trigger';
import { ETAPA } from '@/lib/status-meta';
import { fmtDate } from '@/lib/format';
import { SalaForm } from './sala-form';
import { CloseCicloForm } from './close-ciclo-form';

export default async function SalasPage() {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  const [{ data: salas }, { data: strainRows }] = await Promise.all([
    supabase.from('salas').select('*, strain:strains(id, name)').order('name'),
    supabase.from('strains').select('id, name').eq('active', true).order('name'),
  ]);

  const strains = strainRows ?? [];
  const isAdmin = profile?.role === 'admin';

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-text">Salas & Cultivo</h1>
          <p className="text-text-soft">Plantas, etapas y sensores</p>
        </div>
        {isAdmin && (
          <ModalTrigger label="+ Nueva sala" title="Nueva sala">
            <SalaForm strains={strains} />
          </ModalTrigger>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(salas ?? []).map((s) => {
          const strain = Array.isArray(s.strain) ? s.strain[0] : s.strain;
          const etapaMeta = ETAPA[s.etapa as keyof typeof ETAPA];
          const occupancy = s.capacity > 0 ? Math.min(100, (s.plants / s.capacity) * 100) : 0;
          return (
            <div key={s.id} className="rounded-xl border border-line bg-surface p-4">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-display font-bold text-text">{s.name}</h3>
                <Badge label={`${etapaMeta.label} · día ${s.etapa_dias}`} color={etapaMeta.color} />
              </div>
              <p className="text-text-soft text-sm mb-3">{strain?.name ?? 'Sin genética asignada'}</p>

              <div className="mb-3">
                <div className="flex justify-between text-xs text-text-mute mb-1">
                  <span>Ocupación</span>
                  <span>
                    {s.plants}/{s.capacity}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
                  <div className="h-full bg-accent" style={{ width: `${occupancy}%` }} />
                </div>
              </div>

              <dl className="text-sm text-text-soft space-y-1 mb-4">
                <div className="flex justify-between">
                  <dt>Cosecha estimada</dt>
                  <dd>{fmtDate(s.cosecha_estimada)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Responsable</dt>
                  <dd>{s.responsable ?? '—'}</dd>
                </div>
              </dl>

              <div className="rounded-lg border border-dashed border-line-2 p-2 text-xs text-text-mute mb-3">
                Sensores en vivo: pendiente de conectar InfluxDB.
              </div>

              {isAdmin && (
                <div className="flex gap-2">
                  <ModalTrigger
                    label="Configurar"
                    className="flex-1 rounded-lg border border-line-2 text-xs font-semibold px-3 py-1.5 hover:border-accent hover:text-accent"
                    title={`Configurar — ${s.name}`}
                  >
                    <SalaForm strains={strains} sala={s} />
                  </ModalTrigger>
                  <ModalTrigger
                    label="Cerrar ciclo"
                    className="flex-1 rounded-lg border border-line-2 text-xs font-semibold px-3 py-1.5 hover:border-accent hover:text-accent"
                    title={`Cerrar ciclo — ${s.name}`}
                  >
                    <CloseCicloForm salaId={s.id} strains={strains} />
                  </ModalTrigger>
                </div>
              )}
            </div>
          );
        })}
        {(salas ?? []).length === 0 && (
          <p className="col-span-full text-center text-text-mute py-10">Sin salas cargadas todavía.</p>
        )}
      </div>
    </div>
  );
}
