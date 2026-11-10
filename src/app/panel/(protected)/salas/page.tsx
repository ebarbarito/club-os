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
  nombreLote,
  ESTADO_LOTE,
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
  CortarEsquejesForm,
  DescartarForm,
  DesdeStockForm,
  EditarLoteForm,
  ManicuraForm,
  MoverForm,
  ProcesoForm,
  TerminarSecadoForm,
  type AvanceManicura,
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
    { data: stockRows },
    { data: lotePesajesCerrados },
    { data: tenantRow },
    { data: manicuraRows },
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
        .select(
          'id, numero, codigo, estado, sala_id, sala_flora_id, sala_destino_id, corte_fecha, flora_inicio, dias_flora, secado_inicio, cerrado_at, notas',
        )
        .order('numero', { ascending: false })
        .limit(60),
      supabase.from('strains').select('id, name').eq('item_type', 'genetica').neq('status', 'inactiva').order('name'),
      supabase.from('lote_pesajes').select('lote_id, strain_id, plantas, peso_humedo, peso_seco'),
      supabase
        .from('lote_procesos')
        .select('id, lote_id, origen, tipo, plantas, peso_entrada, created_at, strain:strains!lote_procesos_strain_id_fkey(name), lote:lotes(numero, codigo)')
        .eq('estado', 'pendiente')
        .order('created_at'),
      supabase.from('strains').select('id, name').neq('status', 'inactiva').order('name'),
      supabase.from('stock_general').select('strain_id, grams, strain:strains(name, item_type)').gt('grams', 0),
      supabase.from('lote_pesajes').select('strain_id, peso_seco, lote:lotes(id, numero, codigo, estado)').gt('peso_seco', 0),
      supabase.from('tenants').select('lote_prefijo').eq('id', profile.tenantId).maybeSingle(),
      supabase.from('lote_manicuras').select('lote_id, strain_id, peso_seco, peso_trim, plantas, fecha').is('anulada_at', null),
    ]);

  const prefijo: string | null = tenantRow?.lote_prefijo ?? null;

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
        loteCodigo: null as string | null,
        esMadre: r.es_madre,
        ingresoAt: r.ingreso_at,
      };
    },
  );
  grupos.sort((a, b) => a.strainName.localeCompare(b.strainName, 'es'));

  const lotes: (LoteResumen & { cerradoAt: string | null })[] = (loteRows ?? []).map(
    (l: {
      id: string;
      numero: number;
      codigo: string | null;
      estado: LoteResumen['estado'];
      sala_id: string | null;
      sala_flora_id: string | null;
      sala_destino_id: string | null;
      corte_fecha: string | null;
      flora_inicio: string | null;
      dias_flora: number;
      secado_inicio: string | null;
      cerrado_at: string | null;
      notas: string | null;
    }) => ({
      id: l.id,
      numero: l.numero,
      codigo: l.codigo ?? codigoLote(l.numero, prefijo),
      estado: l.estado,
      salaId: l.sala_id,
      salaFloraId: l.sala_flora_id,
      salaDestinoId: l.sala_destino_id,
      corteFecha: l.corte_fecha,
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
      lote_id: string | null;
      origen: string;
      tipo: 'extraccion' | 'aceite';
      plantas: number | null;
      peso_entrada: number | null;
      created_at: string;
      strain: { name: string } | { name: string }[] | null;
      lote: { numero: number; codigo: string | null } | { numero: number; codigo: string | null }[] | null;
    }) => {
      const strain = Array.isArray(r.strain) ? r.strain[0] : r.strain;
      const lote = Array.isArray(r.lote) ? r.lote[0] : r.lote;
      return {
        id: r.id,
        loteId: r.lote_id,
        loteCodigo: lote ? (lote.codigo ?? codigoLote(lote.numero, prefijo)) : null,
        origen: r.origen,
        tipo: r.tipo,
        strainName: strain?.name ?? '—',
        plantas: r.plantas,
        pesoEntrada: r.peso_entrada == null ? null : Number(r.peso_entrada),
        creado: r.created_at,
      };
    },
  );

  // Genéticas con stock general (para mandar material seco a un proceso) y
  // los lotes cerrados de cada una (lote de origen opcional).
  const stockGenetica = (stockRows ?? [])
    .map((r: { strain_id: string; grams: number; strain: { name: string; item_type: string } | { name: string; item_type: string }[] | null }) => {
      const st = Array.isArray(r.strain) ? r.strain[0] : r.strain;
      return { strainId: r.strain_id, name: st?.name ?? '—', grams: Number(r.grams), itemType: st?.item_type };
    })
    .filter((r: { itemType?: string }) => r.itemType === 'genetica')
    .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'es'));
  type LoteMin = { id: string; numero: number; codigo: string | null; estado: string };
  const lotesPorId = new Map<string, { id: string; numero: number; codigo: string; strainIds: string[] }>();
  for (const r of (lotePesajesCerrados ?? []) as { strain_id: string; lote: LoteMin | LoteMin[] | null }[]) {
    const l = Array.isArray(r.lote) ? r.lote[0] : r.lote;
    if (!l || l.estado !== 'cerrado') continue;
    const prev = lotesPorId.get(l.id) ?? { id: l.id, numero: l.numero, codigo: l.codigo ?? codigoLote(l.numero, prefijo), strainIds: [] };
    prev.strainIds.push(r.strain_id);
    lotesPorId.set(l.id, prev);
  }
  const lotesCerrados = [...lotesPorId.values()].sort((a, b) => b.numero - a.numero);

  const proximoCodigo = codigoLote(Math.max(0, ...lotes.map((l) => l.numero)) + 1, prefijo);
  const salaNombre = new Map(salas.map((s) => [s.id, s.name]));
  const loteById = new Map(lotes.map((l) => [l.id, l]));
  // Nombre a mostrar: código, y desde flora la sala ("GL-CUL-013 · 420").
  const nombreDe = (l: { codigo: string; salaFloraId: string | null }) =>
    nombreLote(l.codigo, l.salaFloraId ? salaNombre.get(l.salaFloraId) : null);
  for (const g of grupos) {
    const l = g.loteId ? loteById.get(g.loteId) : null;
    g.loteCodigo = l ? nombreDe(l) : null;
  }
  const salasFlora = salas.filter((s) => s.tipo === 'flora').map((s) => ({ id: s.id, name: s.name }));
  const lotesAbiertos = lotes
    .filter((l) => l.estado === 'esquejes' || l.estado === 'vege')
    .map((l) => ({
      id: l.id,
      codigo: l.codigo,
      destino: l.salaDestinoId ? (salaNombre.get(l.salaDestinoId) ?? null) : null,
      estado: l.estado,
    }));
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
        return { id: d.id, name: d.name, tipo: d.tipo, loteCodigo: l ? nombreDe(l) : null, loteDia: l ? diaDeEtapa(l.floraInicio) : null };
      })
      // Primero la sala siguiente directa (vege antes que flora).
      .sort((a, b) => (a.tipo === b.tipo ? 0 : a.tipo === 'vege' ? -1 : 1));

  // Avance de la manicura de un lote en secado, por genética.
  const manicuras: { lote_id: string; strain_id: string; peso_seco: number; peso_trim: number | null; plantas: number | null; fecha: string }[] =
    manicuraRows ?? [];
  const avanceDe = (loteId: string): AvanceManicura[] =>
    lineasDeLote(loteId).map((l) => {
      const ms = manicuras.filter((m) => m.lote_id === loteId && m.strain_id === l.strainId);
      return {
        ...l,
        seco: ms.reduce((s, m) => s + (Number(m.peso_seco) || 0), 0),
        trim: ms.reduce((s, m) => s + (Number(m.peso_trim) || 0), 0),
        plantasHechas: ms.reduce((s, m) => s + (m.plantas ?? 0), 0),
      };
    });
  const ultimaManicura = (loteId: string) =>
    manicuras.filter((m) => m.lote_id === loteId).reduce<string | null>((max, m) => (!max || m.fecha > max ? m.fecha : max), null);

  const salasSecado = salas.filter((s) => s.tipo === 'secado').map((s) => ({ id: s.id, name: s.name }));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-text">Salas & Cultivo</h1>
          <p className="text-text-soft text-sm">
            Madres y esquejes → Vege → Flora → Secado → Stock. El lote nace al cortar los esquejes.
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
                <FloraResumen lote={lote} nombre={lote ? nombreDe(lote) : ''} />
              )}

              {s.tipo === 'secado' ? (
                <SecadoLotes
                  lotes={lotes.filter((l) => l.salaId === s.id && l.estado === 'secado')}
                  avanceDe={avanceDe}
                  ultimaManicura={ultimaManicura}
                  salaFloraNombre={(id) => (id ? salaNombre.get(id) ?? '—' : '—')}
                  nombreDe={nombreDe}
                  salasFlora={salasFlora}
                />
              ) : (
                <ListaPlantas
                  grupos={enSala}
                  tipo={s.tipo}
                  destinoDe={(loteId) => {
                    const d = loteById.get(loteId)?.salaDestinoId;
                    return d ? (salaNombre.get(d) ?? null) : null;
                  }}
                />
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
                {s.tipo === 'madres' && (
                  <ModalTrigger label="✂ Cortar esquejes" className={btnPri} title={`Cortar esquejes — ${s.name}`}>
                    <CortarEsquejesForm
                      salaId={s.id}
                      madres={enSala
                        .filter((g) => g.esMadre)
                        .map((g) => ({ strainId: g.strainId, name: g.strainName, plants: g.plants }))}
                      lotesAbiertos={lotesAbiertos}
                      salasFlora={salasFlora}
                      proximoCodigo={proximoCodigo}
                    />
                  </ModalTrigger>
                )}
                {(s.tipo === 'madres' || s.tipo === 'vege') && (
                  <ModalTrigger label="Pasar a… →" className={btnPri} title={`Pasar plantas desde ${s.name}`}>
                    <MoverForm
                      origenId={s.id}
                      grupos={movibles}
                      destinos={destinos}
                      proximoCodigo={proximoCodigo}
                      destinoSugerido={
                        // Desde vege, la sala de destino que el lote eligió al cortar.
                        movibles.map((g) => (g.loteId ? loteById.get(g.loteId)?.salaDestinoId : null)).find(Boolean) ?? null
                      }
                    />
                  </ModalTrigger>
                )}
                {s.tipo === 'flora' && lote && (
                  <ModalTrigger label="Cosechar →" className={btnPri} title={`Cosechar ${nombreDe(lote)}`}>
                    <CosecharForm
                      loteId={lote.id}
                      loteCodigo={nombreDe(lote)}
                      lineas={lineasDeLote(lote.id)}
                      salasSecado={salasSecado}
                    />
                  </ModalTrigger>
                )}
                {s.tipo !== 'secado' && (
                  <ModalTrigger
                    label={s.tipo === 'madres' ? '+ Madres' : '+ Cargar plantas'}
                    className={btnSec}
                    title={s.tipo === 'madres' ? `Cargar madres en ${s.name}` : `Cargar plantas en ${s.name}`}
                  >
                    <CargarPlantasForm
                      salaId={s.id}
                      tipo={s.tipo}
                      strains={strains}
                      loteCodigo={lote ? nombreDe(lote) : null}
                      proximoCodigo={proximoCodigo}
                    />
                  </ModalTrigger>
                )}
                {lote && (
                  <ModalTrigger label="Editar lote" className={btnSec} title={`Editar ${nombreDe(lote)}`}>
                    <EditarLoteForm lote={lote} salasFlora={salasFlora} />
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

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h2 className="font-display text-lg font-bold text-text">Extracción y aceites</h2>
          <ModalTrigger label="+ Desde stock" className={btnSec} title="Enviar material seco a un proceso">
            <DesdeStockForm stock={stockGenetica} lotes={lotesCerrados} />
          </ModalTrigger>
        </div>
        {procesos.length === 0 ? (
          <p className="text-text-mute text-sm">
            Sin procesos en curso. Se derivan plantas al cosechar, o material seco desde stock con &quot;+ Desde stock&quot;.
          </p>
        ) : (
          <div className="rounded-xl border border-line bg-surface divide-y divide-line">
            {procesos.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-sm">
                <Badge label={p.tipo === 'extraccion' ? 'Extracción' : 'Aceites'} color={p.tipo === 'extraccion' ? 'blue' : 'amber'} />
                {p.loteId && p.loteCodigo ? (
                  <Link href={`/panel/salas/lotes/${p.loteId}`} className="font-semibold text-accent hover:underline">
                    {p.loteCodigo}
                  </Link>
                ) : (
                  <span className="font-semibold text-text-soft">Stock</span>
                )}
                <span className="flex-1 min-w-40 text-text-soft">
                  {p.strainName}
                  {p.plantas ? ` · ${p.plantas} plantas` : ''}
                  {p.pesoEntrada ? ` · ${fmtGramos(p.pesoEntrada)}` : ''}
                  {p.origen === 'stock' ? ' · desde stock' : ' · de cosecha'} · {fmtDate(p.creado)}
                </span>
                <ModalTrigger
                  label="Cargar resultado"
                  className={btnPri}
                  title={`Resultado — ${p.loteCodigo ?? 'desde stock'}`}
                >
                  <ProcesoForm proceso={p} productos={productos} />
                </ModalTrigger>
              </div>
            ))}
          </div>
        )}
      </section>

      <LotesTabla lotes={lotes} grupos={grupos} pesajes={pesajes} salaNombre={salaNombre} nombreDe={nombreDe} />
    </div>
  );
}

// ── Piezas de la tarjeta ───────────────────────────────────────────────────

function FloraResumen({ lote, nombre }: { lote: (LoteResumen & { cerradoAt: string | null }) | null; nombre: string }) {
  if (!lote || !lote.floraInicio) {
    return (
      <p className="rounded-lg bg-surface-2 text-text-soft text-sm px-3 py-2 mb-3">
        Sala libre. El próximo lote entra cuando pasen sus plantas desde vege.
      </p>
    );
  }
  const dia = diaDeEtapa(lote.floraInicio);
  const pct = Math.min(100, (dia / Math.max(1, lote.diasFlora)) * 100);
  const cosecha = sumarDias(lote.floraInicio, lote.diasFlora);
  const pasado = dia > lote.diasFlora;
  return (
    <div className="rounded-lg bg-purple-bg px-3 py-2.5 mb-3">
      <div className="flex items-baseline justify-between gap-2">
        <Link href={`/panel/salas/lotes/${lote.id}`} className="font-display font-bold text-purple hover:underline">
          {nombre}
        </Link>
        <span className="font-display text-2xl font-bold text-purple leading-none">
          Día {dia} <span className="text-sm font-semibold">de {lote.diasFlora}</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-surface/60 overflow-hidden mt-2">
        <div className={`h-full ${pasado ? 'bg-red' : 'bg-purple'}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-xs text-text-soft mt-1">
        <span>Inicio {fmtFecha(lote.floraInicio)}</span>
        <span className={pasado ? 'text-red font-semibold' : ''}>
          Cosecha est. {fmtFecha(cosecha)} (día {lote.diasFlora})
        </span>
      </div>
    </div>
  );
}

function ListaPlantas({
  grupos,
  tipo,
  destinoDe,
}: {
  grupos: GrupoPlantas[];
  tipo: string;
  destinoDe: (loteId: string) => string | null;
}) {
  if (grupos.length === 0) return <p className="text-text-mute text-sm">Sin plantas.</p>;
  const madres = grupos.filter((g) => g.esMadre);
  const resto = grupos.filter((g) => !g.esMadre);
  // En esquejes y vege las plantas se agrupan por lote.
  const porLote = new Map<string, GrupoPlantas[]>();
  for (const g of resto) {
    const k = g.loteId ?? '';
    porLote.set(k, [...(porLote.get(k) ?? []), g]);
  }
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
      {tipo === 'flora'
        ? resto.length > 0 && <ul className="max-h-56 overflow-y-auto">{resto.map(fila)}</ul>
        : [...porLote.entries()].map(([loteId, gs]) => {
            const destino = loteId ? destinoDe(loteId) : null;
            return (
              <div key={loteId || 'sin-lote'}>
                <p className="text-xs font-semibold text-text-mute uppercase">
                  {gs[0].loteCodigo ?? (tipo === 'madres' ? 'Esquejes sin lote' : 'Sin lote')} ·{' '}
                  {gs.reduce((s, g) => s + g.plants, 0)}
                  {destino ? <span className="normal-case font-normal"> → {destino}</span> : null}
                </p>
                <ul className="max-h-56 overflow-y-auto">{gs.map(fila)}</ul>
              </div>
            );
          })}
    </div>
  );
}

function SecadoLotes({
  lotes,
  avanceDe,
  ultimaManicura,
  salaFloraNombre,
  nombreDe,
  salasFlora,
}: {
  lotes: LoteResumen[];
  avanceDe: (id: string) => AvanceManicura[];
  ultimaManicura: (id: string) => string | null;
  salaFloraNombre: (id: string | null) => string;
  nombreDe: (l: { codigo: string; salaFloraId: string | null }) => string;
  salasFlora: { id: string; name: string }[];
}) {
  if (lotes.length === 0) return <p className="text-text-mute text-sm">Sin lotes secándose.</p>;
  return (
    <div className="space-y-3">
      {lotes.map((l) => {
        const avance = avanceDe(l.id);
        const plantas = avance.reduce((s, x) => s + x.plants, 0);
        const hechas = avance.reduce((s, x) => s + Math.min(x.plantasHechas, x.plants), 0);
        const seco = avance.reduce((s, x) => s + x.seco, 0);
        const ultima = ultimaManicura(l.id);
        const pct = plantas > 0 ? Math.min(100, (hechas / plantas) * 100) : 0;
        return (
          <div key={l.id} className="rounded-lg border border-line-2 p-3">
            <div className="flex items-baseline justify-between gap-2">
              <Link href={`/panel/salas/lotes/${l.id}`} className="font-display font-bold text-amber-tx hover:underline">
                {nombreDe(l)}
              </Link>
              <span className="font-display text-xl font-bold text-amber-tx">Día {diaDeEtapa(l.secadoInicio)}</span>
            </div>
            <p className="text-xs text-text-mute">
              De {salaFloraNombre(l.salaFloraId)} · {plantas} plantas · {avance.length} genéticas
            </p>
            <div className="mt-2">
              <div className="flex justify-between text-xs text-text-soft mb-1">
                <span>
                  Manicura: {hechas}/{plantas} plantas · {fmtGramos(seco)} a stock
                </span>
                <span>
                  {ultima ? `Última: ${fmtFecha(ultima)} · ` : ''}
                  <Link href={`/panel/salas/lotes/${l.id}#manicura`} className="text-accent hover:underline">
                    {ultima ? 'ver / anular cargas' : 'sin cargas'}
                  </Link>
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
                <div className="h-full bg-amber" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              <ModalTrigger label="+ Manicura del día" className={btnPri} title={`Manicura — ${nombreDe(l)}`}>
                <ManicuraForm loteId={l.id} loteCodigo={nombreDe(l)} avance={avance} />
              </ModalTrigger>
              <ModalTrigger label="Terminar secado" className={btnSec} title={`Terminar secado — ${nombreDe(l)}`}>
                <TerminarSecadoForm loteId={l.id} loteCodigo={nombreDe(l)} avance={avance} />
              </ModalTrigger>
              <ModalTrigger label="Editar lote" className={btnSec} title={`Editar ${nombreDe(l)}`}>
                <EditarLoteForm lote={l} salasFlora={salasFlora} />
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
  nombreDe,
}: {
  lotes: (LoteResumen & { cerradoAt: string | null })[];
  grupos: GrupoPlantas[];
  pesajes: { lote_id: string; plantas: number; peso_seco: number | null }[];
  salaNombre: Map<string, string>;
  nombreDe: (l: { codigo: string; salaFloraId: string | null }) => string;
}) {
  if (lotes.length === 0) return null;
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
              <th className="text-left font-semibold px-3 py-2">Corte</th>
              <th className="text-left font-semibold px-3 py-2">Día 0 flora</th>
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
              const e = ESTADO_LOTE[l.estado] ?? ESTADO_LOTE.cerrado;
              const salaFlora = l.salaFloraId ?? l.salaDestinoId;
              return (
                <tr key={l.id} className="hover:bg-surface-2">
                  <td className="px-3 py-2 font-semibold">
                    <Link href={`/panel/salas/lotes/${l.id}`} className="text-accent hover:underline">
                      {nombreDe(l)}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <Badge label={e.label} color={e.color} />
                  </td>
                  <td className="px-3 py-2 text-text-soft">
                    {salaFlora ? (salaNombre.get(salaFlora) ?? '—') : '—'}
                    {!l.salaFloraId && l.salaDestinoId ? ' (destino)' : ''}
                  </td>
                  <td className="px-3 py-2 text-text-soft">{fmtFecha(l.corteFecha)}</td>
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
