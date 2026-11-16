'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { ingresar, pedirClave, type Estado } from '@/lib/socios/actions';

const inputCls = 'w-full rounded-lg border border-line-2 bg-surface px-3 py-2.5 text-base outline-none focus:border-accent';
const labelCls = 'block text-xs font-medium text-text-soft mb-1';
const btnCls = 'w-full rounded-lg bg-accent text-white font-semibold py-3 disabled:opacity-60';

export function IngresarForm({ clubName }: { clubName: string }) {
  const [modo, setModo] = useState<'ingresar' | 'clave'>('ingresar');
  const [dni, setDni] = useState('');
  const [estadoIngreso, accionIngreso, ingresando] = useActionState<Estado, FormData>(ingresar, null);
  const [estadoClave, accionClave, pidiendo] = useActionState<Estado, FormData>(pedirClave, null);

  return (
    <div className="max-w-sm mx-auto px-4 py-10">
      <h1 className="font-display text-2xl font-bold text-text mb-1">
        {modo === 'ingresar' ? 'Ingresá a tu cuenta' : 'Recibí tu clave'}
      </h1>
      <p className="text-text-soft text-sm mb-6">
        {modo === 'ingresar'
          ? `Sitio de socios de ${clubName}. Tu usuario es tu DNI.`
          : 'Te mandamos una clave provisoria al mail que tenés registrado en el club.'}
      </p>

      {/* Panel y sitio de socios comparten dominio: sin autocompletar, para que
          el navegador no ponga el usuario del panel (un mail) en el DNI. */}
      {modo === 'ingresar' ? (
        <form action={accionIngreso} className="space-y-4">
          <div>
            <label className={labelCls} htmlFor="dni">DNI</label>
            <input
              id="dni"
              name="dni"
              inputMode="numeric"
              autoComplete="off"
              placeholder="Sin puntos"
              required
              value={dni}
              onChange={(e) => setDni(e.target.value.replace(/[^\d.\s-]/g, ''))}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="clave">Contraseña</label>
            <input id="clave" name="clave" type="password" autoComplete="off" required className={inputCls} />
            <p className="text-text-mute text-xs mt-1">Si recibiste una clave provisoria por mail, escribila acá.</p>
          </div>
          {estadoIngreso?.error && (
            <p className="rounded-lg bg-red-bg text-red text-sm px-3 py-2" role="alert">{estadoIngreso.error}</p>
          )}
          <button type="submit" disabled={ingresando} className={btnCls}>
            {ingresando ? 'Ingresando…' : 'Ingresar'}
          </button>
          <button
            type="button"
            onClick={() => setModo('clave')}
            className="w-full text-sm text-accent font-semibold hover:underline"
          >
            Primera vez o te olvidaste la contraseña
          </button>
        </form>
      ) : (
        <form action={accionClave} className="space-y-4">
          <div>
            <label className={labelCls} htmlFor="dni-clave">DNI</label>
            <input
              id="dni-clave"
              name="dni"
              inputMode="numeric"
              autoComplete="off"
              placeholder="Sin puntos"
              required
              value={dni}
              onChange={(e) => setDni(e.target.value.replace(/[^\d.\s-]/g, ''))}
              className={inputCls}
            />
          </div>
          {estadoClave?.error && (
            <p className="rounded-lg bg-red-bg text-red text-sm px-3 py-2" role="alert">{estadoClave.error}</p>
          )}
          {estadoClave?.ok ? (
            <>
              <p className="rounded-lg bg-surface-2 text-text text-sm px-3 py-3" role="status">{estadoClave.ok}</p>
              <button type="button" onClick={() => setModo('ingresar')} className={btnCls}>
                Ya tengo la clave, ingresar
              </button>
            </>
          ) : (
            <button type="submit" disabled={pidiendo} className={btnCls}>
              {pidiendo ? 'Enviando…' : 'Enviarme la clave'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setModo('ingresar')}
            className="w-full text-sm text-accent font-semibold hover:underline"
          >
            Volver a ingresar
          </button>
        </form>
      )}

      <p className="text-center text-text-mute text-xs mt-8">
        ¿Todavía no sos socio? <Link href="/alta-socio" className="text-accent hover:underline">Pre-inscribite</Link>
      </p>
    </div>
  );
}
