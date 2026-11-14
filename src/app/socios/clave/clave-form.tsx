'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { cambiarClave, type Estado } from '@/lib/socios/actions';

const inputCls = 'w-full rounded-lg border border-line-2 bg-surface px-3 py-2.5 text-base outline-none focus:border-accent';
const labelCls = 'block text-xs font-medium text-text-soft mb-1';

export function ClaveForm({ obligatoria, nombre }: { obligatoria: boolean; nombre: string | null }) {
  const [estado, accion, guardando] = useActionState<Estado, FormData>(cambiarClave, null);
  const primerNombre = (nombre ?? '').trim().split(/\s+/)[0];

  return (
    <div className="max-w-sm mx-auto px-4 py-10">
      <h1 className="font-display text-2xl font-bold text-text mb-1">
        {obligatoria ? `¡Hola${primerNombre ? ` ${primerNombre}` : ''}! Creá tu contraseña` : 'Cambiar contraseña'}
      </h1>
      <p className="text-text-soft text-sm mb-6">
        {obligatoria
          ? 'Entraste con la clave provisoria. Elegí tu contraseña definitiva para las próximas veces.'
          : 'Elegí una contraseña nueva. Se cierra la sesión en tus otros dispositivos.'}
      </p>

      <form action={accion} className="space-y-4">
        <div>
          <label className={labelCls} htmlFor="clave">Contraseña nueva</label>
          <input id="clave" name="clave" type="password" autoComplete="new-password" required minLength={8} className={inputCls} />
          <p className="text-text-mute text-xs mt-1">Al menos 8 caracteres, con letras y números.</p>
        </div>
        <div>
          <label className={labelCls} htmlFor="repetir">Repetila</label>
          <input id="repetir" name="repetir" type="password" autoComplete="new-password" required minLength={8} className={inputCls} />
        </div>
        {estado?.error && (
          <p className="rounded-lg bg-red-bg text-red text-sm px-3 py-2" role="alert">{estado.error}</p>
        )}
        <button type="submit" disabled={guardando} className="w-full rounded-lg bg-accent text-white font-semibold py-3 disabled:opacity-60">
          {guardando ? 'Guardando…' : 'Guardar contraseña'}
        </button>
        {!obligatoria && (
          <Link href="/socios" className="block text-center text-sm text-accent font-semibold hover:underline">
            Cancelar
          </Link>
        )}
      </form>
    </div>
  );
}
