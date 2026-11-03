'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useModalClose } from '@/components/modal-trigger';
import { codigoLote, fmtGramos, hoyAR, type GrupoPlantas } from '@/lib/cultivo';
import {
  cargarPlantas,
  cosecharLote,
  descartarPlantas,
  editarLote,
  enviarLoteAStock,
  moverPlantas,
  terminarProceso,
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
  loteNumero,
  proximoLote,
}: {
  salaId: string;
  tipo: string;
  strains: Strain[];
  loteNumero: number | null;
  proximoLote: number;
}) {
  const { pending, error, setError, enviar } = useEnvio();
  const [rows, setRows] = useState([{ strainId: '', plants: '', esMadre: false }]);
  const [nota, setNota] = useState('');

  function update(i: number, patch: Partial<(typeof rows)[number]>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function submit() {
    const items = rows
      .filter((r) => r.strainId && Number(r.plants) > 0)
      .map((r) => ({ strainId: r.strainId, plants: Math.round(Number(r.plants)), esMadre: r.esMadre }));
    if (items.length === 0) {
      setError('Elegí la genética y la cantidad de plantas.');
      return;
    }
    enviar(() => cargarPlantas(salaId, items, nota));
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-soft">
        {tipo === 'madres'
          ? 'Esquejes recién cortados o plantas madre nuevas.'
          : tipo === 'flora'
            ? loteNumero
              ? `Se suman al lote ${codigoLote(loteNumero)} de esta sala.`
              : `Se crea el lote ${codigoLote(proximoLote)} con fecha de inicio de flora hoy.`
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
          {tipo === 'madres' && (
            <label className="flex items-center gap-1 text-xs text-text-soft">
              <input type="checkbox" checked={row.esMadre} onChange={(e) => update(i, { esMadre: e.target.checked })} />
              Madre
            </label>
          )}
          {rows.length > 1 && (
            <button type="button" onClick={() => setRows((p) => p.filter((_, idx) => idx !== i))} className="text-red text-xs">
              Quitar
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => setRows((p) => [...p, { strainId: '', plants: '', esMadre: false }])}
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
        {pending ? 'Guardando…' : 'Cargar plantas'}
      </button>
    </div>
  );
}

// ── Pasar plantas a la sala siguiente ──────────────────────────────────────

export type DestinoSala = { id: string; name: string; tipo: string; loteNumero: number | null; loteDia: number | null };

export function MoverForm({
  origenId,
  grupos,
  destinos,
  proximoLote,
}: {
  origenId: string;
  grupos: GrupoPlantas[];
  destinos: DestinoSala[];
  proximoLote: number;
}) {
  const { pending, error, setError, enviar } = useEnvio();
  const [destino, setDestino] = useState(destinos[0]?.id ?? '');
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
            {dest.loteNumero
              ? `Se suman al lote ${codigoLote(dest.loteNumero)}, que va por el día ${dest.loteDia} de flora.`
              : `Nace el lote ${codigoLote(proximoLote)}: el día 1 de flora es hoy.`}
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
                <span className="text-text-mute text-xs"> · {g.plants} plantas</span>
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
              {g.esMadre ? ' (madre)' : ''} · {g.plants} plantas
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
type Deriv = { humedo: string; extP: string; extG: string; aceP: string; aceG: string; abierta: boolean };
const DERIV_VACIA: Deriv = { humedo: '', extP: '', extG: '', aceP: '', aceG: '', abierta: false };

export function CosecharForm({
  loteId,
  loteNumero,
  lineas,
  salasSecado,
}: {
  loteId: string;
  loteNumero: number;
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
      const x = d(l.strainId);
      if (aSecado(l) < 0) return setError(`${l.strainName} tiene ${l.plants} plantas: revisá lo derivado.`);
      if (entero(x.extP) > 0 && !(numero(x.extG) ?? 0)) return setError(`Cargá el peso que sale a extracción de ${l.strainName}.`);
      if (entero(x.aceP) > 0 && !(numero(x.aceG) ?? 0)) return setError(`Cargá el peso que sale a aceites de ${l.strainName}.`);
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
            extraccionPeso: numero(x.extG),
            aceitePlantas: entero(x.aceP),
            aceitePeso: numero(x.aceG),
          };
        }),
      ),
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-soft">
        Cosecha del lote <strong>{codigoLote(loteNumero)}</strong>. Por cada genética podés derivar plantas a extracción o a
        aceites; el resto pasa a secado (hoy es el día 1).
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
                <div className="grid grid-cols-[auto_1fr_1fr] items-center gap-2 text-xs rounded-lg bg-surface-2 p-2">
                  <span />
                  <span className="text-text-mute">Plantas</span>
                  <span className="text-text-mute">Peso al salir (g)</span>
                  <span className="font-semibold text-text">Extracción</span>
                  <input type="number" min="0" inputMode="numeric" value={x.extP} onChange={(e) => set(l.strainId, { extP: e.target.value })} className={inputCls} />
                  <input type="number" min="0" step="0.1" inputMode="decimal" value={x.extG} onChange={(e) => set(l.strainId, { extG: e.target.value })} className={inputCls} />
                  <span className="font-semibold text-text">Aceites</span>
                  <input type="number" min="0" inputMode="numeric" value={x.aceP} onChange={(e) => set(l.strainId, { aceP: e.target.value })} className={inputCls} />
                  <input type="number" min="0" step="0.1" inputMode="decimal" value={x.aceG} onChange={(e) => set(l.strainId, { aceG: e.target.value })} className={inputCls} />
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
  proceso: { id: string; loteId: string; tipo: 'extraccion' | 'aceite'; strainName: string; plantas: number; pesoEntrada: number | null };
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
    enviar(() => terminarProceso(proceso.id, proceso.loteId, { resultado: r, unidad, productoId: producto || null, nota }));
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-soft">
        {proceso.tipo === 'extraccion' ? 'Extracción' : 'Aceites'} · {proceso.strainName} · {proceso.plantas} plantas
        {proceso.pesoEntrada ? ` · salió con ${fmtGramos(proceso.pesoEntrada)}` : ''}
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

// ── Fin de secado y manicura: pesaje y envío a stock ───────────────────────

export function StockForm({
  loteId,
  loteNumero,
  lineas,
  humedos,
}: {
  loteId: string;
  loteNumero: number;
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
        Pesaje final del lote <strong>{codigoLote(loteNumero)}</strong>. El peso seco se suma al <strong>stock general</strong>{' '}
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
}: {
  lote: { id: string; numero: number; floraInicio: string; diasFlora: number; secadoInicio: string | null; notas: string | null; estado: string };
}) {
  const { pending, error, enviar } = useEnvio();
  const [numeroLote, setNumeroLote] = useState(String(lote.numero));
  const [floraInicio, setFloraInicio] = useState(lote.floraInicio);
  const [diasFlora, setDiasFlora] = useState(String(lote.diasFlora));
  const [secadoInicio, setSecadoInicio] = useState(lote.secadoInicio ?? '');
  const [notas, setNotas] = useState(lote.notas ?? '');

  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className={labelCls}>Número de lote</label>
        <input type="number" min="1" value={numeroLote} onChange={(e) => setNumeroLote(e.target.value)} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Días de flora estimados</label>
        <input type="number" min="1" value={diasFlora} onChange={(e) => setDiasFlora(e.target.value)} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Inicio de flora</label>
        <input type="date" max={hoyAR()} value={floraInicio} onChange={(e) => setFloraInicio(e.target.value)} className={inputCls} />
      </div>
      {lote.estado !== 'flora' && (
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
                floraInicio,
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
