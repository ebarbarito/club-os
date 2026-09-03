'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useModalClose } from '@/components/modal-trigger';
import { createEmployee, updateEmployee } from './actions';

const inputCls = 'w-full rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent';
const labelCls = 'block text-xs font-medium text-text-soft mb-1';

type Employee = { id: string; name: string; last_name: string; dni: string; salary: number; active: boolean };

export function EmployeeForm({ employee }: { employee?: Employee }) {
  const router = useRouter();
  const close = useModalClose();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(formData: FormData) {
    startTransition(async () => {
      const res = employee ? await updateEmployee(formData) : await createEmployee(formData);
      if (res?.error) {
        setError(res.error);
        return;
      }
      close();
      router.refresh();
    });
  }

  return (
    <form action={submit} className="space-y-3">
      {employee && <input type="hidden" name="id" value={employee.id} />}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Nombre</label>
          <input name="name" required defaultValue={employee?.name} className={inputCls} placeholder="Lautaro" />
        </div>
        <div>
          <label className={labelCls}>Apellido</label>
          <input name="last_name" required defaultValue={employee?.last_name} className={inputCls} placeholder="Méndez" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>DNI</label>
          <input name="dni" required defaultValue={employee?.dni} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Remuneración pactada</label>
          <input name="salary" type="number" min="0" step="1" required defaultValue={employee?.salary} className={inputCls} />
        </div>
      </div>
      {employee && (
        <label className="flex items-center gap-2 text-sm text-text-soft">
          <input type="checkbox" name="active" defaultChecked={employee.active} />
          Activo (aparece como concepto en Caja)
        </label>
      )}

      {error && <p className="text-red text-sm">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-accent text-white font-semibold text-sm py-2 disabled:opacity-60"
      >
        {pending ? 'Guardando…' : employee ? 'Guardar cambios' : 'Dar de alta'}
      </button>
    </form>
  );
}
