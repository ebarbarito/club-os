'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useModalClose } from '@/components/modal-trigger';
import { upsertSala } from './actions';

const inputCls = 'w-full rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent';
const labelCls = 'block text-xs font-medium text-text-soft mb-1';

type Strain = { id: string; name: string };
type Sala = {
  id: string;
  name: string;
  strain_id: string | null;
  etapa: string;
  etapa_dias: number;
  plants: number;
  capacity: number;
  cosecha_estimada: string | null;
  responsable: string | null;
  temp_min: number | null;
  temp_max: number | null;
  hum_min: number | null;
  hum_max: number | null;
  sensor_id: string | null;
};

export function SalaForm({ strains, sala }: { strains: Strain[]; sala?: Sala }) {
  const router = useRouter();
  const close = useModalClose();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(formData: FormData) {
    startTransition(async () => {
      const res = await upsertSala(formData);
      if (res?.error) {
        setError(res.error);
        return;
      }
      close();
      router.refresh();
    });
  }

  return (
    <form action={submit} className="grid grid-cols-2 gap-3">
      {sala && <input type="hidden" name="id" value={sala.id} />}
      <div className="col-span-2">
        <label className={labelCls}>Nombre de la sala</label>
        <input name="name" required defaultValue={sala?.name} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Genética</label>
        <select name="strain_id" defaultValue={sala?.strain_id ?? ''} className={inputCls}>
          <option value="">—</option>
          {strains.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls}>Etapa</label>
        <select name="etapa" defaultValue={sala?.etapa ?? 'vegetativo'} className={inputCls}>
          <option value="vegetativo">Vegetativo</option>
          <option value="floracion">Floración</option>
          <option value="secado">Secado</option>
        </select>
      </div>
      <div>
        <label className={labelCls}>Día en la etapa</label>
        <input name="etapa_dias" type="number" min="0" defaultValue={sala?.etapa_dias ?? 0} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Cosecha estimada</label>
        <input name="cosecha_estimada" type="date" defaultValue={sala?.cosecha_estimada ?? ''} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Plantas</label>
        <input name="plants" type="number" min="0" defaultValue={sala?.plants ?? 0} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Capacidad</label>
        <input name="capacity" type="number" min="0" defaultValue={sala?.capacity ?? 0} className={inputCls} />
      </div>
      <div className="col-span-2">
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
