'use client';

import { useState, useTransition } from 'react';
import { useModalClose } from '@/components/modal-trigger';
import { createMemberPublic } from '@/lib/public/actions';
import { useStore } from './store';

const inputCls = 'w-full rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent';
const labelCls = 'block text-xs font-medium text-text-soft mb-1';

export function SignupForm() {
  const close = useModalClose();
  const { setMemberId } = useStore();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [consent, setConsent] = useState(false);

  function submit(formData: FormData) {
    if (!consent) {
      setError('Tenés que aceptar los consentimientos para continuar.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await createMemberPublic(formData);
      if (res?.error) {
        setError(res.error);
        return;
      }
      if (res?.memberId) setMemberId(res.memberId);
      setDone(true);
    });
  }

  if (done) {
    return (
      <div className="text-center py-4">
        <p className="font-display font-bold text-text mb-2">¡Listo!</p>
        <p className="text-text-soft text-sm mb-4">
          Tu alta quedó en evaluación. Te vamos a avisar por email cuando el club la valide.
        </p>
        <button onClick={close} className="rounded-lg bg-accent text-white font-semibold text-sm px-4 py-2">
          Cerrar
        </button>
      </div>
    );
  }

  return (
    <form action={submit} className="grid grid-cols-2 gap-3">
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
        <input name="birth" type="date" required className={inputCls} />
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
      <div className="col-span-2">
        <label className={labelCls}>Patología</label>
        <input name="patologia" className={inputCls} />
      </div>

      <div className="col-span-2 border-t border-line pt-3 mt-1">
        <p className="text-xs font-semibold text-text-mute uppercase mb-2">Documentación</p>
      </div>
      <div>
        <label className={labelCls}>DNI (frente)</label>
        <input name="dni_frente" type="file" accept="image/*,.pdf" required className={`${inputCls} p-1.5`} />
      </div>
      <div>
        <label className={labelCls}>DNI (dorso)</label>
        <input name="dni_dorso" type="file" accept="image/*,.pdf" required className={`${inputCls} p-1.5`} />
      </div>
      <div className="col-span-2">
        <label className={labelCls}>Constancia REPROCANN</label>
        <input name="reprocann_doc" type="file" accept="image/*,.pdf" required className={`${inputCls} p-1.5`} />
      </div>

      <label className="col-span-2 flex items-start gap-2 text-xs text-text-soft mt-2">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
        Declaro ser mayor de 18 años y acepto que el club valide mis datos y REPROCANN para habilitarme como socio.
      </label>

      {error && <p className="col-span-2 text-red text-sm">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="col-span-2 rounded-lg bg-accent text-white font-semibold text-sm py-2 disabled:opacity-60"
      >
        {pending ? 'Enviando…' : 'Enviar alta'}
      </button>
    </form>
  );
}
