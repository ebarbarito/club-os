import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth/get-session-profile';
import { ROLES } from '@/lib/roles';
import { Badge } from '@/components/badge';
import { fmtDateTime } from '@/lib/format';
import { ESTADO_LOTE, diaDeEtapa, diasEntre, fmtFecha, fmtGramos, nombreLote } from '@/lib/cultivo';

const TIPO_MOV: Record<string, string> = {
  alta: 'Carga',
  mover: 'Movimiento',
  derivar: 'Derivación',
  proceso: 'Proceso',
  descarte: 'Descarte',
  cosecha: 'Cosecha',
  stock: 'A stock',
  ajuste: 'Ajuste',
};

function uno<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export default async function LotePage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getSessionProfile();
  if (!profile) redirect('/panel/login');
  if (profile.role !== 'admin' && profile.role !== 'cultivo') redirect(`/panel/${ROLES[profile.role].home}`);

  const { id } = await params;
  const supabase = await createClient();

  const [{ data: lote }, { data: plantas }, { data: pesajes }, { data: movs }, { data: salas }, { data: procesos }, { data: manicuras }] =
    await Promise.all([
    supabase.from('lotes').select('*').eq('id', id).maybeSingle(),
    supabase.from('sala_strains').select('strain_id, plants, strain:strains(name)').eq('lote_id', id),
    supabase.from('lote_pesajes').select('strain_id, plantas, peso_humedo, peso_seco, peso_trim, strain:strains(name)').eq('lote_id', id),
    supabase
      .from('cultivo_movimientos')
      .select('id, created_at, tipo, sala_origen_id, sala_destino_id, strain_id, plantas, gramos, nota, strain:strains(name), autor:profiles(name)')
      .eq('lote_id', id)
      .order('created_at'),
    supabase.from('salas').select('id, name'),
    supabase
      .from('lote_procesos')
      .select(
        'id, origen, tipo, plantas, peso_entrada, estado, resultado, unidad, nota, created_at, terminado_at, strain:strains!lote_procesos_strain_id_fkey(name), producto:strains!lote_procesos_producto_id_fkey(name)',
      )
      .eq('lote_id', id)
      .order('created_at'),
    supabase
      .from('lote_manicuras')
      .select('id, fecha, peso_seco, peso_trim, plantas, operario, nota, strain:strains(name)')
      .eq('lote_id', id)
      .order('fecha')
      .order('created_at'),
  ]);
  if (!lote) notFound();

  const salaNombre = new Map<string, string>((salas ?? []).map((s: { id: string; name: string }) => [s.id, s.name]));
  const nombreSala = (sid: string | null) => (sid ? salaNombre.get(sid) ?? 'Sala eliminada' : '—');

  // Una fila por genética: plantas actuales (o las registradas al pesar) y pesos.
  type Fila = { strainId: string; nombre: string; plantas: number; humedo: number | null; seco: number | null; trim: number | null };
  const filas = new Map<string, Fila>();
  for (const p of pesajes ?? []) {
    filas.set(p.strain_id, {
      strainId: p.strain_id,
      nombre: uno<{ name: string }>(p.strain)?.name ?? '—',
      plantas: p.plantas,
      humedo: p.peso_humedo,
      seco: p.peso_seco,
      trim: p.peso_trim,
    });
  }
  if (lote.estado !== 'cerrado') {
    const actuales = new Map<string, number>();
    for (const p of plantas ?? []) actuales.set(p.strain_id, (actuales.get(p.strain_id) ?? 0) + p.plants);
    for (const p of plantas ?? []) {
      const f = filas.get(p.strain_id);
      if (f) f.plantas = actuales.get(p.strain_id) ?? 0;
      else
        filas.set(p.strain_id, {
          strainId: p.strain_id,
          nombre: uno<{ name: string }>(p.strain)?.name ?? '—',
          plantas: actuales.get(p.strain_id) ?? 0,
          humedo: null,
          seco: null,
          trim: null,
        });
    }
  }
  const lista = [...filas.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const totPlantas = lista.reduce((s, f) => s + f.plantas, 0);
  const totHumedo = lista.reduce((s, f) => s + (Number(f.humedo) || 0), 0);
  const totSeco = lista.reduce((s, f) => s + (Number(f.seco) || 0), 0);
  const totTrim = lista.reduce((s, f) => s + (Number(f.trim) || 0), 0);

  const cierre: string | null = lote.cerrado_at ? new Date(lote.cerrado_at).toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }) : null;
  // Fin de flora: el pase a secado, o el cierre si todo se derivó a procesos.
  const finFlora: string | null = lote.secado_inicio ?? cierre;
  const enFlora = Boolean(lote.flora_inicio);
  const diasFlora = !enFlora ? 0 : finFlora ? diasEntre(lote.flora_inicio, finFlora) : diaDeEtapa(lote.flora_inicio);
  const conSecado = Boolean(lote.secado_inicio);
  const diasSecado = lote.secado_inicio ? (cierre ? diasEntre(lote.secado_inicio, cierre) : diaDeEtapa(lote.secado_inicio)) : null;

  const e = ESTADO_LOTE[lote.estado] ?? ESTADO_LOTE.cerrado;
  const nombre = nombreLote(lote.codigo ?? `${lote.numero}`, lote.sala_flora_id ? salaNombre.get(lote.sala_flora_id) : null);

  return (
    <div className="max-w-4xl">
      <Link href="/panel/salas" className="text-sm text-accent hover:underline">
        ← Salas & Cultivo
      </Link>
      <div className="flex flex-wrap items-center gap-3 mt-2 mb-4">
        <h1 className="font-display text-2xl font-bold text-text">{nombre}</h1>
        <Badge label={e.label} color={e.color} />
      </div>
      <p className="text-text-soft text-sm mb-4">
        Corte de esquejes: {fmtFecha(lote.corte_fecha)}
        {lote.sala_destino_id ? ` · Destino: ${nombreSala(lote.sala_destino_id)}` : ''}
      </p>
      {lote.notas && <p className="text-text-soft text-sm mb-4 whitespace-pre-wrap">{lote.notas}</p>}

      {/* Recorrido */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-xs font-semibold uppercase text-purple">Flora</p>
          {enFlora ? (
            <>
              <p className="font-display font-bold text-text">{nombreSala(lote.sala_flora_id)}</p>
              <p className="text-sm text-text-soft">
                {fmtFecha(lote.flora_inicio)} → {finFlora ? fmtFecha(finFlora) : 'hoy'}
              </p>
              <p className="text-sm text-text">
                {lote.estado === 'flora' ? `Día ${diasFlora} de ${lote.dias_flora}` : `${diasFlora} días`}
              </p>
            </>
          ) : (
            <p className="text-sm text-text-mute">
              Todavía en {lote.estado === 'esquejes' ? 'esquejes' : 'vege'} (en {nombreSala(lote.sala_id)})
            </p>
          )}
        </div>
        <div className={`rounded-xl border p-4 ${lote.secado_inicio ? 'border-line bg-surface' : 'border-dashed border-line-2'}`}>
          <p className="text-xs font-semibold uppercase text-amber-tx">Secado y manicura</p>
          {lote.secado_inicio ? (
            <>
              <p className="font-display font-bold text-text">
                {lote.estado === 'secado' ? nombreSala(lote.sala_id) : 'Secado'}
              </p>
              <p className="text-sm text-text-soft">
                {fmtFecha(lote.secado_inicio)} → {cierre ? fmtFecha(cierre) : 'hoy'}
              </p>
              <p className="text-sm text-text">{lote.estado === 'secado' ? `Día ${diasSecado}` : `${diasSecado} días`}</p>
            </>
          ) : (
            <p className="text-sm text-text-mute">{cierre ? 'No pasó por secado' : 'Pendiente'}</p>
          )}
        </div>
        <div className={`rounded-xl border p-4 ${cierre && conSecado ? 'border-line bg-surface' : 'border-dashed border-line-2'}`}>
          <p className="text-xs font-semibold uppercase text-accent">Stock</p>
          {cierre && conSecado ? (
            <>
              <p className="font-display font-bold text-text">{fmtGramos(totSeco)}</p>
              <p className="text-sm text-text-soft">Ingresó el {fmtFecha(cierre)}</p>
              <p className="text-sm text-text">
                Ciclo total: {diasEntre(lote.corte_fecha ?? lote.flora_inicio, cierre)} días
              </p>
            </>
          ) : (
            <p className="text-sm text-text-mute">{cierre ? 'Todo fue a extracción / aceites' : 'Pendiente'}</p>
          )}
        </div>
      </div>

      {/* Genéticas y pesajes */}
      <h2 className="font-display text-lg font-bold text-text mb-2">Genéticas</h2>
      <div className="rounded-xl border border-line bg-surface overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-xs text-text-soft">
            <tr>
              <th className="text-left font-semibold px-3 py-2">Genética</th>
              <th className="text-right font-semibold px-3 py-2">Plantas</th>
              <th className="text-right font-semibold px-3 py-2">Húmedo</th>
              <th className="text-right font-semibold px-3 py-2">Seco</th>
              <th className="text-right font-semibold px-3 py-2">Trim</th>
              <th className="text-right font-semibold px-3 py-2">g/planta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {lista.map((f) => (
              <tr key={f.strainId}>
                <td className="px-3 py-2">{f.nombre}</td>
                <td className="px-3 py-2 text-right">{f.plantas}</td>
                <td className="px-3 py-2 text-right">{f.humedo ? fmtGramos(Number(f.humedo)) : '—'}</td>
                <td className="px-3 py-2 text-right">{f.seco ? fmtGramos(Number(f.seco)) : '—'}</td>
                <td className="px-3 py-2 text-right">{f.trim ? fmtGramos(Number(f.trim)) : '—'}</td>
                <td className="px-3 py-2 text-right">{f.seco && f.plantas ? fmtGramos(Number(f.seco) / f.plantas) : '—'}</td>
              </tr>
            ))}
            {lista.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-text-mute">
                  Sin plantas registradas.
                </td>
              </tr>
            )}
          </tbody>
          {lista.length > 1 && (
            <tfoot className="bg-surface-2 font-semibold">
              <tr>
                <td className="px-3 py-2">Total</td>
                <td className="px-3 py-2 text-right">{totPlantas}</td>
                <td className="px-3 py-2 text-right">{totHumedo ? fmtGramos(totHumedo) : '—'}</td>
                <td className="px-3 py-2 text-right">{totSeco ? fmtGramos(totSeco) : '—'}</td>
                <td className="px-3 py-2 text-right">{totTrim ? fmtGramos(totTrim) : '—'}</td>
                <td className="px-3 py-2 text-right">{totSeco && totPlantas ? fmtGramos(totSeco / totPlantas) : '—'}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {(procesos ?? []).length > 0 && (
        <>
          <h2 className="font-display text-lg font-bold text-text mb-2">Extracción y aceites</h2>
          <div className="rounded-xl border border-line bg-surface overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-xs text-text-soft">
                <tr>
                  <th className="text-left font-semibold px-3 py-2">Proceso</th>
                  <th className="text-left font-semibold px-3 py-2">Genética</th>
                  <th className="text-right font-semibold px-3 py-2">Plantas</th>
                  <th className="text-right font-semibold px-3 py-2">Destinado</th>
                  <th className="text-right font-semibold px-3 py-2">Rindió</th>
                  <th className="text-right font-semibold px-3 py-2">%</th>
                  <th className="text-left font-semibold px-3 py-2">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(procesos ?? []).map(
                  (pr: {
                    id: string;
                    origen: string;
                    tipo: string;
                    plantas: number | null;
                    peso_entrada: number | null;
                    estado: string;
                    resultado: number | null;
                    unidad: string | null;
                    nota: string | null;
                    strain: { name: string } | { name: string }[] | null;
                    producto: { name: string } | { name: string }[] | null;
                  }) => {
                    const entrada = pr.peso_entrada == null ? null : Number(pr.peso_entrada);
                    const res = pr.resultado == null ? null : Number(pr.resultado);
                    return (
                      <tr key={pr.id}>
                        <td className="px-3 py-2">
                          {pr.tipo === 'extraccion' ? 'Extracción' : 'Aceites'}
                          <span className="block text-xs text-text-mute">{pr.origen === 'stock' ? 'Desde stock' : 'Al cosechar'}</span>
                          {pr.nota && <span className="block text-xs text-text-mute">{pr.nota}</span>}
                        </td>
                        <td className="px-3 py-2">{uno(pr.strain)?.name ?? '—'}</td>
                        <td className="px-3 py-2 text-right">{pr.plantas ?? '—'}</td>
                        <td className="px-3 py-2 text-right">{entrada ? fmtGramos(entrada) : '—'}</td>
                        <td className="px-3 py-2 text-right">
                          {pr.estado === 'pendiente' ? (
                            <span className="text-amber-tx">En proceso</span>
                          ) : res != null ? (
                            `${res.toLocaleString('es-AR', { maximumFractionDigits: 1 })} ${pr.unidad ?? ''}`
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {res != null && entrada && pr.unidad === 'g'
                            ? `${((res / entrada) * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 })} %`
                            : '—'}
                        </td>
                        <td className="px-3 py-2 text-text-soft">{uno(pr.producto)?.name ?? '—'}</td>
                      </tr>
                    );
                  },
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {(manicuras ?? []).length > 0 && (
        <>
          <h2 className="font-display text-lg font-bold text-text mb-2">Manicura</h2>
          <div className="rounded-xl border border-line bg-surface overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-xs text-text-soft">
                <tr>
                  <th className="text-left font-semibold px-3 py-2">Fecha</th>
                  <th className="text-left font-semibold px-3 py-2">Genética</th>
                  <th className="text-right font-semibold px-3 py-2">Plantas</th>
                  <th className="text-right font-semibold px-3 py-2">Flor</th>
                  <th className="text-right font-semibold px-3 py-2">Trim</th>
                  <th className="text-left font-semibold px-3 py-2">Quién</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(manicuras ?? []).map(
                  (m: {
                    id: string;
                    fecha: string;
                    peso_seco: number;
                    peso_trim: number | null;
                    plantas: number | null;
                    operario: string | null;
                    nota: string | null;
                    strain: { name: string } | { name: string }[] | null;
                  }) => (
                    <tr key={m.id}>
                      <td className="px-3 py-2">{fmtFecha(m.fecha)}</td>
                      <td className="px-3 py-2">
                        {uno(m.strain)?.name ?? '—'}
                        {m.nota && <span className="block text-xs text-text-mute">{m.nota}</span>}
                      </td>
                      <td className="px-3 py-2 text-right">{m.plantas ?? '—'}</td>
                      <td className="px-3 py-2 text-right">{Number(m.peso_seco) > 0 ? fmtGramos(Number(m.peso_seco)) : '—'}</td>
                      <td className="px-3 py-2 text-right">{m.peso_trim ? fmtGramos(Number(m.peso_trim)) : '—'}</td>
                      <td className="px-3 py-2 text-text-soft">{m.operario ?? '—'}</td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Historial */}
      <h2 className="font-display text-lg font-bold text-text mb-2">Historial</h2>
      <div className="rounded-xl border border-line bg-surface divide-y divide-line">
        {(movs ?? []).map(
          (m: {
            id: string;
            created_at: string;
            tipo: string;
            sala_origen_id: string | null;
            sala_destino_id: string | null;
            plantas: number | null;
            gramos: number | null;
            nota: string | null;
            strain: { name: string } | { name: string }[] | null;
            autor: { name: string } | { name: string }[] | null;
          }) => (
            <div key={m.id} className="px-3 py-2 text-sm flex flex-wrap gap-x-3 gap-y-0.5">
              <span className="text-text-mute w-32 shrink-0">{fmtDateTime(m.created_at)}</span>
              <span className="font-semibold text-text w-24 shrink-0">{TIPO_MOV[m.tipo] ?? m.tipo}</span>
              <span className="text-text-soft flex-1 min-w-48">
                {uno(m.strain)?.name ?? ''}
                {m.plantas ? ` · ${m.plantas} plantas` : ''}
                {m.gramos ? ` · ${fmtGramos(Number(m.gramos))}` : ''}
                {m.sala_origen_id || m.sala_destino_id
                  ? ` · ${m.sala_origen_id ? nombreSala(m.sala_origen_id) : ''}${m.sala_origen_id && m.sala_destino_id ? ' → ' : ''}${m.sala_destino_id ? nombreSala(m.sala_destino_id) : ''}`
                  : ''}
                {m.nota ? ` · ${m.nota}` : ''}
              </span>
              <span className="text-text-mute text-xs">{uno(m.autor)?.name ?? ''}</span>
            </div>
          ),
        )}
        {(movs ?? []).length === 0 && <p className="px-3 py-6 text-center text-text-mute text-sm">Sin movimientos.</p>}
      </div>
    </div>
  );
}
