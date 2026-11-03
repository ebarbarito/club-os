'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useModalClose } from '@/components/modal-trigger';
import { TIPOS_SALA } from '@/lib/cultivo';
import { upsertSala } from './actions';

const inputCls = 'w-full rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent';
const labelCls = 'block text-xs font-medium text-text-soft mb-1';

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

const ORDEN_SUGERIDO: Record<string, number> = { madres: 1, vege: 2, flora: 3, secado: 5 };

// Datos fijos de la sala. Las plantas ya no se cargan acá: entran con
// "Cargar plantas" y se mueven con "Pasar a…", así queda el recorrido.
export function SalaForm({ sala }: { sala?: Sala }) {
  const router = useRouter();
  const close = useModalClose();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [tipo, setTipo] = useState(sala?.tipo ?? 'vege');
  const [orden, setOrden] = useState(String(sala?.orden ?? ORDEN_SUGERIDO.vege));

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const res = await upsertSala(formData);
      if (res.error) {
        setError(res.error);
        return;
      }
      close();
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-2 gap-3">
      {sala && <input type="hidden" name="id" value={sala.id} />}
      <div className="col-span-2">
        <label className={labelCls}>Nombre de la sala</label>
        <input name="name" required defaultValue={sala?.name} className={inputCls} />
      </div>

      <div>
        <label className={labelCls}>Tipo de sala</label>
        <select
          name="tipo"
          value={tipo}
          onChange={(e) => {
            setTipo(e.target.value);
            if (!sala) setOrden(String(ORDEN_SUGERIDO[e.target.value] ?? 9));
          }}
          className={inputCls}
        >
          {TIPOS_SALA.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls}>Orden en el recorrido</label>
        <input name="orden" type="number" min="0" value={orden} onChange={(e) => setOrden(e.target.value)} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Capacidad (plantas)</label>
        <input name="capacity" type="number" min="0" defaultValue={sala?.capacity ?? 0} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Responsable</label>
        <input name="responsable" defaultValue={sala?.responsable ?? ''} className={inputCls} />
      </div>

      <div className="col-span-2 border-t border-line pt-3 mt-1">
        <p className="text-xs font-semibold text-text-mute uppercase mb-2">Rangos ideales de sensores</p>
      </div>
      <div>
        <label className={labelCls}>Temp. mín / máx (°C)</label>
        <div className="flex gap-2">
          <input name="temp_min" type="number" step="0.1" defaultValue={sala?.temp_min ?? ''} className={inputCls} />
          <input name="temp_max" type="number" step="0.1" defaultValue={sala?.temp_max ?? ''} className={inputCls} />
        </div>
      </div>
      <div>
        <label className={labelCls}>Humedad mín / máx (%)</label>
        <div className="flex gap-2">
          <input name="hum_min" type="number" step="1" defaultValue={sala?.hum_min ?? ''} className={inputCls} />
          <input name="hum_max" type="number" step="1" defaultValue={sala?.hum_max ?? ''} className={inputCls} />
        </div>
      </div>
      <div className="col-span-2">
        <label className={labelCls}>ID de sensor físico (tag en InfluxDB)</label>
        <input name="sensor_id" defaultValue={sala?.sensor_id ?? ''} className={inputCls} placeholder="ej. sala-veg-a" />
      </div>

      {error && <p className="col-span-2 text-red text-sm">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="col-span-2 rounded-lg bg-accent text-white font-semibold text-sm py-2 disabled:opacity-60"
      >
        {pending ? 'Guardando…' : sala ? 'Guardar cambios' : 'Crear sala'}
      </button>
    </form>
  );
}
