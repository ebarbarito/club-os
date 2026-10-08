'use client';

import { useRef, useState, useTransition } from 'react';
import { cambiarPassword } from './cambiar-password-action';

export function CambiarPasswordForm({ onSuccess }: { onSuccess: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const nueva = String(fd.get('nueva') ?? '');
    const confirmar = String(fd.get('confirmar') ?? '');
    if (nueva.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return; }
    if (nueva !== confirmar) { setError('Las contraseñas no coinciden'); return; }
    setError(null);
    startTransition(async () => {
      const res = await cambiarPassword(fd);
      if (res?.error) { setError(res.error); return; }
      formRef.current?.reset();
      onSuccess();
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-text mb-1">Nueva contraseña</label>
        <input
          name="nueva"
          type="password"
          required
          minLength={6}
          autoFocus
          className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
          placeholder="Mínimo 6 caracteres"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-text mb-1">Confirmar contraseña</label>
        <input
          name="confirmar"
          type="password"
          required
          minLength={6}
          className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
          placeholder="Repetí la nueva contraseña"
        />
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-accent text-white text-sm font-semibold py-2 disabled:opacity-50"
      >
        {pending ? 'Guardando...' : 'Cambiar contraseña'}
      </button>
    </form>
  );
}
