'use client';

import { CAMPO_INVALIDO, desmarcar, marcarCampo } from '@/lib/alta/marcar-campo';
import { useRef, useState, useTransition } from 'react';
import { completarEtapa2 } from '@/lib/public/actions';
import { SignaturePad, type SignaturePadHandle } from '@/components/signature-pad';
import { ENTREGAS } from '@/lib/alta/opciones';
import { PlanSelector } from '@/components/alta/plan-selector';
import { DocumentoScroll } from './documento-scroll';
import { aplicarDatosEtapa2 } from '@/lib/alta/documentos';
import type { MedicoClub } from '@/lib/alta/medico';

const inputCls = `w-full rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent ${CAMPO_INVALIDO}`;
const seccionCls = `rounded-xl border border-line bg-surface p-5 scroll-mt-4 ${CAMPO_INVALIDO}`;
const labelCls = 'block text-xs font-medium text-text-soft mb-1';
const req = <span className="text-red">*</span>;

// "Retiro o envío" se sacó del formulario por ahora; con true vuelve a
// aparecer (y a ser obligatorio).
const PEDIR_ENTREGA = false;

function OptionCard({
  name,
  value,
  checked,
  onChange,
  title,
  desc,
  type = 'radio',
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  title: string;
  desc?: string;
  type?: 'radio' | 'checkbox';
}) {
  return (
    <label className={`rounded-lg border p-3 cursor-pointer ${checked ? 'border-accent bg-surface-2' : 'border-line-2'}`}>
      <div className="flex items-start gap-2">
        <input type={type} name={name} value={value} checked={checked} onChange={onChange} className="mt-1" />
        <div>
          <p className="font-semibold text-text text-sm">{title}</p>
          {desc && <p className="text-text-soft text-xs">{desc}</p>}
        </div>
      </div>
    </label>
  );
}

// ETAPA 2 — Formulario de adhesión (link personal que manda el club).
export function Etapa2Form({
  token,
  tenantName,
  nombre,
  reprocannPendiente,
  planInicial,
  adicionalesIniciales,
  documentos,
  tipo,
  reprocannActual,
  medico,
}: {
  token: string;
  tenantName: string;
  nombre: string;
  reprocannPendiente: boolean;
  planInicial: string;
  adicionalesIniciales: string[];
  documentos: { titulo: string; texto: string }[];
  tipo: string;
  reprocannActual: { credencial: string; vencimiento: string };
  // Médico precargado (el del club, salvo que la ficha ya tenga otro).
  medico: MedicoClub;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [reprocann, setReprocann] = useState('vigente');
  const [plan, setPlan] = useState(planInicial);
  const [adicionales, setAdicionales] = useState<string[]>(adicionalesIniciales);
  const [entrega, setEntrega] = useState('');
  const sigRef = useRef<SignaturePadHandle>(null);
  // Lo que va completando en este formulario, para que los documentos se
  // muestren ya completos (médico, dosis, REPROCANN, plan y cuota).
  const [campos, setCampos] = useState<Record<string, string>>(() => ({ ...medico }));
  const hayPrecarga = Boolean(medico.doctor);
  const textos = documentos.map((d) =>
    aplicarDatosEtapa2(d.texto, {
      plan,
      adicionales,
      reprocann: reprocannPendiente ? reprocann : 'vigente',
      credencial: reprocannPendiente ? campos.repr_num : reprocannActual.credencial,
      vencimiento: reprocannPendiente ? campos.repr_exp : reprocannActual.vencimiento,
      medico: campos.doctor,
      especialidad: campos.especialidad_institucion,
      diagnostico: campos.patologia,
      producto: campos.producto_prescripto,
      dosis: campos.dosis_mensual,
      unidad: campos.dosis_unidad ?? 'g',
    }),
  );
  // Se guarda el texto que aceptó: si después cambia un dato que figura en
  // el documento, deja de estar aceptado y hay que volver a aceptarlo.
  const [aceptadoTexto, setAceptadoTexto] = useState<string[]>(() => documentos.map(() => ''));
  const aceptados = textos.map((t, i) => aceptadoTexto[i] === t);

  const formRef = useRef<HTMLFormElement>(null);

  function fallar(mensaje: string, campo?: string) {
    setError(mensaje);
    marcarCampo(formRef.current, campo);
  }

  // onSubmit (y no <form action>) para que, si hay un error, no se borre lo
  // que ya se completó.
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    if (!plan) return fallar('Elegí un plan', 'plan_solicitado');
    if (PEDIR_ENTREGA && !entrega) return fallar('Elegí retiro o envío', 'entrega_preferida');
    const sinAceptar = aceptados.findIndex((a) => !a);
    if (sinAceptar >= 0) return fallar('Tenés que leer y aceptar todos los documentos', `acepta_doc_${sinAceptar}`);
    if (sigRef.current?.isEmpty()) return fallar('Falta tu firma', 'firma_data_url');
    formData.set('firma_data_url', sigRef.current?.getDataUrl() ?? '');
    startTransition(async () => {
      const res = await completarEtapa2(token, formData);
      if (res?.error) {
        fallar(res.error, 'campo' in res ? res.campo : undefined);
        return;
      }
      setDone(true);
      window.scrollTo({ top: 0 });
    });
  }

  if (done) {
    return (
      <div className="max-w-xl mx-auto text-center py-16 px-4">
        <p className="font-display text-2xl font-bold text-text mb-2">¡Listo!</p>
        <p className="text-text-soft">
          Recibimos tu formulario de adhesión. {tenantName} lo va a validar y te avisamos por WhatsApp para coordinar la
          vinculación en REPROCANN y tu primer retiro.
        </p>
      </div>
    );
  }

  // Numeración de secciones: la de REPROCANN solo aparece si quedó pendiente.
  const o = reprocannPendiente ? 1 : 0;
  // Numeración de las secciones que siguen a "Retiro o envío".
  const n = o + (PEDIR_ENTREGA ? 1 : 0);

  return (
    <form
      ref={formRef}
      onSubmit={submit}
      onInput={(e) => desmarcar(e.target)}
      // La firma es un canvas: no dispara input/change.
      onPointerDown={(e) => {
        if (e.target instanceof HTMLCanvasElement) desmarcar(e.target);
      }}
      onChange={(e) => {
        desmarcar(e.target);
        const t: EventTarget = e.target;
        if (!(t instanceof HTMLInputElement || t instanceof HTMLSelectElement || t instanceof HTMLTextAreaElement)) return;
        if (t.name && t.type !== 'file' && t.type !== 'checkbox' && t.type !== 'radio') {
          setCampos((prev) => ({ ...prev, [t.name]: t.value }));
        }
      }}
      className="max-w-2xl mx-auto px-4 py-10 space-y-5"
    >
      <div>
        <p className="text-xs font-semibold text-text-mute uppercase tracking-wide">Paso 2 de 2</p>
        <h1 className="font-display text-2xl font-bold text-text">Formulario de adhesión</h1>
        <p className="text-text-soft">
          {tenantName} · {nombre}
        </p>
      </div>

      {reprocannPendiente && (
        <section className={seccionCls}>
          <h2 className="font-display font-bold text-accent mb-1">1. REPROCANN</h2>
          <p className="text-text-mute text-sm mb-4">En la pre-inscripción quedó pendiente. ¿Ya tenés tu credencial?</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <OptionCard
              name="reprocann"
              value="vigente"
              checked={reprocann === 'vigente'}
              onChange={() => setReprocann('vigente')}
              title="Sí, ya la tengo"
            />
            <OptionCard
              name="reprocann"
              value="tramite"
              checked={reprocann === 'tramite'}
              onChange={() => setReprocann('tramite')}
              title="Todavía está en trámite"
            />
          </div>
          {reprocann === 'vigente' && (
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
                <label className={labelCls}>Foto de la credencial</label>
                <input name="reprocann_doc" type="file" accept="image/*,.pdf" className={`${inputCls} p-1.5`} />
              </div>
            </div>
          )}
        </section>
      )}

      <section className={seccionCls}>
        <h2 className="font-display font-bold text-accent mb-1">{1 + o}. Indicación médica</h2>
        <p className="text-text-mute text-sm mb-4">
          {hayPrecarga
            ? 'Cargamos los datos de nuestro médico tratante. Si ya tenés REPROCANN con otro médico, reemplazalos por los de tu indicación.'
            : 'Copiá los datos de la indicación de tu médico/a.'}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Médico tratante {req}</label>
            <input name="doctor" required defaultValue={medico.doctor ?? ''} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Matrícula</label>
            <input name="matricula" defaultValue={medico.matricula ?? ''} className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Especialidad / Institución</label>
            <input name="especialidad_institucion" defaultValue={medico.especialidad_institucion ?? ''} className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Diagnóstico / patología principal {req}</label>
            <input name="patologia" required className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Producto prescripto {req}</label>
            <input name="producto_prescripto" required defaultValue={medico.producto_prescripto ?? ''} className={inputCls} />
          </div>
          <div className="grid grid-cols-[1fr_5rem] gap-2 items-end">
            <div>
              <label className={labelCls}>Dosis mensual <span className="text-text-mute">(opcional)</span></label>
              <input name="dosis_mensual" type="number" inputMode="decimal" min="0" step="0.01" className={inputCls} />
            </div>
            <select name="dosis_unidad" className={inputCls} defaultValue="g">
              <option value="g">g</option>
              <option value="ml">ml</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Foto de la indicación médica</label>
            <input name="indicacion_medica" type="file" accept="image/*,.pdf" className={`${inputCls} p-1.5`} />
          </div>
        </div>
      </section>

      <section className={seccionCls}>
        <h2 className="font-display font-bold text-accent mb-1">{2 + o}. Plan</h2>
        <p className="text-text-mute text-sm mb-4">
          {planInicial
            ? 'Es el que elegiste en la pre-inscripción. Confirmalo o cambialo según tu indicación médica.'
            : 'Elegí el plan que corresponde a tu indicación médica.'}
        </p>
        <PlanSelector
          plan={plan}
          onPlanChange={setPlan}
          adicionales={adicionales}
          onAdicionalesChange={setAdicionales}
          autocultivo={tipo === 'autocultivador'}
        />
      </section>

      {PEDIR_ENTREGA && (
      <section className={seccionCls}>
        <h2 className="font-display font-bold text-accent mb-1">{3 + o}. Retiro o envío</h2>
        <p className="text-text-mute text-sm mb-4">¿Cómo preferís recibirlo?</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {ENTREGAS.map((e) => (
            <OptionCard
              key={e.value}
              name="entrega_preferida"
              value={e.value}
              checked={entrega === e.value}
              onChange={() => setEntrega(e.value)}
              title={e.title}
              desc={e.desc}
            />
          ))}
        </div>
      </section>
      )}

      <section className={seccionCls}>
        <h2 className="font-display font-bold text-accent mb-1">{3 + n}. DNI</h2>
        <p className="text-text-mute text-sm mb-4">Sacale una foto a tu DNI. Si ya lo mandaste por WhatsApp, podés saltear este paso.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Frente</label>
            <input name="dni_frente" type="file" accept="image/*,.pdf" className={`${inputCls} p-1.5`} />
          </div>
          <div>
            <label className={labelCls}>Dorso</label>
            <input name="dni_dorso" type="file" accept="image/*,.pdf" className={`${inputCls} p-1.5`} />
          </div>
        </div>
      </section>

      <section className={seccionCls}>
        <h2 className="font-display font-bold text-accent mb-1">{4 + n}. Documentación</h2>
        <p className="text-text-mute text-sm mb-4">
          Leé cada documento hasta el final y marcá &quot;Leí y acepto&quot;. Después firmás abajo.
        </p>
        <div className="space-y-4">
          {documentos.map((d, i) => (
            <DocumentoScroll
              key={i}
              index={i}
              titulo={d.titulo}
              texto={textos[i]}
              aceptado={aceptados[i] ?? false}
              onAceptadoChange={(v) => setAceptadoTexto((prev) => prev.map((x, j) => (j === i ? (v ? textos[i] : '') : x)))}
            />
          ))}
        </div>
      </section>

      <section className={seccionCls}>
        <h2 className="font-display font-bold text-accent mb-1">{5 + n}. Firma</h2>
        <p className="text-text-mute text-sm mb-3">Firmá con el dedo (en el celular) o con el mouse.</p>
        <SignaturePad ref={sigRef} hiddenInputName="firma_data_url" />
      </section>

      {error && (
        <p role="alert" className="text-red text-sm font-medium bg-red-bg rounded-lg px-3 py-2">
          {error} — revisá el campo marcado en rojo.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-accent text-white font-semibold py-3 disabled:opacity-60"
      >
        {pending ? 'Enviando…' : 'Firmar y enviar'}
      </button>
    </form>
  );
}
