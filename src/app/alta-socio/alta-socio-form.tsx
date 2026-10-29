'use client';

import { useState, useTransition } from 'react';
import { createMemberPublic } from '@/lib/public/actions';
import { PlanSelector } from '@/components/alta/plan-selector';
import { TRAMITES_REPROCANN } from '@/lib/alta/opciones';

const inputCls = 'w-full rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent';
const labelCls = 'block text-xs font-medium text-text-soft mb-1';
const req = <span className="text-red">*</span>;

const REPROCANN_OPCIONES = [
  { value: 'vigente', title: 'Sí, tengo REPROCANN', desc: 'Cargá los datos de tu credencial.' },
  { value: 'tramite', title: 'Está en trámite', desc: 'Ya lo inicié, falta la aprobación.' },
  { value: 'no', title: 'No tengo', desc: 'Todavía no lo empecé.' },
] as const;

const TIPOS_INSCRIPCION = [
  { value: 'paciente', title: 'Paciente', desc: 'El club cultiva tu tratamiento.' },
  { value: 'autocultivador', title: 'Autocultivador', desc: 'Te inscribís como autocultivador y cedés tu parcela al club.' },
] as const;

// ETAPA 1 — Pre-inscripción. Lo médico, el plan, los consentimientos
// restantes y la firma van en la etapa 2 (/alta-socio/completar/<token>),
// que el club manda por WhatsApp después de revisar estos datos.
export function AltaSocioForm({ tenantName }: { tenantName: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [plan, setPlan] = useState('');
  const [adicionales, setAdicionales] = useState<string[]>([]);
  const [reprocann, setReprocann] = useState<string>('vigente');
  const [tramite, setTramite] = useState('');
  const [tipo, setTipo] = useState('paciente');

  function submit(formData: FormData) {
    setError(null);
    if (!plan) {
      setError('Elegí un plan');
      return;
    }
    if (reprocann !== 'vigente' && !tramite) {
      setError('Contanos cómo vas a tramitar tu REPROCANN');
      return;
    }
    startTransition(async () => {
      const res = await createMemberPublic(formData);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setDone(true);
      window.scrollTo({ top: 0 });
    });
  }

  if (done) {
    return (
      <div className="max-w-xl mx-auto text-center py-16 px-4">
        <p className="font-display text-2xl font-bold text-text mb-2">¡Recibimos tu pre-inscripción!</p>
        <p className="text-text-soft">
          El equipo de {tenantName} va a revisar tus datos y te va a escribir por WhatsApp para mandarte la segunda
          parte: indicación médica y firma de la documentación.
        </p>
        {reprocann !== 'vigente' && tramite === 'acompanado' && (
          <p className="text-text-soft mt-3">
            Para tu REPROCANN, el equipo de <strong>CLINICANN</strong> te va a contactar a la brevedad.
          </p>
        )}
      </div>
    );
  }

  return (
    <form action={submit} className="max-w-2xl mx-auto px-4 py-10 space-y-5">
      <div>
        <p className="text-xs font-semibold text-text-mute uppercase tracking-wide">Paso 1 de 2</p>
        <h1 className="font-display text-2xl font-bold text-text">Pre-inscripción</h1>
        <p className="text-text-soft">{tenantName}</p>
      </div>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="font-display font-bold text-accent mb-1">1. Datos personales</h2>
        <p className="text-text-mute text-sm mb-4">Completá tal como figuran en tu DNI.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Nombre {req}</label>
            <input name="nombre" required autoComplete="given-name" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Apellido {req}</label>
            <input name="apellido" required autoComplete="family-name" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>DNI / Pasaporte {req}</label>
            <input name="dni" required inputMode="numeric" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Fecha de nacimiento {req}</label>
            <input name="birth" type="date" required className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Nacionalidad</label>
            <input name="nacionalidad" defaultValue="Argentina" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Estado civil</label>
            <input name="estado_civil" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>CUIL/CUIT {req}</label>
            <input name="cuil_cuit" required inputMode="numeric" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Domicilio real {req}</label>
            <input name="address" required autoComplete="street-address" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Localidad {req}</label>
            <input name="localidad" required className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Provincia {req}</label>
            <input name="provincia" required className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Código postal</label>
            <input name="codigo_postal" inputMode="numeric" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Teléfono / WhatsApp {req}</label>
            <input name="phone" type="tel" required autoComplete="tel" className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Correo electrónico {req}</label>
            <input name="email" type="email" required autoComplete="email" className={inputCls} />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="font-display font-bold text-accent mb-1">2. Plan mensual</h2>
        <p className="text-text-mute text-sm mb-4">
          Elegí el plan que corresponde a tu indicación médica. Si todavía no la tenés, elegí el que pensás que vas a
          necesitar: lo confirmás en la segunda parte.
        </p>
        <PlanSelector plan={plan} onPlanChange={setPlan} adicionales={adicionales} onAdicionalesChange={setAdicionales} />
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="font-display font-bold text-accent mb-1">3. REPROCANN</h2>
        <p className="text-text-mute text-sm mb-4">¿Tenés tu credencial de REPROCANN?</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {REPROCANN_OPCIONES.map((o) => (
            <label
              key={o.value}
              className={`rounded-lg border p-3 cursor-pointer ${reprocann === o.value ? 'border-accent bg-surface-2' : 'border-line-2'}`}
            >
              <div className="flex items-start gap-2">
                <input
                  type="radio"
                  name="reprocann"
                  value={o.value}
                  checked={reprocann === o.value}
                  onChange={() => setReprocann(o.value)}
                  className="mt-1"
                />
                <div>
                  <p className="font-semibold text-text text-sm">{o.title}</p>
                  <p className="text-text-soft text-xs">{o.desc}</p>
                </div>
              </div>
            </label>
          ))}
        </div>

        <p className="text-sm font-medium text-text mt-4 mb-2">¿Cómo te inscribís? {req}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TIPOS_INSCRIPCION.map((t) => (
            <label
              key={t.value}
              className={`rounded-lg border p-3 cursor-pointer ${tipo === t.value ? 'border-accent bg-surface-2' : 'border-line-2'}`}
            >
              <div className="flex items-start gap-2">
                <input
                  type="radio"
                  name="reprocann_type"
                  value={t.value}
                  checked={tipo === t.value}
                  onChange={() => setTipo(t.value)}
                  className="mt-1"
                />
                <div>
                  <p className="font-semibold text-text text-sm">{t.title}</p>
                  <p className="text-text-soft text-xs">{t.desc}</p>
                </div>
              </div>
            </label>
          ))}
        </div>

        {reprocann === 'vigente' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            <div>
              <label className={labelCls}>N° de credencial {req}</label>
              <input name="repr_num" required className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Fecha de vencimiento {req}</label>
              <input name="repr_exp" type="date" required className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Foto de la credencial (opcional)</label>
              <input name="reprocann_doc" type="file" accept="image/*,.pdf" className={`${inputCls} p-1.5`} />
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-sm font-medium text-text mb-2">¿Cómo querés hacer el trámite? {req}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {TRAMITES_REPROCANN.map((t) => (
                <label
                  key={t.value}
                  className={`rounded-lg border p-3 cursor-pointer ${tramite === t.value ? 'border-accent bg-surface-2' : 'border-line-2'}`}
                >
                  <div className="flex items-start gap-2">
                    <input
                      type="radio"
                      name="tramite_reprocann"
                      value={t.value}
                      checked={tramite === t.value}
                      onChange={() => setTramite(t.value)}
                      className="mt-1"
                    />
                    <p className="font-semibold text-text text-sm">{t.title}</p>
                  </div>
                </label>
              ))}
            </div>
            {TRAMITES_REPROCANN.filter((t) => t.value === tramite).map((t) => (
              <div key={t.value} className="rounded-lg bg-surface-2 border border-line-2 px-4 py-3 mt-3">
                <ul className="list-disc pl-4 space-y-1.5 text-sm text-text-soft">
                  {t.info.map((linea, i) => (
                    <li key={i}>{linea.replaceAll('[CLUB]', tenantName)}</li>
                  ))}
                </ul>
              </div>
            ))}
            <p className="text-text-mute text-xs mt-3">
              Queda asentado como pendiente: lo completás en la segunda parte del formulario.
            </p>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="font-display font-bold text-accent mb-3">4. Tus datos</h2>
        <label className="flex items-start gap-2 text-sm text-text-soft">
          <input type="checkbox" name="consiente_datos" required className="mt-0.5" />
          En cumplimiento de la Ley N° 25.326, presto consentimiento expreso, libre e informado para el tratamiento de mis
          datos personales y datos sensibles de salud por parte de la Asociación, con fines de gestión administrativa de la
          membresía, seguimiento del cultivo y dispensación, comunicaciones institucionales y cumplimiento de obligaciones
          legales.
        </label>
      </section>

      {error && <p className="text-red text-sm">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-accent text-white font-semibold py-3 disabled:opacity-60"
      >
        {pending ? 'Enviando…' : 'Enviar pre-inscripción'}
      </button>
    </form>
  );
}
