'use client';

import { useMemo, useState } from 'react';
import { useModalClose } from '@/components/modal-trigger';

export type ArticuloStock = { id: string; nombre: string; esGenetica: boolean; dispensa: number; general: number };

type Tipo = 'geneticas' | 'accesorios' | 'ambos';
type Deposito = 'dispensa' | 'general' | 'total';

const opcionCls = (activa: boolean) =>
  `rounded-lg border px-3 py-2 text-sm text-left ${activa ? 'border-accent bg-accent/10 text-accent font-semibold' : 'border-line-2 text-text-soft hover:border-accent'}`;

// Arma la hoja de stock para imprimir: genéticas, accesorios o ambos (en dos
// secciones), de todo el stock o de los artículos que se elijan.
export function ImprimirStockForm({ articulos, esAdmin }: { articulos: ArticuloStock[]; esAdmin: boolean }) {
  const close = useModalClose();
  const [tipo, setTipo] = useState<Tipo>('geneticas');
  const [deposito, setDeposito] = useState<Deposito>('dispensa');
  const [alcance, setAlcance] = useState<'todos' | 'elegir'>('todos');
  const [ceros, setCeros] = useState(false);
  const [control, setControl] = useState(true);
  const [buscar, setBuscar] = useState('');
  const [elegidos, setElegidos] = useState<Set<string>>(new Set());

  const dep: Deposito = esAdmin ? deposito : 'dispensa';
  const stockDe = (a: ArticuloStock) => (dep === 'dispensa' ? a.dispensa : dep === 'general' ? a.general : a.dispensa + a.general);
  const visibles = useMemo(
    () =>
      articulos
        .filter((a) => (tipo === 'ambos' ? true : tipo === 'geneticas' ? a.esGenetica : !a.esGenetica))
        .filter((a) => ceros || stockDe(a) > 0)
        .filter((a) => a.nombre.toLowerCase().includes(buscar.trim().toLowerCase())),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [articulos, tipo, ceros, buscar, dep],
  );
  const elegidosVisibles = visibles.filter((a) => elegidos.has(a.id));

  function alternar(id: string) {
    setElegidos((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function todosVisibles(marcar: boolean) {
    setElegidos((prev) => {
      const n = new Set(prev);
      for (const a of visibles) {
        if (marcar) n.add(a.id);
        else n.delete(a.id);
      }
      return n;
    });
  }

  const puedeImprimir = alcance === 'todos' || elegidosVisibles.length > 0;

  function imprimir() {
    const q = new URLSearchParams({ tipo, deposito: esAdmin ? deposito : 'dispensa', auto: '1' });
    if (ceros) q.set('ceros', '1');
    if (control) q.set('control', '1');
    if (alcance === 'elegir') q.set('ids', elegidosVisibles.map((a) => a.id).join(','));
    window.open(`/panel/stock/imprimir?${q.toString()}`, '_blank');
    close();
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium text-text-soft mb-1.5">Qué imprimir</p>
        <div className="grid grid-cols-3 gap-2">
          <button type="button" className={opcionCls(tipo === 'geneticas')} onClick={() => setTipo('geneticas')}>
            Genéticas
          </button>
          <button type="button" className={opcionCls(tipo === 'accesorios')} onClick={() => setTipo('accesorios')}>
            Accesorios y otros
          </button>
          <button type="button" className={opcionCls(tipo === 'ambos')} onClick={() => setTipo('ambos')}>
            Las dos (separadas)
          </button>
        </div>
      </div>

      {esAdmin && (
        <div>
          <p className="text-xs font-medium text-text-soft mb-1.5">Stock</p>
          <div className="grid grid-cols-3 gap-2">
            <button type="button" className={opcionCls(deposito === 'dispensa')} onClick={() => setDeposito('dispensa')}>
              Dispensa
            </button>
            <button type="button" className={opcionCls(deposito === 'general')} onClick={() => setDeposito('general')}>
              General
            </button>
            <button type="button" className={opcionCls(deposito === 'total')} onClick={() => setDeposito('total')}>
              Dispensa + general
            </button>
          </div>
        </div>
      )}

      <div>
        <p className="text-xs font-medium text-text-soft mb-1.5">Artículos</p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className={opcionCls(alcance === 'todos')} onClick={() => setAlcance('todos')}>
            Todos (total)
          </button>
          <button type="button" className={opcionCls(alcance === 'elegir')} onClick={() => setAlcance('elegir')}>
            Elegir algunos (parcial)
          </button>
        </div>
      </div>

      {alcance === 'elegir' && (
        <div className="rounded-lg border border-line-2">
          <div className="flex items-center gap-2 p-2 border-b border-line">
            <input
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
              placeholder="Buscar…"
              className="flex-1 rounded-md border border-line-2 px-2 py-1 text-sm outline-none focus:border-accent"
            />
            <button type="button" onClick={() => todosVisibles(true)} className="text-xs text-accent font-semibold">
              Todos
            </button>
            <button type="button" onClick={() => todosVisibles(false)} className="text-xs text-text-soft font-semibold">
              Ninguno
            </button>
          </div>
          <div className="max-h-56 overflow-y-auto p-1">
            {visibles.map((a) => (
              <label key={a.id} className="flex items-center gap-2 px-2 py-1 text-sm rounded hover:bg-surface-2 cursor-pointer">
                <input type="checkbox" checked={elegidos.has(a.id)} onChange={() => alternar(a.id)} />
                <span className="text-text">{a.nombre}</span>
                {stockDe(a) <= 0 && <span className="text-text-mute text-xs">sin stock</span>}
              </label>
            ))}
            {visibles.length === 0 && <p className="px-2 py-3 text-sm text-text-mute">No hay artículos para mostrar.</p>}
          </div>
          <p className="px-3 py-1.5 border-t border-line text-xs text-text-mute">
            {elegidosVisibles.length} elegido{elegidosVisibles.length === 1 ? '' : 's'}
          </p>
        </div>
      )}

      <div className="space-y-1.5">
        <label className="flex items-center gap-2 text-sm text-text">
          <input type="checkbox" checked={ceros} onChange={(e) => setCeros(e.target.checked)} />
          Incluir artículos sin stock
        </label>
        <label className="flex items-center gap-2 text-sm text-text">
          <input type="checkbox" checked={control} onChange={(e) => setControl(e.target.checked)} />
          Agregar columna para el conteo a mano
        </label>
      </div>

      <button
        type="button"
        onClick={imprimir}
        disabled={!puedeImprimir}
        className="w-full rounded-lg bg-accent text-white font-semibold py-2.5 disabled:opacity-50"
      >
        Ver e imprimir
      </button>
    </div>
  );
}
