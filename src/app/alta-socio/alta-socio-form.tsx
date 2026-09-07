'use client';

import { useRef, useState, useTransition } from 'react';
import { createMemberPublic } from '@/lib/public/actions';
import { SignaturePad, type SignaturePadHandle } from '@/components/signature-pad';

const inputCls = 'w-full rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent';
const labelCls = 'block text-xs font-medium text-text-soft mb-1';
const req = <span className="text-red">*</span>;

const CATEGORIAS = [
  { value: 'activo', title: 'Socio Activo', desc: 'Adulto mayor de 18 años, uso medicinal con REPROCANN.' },
  { value: 'autocultivador', title: 'Socio Autocultivador', desc: 'Inscripto en REPROCANN como autocultivador. Cede parcela al club.' },
  { value: 'adherente_menor', title: 'Socio Adherente — Menor de edad', desc: 'Requiere representante legal o tutor responsable.' },
  { value: 'adherente', title: 'Socio Adherente', desc: 'Familiar o cuidador de paciente medicinal. Sin REPROCANN propio.' },
];

export function AltaSocioForm({ tenantName }: { tenantName: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [categoria, setCategoria] = useState('activo');
  const sigRef = useRef<SignaturePadHandle>(null);

  function submit(formData: FormData) {
    setError(null);
    if (sigRef.current?.isEmpty()) {
      setError('Falta la firma del solicitante');
      return;
    }
    formData.set('firma_data_url', sigRef.current?.getDataUrl() ?? '');
    startTransition(async () => {
      const res = await createMemberPublic(formData);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setDone(true);
    });
  }

  if (done) {
    return (
      <div className="max-w-xl mx-auto text-center py-16 px-4">
        <p className="font-display text-2xl font-bold text-text mb-2">¡Listo!</p>
        <p className="text-text-soft">
          Tu solicitud de alta en {tenantName} quedó en evaluación. Te vamos a avisar por email cuando el club la valide.
        </p>
      </div>
    );
  }

  return (
    <form action={submit} className="max-w-2xl mx-auto px-4 py-10 space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-text">Alta de socio/a</h1>
        <p className="text-text-soft">{tenantName}</p>
      </div>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="font-display font-bold text-accent mb-1">1. Datos personales</h2>
        <p className="text-text-mute text-sm mb-4">Completá tal como figuran en tu DNI.</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={labelCls}>Apellido y nombre {req}</label>
            <input name="name" required className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>DNI / Pasaporte {req}</label>
            <input name="dni" required className={inputCls} />
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
            <input name="cuil_cuit" required className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Domicilio real {req}</label>
            <input name="address" required className={inputCls} />
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
            <input name="codigo_postal" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Teléfono / WhatsApp {req}</label>
            <input name="phone" required className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Correo electrónico {req}</label>
            <input name="email" type="email" required className={inputCls} />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Zona</label>
            <input name="zona" className={inputCls} />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="font-display font-bold text-accent mb-1">2. Categoría de socio solicitada</h2>
        <p className="text-text-mute text-sm mb-4">Marcá la que corresponde a tu situación.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CATEGORIAS.map((c) => (
            <label
              key={c.value}
              className={`rounded-lg border p-3 cursor-pointer ${categoria === c.value ? 'border-accent bg-surface-2' : 'border-line-2'}`}
            >
              <div className="flex items-start gap-2">
                <input
                  type="radio"
                  name="categoria_socio"
                  value={c.value}
                  checked={categoria === c.value}
                  onChange={() => setCategoria(c.value)}
                  className="mt-1"
                />
                <div>
                  <p className="font-semibold text-text text-sm">{c.title}</p>
                  <p className="text-text-soft text-xs">{c.desc}</p>
                </div>
              </div>
            </label>
          ))}
        </div>
        {categoria === 'adherente_menor' && (
          <p className="text-amber-tx text-xs bg-amber-bg rounded-lg px-3 py-2 mt-3">
            Los datos del representante legal/tutor se coordinan directamente con el club luego del envío de esta solicitud.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="font-display font-bold text-accent mb-1">3. Información médica y REPROCANN</h2>
        <p className="text-text-mute text-sm mb-4">Completá según corresponda a tu categoría.</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>¿Posee inscripción en REPROCANN?</label>
            <select name="reprocann" className={inputCls} defaultValue="no">
              <option value="vigente">Vigente</option>
              <option value="tramite">En trámite</option>
              <option value="no">Sin REPROCANN</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Categoría REPROCANN</label>
            <select name="reprocann_type" className={inputCls} defaultValue="">
              <option value="">Sin especificar</option>
              <option value="paciente">Paciente</option>
              <option value="autocultivador">Autocultivador</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>N° de credencial REPROCANN</label>
            <input name="repr_num" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Fecha de vencimiento credencial</label>
            <input name="repr_exp" type="date" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Médico tratante {req}</label>
            <input name="doctor" required className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Especialidad / Institución</label>
            <input name="especialidad_institucion" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Diagnóstico / patología principal {req}</label>
            <input name="patologia" required className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Producto prescripto {req}</label>
            <input name="producto_prescripto" required className={inputCls} />
          </div>
          <div className="col-span-2 grid grid-cols-[1fr_7rem] gap-2 items-end">
            <div>
              <label className={labelCls}>Dosis mensual indicada {req}</label>
              <input name="dosis_mensual" type="number" min="0" step="0.01" required className={inputCls} />
            </div>
            <select name="dosis_unidad" className={inputCls} defaultValue="g">
              <option value="g">g</option>
              <option value="ml">ml</option>
            </select>
          </div>
        </div>
        <p className="text-text-mute text-xs mt-4">
          Recordá tener a mano para adjuntar por WhatsApp/email: DNI (frente y dorso), credencial REPROCANN vigente y receta
          médica con cantidades prescriptas.
        </p>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <label className={labelCls}>DNI (frente) — opcional acá</label>
            <input name="dni_frente" type="file" accept="image/*,.pdf" className={`${inputCls} p-1.5`} />
          </div>
          <div>
            <label className={labelCls}>DNI (dorso) — opcional acá</label>
            <input name="dni_dorso" type="file" accept="image/*,.pdf" className={`${inputCls} p-1.5`} />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Constancia REPROCANN — opcional acá</label>
            <input name="reprocann_doc" type="file" accept="image/*,.pdf" className={`${inputCls} p-1.5`} />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="font-display font-bold text-accent mb-3">4. Declaración y consentimiento</h2>
        <div className="space-y-3 text-sm text-text-soft">
          <label className="flex items-start gap-2">
            <input type="checkbox" name="consiente_estatuto" required className="mt-0.5" />
            Declaro conocer y aceptar el Estatuto y Reglamento Interno de la Asociación {tenantName}, comprometiéndome a
            cumplir las obligaciones que de ellos surjan, en el marco de la Ley N° 27.350 y sus normas complementarias.
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" name="consiente_datos" required className="mt-0.5" />
            En cumplimiento de la Ley N° 25.326, presto consentimiento expreso, libre e informado para el tratamiento de
            mis datos personales y datos sensibles de salud por parte de la Asociación, con fines de gestión
            administrativa de la membresía, seguimiento del cultivo y dispensación, comunicaciones institucionales y
            cumplimiento de obligaciones legales.
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" name="consiente_veracidad" required className="mt-0.5" />
            Declaro que toda la información aportada es veraz y completa, y que el cannabis obtenido será utilizado
            exclusivamente con fines medicinales o terapéuticos.
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="font-display font-bold text-accent mb-1">5. Firma</h2>
        <p className="text-text-mute text-sm mb-3">Firmá con el dedo (en el celular) o con el mouse.</p>
        <label className={labelCls}>Firma del solicitante</label>
        <SignaturePad ref={sigRef} hiddenInputName="firma_data_url" />
      </section>

      {error && <p className="text-red text-sm">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-accent text-white font-semibold py-3 disabled:opacity-60"
      >
        {pending ? 'Enviando…' : 'Generar mi solicitud'}
      </button>
    </form>
  );
}
