'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createConcept, updateConcept, deleteConcept } from './concept-actions';

export type LedgerConcept = {
  id: string;
  name: string;
  allows_ingreso: boolean;
  allows_egreso: boolean;
  active: boolean;
};

const inputCls = 'rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent';
const labelCls = 'block text-xs font-medium text-text-soft mb-1';

function ConceptTypeLabel({ allows_ingreso, allows_egreso }: { allows_ingreso: boolean; allows_egreso: boolean }) {
  if (allows_ingreso && allows_egreso) return <span className="text-text-soft text-xs">Ingreso y egreso</span>;
  if (allows_ingreso) return <span className="text-green text-xs font-medium">Solo ingreso</span>;
  if (allows_egreso) return <span className="text-red text-xs font-medium">Solo egreso</span>;
  return <span className="text-text-mute text-xs">Sin tipo</span>;
}

function ConceptRow({ concept }: { concept: LedgerConcept }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(concept.name);
  const [allowsIngreso, setAllowsIngreso] = useState(concept.allows_ingreso);
  const [allowsEgreso, setAllowsEgreso] = useState(concept.allows_egreso);
  const [active, setActive] = useState(concept.active);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    if (!name.trim()) { setError('El nombre es obligatorio'); return; }
    if (!allowsIngreso && !allowsEgreso) { setError('Debe permitir al menos un tipo'); return; }
    const fd = new FormData();
    fd.set('id', concept.id);
    fd.set('name', name.trim());
    fd.set('allows_ingreso', String(allowsIngreso));
    fd.set('allows_egreso', String(allowsEgreso));
    fd.set('active', String(active));
    startTransition(async () => {
      const res = await updateConcept(fd);
      if (res?.error) { setError(res.error); return; }
      setEditing(false);
      router.refresh();
    });
  }

  function remove() {
    if (!confirm(`¿Eliminar el concepto "${concept.name}"?`)) return;
    startTransition(async () => {
      const res = await deleteConcept(concept.id);
      if (res?.error) { setError(res.error ?? 'Error al eliminar'); return; }
      router.refresh();
    });
  }

  if (!editing) {
    return (
      <tr className="border-t border-line">
        <td className="px-4 py-2.5 text-text font-medium">{concept.name}</td>
        <td className="px-4 py-2.5">
          <ConceptTypeLabel allows_ingreso={concept.allows_ingreso} allows_egreso={concept.allows_egreso} />
        </td>
        <td className="px-4 py-2.5">
          <span className={`text-xs font-semibold ${concept.active ? 'text-green' : 'text-text-mute'}`}>
            {concept.active ? 'Activo' : 'Inactivo'}
          </span>
        </td>
        <td className="px-4 py-2.5 text-right">
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setEditing(true)} className="text-accent text-xs font-semibold">Editar</button>
            <button type="button" onClick={remove} disabled={pending} className="text-red text-xs font-semibold disabled:opacity-50">Eliminar</button>
          </div>
          {error && <p className="text-red text-xs mt-1">{error}</p>}
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-line bg-surface-2">
      <td className="px-4 py-2.5" colSpan={4}>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className={labelCls}>Nombre</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={`${inputCls} w-48`} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Tipos válidos</label>
            <label className="flex items-center gap-2 text-sm text-text cursor-pointer">
              <input type="checkbox" checked={allowsIngreso} onChange={(e) => setAllowsIngreso(e.target.checked)} className="rounded" />
              Ingreso
            </label>
            <label className="flex items-center gap-2 text-sm text-text cursor-pointer">
              <input type="checkbox" checked={allowsEgreso} onChange={(e) => setAllowsEgreso(e.target.checked)} className="rounded" />
              Egreso
            </label>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Estado</label>
            <label className="flex items-center gap-2 text-sm text-text cursor-pointer">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="rounded" />
              Activo
            </label>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={save} disabled={pending} className="rounded-lg bg-accent text-white text-sm font-semibold px-4 py-2 disabled:opacity-50">
              {pending ? 'Guardando…' : 'Guardar'}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-line-2 text-sm px-3 py-2">
              Cancelar
            </button>
          </div>
        </div>
        {error && <p className="text-red text-xs mt-2">{error}</p>}
      </td>
    </tr>
  );
}

function AddConceptRow() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [allowsIngreso, setAllowsIngreso] = useState(true);
  const [allowsEgreso, setAllowsEgreso] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add() {
    setError(null);
    if (!name.trim()) { setError('El nombre es obligatorio'); return; }
    if (!allowsIngreso && !allowsEgreso) { setError('Debe permitir al menos un tipo'); return; }
    const fd = new FormData();
    fd.set('name', name.trim());
    fd.set('allows_ingreso', String(allowsIngreso));
    fd.set('allows_egreso', String(allowsEgreso));
    startTransition(async () => {
      const res = await createConcept(fd);
      if (res?.error) { setError(res.error); return; }
      setName('');
      setAllowsIngreso(true);
      setAllowsEgreso(true);
      router.refresh();
    });
  }

  return (
    <tr className="border-t border-line bg-surface-2">
      <td className="px-4 py-3" colSpan={4}>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className={labelCls}>Nuevo concepto</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
              placeholder="Nombre del concepto"
              className={`${inputCls} w-48`}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Tipos válidos</label>
            <label className="flex items-center gap-2 text-sm text-text cursor-pointer">
              <input type="checkbox" checked={allowsIngreso} onChange={(e) => setAllowsIngreso(e.target.checked)} className="rounded" />
              Ingreso
            </label>
            <label className="flex items-center gap-2 text-sm text-text cursor-pointer">
              <input type="checkbox" checked={allowsEgreso} onChange={(e) => setAllowsEgreso(e.target.checked)} className="rounded" />
              Egreso
            </label>
          </div>
          <button type="button" onClick={add} disabled={pending} className="rounded-lg bg-accent text-white text-sm font-semibold px-4 py-2 disabled:opacity-50">
            {pending ? 'Agregando…' : '+ Agregar'}
          </button>
        </div>
        {error && <p className="text-red text-xs mt-2">{error}</p>}
      </td>
    </tr>
  );
}

export function PlanDeCuentas({ concepts }: { concepts: LedgerConcept[] }) {
  return (
    <div>
      <div className="mb-3">
        <p className="font-semibold text-text">Plan de cuentas</p>
        <p className="text-text-mute text-xs mt-0.5">
          Conceptos disponibles al registrar movimientos en Caja. Podés indicar si cada uno aplica a ingresos, egresos o ambos.
        </p>
      </div>
      <div className="rounded-xl border border-line bg-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-text-soft text-left">
            <tr>
              <th className="px-4 py-2.5 font-medium">Concepto</th>
              <th className="px-4 py-2.5 font-medium">Tipo</th>
              <th className="px-4 py-2.5 font-medium">Estado</th>
              <th className="px-4 py-2.5 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {concepts.map((c) => <ConceptRow key={c.id} concept={c} />)}
            <AddConceptRow />
          </tbody>
        </table>
      </div>
    </div>
  );
}
