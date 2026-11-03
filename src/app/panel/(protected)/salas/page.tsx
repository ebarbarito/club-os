import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth/get-session-profile';
import { ROLES } from '@/lib/roles';
import { Badge } from '@/components/badge';
import { ModalTrigger } from '@/components/modal-trigger';
import { fmtDate } from '@/lib/format';
import {
  DESTINOS,
  TIPO_COLOR,
  codigoLote,
  diaDeEtapa,
  fmtFecha,
  fmtGramos,
  sumarDias,
  tipoLabel,
  type GrupoPlantas,
  type LoteResumen,
  type TipoSala,
} from '@/lib/cultivo';
import { SalaForm } from './sala-form';
import {
  CargarPlantasForm,
  CosecharForm,
  DescartarForm,
  EditarLoteForm,
  MoverForm,
  ProcesoForm,
  StockForm,
  type DestinoSala,
} from './cultivo-forms';

const btnSec =
  'rounded-lg border border-line-2 text-xs font-semibold px-3 py-1.5 hover:border-accent hover:text-accent';
const btnPri = 'rounded-lg bg-accent text-white text-xs font-semibold px-3 py-1.5';

type Sala = {
  id: string;
  name: string;
  tipo: string;
  orden: number;
  capacity: number;
  responsable: string | null;
  temp_min: number | null;
  temp_max: number | null;
  hum_min: number | null;
  hum_max: number | null;
  sensor_id: string | null;
};

export default async function SalasPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect('/panel/login');
  if (profile.role !== 'admin' && profile.role !== 'cultivo') redirect(`/panel/${ROLES[profile.role].home}`);

  const supabase = await createClient();

  const [
    { data: salaRows },
    { data: plantRows },
    { data: loteRows },
    { data: strainRows },
    { data: pesajeRows },
    { data: procesoRows },
    { data: productoRows },
  ] = await Promise.all([
      supabase
        .from('salas')
        .select('id, name, tipo, orden, capacity, responsable, temp_min, temp_max, hum_min, hum_max, sensor_id')
        .order('orden')
        .order('name'),
      supabase
        .from('sala_strains')
        .select('id, sala_id, strain_id, plants, lote_id, es_madre, ingreso_at, strain:strains(name)')
        .gt('plants', 0),
      supabase
        .from('lotes')
        .select('id, numero, estado, sala_id, sala_flora_id, flora_inicio, dias_flora, secado_inicio, cerrado_at, notas')
        .order('numero', { ascending: false })
        .limit(60),
      supabase.from('strains').select('id, name').eq('item_type', 'genetica').neq('status', 'inactiva').order('name'),
      supabase.from('lote_pesajes').select('lote_id, strain_id, plantas, peso_humedo, peso_seco'),
      supabase
        .from('lote_procesos')
        .select('id, lote_id, tipo, plantas, peso_entrada, created_at, strain:strains!lote_procesos_strain_id_fkey(name), lote:lotes(numero)')
        .eq('estado', 'pendiente')
        .order('created_at'),
      supabase.from('strains').select('id, name').neq('status', 'inactiva').order('name'),
    ]);

  const salas: Sala[] = salaRows ?? [];
  const strains: { id: string; name: string }[] = strainRows ?? [];
  const isAdmin = profile.role === 'admin';

  const grupos: (GrupoPlantas & { salaId: string })[] = (plantRows ?? []).map(
    (r: {
      id: string;
      sala_id: string;
      strain_id: string;
      plants: number;
      lote_id: string | null;
      es_madre: boolean;
      ingreso_at: string;
      strain: { name: string } | { name: string }[] | null;
    }) => {
      const strain = Array.isArray(r.strain) ? r.strain[0] : r.strain;
      return {
        id: r.id,
        salaId: r.sala_id,
        strainId: r.strain_id,
        strainName: strain?.name ?? '—',
        plants: r.plants,
        loteId: r.lote_id,
        esMadre: r.es_madre,
        ingresoAt: r.ingreso_at,
      };
    },
  );
  grupos.sort((a, b) => a.strainName.localeCompare(b.strainName, 'es'));

  const lotes: (LoteResumen & { salaFloraId: string | null; cerradoAt: string | null })[] = (loteRows ?? []).map(
    (l: {
      id: string;
      numero: number;
      estado: LoteResumen['estado'];
      sala_id: string | null;
      sala_flora_id: string | null;
      flora_inicio: string;
      dias_flora: number;
      secado_inicio: string | null;
      cerrado_at: string | null;
      notas: string | null;
    }) => ({
      id: l.id,
      numero: l.numero,
      estado: l.estado,
      salaId: l.sala_id,
      salaFloraId: l.sala_flora_id,
      floraInicio: l.flora_inicio,
      diasFlora: l.dias_flora,
      secadoInicio: l.secado_inicio,
      cerradoAt: l.cerrado_at,
      notas: l.notas,
    }),
  );
  const pesajes: { lote_id: string; strain_id: string; plantas: number; peso_humedo: number | null; peso_seco: number | null }[] =
    pesajeRows ?? [];

  const productos: { id: string; name: string }[] = productoRows ?? [];
  const procesos = (procesoRows ?? []).map(
    (r: {
      id: string;
      lote_id: string;
      tipo: 'extraccion' | 'aceite';
      plantas: number;
      peso_entrada: number | null;
      created_at: string;
      strain: { name: string } | { name: string }[] | null;
      lote: { numero: number } | { numero: number }[] | null;
    }) => {
      const strain = Array.isArray(r.strain) ? r.strain[0] : r.strain;
      const lote = Array.isArray(r.lote) ? r.lote[0] : r.lote;
      return {
        id: r.id,
        loteId: r.lote_id,
        loteNumero: lote?.numero ?? 0,
        tipo: r.tipo,
        strainName: strain?.name ?? '—',
        plantas: r.plantas,
        pesoEntrada: r.peso_entrada == null ? null : Number(r.peso_entrada),
        creado: r.created_at,
      };
    },
  );

  const proximoLote = Math.max(0, ...lotes.map((l) => l.numero)) + 1;
  const salaNombre = new Map(salas.map((s) => [s.id, s.name]));
  const loteEnFlora = (salaId: string) => lotes.find((l) => l.salaId === salaId && l.estado === 'flora') ?? null;
  const lineasDeLote = (loteId: string) => {
    const porStrain = new Map<string, { strainId: string; strainName: string; plants: number }>();
    for (const g of grupos.filter((g) => g.loteId === loteId)) {
      const prev = porStrain.get(g.strainId);
      if (prev) prev.plants += g.plants;
      else porStrain.set(g.strainId, { strainId: g.strainId, strainName: g.strainName, plants: g.plants });
    }
    return [...porStrain.values()];
  };

  const destinosDe = (sala: Sala): DestinoSala[] =>
    salas
      .filter((d) => d.id !== sala.id && (DESTINOS[sala.tipo] ?? []).includes(d.tipo as TipoSala))
      .map((d) => {
        const l = d.tipo === 'flora' ? loteEnFlora(d.id) : null;
        return { id: d.id, name: d.name, tipo: d.tipo, loteNumero: l?.numero ?? null, loteDia: l ? diaDeEtapa(l.floraInicio) : null };
      })
      // Primero la sala siguiente directa (vege antes que flora).
      .sort((a, b) => (a.tipo === b.tipo ? 0 : a.tipo === 'vege' ? -1 : 1));

  const salasSecado = salas.filter((s) => s.tipo === 'secado').map((s) => ({ id: s.id, name: s.name }));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-text">Salas & Cultivo</h1>
          <p className="text-text-soft text-sm">
            Madres y esquejes → Vege → Flora → Secado → Stock. El lote nace al entrar a flora.
          </p>
        </div>
        {isAdmin && (
          <ModalTrigger label="+ Nueva sala" title="Nueva sala">
            <SalaForm />
          </ModalTrigger>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {salas.map((s) => {
          const enSala = grupos.filter((g) => g.salaId === s.id);
          const total = enSala.reduce((sum, g) => sum + g.plants, 0);
          const ocupacion = s.capacity > 0 ? Math.min(100, (total / s.capacity) * 100) : 0;
          const lote = s.tipo === 'flora' ? loteEnFlora(s.id) : null;
          const destinos = destinosDe(s);
          const movibles = enSala.filter((g) => !g.esMadre);

          return (
            <div key={s.id} className="rounded-xl border border-line bg-surface p-4 flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <h3 className="font-display font-bold text-text leading-tight">{s.name}</h3>
                  {s.responsable && <p className="text-text-mute text-xs">Resp.: {s.responsable}</p>}
                </div>
                <Badge label={tipoLabel(s.tipo)} color={TIPO_COLOR[s.tipo] ?? 'gray'} />
              </div>

              {s.tipo === 'flora' && (
                <FloraResumen lote={lote} />
              )}

              {s.tipo === 'secado' ? (
                <SecadoLotes
                  lotes={lotes.filter((l) => l.salaId === s.id && l.estado === 'secado')}
                  lineasDeLote={lineasDeLote}
                  pesajes={pesajes}
                  salaFloraNombre={(id) => (id ? salaNombre.get(id) ?? '—' : '—')}
                />
              ) : (
                <ListaPlantas grupos={enSala} tipo={s.tipo} />
              )}

              {s.capacity > 0 && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-text-mute mb-1">
                    <span>Ocupación</span>
                    <span>
                      {total}/{s.capacity}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
                    <div className={`h-full ${total > s.capacity ? 'bg-red' : 'bg-accent'}`} style={{ width: `${ocupacion}%` }} />
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-line">
                {(s.tipo === 'madres' || s.tipo === 'vege') && (
                  <ModalTrigger label="Pasar a… →" className={btnPri} title={`Pasar plantas desde ${s.name}`}>
                    <MoverForm origenId={s.id} grupos={movibles} destinos={destinos} proximoLote={proximoLote} />
                  </ModalTrigger>
                )}
                {s.tipo === 'flora' && lote && (
                  <ModalTrigger label="Cosechar →" className={btnPri} title={`Cosechar ${codigoLote(lote.numero)}`}>
                    <CosecharForm
                      loteId={lote.id}
                      loteNumero={lote.numero}
                      lineas={lineasDeLote(lote.id)}
                      salasSecado={salasSecado}
                    />
                  </ModalTrigger>
                )}
                {s.tipo !== 'secado' && (
                  <ModalTrigger
                    label={s.tipo === 'madres' ? '+ Esquejes / madres' : '+ Cargar plantas'}
                    className={btnSec}
                    title={`Cargar plantas en ${s.name}`}
                  >
                    <CargarPlantasForm
                      salaId={s.id}
                      tipo={s.tipo}
                      strains={strains}
                      loteNumero={lote?.numero ?? null}
                      proximoLote={proximoLote}
                    />
                  </ModalTrigger>
                )}
                {lote && (
                  <ModalTrigger label="Editar lote" className={btnSec} title={`Editar ${codigoLote(lote.numero)}`}>
                    <EditarLoteForm lote={lote} />
                  </ModalTrigger>
                )}
                {s.tipo !== 'secado' && enSala.length > 0 && (
                  <ModalTrigger label="Descartar" className={btnSec} title={`Descartar plantas — ${s.name}`}>
                    <DescartarForm grupos={enSala} />
                  </ModalTrigger>
                )}
                {isAdmin && (
                  <ModalTrigger label="Configurar" className={`${btnSec} ml-auto`} title={`Configurar — ${s.name}`}>
                    <SalaForm sala={s} />
                  </ModalTrigger>
                )}
              </div>
            </div>
          );
        })}

        {(() => {
          const cls =
            'rounded-xl border border-dashed border-line-2 p-4 flex flex-col justify-center items-center text-center';
          const contenido = (
            <>
              <span className="font-display font-bold text-text">Stock</span>
              <span className="text-text-soft text-sm">Lo que sale de secado entra al stock general por genética.</span>
            </>
          );
          return isAdmin ? (
            <Link href="/panel/stock" className={`${cls} hover:border-accent`}>
              {contenido}
            </Link>
          ) : (
            <div className={cls}>{contenido}</div>
          );
        })()}

        {salas.length === 0 && (
          <p className="col-span-full text-center text-text-mute py-10">Sin salas cargadas todavía.</p>
        )}
      </div>

      {procesos.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-lg font-bold text-text mb-2">Extracción y aceites en proceso</h2>
          <div className="rounded-xl border border-line bg-surface divide-y divide-line">
            {procesos.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-sm">
                <Badge label={p.tipo === 'extraccion' ? 'Extracción' : 'Aceites'} color={p.tipo === 'extraccion' ? 'blue' : 'amber'} />
                <Link href={`/panel/salas/lotes/${p.loteId}`} className="font-semibold text-accent hover:underline">
                  {codigoLote(p.loteNumero)}
                </Link>
                <span className="flex-1 min-w-40 text-text-soft">
                  {p.strainName} · {p.plantas} plantas{p.pesoEntrada ? ` · ${fmtGramos(p.pesoEntrada)}` : ''} · desde{' '}
                  {fmtDate(p.creado)}
                </span>
                <ModalTrigger label="Cargar resultado" className={btnPri} title={`Resultado — ${codigoLote(p.loteNumero)}`}>
                  <ProcesoForm proceso={p} productos={productos} />
                </ModalTrigger>
              </div>
            ))}
          </div>
        </section>
      )}

      <LotesTabla lotes={lotes} grupos={grupos} pesajes={pesajes} salaNombre={salaNombre} />
    </div>
  );
}

// ── Piezas de la tarjeta ───────────────────────────────────────────────────

function FloraResumen({ lote }: { lote: (LoteResumen & { cerradoAt: string | null }) | null }) {
  if (!lote) {
    return (
      <p className="rounded-lg bg-surface-2 text-text-soft text-sm px-3 py-2 mb-3">
        Sala libre. El próximo lote nace cuando pasen plantas desde vege.
      </p>
    );
  }
  const dia = diaDeEtapa(lote.floraInicio);
  const pct = Math.min(100, (dia / Math.max(1, lote.diasFlora)) * 100);
  const cosecha = sumarDias(lote.floraInicio, lote.diasFlora - 1);
  const pasado = dia > lote.diasFlora;
  return (
    <div className="rounded-lg bg-purple-bg px-3 py-2.5 mb-3">
      <div className="flex items-baseline justify-between gap-2">
        <Link href={`/panel/salas/lotes/${lote.id}`} className="font-display font-bold text-purple hover:underline">
          Lote {codigoLote(lote.numero)}
        </Link>
        <span className="font-display text-2xl font-bold text-purple leading-none">Día {dia}</span>
      </div>
      <div className="h-1.5 rounded-full bg-surface/60 overflow-hidden mt-2">
        <div className={`h-full ${pasado ? 'bg-red' : 'bg-purple'}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-xs text-text-soft mt-1">
        <span>Inicio {fmtFecha(lote.floraInicio)}</span>
        <span className={pasado ? 'text-red font-semibold' : ''}>
          Cosecha est. {fmtFecha(cosecha)} ({lote.diasFlora} días)
        </span>
      </div>
    </div>
  );
}

function ListaPlantas({ grupos, tipo }: { grupos: GrupoPlantas[]; tipo: string }) {
  if (grupos.length === 0) return <p className="text-text-mute text-sm">Sin plantas.</p>;
  const madres = grupos.filter((g) => g.esMadre);
  const resto = grupos.filter((g) => !g.esMadre);
  const conDias = tipo === 'madres' || tipo === 'vege';
  const fila = (g: GrupoPlantas) => (
    <li key={g.id} className="flex justify-between gap-2">
      <span className="truncate">{g.strainName}</span>
      <span className="shrink-0 text-text-mute">
        {g.plants}
        {conDias && !g.esMadre ? ` · día ${diaDeEtapa(g.ingresoAt)}` : ''}
      </span>
    </li>
  );
  return (
    <div className="text-sm text-text-soft space-y-2">
      {madres.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-text-mute uppercase">Madres · {madres.reduce((s, g) => s + g.plants, 0)}</p>
          <ul className="max-h-40 overflow-y-auto">{madres.map(fila)}</ul>
        </div>
      )}
      {resto.length > 0 && (
        <div>
          {tipo === 'madres' && (
            <p className="text-xs font-semibold text-text-mute uppercase">Esquejes · {resto.reduce((s, g) => s + g.plants, 0)}</p>
          )}
          <ul className="max-h-56 overflow-y-auto">{resto.map(fila)}</ul>
        </div>
      )}
    </div>
  );
}

function SecadoLotes({
  lotes,
  lineasDeLote,
  pesajes,
  salaFloraNombre,
}: {
  lotes: (LoteResumen & { salaFloraId: string | null })[];
  lineasDeLote: (id: string) => { strainId: string; strainName: string; plants: number }[];
  pesajes: { lote_id: string; strain_id: string; peso_humedo: number | null }[];
  salaFloraNombre: (id: string | null) => string;
}) {
  if (lotes.length === 0) return <p className="text-text-mute text-sm">Sin lotes secándose.</p>;
  return (
    <div className="space-y-3">
      {lotes.map((l) => {
        const lineas = lineasDeLote(l.id);
        const humedos = Object.fromEntries(
          pesajes.filter((p) => p.lote_id === l.id).map((p) => [p.strain_id, p.peso_humedo]),
        );
        const plantas = lineas.reduce((s, x) => s + x.plants, 0);
        return (
          <div key={l.id} className="rounded-lg border border-line-2 p-3">
            <div className="flex items-baseline justify-between gap-2">
              <Link href={`/panel/salas/lotes/${l.id}`} className="font-display font-bold text-amber-tx hover:underline">
                Lote {codigoLote(l.numero)}
              </Link>
              <span className="font-display text-xl font-bold text-amber-tx">Día {diaDeEtapa(l.secadoInicio)}</span>
            </div>
            <p className="text-xs text-text-mute mb-2">
              De {salaFloraNombre(l.salaFloraId)} · {plantas} plantas · {lineas.length} genéticas
            </p>
            <div className="flex flex-wrap gap-2">
              <ModalTrigger label="Pesar y enviar a stock" className={btnPri} title={`Pesaje final — ${codigoLote(l.numero)}`}>
                <StockForm loteId={l.id} loteNumero={l.numero} lineas={lineas} humedos={humedos} />
              </ModalTrigger>
              <ModalTrigger label="Editar lote" className={btnSec} title={`Editar ${codigoLote(l.numero)}`}>
                <EditarLoteForm lote={l} />
              </ModalTrigger>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LotesTabla({
  lotes,
  grupos,
  pesajes,
  salaNombre,
}: {
  lotes: (LoteResumen & { salaFloraId: string | null; cerradoAt: string | null })[];
  grupos: GrupoPlantas[];
  pesajes: { lote_id: string; plantas: number; peso_seco: number | null }[];
  salaNombre: Map<string, string>;
}) {
  if (lotes.length === 0) return null;
  const ESTADO: Record<string, { label: string; color: 'purple' | 'amber' | 'gray' }> = {
    flora: { label: 'En flora', color: 'purple' },
    secado: { label: 'En secado', color: 'amber' },
    cerrado: { label: 'Cerrado', color: 'gray' },
  };
  return (
    <section className="mt-8">
      <h2 className="font-display text-lg font-bold text-text mb-2">Lotes</h2>
      <div className="rounded-xl border border-line bg-surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-xs text-text-soft">
            <tr>
              <th className="text-left font-semibold px-3 py-2">Lote</th>
              <th className="text-left font-semibold px-3 py-2">Estado</th>
              <th className="text-left font-semibold px-3 py-2">Sala de flora</th>
              <th className="text-left font-semibold px-3 py-2">Inicio flora</th>
              <th className="text-right font-semibold px-3 py-2">Plantas</th>
              <th className="text-right font-semibold px-3 py-2">Seco</th>
              <th className="text-right font-semibold px-3 py-2">g/planta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {lotes.map((l) => {
              const pes = pesajes.filter((p) => p.lote_id === l.id);
              const plantas =
                l.estado === 'cerrado'
                  ? pes.reduce((s, p) => s + p.plantas, 0)
                  : grupos.filter((g) => g.loteId === l.id).reduce((s, g) => s + g.plants, 0);
              const seco = pes.reduce((s, p) => s + (Number(p.peso_seco) || 0), 0);
              const e = ESTADO[l.estado];
              return (
                <tr key={l.id} className="hover:bg-surface-2">
                  <td className="px-3 py-2 font-semibold">
                    <Link href={`/panel/salas/lotes/${l.id}`} className="text-accent hover:underline">
                      {codigoLote(l.numero)}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <Badge label={e.label} color={e.color} />
                  </td>
                  <td className="px-3 py-2 text-text-soft">{l.salaFloraId ? salaNombre.get(l.salaFloraId) ?? '—' : '—'}</td>
                  <td className="px-3 py-2 text-text-soft">{fmtFecha(l.floraInicio)}</td>
                  <td className="px-3 py-2 text-right">{plantas}</td>
                  <td className="px-3 py-2 text-right">{seco > 0 ? fmtGramos(seco) : '—'}</td>
                  <td className="px-3 py-2 text-right">{seco > 0 && plantas > 0 ? fmtGramos(seco / plantas) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
