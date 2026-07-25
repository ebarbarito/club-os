'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useModalClose } from '@/components/modal-trigger';
import { createUser } from './actions';

const inputCls = 'w-full rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent';
const labelCls = 'block text-xs font-medium text-text-soft mb-1';

export function CreateUserForm() {
  const router = useRouter();
  const close = useModalClose();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(formData: FormData) {
    startTransition(async () => {
      const res = await createUser(formData);
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
      <div>
        <label className={labelCls}>Nombre</label>
        <input name="name" required className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Email</label>
        <input name="email" type="email" required className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Contraseña inicial</label>
        <input name="password" type="text" required minLength={6} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Perfil</label>
        <select name="role" className={inputCls} defaultValue="dispensador">
          <option value="admin">Administrador</option>
          <option value="dispensador">Dispensador/a</option>
          <option value="cultivo">Cultivo</option>
        </select>
      </div>

      {error && <p className="text-red text-sm">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-accent text-white font-semibold text-sm py-2 disabled:opacity-60"
      >
        {pending ? 'Creando…' : 'Crear usuario'}
      </button>
    </form>
  );
}
