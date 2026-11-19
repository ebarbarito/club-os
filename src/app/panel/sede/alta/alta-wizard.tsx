'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { CAMPO_INVALIDO, desmarcar, marcarCampo } from '@/lib/alta/marcar-campo';
import { PlanSelector } from '@/components/alta/plan-selector';
import { SignaturePad, type SignaturePadHandle } from '@/components/signature-pad';
import { DocumentoScroll } from '@/app/alta-socio/completar/[token]/documento-scroll';
import { aplicarDatosEtapa2, personalizarDocumento, type DocumentoAdhesion } from '@/lib/alta/documentos';
import type { MedicoClub } from '@/lib/alta/medico';
import { FotoInput } from './foto-input';
import { altaEnSede } from './actions';
import { useAtras } from '../use-atras';

// Tamaños pensados para tablet: campos y botones grandes.
const inputCls = `w-full rounded-xl border-2 border-line-2 bg-surface px-4 py-3 text-lg outline-none focus:border-accent ${CAMPO_INVALIDO}`;
const labelCls = 'block text-sm font-semibold text-text-soft mb-1.5';
const req = <span className="text-red">*</span>;

const PASOS = [
  { key: 'responsable', titulo: 'Quién atiende' },
  { key: 'datos', titulo: 'Datos personales' },
  { key: 'plan', titulo: 'Tipo de socio y plan' },
  { key: 'reprocann', titulo: 'REPROCANN' },
  { key: 'medico', titulo: 'Indicación médica' },
  { key: 'dni', titulo: 'Fotos del DNI' },
  { key: 'documentos', titulo: 'Documentación' },
  { key: 'firma', titulo: 'Firma' },
] as const;

function Opcion({
  activa,
  onClick,
  titulo,
  desc,
}: {
  activa: boolean;
  onClick: () => void;
  titulo: string;
  desc?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border-2 p-5 text-left transition ${activa ? 'border-accent bg-accent/10' : 'border-line-2 bg-surface'}`}
    >
      <p className={`text-lg font-bold ${activa ? 'text-accent' : 'text-text'}`}>{titulo}</p>
      {desc && <p className="text-text-soft text-sm mt-1">{desc}</p>}
    </button>
  );
}

function edad(birth: string) {
  const b = new Date(birth);
  if (Number.isNaN(b.getTime())) return -1;
  const hoy = new Date();
  let e = hoy.getFullYear() - b.getFullYear();
  const m = hoy.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < b.getDate())) e--;
  return e;
}

type Hecho = { nombre: string; numero: number | null; validado: boolean; derivado: boolean };

export function AltaWizard({
  tenantName,
  equipo,
  docsPaciente,
  docsAutocultivador,
  medico,
  infoClinicann,
  contactoClinicann,
}: {
  tenantName: string;
  equipo: string[];
  docsPaciente: DocumentoAdhesion[];
  docsAutocultivador: DocumentoAdhesion[];
  medico: MedicoClub;
  infoClinicann: string[];
  contactoClinicann: string | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const pasosRef = useRef<(HTMLDivElement | null)[]>([]);
  const sigRef = useRef<SignaturePadHandle>(null);
  const [paso, setPaso] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [hecho, setHecho] = useState<Hecho | null>(null);

  const [responsable, setResponsable] = useState('');
  const [tipo, setTipo] = useState<'paciente' | 'autocultivador'>('paciente');
  const [plan, setPlan] = useState('');
  const [adicionales, setAdicionales] = useState<string[]>([]);
  const [reprocann, setReprocann] = useState<'vigente' | 'tramite' | 'no' | ''>('');
  const [campos, setCampos] = useState<Record<string, string>>(() => ({
    // Los mismos valores por defecto que tienen los campos (para que los
    // documentos se vean completos aunque no se toquen).
    nacionalidad: 'Argentina',
    provincia: 'Buenos Aires',
    dosis_unidad: 'g',
    ...medico,
  }));
  const [aceptadoTexto, setAceptadoTexto] = useState<string[]>([]);

  const docsBase = tipo === 'autocultivador' ? docsAutocultivador : docsPaciente;
  const textos = useMemo(() => {
    const fecha = new Date();
    return docsBase.map((d) =>
      aplicarDatosEtapa2(
        personalizarDocumento(d.texto, {
          club: tenantName,
          nombreCompleto: `${campos.apellido ?? ''} ${campos.nombre ?? ''}`.trim(),
          dni: campos.dni ?? '',
          fechaNacimiento: campos.birth ?? null,
          nacionalidad: campos.nacionalidad ?? null,
          estadoCivil: campos.estado_civil ?? null,
          domicilioReal: campos.address ?? null,
          localidad: campos.localidad ?? null,
          provincia: campos.provincia ?? null,
          codigoPostal: campos.codigo_postal ?? null,
          telefono: campos.phone ?? null,
          email: campos.email ?? null,
          cuil: campos.cuil_cuit ?? null,
          tipo,
          fecha,
        }),
        {
          plan,
          adicionales,
          reprocann: reprocann || null,
          credencial: campos.repr_num,
          vencimiento: campos.repr_exp,
          medico: campos.doctor,
          especialidad: campos.especialidad_institucion,
          diagnostico: campos.patologia,
          producto: campos.producto_prescripto,
          dosis: campos.dosis_mensual,
          unidad: campos.dosis_unidad ?? 'g',
        },
      ),
    );
  }, [docsBase, campos, tipo, plan, adicionales, reprocann, tenantName]);
  const aceptados = textos.map((t, i) => aceptadoTexto[i] === t);

  // Flecha "atrás" del navegador: vuelve al paso anterior; en el primero
  // pregunta antes de salir (se perdería lo cargado).
  const pasoRef = useRef(paso);
  pasoRef.current = paso;
  const hechoRef = useRef(hecho);
  hechoRef.current = hecho;
  useAtras(() => {
    if (!hechoRef.current) {
      if (pasoRef.current > 0) {
        setError(null);
        setPaso((p) => Math.max(p - 1, 0));
        window.scrollTo({ top: 0 });
        return true;
      }
      if (!window.confirm('¿Salir del alta? Se pierde lo que cargaste.')) return true;
    }
    window.location.assign('/panel/sede');
    return false;
  });

  // Terminada el alta, la tablet vuelve sola al inicio (no quedan datos a la vista).
  useEffect(() => {
    if (!hecho) return;
    const t = setTimeout(() => window.location.assign('/panel/sede'), 90_000);
    return () => clearTimeout(t);
  }, [hecho]);

  function fallar(mensaje: string, campo?: string) {
    setError(mensaje);
    if (campo) {
      // Lleva al paso que tiene el campo con problema.
      const i = pasosRef.current.findIndex((el) => el?.querySelector(`[name="${campo}"]`));
      if (i >= 0 && i !== paso) setPaso(i);
      setTimeout(() => marcarCampo(formRef.current, campo), 50);
    }
  }

  function validar(i: number): boolean {
    setError(null);
    const cont = pasosRef.current[i];
    const key = PASOS[i].key;
    if (key === 'responsable' && !responsable) {
      fallar('Elegí quién está atendiendo', 'responsable');
      return false;
    }
    if (cont) {
      const invalido = [...cont.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select, textarea')].find(
        (el) => el.type !== 'file' && !el.checkValidity(),
      );
      if (invalido) {
        fallar('Completá los campos marcados', invalido.name);
        return false;
      }
    }
    if (key === 'datos') {
      const e = edad(campos.birth ?? '');
      if (e < 18) {
        fallar('Tiene que ser mayor de 18 años para asociarse', 'birth');
        return false;
      }
      if ((campos.dni ?? '').replace(/\D/g, '').length < 7) {
        fallar('Revisá el DNI', 'dni');
        return false;
      }
    }
    if (key === 'plan') {
      if (!plan) {
        fallar('Elegí un plan', 'plan_solicitado');
        return false;
      }
      if (tipo === 'autocultivador' && plan === 'medicinal') {
        fallar('El plan Medicinal no aplica al autocultivo', 'plan_solicitado');
        return false;
      }
    }
    if (key === 'reprocann' && !reprocann) {
      fallar('Indicá si tiene REPROCANN', 'reprocann');
      return false;
    }
    if (key === 'documentos') {
      const sin = aceptados.findIndex((a) => !a);
      if (sin >= 0) {
        fallar('Hay que leer y aceptar todos los documentos', `acepta_doc_${sin}`);
        return false;
      }
    }
    if (key === 'firma' && sigRef.current?.isEmpty()) {
      fallar('Falta la firma', 'firma_data_url');
      return false;
    }
    return true;
  }

  function siguiente() {
    if (!validar(paso)) return;
    setPaso((p) => Math.min(p + 1, PASOS.length - 1));
    window.scrollTo({ top: 0 });
  }

  function atras() {
    setError(null);
    setPaso((p) => Math.max(p - 1, 0));
    window.scrollTo({ top: 0 });
  }

  function finalizar() {
    for (let i = 0; i < PASOS.length; i++) {
      if (!validar(i)) {
        setPaso(i);
        return;
      }
    }
    const fd = new FormData(formRef.current!);
    fd.set('responsable', responsable);
    fd.set('firma_data_url', sigRef.current?.getDataUrl() ?? '');
    startTransition(async () => {
      try {
        const res = await altaEnSede(fd);
        if ('error' in res) {
          fallar(res.error, res.campo);
          return;
        }
        setHecho(res);
        window.scrollTo({ top: 0 });
      } catch {
        setError('No se pudo enviar. Revisá la conexión a internet y probá de nuevo.');
      }
    });
  }

  if (hecho) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <div className="text-6xl mb-4" aria-hidden>
          {hecho.validado ? '🎉' : '📋'}
        </div>
        {hecho.validado ? (
          <>
            <h1 className="font-display text-3xl font-bold text-text mb-2">¡Bienvenido/a, {hecho.nombre}!</h1>
            <p className="text-xl text-text-soft mb-1">Ya sos socio/a de {tenantName}.</p>
            {hecho.numero && <p className="text-2xl font-bold text-accent mt-4">Socio N° {hecho.numero}</p>}
          </>
        ) : (
          <>
            <h1 className="font-display text-3xl font-bold text-text mb-2">¡Gracias, {hecho.nombre}!</h1>
            <p className="text-xl text-text-soft">
              Tu inscripción quedó registrada. Te validamos apenas tengas tu REPROCANN.
            </p>
            {hecho.derivado && (
              <div className="mt-6 rounded-2xl border-2 border-accent/40 bg-accent/5 p-5 text-left">
                <p className="font-bold text-text text-lg mb-2">Te derivamos a CLINICANN para el trámite</p>
                <ul className="list-disc pl-5 space-y-1.5 text-text-soft">
                  {infoClinicann.map((l, i) => (
                    <li key={i}>{l.replaceAll('[CLUB]', tenantName)}</li>
                  ))}
                </ul>
                {contactoClinicann && <p className="mt-3 font-semibold text-text">Contacto: {contactoClinicann}</p>}
              </div>
            )}
          </>
        )}
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-2xl bg-accent text-white text-lg font-bold px-8 py-4"
          >
            Nueva inscripción
          </button>
          <button
            type="button"
            onClick={() => window.location.assign('/panel/sede')}
            className="rounded-2xl border-2 border-line-2 text-text text-lg font-bold px-8 py-4"
          >
            Volver al inicio
          </button>
        </div>
        <p className="text-text-mute text-sm mt-3">La pantalla vuelve sola al inicio en un minuto y medio.</p>
      </div>
    );
  }

  const esUltimo = paso === PASOS.length - 1;
  const ref = (i: number) => (el: HTMLDivElement | null) => {
    pasosRef.current[i] = el;
  };
  const vis = (i: number) => (paso === i ? '' : 'hidden');

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={(e) => e.preventDefault()}
      onInput={(e) => desmarcar(e.target)}
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
      className="max-w-3xl mx-auto px-5 sm:px-8 pt-6 pb-36"
    >
      {/* Avance */}
      <div className="mb-6">
        <div className="flex gap-1.5 mb-3">
          {PASOS.map((p, i) => (
            <div key={p.key} className={`h-2 flex-1 rounded-full ${i <= paso ? 'bg-accent' : 'bg-line-2'}`} />
          ))}
        </div>
        <p className="text-sm font-semibold text-text-mute uppercase tracking-wide">
          Paso {paso + 1} de {PASOS.length}
        </p>
        <h1 className="font-display text-3xl font-bold text-text">{PASOS[paso].titulo}</h1>
      </div>

      {/* 1. Responsable */}
      <div ref={ref(0)} className={vis(0)}>
        <p className="text-lg text-text-soft mb-4">¿Quién del equipo está acompañando esta inscripción?</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {equipo.map((n) => (
            <Opcion key={n} activa={responsable === n} onClick={() => setResponsable(n)} titulo={n} />
          ))}
        </div>
        <div className="mt-4">
          <label className={labelCls}>Otro (escribí el nombre)</label>
          <input
            name="responsable"
            value={equipo.includes(responsable) ? '' : responsable}
            onChange={(e) => setResponsable(e.target.value)}
            className={inputCls}
            autoComplete="off"
          />
        </div>
      </div>

      {/* 2. Datos personales */}
      <div ref={ref(1)} className={vis(1)}>
        <p className="text-lg text-text-soft mb-4">Tal como figuran en el DNI.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Nombre {req}</label>
            <input name="nombre" required autoComplete="off" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Apellido {req}</label>
            <input name="apellido" required autoComplete="off" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>DNI / Pasaporte {req}</label>
            <input name="dni" required inputMode="numeric" autoComplete="off" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Fecha de nacimiento {req}</label>
            <input name="birth" type="date" required className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>CUIL/CUIT {req}</label>
            <input name="cuil_cuit" required inputMode="numeric" autoComplete="off" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Nacionalidad</label>
            <input name="nacionalidad" defaultValue="Argentina" autoComplete="off" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Estado civil</label>
            <input name="estado_civil" autoComplete="off" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Teléfono / WhatsApp {req}</label>
            <input name="phone" type="tel" required autoComplete="off" className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Correo electrónico {req}</label>
            <input name="email" type="email" required autoComplete="off" className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Domicilio real {req}</label>
            <input name="address" required autoComplete="off" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Localidad {req}</label>
            <input name="localidad" required autoComplete="off" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Provincia {req}</label>
            <input name="provincia" required defaultValue="Buenos Aires" autoComplete="off" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Código postal</label>
            <input name="codigo_postal" inputMode="numeric" autoComplete="off" className={inputCls} />
          </div>
        </div>
      </div>

      {/* 3. Tipo y plan */}
      <div ref={ref(2)} className={vis(2)}>
        <p className={labelCls}>¿Cómo se inscribe? {req}</p>
        <input type="hidden" name="reprocann_type" value={tipo} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          <Opcion
            activa={tipo === 'paciente'}
            onClick={() => setTipo('paciente')}
            titulo="Paciente"
            desc="El club cultiva su tratamiento."
          />
          <Opcion
            activa={tipo === 'autocultivador'}
            onClick={() => {
              setTipo('autocultivador');
              if (plan === 'medicinal') setPlan('');
            }}
            titulo="Autocultivador"
            desc="Se inscribe como autocultivador y cede su parcela al club."
          />
        </div>
        <div className="text-base">
          <PlanSelector
            plan={plan}
            onPlanChange={setPlan}
            adicionales={adicionales}
            onAdicionalesChange={setAdicionales}
            autocultivo={tipo === 'autocultivador'}
          />
        </div>
      </div>

      {/* 4. REPROCANN */}
      <div ref={ref(3)} className={vis(3)}>
        <p className="text-lg text-text-soft mb-4">¿Tiene la credencial de REPROCANN?</p>
        <input type="hidden" name="reprocann" value={reprocann} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Opcion activa={reprocann === 'vigente'} onClick={() => setReprocann('vigente')} titulo="Sí, la tengo" />
          <Opcion activa={reprocann === 'tramite'} onClick={() => setReprocann('tramite')} titulo="Está en trámite" />
          <Opcion activa={reprocann === 'no'} onClick={() => setReprocann('no')} titulo="No tengo" />
        </div>
        {reprocann === 'vigente' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
            <div>
              <label className={labelCls}>N° de credencial {req}</label>
              <input name="repr_num" required autoComplete="off" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Vencimiento {req}</label>
              <input name="repr_exp" type="date" required className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <FotoInput name="reprocann_doc" label="Foto de la credencial" ayuda="Opcional, pero ayuda a validar." />
            </div>
          </div>
        )}
        {reprocann === 'tramite' && (
          <p className="mt-6 rounded-2xl bg-surface-2 px-5 py-4 text-text-soft">
            Queda registrado en evaluación: se valida cuando tenga la credencial.
          </p>
        )}
        {reprocann === 'no' && (
          <div className="mt-6 rounded-2xl border-2 border-accent/40 bg-accent/5 p-5">
            <p className="font-bold text-text text-lg mb-2">Lo derivamos a CLINICANN para el trámite</p>
            <ul className="list-disc pl-5 space-y-1.5 text-text-soft">
              {infoClinicann.map((l, i) => (
                <li key={i}>{l.replaceAll('[CLUB]', tenantName)}</li>
              ))}
            </ul>
            {contactoClinicann && <p className="mt-3 font-semibold text-text">Contacto: {contactoClinicann}</p>}
            <p className="text-text-mute text-sm mt-3">
              Completa igual todo el alta; queda en evaluación hasta que tenga el REPROCANN.
            </p>
          </div>
        )}
      </div>

      {/* 5. Indicación médica */}
      <div ref={ref(4)} className={vis(4)}>
        <p className="text-lg text-text-soft mb-4">
          {reprocann === 'vigente'
            ? 'Vienen cargados los datos de nuestro médico tratante. Si tiene REPROCANN con otro médico, reemplazalos.'
            : 'Quedan los datos de nuestro médico tratante; el diagnóstico lo define la consulta.'}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Médico tratante {req}</label>
            <input name="doctor" required defaultValue={medico.doctor ?? ''} autoComplete="off" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Matrícula</label>
            <input name="matricula" defaultValue={medico.matricula ?? ''} autoComplete="off" className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Especialidad / Institución</label>
            <input
              name="especialidad_institucion"
              defaultValue={medico.especialidad_institucion ?? ''}
              autoComplete="off"
              className={inputCls}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Diagnóstico / patología principal {reprocann === 'vigente' ? req : '(opcional)'}</label>
            <input name="patologia" required={reprocann === 'vigente'} autoComplete="off" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Producto prescripto {req}</label>
            <input
              name="producto_prescripto"
              required
              defaultValue={medico.producto_prescripto ?? ''}
              autoComplete="off"
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-[1fr_6rem] gap-2 items-end">
            <div>
              <label className={labelCls}>Dosis mensual (opcional)</label>
              <input name="dosis_mensual" type="number" inputMode="decimal" min="0" step="0.01" className={inputCls} />
            </div>
            <select name="dosis_unidad" defaultValue="g" className={inputCls}>
              <option value="g">g</option>
              <option value="ml">ml</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <FotoInput name="indicacion_medica" label="Foto de la indicación médica" ayuda="Opcional." />
          </div>
        </div>
      </div>

      {/* 6. DNI */}
      <div ref={ref(5)} className={vis(5)}>
        <p className="text-lg text-text-soft mb-4">Sacale una foto al frente y al dorso del DNI.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FotoInput name="dni_frente" label="Frente" />
          <FotoInput name="dni_dorso" label="Dorso" />
        </div>
      </div>

      {/* 7. Documentación */}
      <div ref={ref(6)} className={vis(6)}>
        <p className="text-lg text-text-soft mb-4">
          Leé cada documento hasta el final y marcá &quot;Leí y acepto&quot;.
        </p>
        <div className="space-y-4">
          {docsBase.map((d, i) => (
            <DocumentoScroll
              key={`${tipo}-${i}`}
              index={i}
              titulo={d.titulo}
              texto={textos[i]}
              aceptado={aceptados[i] ?? false}
              onAceptadoChange={(v) =>
                setAceptadoTexto((prev) => {
                  const n = [...prev];
                  n[i] = v ? textos[i] : '';
                  return n;
                })
              }
            />
          ))}
        </div>
        <label className={`mt-5 flex items-start gap-3 rounded-2xl border-2 border-line-2 p-4 text-text-soft ${CAMPO_INVALIDO}`}>
          <input type="checkbox" name="consiente_datos" required className="mt-1 h-5 w-5 shrink-0" />
          <span>
            En cumplimiento de la Ley N° 25.326, presto consentimiento expreso, libre e informado para el tratamiento de mis
            datos personales y datos sensibles de salud por parte de la Asociación, con fines de gestión administrativa de
            la membresía, seguimiento del cultivo y dispensación, comunicaciones institucionales y cumplimiento de
            obligaciones legales.
          </span>
        </label>
      </div>

      {/* 8. Firma */}
      <div ref={ref(7)} className={vis(7)}>
        <p className="text-lg text-text-soft mb-4">
          {campos.nombre ? `${campos.nombre}, firmá` : 'Firmá'} con el dedo en el recuadro.
        </p>
        <SignaturePad ref={sigRef} hiddenInputName="firma_data_url" grande />
      </div>

      {error && (
        <p role="alert" className="mt-6 rounded-xl bg-red-bg text-red font-semibold px-4 py-3">
          {error}
        </p>
      )}

      {/* Botonera fija abajo */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur px-5 py-4">
        <div className="max-w-3xl mx-auto flex gap-3">
          {paso > 0 && (
            <button
              type="button"
              onClick={atras}
              disabled={pending}
              className="rounded-2xl border-2 border-line-2 text-text text-lg font-bold px-6 py-4"
            >
              Atrás
            </button>
          )}
          {esUltimo ? (
            <button
              type="button"
              onClick={finalizar}
              disabled={pending}
              className="flex-1 rounded-2xl bg-accent text-white text-lg font-bold py-4 disabled:opacity-60"
            >
              {pending ? 'Guardando…' : 'Finalizar inscripción'}
            </button>
          ) : (
            <button
              type="button"
              onClick={siguiente}
              className="flex-1 rounded-2xl bg-accent text-white text-lg font-bold py-4"
            >
              Siguiente
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
