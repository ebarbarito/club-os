'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useModalClose } from '@/components/modal-trigger';
import { createProveedor, updateProveedor } from './actions';

const inputCls = 'w-full rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent';
const labelCls = 'block text-xs font-medium text-text-soft mb-1';

type Proveedor = {
  id: string;
  name: string;
  cuit: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  rubro: string | null;
  notes: string | null;
};

export function ProveedorForm({ proveedor }: { proveedor?: Proveedor }) {
  const router = useRouter();
  const close = useModalClose();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(formData: FormData) {
    startTransition(async () => {
      const res = proveedor
        ? await updateProveedor(proveedor.id, formData)
        : await createProveedor(formData);
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
      <div className="col-span-2">
        <label className={labelCls}>Nombre *</label>
        <input name="name" required defaultValue={proveedor?.name ?? ''} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>CUIT</label>
        <input name="cuit" defaultValue={proveedor?.cuit ?? ''} className={inputCls} placeholder="20-12345678-9" />
      </div>
      <div>
        <label className={labelCls}>Rubro</label>
        <input name="rubro" defaultValue={proveedor?.rubro ?? ''} className={inputCls} placeholder="Insumos, Ferretería…" />
      </div>
      <div>
        <label className={labelCls}>Contacto</label>
        <input name="contact_name" defaultValue={proveedor?.contact_name ?? ''} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Teléfono</label>
        <input name="phone" defaultValue={proveedor?.phone ?? ''} className={inputCls} />
      </div>
      <div className="col-span-2">
        <label className={labelCls}>Email</label>
        <input name="email" type="email" defaultValue={proveedor?.email ?? ''} className={inputCls} />
      </div>
      <div className="col-span-2">
        <label className={labelCls}>Domicilio</label>
        <input name="address" defaultValue={proveedor?.address ?? ''} className={inputCls} />
      </div>
      <div className="col-span-2">
        <label className={labelCls}>Notas</label>
        <textarea name="notes" rows={2} defaultValue={proveedor?.notes ?? ''} className={inputCls} />
      </div>

      {error && <p className="col-span-2 text-red text-sm">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="col-span-2 rounded-lg bg-accent text-white font-semibold text-sm py-2 disabled:opacity-60 mt-1"
      >
        {pending ? 'Guardando…' : proveedor ? 'Guardar cambios' : 'Crear proveedor'}
      </button>
    </form>
  );
}
