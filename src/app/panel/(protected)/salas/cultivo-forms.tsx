'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useModalClose } from '@/components/modal-trigger';
import { fmtGramos, hoyAR, type GrupoPlantas } from '@/lib/cultivo';
import {
  anularManicura,
  cargarPlantas,
  cortarEsquejes,
  cosecharLote,
  descartarPlantas,
  editarLote,
  enviarLoteAStock,
  moverPlantas,
  procesoDesdeStock,
  registrarManicura,
  terminarProceso,
  terminarSecado,
} from './actions';

const inputCls = 'w-full rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent';
const labelCls = 'block text-xs font-medium text-text-soft mb-1';
const btnCls = 'w-full rounded-lg bg-accent text-white font-semibold text-sm py-2 disabled:opacity-60';

type Strain = { id: string; name: string };

// Envía, muestra el error si lo hay, y si sale bien cierra el modal y
// refresca la página.
function useEnvio() {
  const router = useRouter();
  const close = useModalClose();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function enviar(fn: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.error) {
        setError(res.error);
        return;
      }
      close();
      router.refresh();
    });
  }
  return { pending, error, setError, enviar };
}

function MsgError({ msg }: { msg: string | null }) {
  return msg ? <p className="text-red text-sm">{msg}</p> : null;
}

function numero(v: string): number | null {
  if (v.trim() === '') return null;
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

// ── Cargar plantas (esquejes nuevos, madres o correcciones) ────────────────

export function CargarPlantasForm({
  salaId,
  tipo,
  strains,
  loteCodigo,
  proximoCodigo,
}: {
  salaId: string;
  tipo: string;
  strains: Strain[];
  loteCodigo: string | null;
  proximoCodigo: string;
}) {
  const { pending, error, setError, enviar } = useEnvio();
  // En la sala de madres este formulario carga solo madres; los esquejes
  // entran con "Cortar esquejes" (ahí nace el lote).
  const soloMadres = tipo === 'madres';
  const [rows, setRows] = useState([{ strainId: '', plants: '', esMadre: soloMadres }]);
  const [nota, setNota] = useState('');

  function update(i: number, patch: Partial<(typeof rows)[number]>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function submit() {
    const items = rows
      .filter((r) => r.strainId && Number(r.plants) > 0)
      .map((r) => ({ strainId: r.strainId, plants: Math.round(Number(r.plants)), esMadre: soloMadres }));
    if (items.length === 0) {
      setError('Elegí la genética y la cantidad de plantas.');
      return;
    }
    enviar(() => cargarPlantas(salaId, items, nota));
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-soft">
        {soloMadres
          ? 'Plantas madre nuevas. Los esquejes se cargan con "✂ Cortar esquejes", que es donde nace el lote.'
          : tipo === 'flora'
            ? loteCodigo
              ? `Se suman al lote ${loteCodigo} de esta sala.`
              : `Se crea el lote ${proximoCodigo} con fecha de inicio de flora hoy.`
            : 'Plantas que entran a la sala sin venir de otra sala (por ejemplo, para corregir el conteo).'}
      </p>

      {rows.map((row, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <select value={row.strainId} onChange={(e) => update(i, { strainId: e.target.value })} className={`${inputCls} flex-1 min-w-40`}>
            <option value="">Genética…</option>
            {strains.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="1"
            inputMode="numeric"
            placeholder="Plantas"
            value={row.plants}
            onChange={(e) => update(i, { plants: e.target.value })}
            className={`${inputCls} w-24`}
          />
          {rows.length > 1 && (
            <button type="button" onClick={() => setRows((p) => p.filter((_, idx) => idx !== i))} className="text-red text-xs">
              Quitar
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => setRows((p) => [...p, { strainId: '', plants: '', esMadre: soloMadres }])}
        className="text-accent text-xs font-semibold"
      >
        + Agregar genética
      </button>

      <div>
        <label className={labelCls}>Nota (opcional)</label>
        <input value={nota} onChange={(e) => setNota(e.target.value)} className={inputCls} />
      </div>

      <MsgError msg={error} />
      <button type="button" disabled={pending} onClick={submit} className={btnCls}>
        {pending ? 'Guardando…' : soloMadres ? 'Cargar madres' : 'Cargar plantas'}
      </button>
    </div>
  );
}

// ── Pasar plantas a la sala siguiente ──────────────────────────────────────

export type DestinoSala = { id: string; name: string; tipo: string; loteCodigo: string | null; loteDia: number | null };

export function MoverForm({
  origenId,
  grupos,
  destinos,
  proximoCodigo,
  destinoSugerido,
}: {
  origenId: string;
  grupos: GrupoPlantas[];
  destinos: DestinoSala[];
  proximoCodigo: string;
  destinoSugerido?: string | null;
}) {
  const { pending, error, setError, enviar } = useEnvio();
  const [destino, setDestino] = useState(
    destinoSugerido && destinos.some((d) => d.id === destinoSugerido) ? destinoSugerido : (destinos[0]?.id ?? ''),
  );
  const [sel, setSel] = useState<Record<string, string>>({});

  const dest = destinos.find((d) => d.id === destino);
  const total = Object.values(sel).reduce((s, v) => s + (Number(v) || 0), 0);
  const todos = grupos.length > 0 && grupos.every((g) => sel[g.id] !== undefined);

  function toggle(g: GrupoPlantas, on: boolean) {
    setSel((prev) => {
      const next = { ...prev };
      if (on) next[g.id] = String(g.plants);
      else delete next[g.id];
      return next;
    });
  }

  function submit() {
    if (!destino) {
      setError('Elegí la sala de destino.');
      return;
    }
    const items = Object.entries(sel)
      .map(([id, v]) => ({ id, plants: Math.round(Number(v)) }))
      .filter((i) => i.plants > 0);
    if (items.length === 0) {
      setError('Marcá las genéticas y cuántas plantas pasan.');
      return;
    }
    const excede = items.find((i) => i.plants > (grupos.find((g) => g.id === i.id)?.plants ?? 0));
    if (excede) {
      setError('Hay una cantidad mayor a las plantas que tiene la sala.');
      return;
    }
    enviar(() => moverPlantas(origenId, destino, items));
  }

  if (destinos.length === 0) {
    return <p className="text-sm text-text-soft">No hay una sala de destino configurada para este paso.</p>;
  }
  if (grupos.length === 0) {
    return <p className="text-sm text-text-soft">No hay plantas para mover en esta sala.</p>;
  }

  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>Pasar a</label>
        <select value={destino} onChange={(e) => setDestino(e.target.value)} className={inputCls}>
          {destinos.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        {dest?.tipo === 'flora' && (
          <p className="text-xs mt-1 rounded-lg bg-purple-bg text-purple px-3 py-2">
            {dest.loteCodigo
              ? `${dest.name} ya tiene el lote ${dest.loteCodigo} en flora (día ${dest.loteDia}): solo se pueden sumar plantas de ese mismo lote.`
              : grupos.some((g) => !g.loteCodigo)
                ? `Las plantas entran a flora con su lote; las que no tienen lote forman el ${proximoCodigo}. Hoy es el día 0 de flora.`
                : 'Las plantas entran a flora con su lote. Hoy es el día 0 de flora.'}
          </p>
        )}
      </div>

      <div className="rounded-lg border border-line-2 divide-y divide-line">
        <label className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-text-soft bg-surface-2">
          <input
            type="checkbox"
            checked={todos}
            onChange={(e) =>
              setSel(e.target.checked ? Object.fromEntries(grupos.map((g) => [g.id, String(g.plants)])) : {})
            }
          />
          Seleccionar todas
        </label>
        {grupos.map((g) => {
          const on = sel[g.id] !== undefined;
          return (
            <div key={g.id} className="flex items-center gap-2 px-3 py-2">
              <input type="checkbox" checked={on} onChange={(e) => toggle(g, e.target.checked)} />
              <span className="flex-1 text-sm text-text">
                {g.strainName}
                <span className="text-text-mute text-xs">
                  {' '}
                  · {g.plants} plantas{g.loteCodigo ? ` · ${g.loteCodigo}` : ''}
                </span>
              </span>
              <input
                type="number"
                min="1"
                max={g.plants}
                inputMode="numeric"
                disabled={!on}
                value={sel[g.id] ?? ''}
                onChange={(e) => setSel((prev) => ({ ...prev, [g.id]: e.target.value }))}
                className={`${inputCls} w-20 disabled:opacity-40`}
              />
            </div>
          );
        })}
      </div>

      <MsgError msg={error} />
      <button type="button" disabled={pending} onClick={submit} className={btnCls}>
        {pending ? 'Moviendo…' : `Pasar ${total || ''} plantas${dest ? ` a ${dest.name}` : ''}`}
      </button>
    </div>
  );
}

// ── Descartar plantas ──────────────────────────────────────────────────────

export function DescartarForm({ grupos }: { grupos: GrupoPlantas[] }) {
  const { pending, error, setError, enviar } = useEnvio();
  const [id, setId] = useState(grupos[0]?.id ?? '');
  const [plants, setPlants] = useState('');
  const [nota, setNota] = useState('');
  const grupo = grupos.find((g) => g.id === id);

  function submit() {
    const n = Math.round(Number(plants));
    if (!grupo || !(n > 0)) {
      setError('Elegí la genética y cuántas plantas.');
      return;
    }
    if (n > grupo.plants) {
      setError(`Hay ${grupo.plants} plantas de ${grupo.strainName}.`);
      return;
    }
    enviar(() => descartarPlantas(grupo.id, n, nota));
  }

  if (grupos.length === 0) return <p className="text-sm text-text-soft">No hay plantas en esta sala.</p>;

  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>Genética</label>
        <select value={id} onChange={(e) => setId(e.target.value)} className={inputCls}>
          {grupos.map((g) => (
            <option key={g.id} value={g.id}>
              {g.strainName}
              {g.esMadre ? ' (madre)' : g.loteCodigo ? ` · ${g.loteCodigo}` : ''} · {g.plants} plantas
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls}>Plantas descartadas</label>
        <input type="number" min="1" inputMode="numeric" value={plants} onChange={(e) => setPlants(e.target.value)} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Motivo (opcional)</label>
        <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Plaga, hongo, macho, no enraizó…" className={inputCls} />
      </div>
      <MsgError msg={error} />
      <button type="button" disabled={pending} onClick={submit} className="w-full rounded-lg bg-red text-white font-semibold text-sm py-2 disabled:opacity-60">
        {pending ? 'Guardando…' : 'Registrar descarte'}
      </button>
    </div>
  );
}

// ── Cosechar: lo que no se deriva pasa a secado ────────────────────────────

type LineaLote = { strainId: string; strainName: string; plants: number };
type Deriv = { humedo: string; extP: string; aceP: string; abierta: boolean };
const DERIV_VACIA: Deriv = { humedo: '', extP: '', aceP: '', abierta: false };

export function CosecharForm({
  loteId,
  loteCodigo,
  lineas,
  salasSecado,
}: {
  loteId: string;
  loteCodigo: string;
  lineas: LineaLote[];
  salasSecado: { id: string; name: string }[];
}) {
  const { pending, error, setError, enviar } = useEnvio();
  const [sala, setSala] = useState(salasSecado[0]?.id ?? '');
  const [datos, setDatos] = useState<Record<string, Deriv>>({});

  const d = (id: string) => datos[id] ?? DERIV_VACIA;
  const set = (id: string, patch: Partial<Deriv>) => setDatos((p) => ({ ...p, [id]: { ...d(id), ...patch } }));
  const entero = (v: string) => Math.max(0, Math.round(Number(v) || 0));
  const aSecado = (l: LineaLote) => l.plants - entero(d(l.strainId).extP) - entero(d(l.strainId).aceP);

  const tot = lineas.reduce(
    (acc, l) => ({
      secado: acc.secado + Math.max(0, aSecado(l)),
      ext: acc.ext + entero(d(l.strainId).extP),
      ace: acc.ace + entero(d(l.strainId).aceP),
    }),
    { secado: 0, ext: 0, ace: 0 },
  );

  function submit() {
    for (const l of lineas) {
      if (aSecado(l) < 0) return setError(`${l.strainName} tiene ${l.plants} plantas: revisá lo derivado.`);
    }
    if (tot.secado > 0 && !sala) return setError('Creá una sala de tipo "Secado y manicura" para poder cosechar.');
    enviar(() =>
      cosecharLote(
        loteId,
        sala,
        lineas.map((l) => {
          const x = d(l.strainId);
          return {
            strainId: l.strainId,
            pesoHumedo: numero(x.humedo),
            extraccionPlantas: entero(x.extP),
            aceitePlantas: entero(x.aceP),
          };
        }),
      ),
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-soft">
        Cosecha del lote <strong>{loteCodigo}</strong>. Por cada genética podés derivar plantas a extracción o a
        aceites; el resto pasa a secado (hoy es el día 0 de secado).
      </p>
      {salasSecado.length > 1 && (
        <div>
          <label className={labelCls}>Sala de secado</label>
          <select value={sala} onChange={(e) => setSala(e.target.value)} className={inputCls}>
            {salasSecado.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="rounded-lg border border-line-2 divide-y divide-line">
        {lineas.map((l) => {
          const x = d(l.strainId);
          const sec = aSecado(l);
          return (
            <div key={l.strainId} className="px-3 py-2.5 space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex-1 text-sm text-text">
                  {l.strainName}
                  <span className={`block text-xs ${sec < 0 ? 'text-red' : 'text-text-mute'}`}>
                    {l.plants} plantas · {Math.max(0, sec)} a secado
                    {entero(x.extP) > 0 ? ` · ${entero(x.extP)} a extracción` : ''}
                    {entero(x.aceP) > 0 ? ` · ${entero(x.aceP)} a aceites` : ''}
                  </span>
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  inputMode="decimal"
                  placeholder="Húmedo g"
                  title="Peso húmedo de lo que va a secado (opcional)"
                  value={x.humedo}
                  onChange={(e) => set(l.strainId, { humedo: e.target.value })}
                  className={`${inputCls} w-28`}
                />
              </div>
              {!x.abierta ? (
                <button type="button" onClick={() => set(l.strainId, { abierta: true })} className="text-accent text-xs font-semibold">
                  + Derivar a extracción / aceites
                </button>
              ) : (
                <div className="grid grid-cols-[auto_1fr] items-center gap-2 text-xs rounded-lg bg-surface-2 p-2">
                  <span className="font-semibold text-text">Plantas a extracción</span>
                  <input type="number" min="0" inputMode="numeric" value={x.extP} onChange={(e) => set(l.strainId, { extP: e.target.value })} className={inputCls} />
                  <span className="font-semibold text-text">Plantas a aceites</span>
                  <input type="number" min="0" inputMode="numeric" value={x.aceP} onChange={(e) => set(l.strainId, { aceP: e.target.value })} className={inputCls} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-sm text-text">
        {tot.secado} a secado
        {tot.ext > 0 && ` · ${tot.ext} a extracción`}
        {tot.ace > 0 && ` · ${tot.ace} a aceites`}
        {tot.secado === 0 && tot.ext + tot.ace > 0 && (
          <span className="block text-xs text-text-mute">No queda nada para secado: el lote sale de las salas y quedan sus procesos.</span>
        )}
      </p>

      <MsgError msg={error} />
      <button type="button" disabled={pending} onClick={submit} className={btnCls}>
        {pending ? 'Cosechando…' : 'Confirmar cosecha'}
      </button>
    </div>
  );
}

// ── Resultado de extracción / aceites ──────────────────────────────────────

export function ProcesoForm({
  proceso,
  productos,
}: {
  proceso: {
    id: string;
    loteId: string | null;
    tipo: 'extraccion' | 'aceite';
    strainName: string;
    plantas: number | null;
    pesoEntrada: number | null;
  };
  productos: { id: string; name: string }[];
}) {
  const { pending, error, setError, enviar } = useEnvio();
  const [resultado, setResultado] = useState('');
  const [unidad, setUnidad] = useState<'g' | 'ml'>(proceso.tipo === 'aceite' ? 'ml' : 'g');
  const [producto, setProducto] = useState('');
  const [nota, setNota] = useState('');
  const r = numero(resultado);

  function submit() {
    if (r == null || r < 0) {
      setError('Cargá cuánto rindió el proceso.');
      return;
    }
    enviar(() => terminarProceso(proceso.id, proceso.loteId ?? '', { resultado: r, unidad, productoId: producto || null, nota }));
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-soft">
        {proceso.tipo === 'extraccion' ? 'Extracción' : 'Aceites'} · {proceso.strainName}
        {proceso.plantas ? ` · ${proceso.plantas} plantas` : ''}
        {proceso.pesoEntrada ? ` · se destinaron ${fmtGramos(proceso.pesoEntrada)}` : ''}
      </p>
      <div className="flex gap-2">
        <div className="flex-1">
          <label className={labelCls}>Rindió</label>
          <input type="number" min="0" step="0.1" inputMode="decimal" value={resultado} onChange={(e) => setResultado(e.target.value)} className={inputCls} />
        </div>
        <div className="w-24">
          <label className={labelCls}>Unidad</label>
          <select value={unidad} onChange={(e) => setUnidad(e.target.value as 'g' | 'ml')} className={inputCls}>
            <option value="g">g</option>
            <option value="ml">ml</option>
          </select>
        </div>
      </div>
      {r != null && r > 0 && unidad === 'g' && proceso.pesoEntrada ? (
        <p className="text-xs text-text-mute">Rendimiento: {((r / proceso.pesoEntrada) * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 })} % del peso de entrada</p>
      ) : null}
      <div>
        <label className={labelCls}>Sumar al stock de</label>
        <select value={producto} onChange={(e) => setProducto(e.target.value)} className={inputCls}>
          <option value="">Ninguno por ahora (queda registrado en el lote)</option>
          {productos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <p className="text-text-mute text-xs mt-1">Cuando exista el artículo en el catálogo, elegilo acá y se suma a su stock general.</p>
      </div>
      <div>
        <label className={labelCls}>Nota (opcional)</label>
        <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Método, temperatura, solvente…" className={inputCls} />
      </div>
      <MsgError msg={error} />
      <button type="button" disabled={pending} onClick={submit} className={btnCls}>
        {pending ? 'Guardando…' : 'Cerrar proceso'}
      </button>
    </div>
  );
}

// ── Material seco del stock a extracción / aceites ─────────────────────────

export function DesdeStockForm({
  stock,
  lotes,
}: {
  stock: { strainId: string; name: string; grams: number }[];
  lotes: { id: string; codigo: string; strainIds: string[] }[];
}) {
  const { pending, error, setError, enviar } = useEnvio();
  const [tipo, setTipo] = useState<'extraccion' | 'aceite'>('extraccion');
  const [strainId, setStrainId] = useState(stock[0]?.strainId ?? '');
  const [gramos, setGramos] = useState('');
  const [loteId, setLoteId] = useState('');
  const [nota, setNota] = useState('');

  const item = stock.find((s) => s.strainId === strainId);
  const lotesDeGen = lotes.filter((l) => l.strainIds.includes(strainId));

  function submit() {
    const g = numero(gramos);
    if (!item) return setError('Elegí la genética.');
    if (!g || g <= 0) return setError('Indicá cuántos gramos se destinan.');
    if (g > item.grams) return setError(`En stock general hay ${fmtGramos(item.grams)} de ${item.name}.`);
    enviar(() => procesoDesdeStock({ strainId, tipo, gramos: g, loteId: loteId || null, nota }));
  }

  if (stock.length === 0) return <p className="text-sm text-text-soft">No hay genéticas con stock general.</p>;

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-soft">
        Flor ya seca y pesada que sale del <strong>stock general</strong> a un proceso. Se descuenta del stock ahora y después
        cargás cuánto rindió.
      </p>
      <div className="flex gap-2">
        {(['extraccion', 'aceite'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTipo(t)}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold ${
              tipo === t ? 'border-accent bg-accent text-white' : 'border-line-2 text-text-soft'
            }`}
          >
            {t === 'extraccion' ? 'Extracción' : 'Aceites'}
          </button>
        ))}
      </div>
      <div>
        <label className={labelCls}>Genética</label>
        <select
          value={strainId}
          onChange={(e) => {
            setStrainId(e.target.value);
            setLoteId('');
          }}
          className={inputCls}
        >
          {stock.map((s) => (
            <option key={s.strainId} value={s.strainId}>
              {s.name} · {fmtGramos(s.grams)} en stock
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls}>Gramos que se destinan</label>
        <input type="number" min="0" step="0.1" inputMode="decimal" value={gramos} onChange={(e) => setGramos(e.target.value)} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Lote de origen (opcional)</label>
        <select value={loteId} onChange={(e) => setLoteId(e.target.value)} className={inputCls}>
          <option value="">Sin especificar</option>
          {lotesDeGen.map((l) => (
            <option key={l.id} value={l.id}>
              {l.codigo}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls}>Nota (opcional)</label>
        <input value={nota} onChange={(e) => setNota(e.target.value)} className={inputCls} />
      </div>
      <MsgError msg={error} />
      <button type="button" disabled={pending} onClick={submit} className={btnCls}>
        {pending ? 'Guardando…' : `Enviar a ${tipo === 'extraccion' ? 'extracción' : 'aceites'}`}
      </button>
    </div>
  );
}

// ── Fin de secado y manicura: pesaje y envío a stock ───────────────────────

export function StockForm({
  loteId,
  loteCodigo,
  lineas,
  humedos,
}: {
  loteId: string;
  loteCodigo: string;
  lineas: LineaLote[];
  humedos: Record<string, number | null>;
}) {
  const { pending, error, setError, enviar } = useEnvio();
  const [seco, setSeco] = useState<Record<string, string>>({});
  const [trim, setTrim] = useState<Record<string, string>>({});

  const totalSeco = useMemo(() => Object.values(seco).reduce((s, v) => s + (numero(v) ?? 0), 0), [seco]);
  const totalPlantas = lineas.reduce((s, l) => s + l.plants, 0);

  function submit() {
    if (totalSeco <= 0) {
      setError('Cargá el peso seco de al menos una genética.');
      return;
    }
    const sinPeso = lineas.filter((l) => !(numero(seco[l.strainId] ?? '') ?? 0));
    if (
      sinPeso.length > 0 &&
      !window.confirm(`Quedan sin peso seco: ${sinPeso.map((l) => l.strainName).join(', ')}. ¿Cerrar el lote igual?`)
    ) {
      return;
    }
    enviar(() =>
      enviarLoteAStock(
        loteId,
        lineas.map((l) => ({
          strainId: l.strainId,
          pesoSeco: numero(seco[l.strainId] ?? ''),
          pesoTrim: numero(trim[l.strainId] ?? ''),
        })),
      ),
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-soft">
        Pesaje final del lote <strong>{loteCodigo}</strong>. El peso seco se suma al <strong>stock general</strong>{' '}
        de cada genética y el lote queda cerrado con su historial.
      </p>

      <div className="rounded-lg border border-line-2 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-xs text-text-soft">
            <tr>
              <th className="text-left font-semibold px-3 py-2">Genética</th>
              <th className="text-left font-semibold px-2 py-2">Seco (g)</th>
              <th className="text-left font-semibold px-2 py-2">Trim (g)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {lineas.map((l) => {
              const s = numero(seco[l.strainId] ?? '');
              return (
                <tr key={l.strainId}>
                  <td className="px-3 py-2">
                    <span className="text-text">{l.strainName}</span>
                    <span className="block text-text-mute text-xs">
                      {l.plants} plantas
                      {humedos[l.strainId] ? ` · húmedo ${fmtGramos(humedos[l.strainId])}` : ''}
                      {s && l.plants ? ` · ${fmtGramos(s / l.plants)}/planta` : ''}
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      inputMode="decimal"
                      value={seco[l.strainId] ?? ''}
                      onChange={(e) => setSeco((p) => ({ ...p, [l.strainId]: e.target.value }))}
                      className={`${inputCls} w-24`}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      inputMode="decimal"
                      value={trim[l.strainId] ?? ''}
                      onChange={(e) => setTrim((p) => ({ ...p, [l.strainId]: e.target.value }))}
                      className={`${inputCls} w-24`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-text">
        Total seco: <strong>{fmtGramos(totalSeco)}</strong>
        {totalSeco > 0 && totalPlantas > 0 && (
          <span className="text-text-mute"> · {fmtGramos(totalSeco / totalPlantas)} por planta</span>
        )}
      </p>

      <MsgError msg={error} />
      <button type="button" disabled={pending} onClick={submit} className={btnCls}>
        {pending ? 'Enviando…' : 'Enviar a stock y cerrar lote'}
      </button>
    </div>
  );
}

// ── Editar datos del lote (fechas, número, notas) ──────────────────────────

export function EditarLoteForm({
  lote,
  salasFlora,
}: {
  lote: {
    id: string;
    numero: number;
    codigo: string;
    corteFecha: string | null;
    salaDestinoId: string | null;
    floraInicio: string | null;
    diasFlora: number;
    secadoInicio: string | null;
    notas: string | null;
    estado: string;
  };
  salasFlora: { id: string; name: string }[];
}) {
  const { pending, error, enviar } = useEnvio();
  const [numeroLote, setNumeroLote] = useState(String(lote.numero));
  const [corteFecha, setCorteFecha] = useState(lote.corteFecha ?? '');
  const [destino, setDestino] = useState(lote.salaDestinoId ?? '');
  const [floraInicio, setFloraInicio] = useState(lote.floraInicio ?? '');
  const [diasFlora, setDiasFlora] = useState(String(lote.diasFlora));
  const [secadoInicio, setSecadoInicio] = useState(lote.secadoInicio ?? '');
  const [notas, setNotas] = useState(lote.notas ?? '');
  const antesDeFlora = lote.estado === 'esquejes' || lote.estado === 'vege';

  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className={labelCls}>Número de lote</label>
        <input type="number" min="1" value={numeroLote} onChange={(e) => setNumeroLote(e.target.value)} className={inputCls} />
        <p className="text-text-mute text-xs mt-1">Hoy: {lote.codigo}</p>
      </div>
      <div>
        <label className={labelCls}>Fecha de corte de esquejes</label>
        <input type="date" max={hoyAR()} value={corteFecha} onChange={(e) => setCorteFecha(e.target.value)} className={inputCls} />
      </div>
      {antesDeFlora && (
        <div className="col-span-2">
          <label className={labelCls}>Sala de flora de destino</label>
          <select value={destino} onChange={(e) => setDestino(e.target.value)} className={inputCls}>
            <option value="">Sin definir</option>
            {salasFlora.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {!antesDeFlora && (
        <div>
          <label className={labelCls}>Inicio 12/12 (día 0 de flora)</label>
          <input type="date" max={hoyAR()} value={floraInicio} onChange={(e) => setFloraInicio(e.target.value)} className={inputCls} />
        </div>
      )}
      <div>
        <label className={labelCls}>Días de flora estimados</label>
        <input type="number" min="1" value={diasFlora} onChange={(e) => setDiasFlora(e.target.value)} className={inputCls} />
      </div>
      {(lote.estado === 'secado' || lote.estado === 'cerrado') && (
        <div>
          <label className={labelCls}>Inicio de secado</label>
          <input type="date" max={hoyAR()} value={secadoInicio} onChange={(e) => setSecadoInicio(e.target.value)} className={inputCls} />
        </div>
      )}
      <div className="col-span-2">
        <label className={labelCls}>Notas</label>
        <textarea rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} className={inputCls} />
      </div>
      <div className="col-span-2 space-y-2">
        <MsgError msg={error} />
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            enviar(() =>
              editarLote(lote.id, {
                numero: Math.round(Number(numeroLote)),
                corteFecha: corteFecha || null,
                salaDestinoId: antesDeFlora ? destino || null : lote.salaDestinoId,
                floraInicio: antesDeFlora ? null : floraInicio || null,
                diasFlora: Math.round(Number(diasFlora)),
                secadoInicio: secadoInicio || null,
                notas,
              }),
            )
          }
          className={btnCls}
        >
          {pending ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </div>
  );
}

// ── Cortar esquejes: nace el lote ──────────────────────────────────────────

export function CortarEsquejesForm({
  salaId,
  madres,
  lotesAbiertos,
  salasFlora,
  proximoCodigo,
}: {
  salaId: string;
  madres: { strainId: string; name: string; plants: number }[];
  lotesAbiertos: { id: string; codigo: string; destino: string | null; estado: string }[];
  salasFlora: { id: string; name: string }[];
  proximoCodigo: string;
}) {
  const { pending, error, setError, enviar } = useEnvio();
  const [loteId, setLoteId] = useState(''); // '' = lote nuevo
  const [destino, setDestino] = useState(salasFlora[0]?.id ?? '');
  const [fecha, setFecha] = useState(hoyAR());
  const [rows, setRows] = useState([{ strainId: '', plants: '' }]);
  const [nota, setNota] = useState('');

  function update(i: number, patch: Partial<(typeof rows)[number]>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function submit() {
    const items = rows
      .filter((r) => r.strainId && Number(r.plants) > 0)
      .map((r) => ({ strainId: r.strainId, plants: Math.round(Number(r.plants)) }));
    if (items.length === 0) return setError('Elegí la madre y cuántos esquejes cortaste.');
    if (!loteId && !destino) return setError('Elegí la sala de flora de destino.');
    enviar(() =>
      cortarEsquejes({ salaId, items, loteId: loteId || null, destinoId: loteId ? null : destino || null, fecha, nota }),
    );
  }

  if (madres.length === 0) {
    return (
      <p className="text-sm text-text-soft">
        No hay madres cargadas en esta sala. Cargalas primero con &quot;+ Madres&quot;: cada esqueje queda asociado a la madre de
        la que se cortó.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>Lote</label>
        <select value={loteId} onChange={(e) => setLoteId(e.target.value)} className={inputCls}>
          <option value="">Lote nuevo · {proximoCodigo}</option>
          {lotesAbiertos.map((l) => (
            <option key={l.id} value={l.id}>
              Sumar a {l.codigo}
              {l.destino ? ` (destino ${l.destino})` : ''}
              {l.estado === 'vege' ? ' · ya en vege' : ''}
            </option>
          ))}
        </select>
      </div>

      {!loteId && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Sala de flora de destino</label>
            <select value={destino} onChange={(e) => setDestino(e.target.value)} className={inputCls}>
              {salasFlora.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Fecha de corte</label>
            <input type="date" max={hoyAR()} value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputCls} />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <p className={labelCls}>Madre de origen y esquejes cortados</p>
        {rows.map((row, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <select value={row.strainId} onChange={(e) => update(i, { strainId: e.target.value })} className={`${inputCls} flex-1 min-w-40`}>
              <option value="">Madre…</option>
              {madres.map((m) => (
                <option key={m.strainId} value={m.strainId}>
                  {m.name} ({m.plants} madre{m.plants !== 1 ? 's' : ''})
                </option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              inputMode="numeric"
              placeholder="Esquejes"
              value={row.plants}
              onChange={(e) => update(i, { plants: e.target.value })}
              className={`${inputCls} w-24`}
            />
            {rows.length > 1 && (
              <button type="button" onClick={() => setRows((p) => p.filter((_, idx) => idx !== i))} className="text-red text-xs">
                Quitar
              </button>
            )}
          </div>
        ))}
        <button type="button" onClick={() => setRows((p) => [...p, { strainId: '', plants: '' }])} className="text-accent text-xs font-semibold">
          + Agregar madre
        </button>
      </div>

      <div>
        <label className={labelCls}>Nota (opcional)</label>
        <input value={nota} onChange={(e) => setNota(e.target.value)} className={inputCls} />
      </div>

      <MsgError msg={error} />
      <button type="button" disabled={pending} onClick={submit} className={btnCls}>
        {pending ? 'Guardando…' : loteId ? 'Sumar esquejes al lote' : `Crear ${proximoCodigo} con estos esquejes`}
      </button>
    </div>
  );
}

// ── Manicura diaria (lote en secado) ───────────────────────────────────────

export type AvanceManicura = { strainId: string; strainName: string; plants: number; seco: number; trim: number; plantasHechas: number };

export function ManicuraForm({
  loteId,
  loteCodigo,
  avance,
}: {
  loteId: string;
  loteCodigo: string;
  avance: AvanceManicura[];
}) {
  const { pending, error, setError, enviar } = useEnvio();
  const [fecha, setFecha] = useState(hoyAR());
  const [operario, setOperario] = useState('');
  const [nota, setNota] = useState('');
  const [datos, setDatos] = useState<Record<string, { plantas: string; seco: string; trim: string }>>({});
  const d = (id: string) => datos[id] ?? { plantas: '', seco: '', trim: '' };
  const set = (id: string, patch: Partial<{ plantas: string; seco: string; trim: string }>) =>
    setDatos((prev) => ({ ...prev, [id]: { ...d(id), ...patch } }));

  const totalSeco = avance.reduce((s, a) => s + (numero(d(a.strainId).seco) ?? 0), 0);

  function submit() {
    const items = avance
      .map((a) => ({
        strainId: a.strainId,
        pesoSeco: numero(d(a.strainId).seco),
        pesoTrim: numero(d(a.strainId).trim),
        plantas: numero(d(a.strainId).plantas),
      }))
      .filter((i) => (i.pesoSeco ?? 0) > 0 || (i.pesoTrim ?? 0) > 0);
    if (items.length === 0) return setError('Cargá el peso manicurado de al menos una genética.');
    if (!operario.trim()) return setError('Indicá quién hizo la manicura.');
    enviar(() => registrarManicura({ loteId, fecha, operario, nota, items }));
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-soft">
        Manicura del lote <strong>{loteCodigo}</strong>. La flor que cargues entra al <strong>stock general</strong> en el
        momento. Completá solo las genéticas que se trabajaron.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Fecha</label>
          <input type="date" max={hoyAR()} value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Quién hizo la manicura</label>
          <input value={operario} onChange={(e) => setOperario(e.target.value)} className={inputCls} />
        </div>
      </div>

      <div className="rounded-lg border border-line-2 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-xs text-text-soft">
            <tr>
              <th className="text-left font-semibold px-3 py-2">Genética</th>
              <th className="text-left font-semibold px-2 py-2">Plantas</th>
              <th className="text-left font-semibold px-2 py-2">Flor (g)</th>
              <th className="text-left font-semibold px-2 py-2">Trim (g)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {avance.map((a) => (
              <tr key={a.strainId}>
                <td className="px-3 py-2">
                  <span className="text-text">{a.strainName}</span>
                  <span className="block text-text-mute text-xs">
                    {a.plantasHechas}/{a.plants} plantas · {fmtGramos(a.seco)} hasta ahora
                  </span>
                </td>
                <td className="px-2 py-2">
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={d(a.strainId).plantas}
                    onChange={(e) => set(a.strainId, { plantas: e.target.value })}
                    className={`${inputCls} w-16`}
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    inputMode="decimal"
                    value={d(a.strainId).seco}
                    onChange={(e) => set(a.strainId, { seco: e.target.value })}
                    className={`${inputCls} w-24`}
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    inputMode="decimal"
                    value={d(a.strainId).trim}
                    onChange={(e) => set(a.strainId, { trim: e.target.value })}
                    className={`${inputCls} w-20`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <label className={labelCls}>Nota (opcional)</label>
        <input value={nota} onChange={(e) => setNota(e.target.value)} className={inputCls} />
      </div>

      <MsgError msg={error} />
      <button type="button" disabled={pending} onClick={submit} className={btnCls}>
        {pending ? 'Guardando…' : `Cargar manicura${totalSeco > 0 ? ` · ${fmtGramos(totalSeco)} a stock` : ''}`}
      </button>
    </div>
  );
}

export function TerminarSecadoForm({
  loteId,
  loteCodigo,
  avance,
}: {
  loteId: string;
  loteCodigo: string;
  avance: AvanceManicura[];
}) {
  const { pending, error, enviar } = useEnvio();
  const totalSeco = avance.reduce((s, a) => s + a.seco, 0);
  const totalTrim = avance.reduce((s, a) => s + a.trim, 0);
  const totalPlantas = avance.reduce((s, a) => s + a.plants, 0);
  const sinManicura = avance.filter((a) => a.seco <= 0);

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-soft">
        Se cierra el lote <strong>{loteCodigo}</strong> con lo manicurado hasta hoy y sale de la sala de secado. Lo que ya se
        cargó ya está en el stock general.
      </p>
      <div className="rounded-lg border border-line-2 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-xs text-text-soft">
            <tr>
              <th className="text-left font-semibold px-3 py-2">Genética</th>
              <th className="text-right font-semibold px-3 py-2">Flor</th>
              <th className="text-right font-semibold px-3 py-2">Trim</th>
              <th className="text-right font-semibold px-3 py-2">g/planta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {avance.map((a) => (
              <tr key={a.strainId}>
                <td className="px-3 py-2">
                  {a.strainName}
                  <span className="text-text-mute text-xs"> · {a.plants} plantas</span>
                </td>
                <td className={`px-3 py-2 text-right ${a.seco <= 0 ? 'text-red' : ''}`}>{a.seco > 0 ? fmtGramos(a.seco) : 'sin cargar'}</td>
                <td className="px-3 py-2 text-right">{a.trim > 0 ? fmtGramos(a.trim) : '—'}</td>
                <td className="px-3 py-2 text-right">{a.seco > 0 && a.plants > 0 ? fmtGramos(a.seco / a.plants) : '—'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-surface-2 font-semibold">
            <tr>
              <td className="px-3 py-2">Total · {totalPlantas} plantas</td>
              <td className="px-3 py-2 text-right">{fmtGramos(totalSeco)}</td>
              <td className="px-3 py-2 text-right">{totalTrim > 0 ? fmtGramos(totalTrim) : '—'}</td>
              <td className="px-3 py-2 text-right">{totalSeco > 0 && totalPlantas > 0 ? fmtGramos(totalSeco / totalPlantas) : '—'}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {sinManicura.length > 0 && (
        <p className="rounded-lg bg-amber-bg text-amber-tx text-xs px-3 py-2">
          Sin manicura cargada: {sinManicura.map((a) => a.strainName).join(', ')}. Si cerrás igual, quedan en 0 g.
        </p>
      )}
      <MsgError msg={error} />
      <button type="button" disabled={pending || totalSeco <= 0} onClick={() => enviar(() => terminarSecado(loteId))} className={btnCls}>
        {pending ? 'Cerrando…' : 'Terminar secado y cerrar lote'}
      </button>
    </div>
  );
}

// ── Anular una carga de manicura ───────────────────────────────────────────

export function AnularManicuraForm({ id, loteId, resumen }: { id: string; loteId: string; resumen: string }) {
  const { pending, error, setError, enviar } = useEnvio();
  const [motivo, setMotivo] = useState('');
  return (
    <div className="space-y-3">
      <p className="text-sm text-text-soft">
        Se anula la carga <strong>{resumen}</strong>. Se descuenta del stock general lo que había sumado y de los totales del
        lote. La carga queda en el historial marcada como anulada.
      </p>
      <div>
        <label className={labelCls}>Motivo</label>
        <input
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ej.: peso mal cargado, genética equivocada…"
          className={inputCls}
        />
      </div>
      <MsgError msg={error} />
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!motivo.trim()) return setError('Indicá el motivo de la anulación.');
          enviar(() => anularManicura(id, loteId, motivo));
        }}
        className="w-full rounded-lg bg-red text-white font-semibold text-sm py-2 disabled:opacity-60"
      >
        {pending ? 'Anulando…' : 'Anular carga'}
      </button>
    </div>
  );
}
