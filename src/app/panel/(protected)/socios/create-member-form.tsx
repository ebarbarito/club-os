'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useModalClose } from '@/components/modal-trigger';
import { createMember } from './actions';

const inputCls = 'w-full rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent';
const labelCls = 'block text-xs font-medium text-text-soft mb-1';

export function CreateMemberForm() {
  const router = useRouter();
  const close = useModalClose();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(formData: FormData, submitAs: 'draft' | 'pending') {
    startTransition(async () => {
      const res = await createMember(formData, submitAs);
      if (res?.error) {
        setError(res.error);
        return;
      }
      close();
      router.refresh();
    });
  }

  return (
    <form
      action={(fd) => submit(fd, 'pending')}
      className="grid grid-cols-2 gap-3"
    >
      <div className="col-span-2">
        <label className={labelCls}>Nombre y apellido</label>
        <input name="name" required className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>DNI</label>
        <input name="dni" required className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Fecha de nacimiento</label>
        <input name="birth" type="date" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Teléfono</label>
        <input name="phone" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Email</label>
        <input name="email" type="email" className={inputCls} />
      </div>
      <div className="col-span-2">
        <label className={labelCls}>Zona</label>
        <input name="zona" className={inputCls} />
      </div>

      <div className="col-span-2 border-t border-line pt-3 mt-1">
        <p className="text-xs font-semibold text-text-mute uppercase mb-2">Salud / REPROCANN</p>
      </div>
      <div>
        <label className={labelCls}>REPROCANN</label>
        <select name="reprocann" className={inputCls} defaultValue="no">
          <option value="vigente">Vigente</option>
          <option value="tramite">En trámite</option>
          <option value="no">Sin REPROCANN</option>
        </select>
      </div>
      <div>
        <label className={labelCls}>Modalidad</label>
        <select name="modalidad" className={inputCls} defaultValue="propio">
          <option value="propio">Cultivo propio</option>
          <option value="solidario">Cultivo solidario</option>
          <option value="ong">ONG</option>
        </select>
      </div>
      <div>
        <label className={labelCls}>N° de registro</label>
        <input name="repr_num" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Vencimiento</label>
        <input name="repr_exp" type="date" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Médico tratante</label>
        <input name="doctor" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Matrícula</label>
        <input name="matricula" className={inputCls} />
      </div>
      <div className="col-span-2">
        <label className={labelCls}>Patología</label>
        <input name="patologia" className={inputCls} />
      </div>

      {error && <p className="col-span-2 text-red text-sm">{error}</p>}

      <div className="col-span-2 flex gap-2 mt-2">
        <button
          type="button"
          disabled={pending}
          onClick={(e) => submit(new FormData(e.currentTarget.form!), 'draft')}
          className="flex-1 rounded-lg border border-line-2 text-text font-semibold text-sm py-2 disabled:opacity-60"
        >
          Guardar borrador
        </button>
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-lg bg-accent text-white font-semibold text-sm py-2 disabled:opacity-60"
        >
          {pending ? 'Enviando…' : 'Enviar alta'}
        </button>
      </div>
    </form>
  );
}
