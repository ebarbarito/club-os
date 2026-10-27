// Mensajes para socios — textos de la guía "Mensajes para socios · Green
// Level" (25/10/2026), adaptados al circuito del sistema:
//   2.1  → link de la pre-inscripción (etapa 1), donde ya se elige el plan
//   2.3 / 3.6 → link personal de la segunda parte (etapa 2: firma)
//   2.4  → bienvenida, una vez validado
//
// Los corchetes se completan solos con los datos del club (Configuración →
// Datos para mensajes) y del socio. Los que no tienen dato (ej. [DÍA Y HORA]
// de un turno) quedan a la vista para completarlos a mano antes de enviar:
// en la ficha del socio el texto es editable.

import { ADICIONALES, PLANES, labelDe } from './opciones';

// ── Datos del club ─────────────────────────────────────────────────────────

export const CAMPOS_DATOS = [
  { key: 'whatsapp', label: 'Número de WhatsApp', placeholder: '+54 9 11 7819-9283' },
  { key: 'direccion', label: 'Dirección de la sede', placeholder: 'Calle 123, Monte Grande' },
  { key: 'horario_atencion', label: 'Días y horario de atención', placeholder: 'lunes a viernes de 10 a 18 h' },
  { key: 'horario_retiro', label: 'Días y horarios de retiro', placeholder: 'martes y jueves de 14 a 19 h' },
  { key: 'valor_consulta', label: 'Valor de la consulta médica', placeholder: '$65.000' },
  { key: 'modalidad_consulta', label: 'Modalidad de la consulta', placeholder: 'presencial en la sede o por videollamada' },
  { key: 'plazo_ingreso', label: 'Plazo de ingreso con REPROCANN', placeholder: 'el mismo día' },
  { key: 'plazo_reprocann', label: 'Plazo de aprobación de REPROCANN', placeholder: '15 a 30 días' },
] as const;

export type DatosMensajes = Partial<Record<(typeof CAMPOS_DATOS)[number]['key'], string>>;

export function parseDatosMensajes(raw: unknown): DatosMensajes {
  if (!raw || typeof raw !== 'object') return {};
  const out: DatosMensajes = {};
  for (const { key } of CAMPOS_DATOS) {
    const v = (raw as Record<string, unknown>)[key];
    if (typeof v === 'string' && v.trim()) out[key] = v.trim();
  }
  return out;
}

// ── Plantillas ─────────────────────────────────────────────────────────────

export type Plantilla = {
  id: string;
  seccion: string;
  titulo: string;
  texto: string;
  // Variante para la ficha del socio, cuando ya está pre-inscripto y el
  // texto genérico no aplica (ej. no hace falta pedirle los datos).
  textoFicha?: string;
};

export const SECCIONES = [
  { id: '1', titulo: '1. Primer contacto', desc: 'Dar la bienvenida y hacer la pregunta clave: ¿tiene REPROCANN?' },
  { id: '2', titulo: '2. Camino A: ya tiene REPROCANN', desc: 'Pre-inscripción, segunda parte y bienvenida. Puede resolverse en el día.' },
  { id: '3', titulo: '3. Camino B: todavía no tiene REPROCANN', desc: 'Acompañar en cada etapa: consulta, trámite y alta.' },
  { id: '4', titulo: '4. Seguimiento', desc: 'Recuperar el contacto sin presionar.' },
  { id: '5', titulo: '5. Preguntas frecuentes', desc: 'Respuestas cortas para las dudas que más se repiten.' },
  { id: '6', titulo: '6. Situaciones especiales', desc: 'Casos menos frecuentes, resueltos de antemano.' },
] as const;

export const PLANTILLAS: Plantilla[] = [
  // 1. Primer contacto
  {
    id: '1.1',
    seccion: '1',
    titulo: 'Respuesta a "quiero info" o "¿cómo me asocio?"',
    texto: `¡Hola [NOMBRE]! 🌿 Gracias por escribirnos, soy [TU NOMBRE] de [CLUB].

Somos una ONG de la salud registrada en REPROCANN y acompañamos a pacientes en todo el proceso, desde la consulta médica hasta su ingreso al club.

Para orientarte mejor, contame: ¿ya tenés tu REPROCANN aprobado?`,
  },
  {
    id: '1.2',
    seccion: '1',
    titulo: 'Si escribió por Instagram: pasarlo a WhatsApp',
    texto: `¡Genial! Para enviarte el formulario y la info de los planes, sigamos por WhatsApp así es más cómodo. Escribinos al [WHATSAPP] o pasanos tu número y te escribimos nosotros. 📲`,
  },
  {
    id: '1.3',
    seccion: '1',
    titulo: 'Fuera de horario',
    texto: `¡Hola! Gracias por escribir a [CLUB] 🌿 Nuestro horario de atención es [HORARIO DE ATENCIÓN]. Te respondemos apenas volvamos. Mientras tanto, contanos si ya tenés tu REPROCANN así avanzamos más rápido.`,
  },

  // 2. Camino A
  {
    id: '2.1',
    seccion: '2',
    titulo: 'Envío del formulario (pre-inscripción)',
    texto: `¡Excelente, [NOMBRE]! Entonces el ingreso es muy simple:

1️⃣ Completá este formulario de inscripción (te lleva unos 5 minutos): [LINK PRE-INSCRIPCIÓN]
2️⃣ Ahí mismo elegís el plan que mejor se ajuste a vos
3️⃣ Revisamos tus datos, firmás la documentación y te sumamos a [CLUB]

*Tené a mano:* tu DNI, tu CUIL y tu credencial REPROCANN.

Si tenés alguna duda mientras lo completás, escribime por acá.`,
  },
  {
    id: '2.2',
    seccion: '2',
    titulo: 'Formulario recibido',
    texto: `¡Recibimos tu formulario, gracias! 🙌

Elegiste el plan [PLAN ELEGIDO]. Estamos revisando tus datos y en breve te mandamos la segunda parte para firmar la documentación.`,
  },
  {
    id: '2.3',
    seccion: '2',
    titulo: 'Plan elegido: últimos pasos (segunda parte)',
    texto: `¡Perfecto, [NOMBRE]! Anotamos el plan [PLAN ELEGIDO].

Para cerrar tu ingreso solo falta completar la segunda parte: tu indicación médica y la firma de la documentación (es personal, no la compartas):
👉 [LINK SEGUNDA PARTE]

*Tené a mano:* la indicación médica con las cantidades prescriptas y una foto de tu DNI (frente y dorso).

Una vez hecho, quedan listos tu alta y tu primer retiro.`,
  },
  {
    id: '2.4',
    seccion: '2',
    titulo: 'Bienvenida',
    texto: `🎉 ¡Te damos la bienvenida a [CLUB], [NOMBRE]!

Ya sos parte del club. Algunas cosas útiles:
📍 Dirección: [DIRECCIÓN]
🕒 Horarios de retiro: [HORARIO DE RETIRO]
💬 Ante cualquier duda, este es tu canal directo con nosotros.

Gracias por elegirnos. 💚`,
  },

  // 3. Camino B
  {
    id: '3.1',
    seccion: '3',
    titulo: 'Explicar las dos opciones de consulta',
    texto: `¡No te preocupes, [NOMBRE]! Te acompañamos en todo el trámite 🌿

El primer paso es una consulta médica. Tenés dos opciones:

🩺 *Con tu médico:* si está inscripto en REPROCANN, puede indicarte el tratamiento e iniciar tu trámite.
🩺 *Con nuestro equipo:* trabajamos con los profesionales especializados de Clinicann, nuestra institución médica aliada.

El trámite de REPROCANN es gratuito; solo la consulta médica tiene costo. ¿Cómo preferís hacerlo?`,
  },
  {
    id: '3.2',
    seccion: '3',
    titulo: 'Elige consulta con el equipo de Clinicann',
    texto: `¡Buenísimo! La consulta con nuestro equipo tiene un valor de [VALOR CONSULTA] y es [MODALIDAD CONSULTA].

Estos son los próximos turnos disponibles: [TURNOS DISPONIBLES]

Para reservar, completá tus datos en este formulario (marcá que todavía no tenés REPROCANN): [LINK PRE-INSCRIPCIÓN]
Y contame qué turno te queda mejor.`,
    textoFicha: `¡Buenísimo! La consulta con nuestro equipo tiene un valor de [VALOR CONSULTA] y es [MODALIDAD CONSULTA].

Estos son los próximos turnos disponibles: [TURNOS DISPONIBLES]

Contame qué turno te queda mejor y te lo reservo.`,
  },
  {
    id: '3.3',
    seccion: '3',
    titulo: 'Elige ir con su propio médico',
    texto: `¡Perfecto! Consultale si está inscripto en REPROCANN: si lo está, puede indicarte el tratamiento e iniciar tu trámite.

Si no está inscripto, no hay problema: podés hacer la consulta con nuestro equipo. Avisame cómo te fue y seguimos.`,
  },
  {
    id: '3.4',
    seccion: '3',
    titulo: 'Confirmación del turno',
    texto: `✅ ¡Listo, [NOMBRE]! Tu turno quedó confirmado:
📅 [DÍA Y HORA]
📍 [DIRECCIÓN / LINK DE VIDEOLLAMADA]
🧾 Llevá tu DNI y estudios o indicaciones médicas previas, si tenés.

Si necesitás reprogramar, avisanos con anticipación.`,
  },
  {
    id: '3.5',
    seccion: '3',
    titulo: 'Después de la consulta: trámite en curso',
    texto: `¡Gracias por venir a la consulta, [NOMBRE]! 🙌

Si el médico ya inició tu trámite, ahora queda esperar la aprobación de REPROCANN, que suele demorar [PLAZO REPROCANN]. Te va a llegar la novedad por mail.

Cuando la recibas, avisanos y seguimos con tu ingreso.`,
  },
  {
    id: '3.6',
    seccion: '3',
    titulo: 'REPROCANN aprobado: segunda parte',
    texto: `🎉 ¡Felicitaciones, [NOMBRE]! Ya tenés tu REPROCANN.

Ahora solo falta completar la segunda parte de tu ingreso: cargar tu credencial y tu indicación médica, confirmar tu plan y firmar la documentación (es personal, no la compartas):
👉 [LINK SEGUNDA PARTE]

Cuando lo completes, te sumamos a [CLUB].`,
  },

  // 4. Seguimiento
  {
    id: '4.1',
    seccion: '4',
    titulo: 'No respondió (a las 48 horas)',
    texto: `¡Hola [NOMBRE]! ¿Cómo estás? 🌿 Te escribo de [CLUB] para saber si te quedó alguna duda sobre el ingreso. Estamos para ayudarte cuando quieras.`,
  },
  {
    id: '4.2',
    seccion: '4',
    titulo: 'Segundo intento (a la semana, y el último)',
    texto: `Hola [NOMBRE], te dejo este mensaje por si más adelante querés retomar. Cuando quieras, escribinos y seguimos desde donde quedamos. 💚`,
  },
  {
    id: '4.3',
    seccion: '4',
    titulo: 'Recordatorio de turno (el día anterior)',
    texto: `¡Hola [NOMBRE]! Te recordamos tu consulta de mañana:
📅 [DÍA Y HORA]
📍 [DIRECCIÓN / LINK DE VIDEOLLAMADA]
¿Nos confirmás que venís?`,
  },
  {
    id: '4.4',
    seccion: '4',
    titulo: 'Trámite demorado',
    texto: `Hola [NOMBRE], ¿te llegó alguna novedad de REPROCANN? Si todavía no, es normal que demore unos días más. Si querés, revisamos juntos el estado del trámite.`,
  },
  {
    id: '4.5',
    seccion: '4',
    titulo: 'Primer seguimiento como socio (a las 2 semanas)',
    texto: `¡Hola [NOMBRE]! ¿Cómo vas con el tratamiento? 🌿 Queremos saber cómo te sentís y si necesitás algo. Recordatorio: nuestro director técnico médico hace el seguimiento de tu tratamiento, así que si querés una consulta de control, coordinamos.`,
  },
  {
    id: '4.6',
    seccion: '4',
    titulo: 'Vencimiento de REPROCANN (un mes antes)',
    texto: `Hola [NOMBRE], te avisamos que tu REPROCANN vence el [FECHA DE VENCIMIENTO]. Para que no se corte tu acceso, conviene renovarlo con tiempo. ¿Coordinamos la consulta para la renovación?`,
  },

  // 5. Preguntas frecuentes
  {
    id: '5.1',
    seccion: '5',
    titulo: '¿Cuánto cuesta?',
    texto: `El trámite de REPROCANN es gratuito. La consulta médica tiene un valor de [VALOR CONSULTA], y después elegís uno de nuestros planes:

[PLANES]`,
  },
  {
    id: '5.2',
    seccion: '5',
    titulo: '¿Es legal?',
    texto: `Sí. [CLUB] es una ONG de la salud registrada en REPROCANN, el registro del Ministerio de Salud de la Nación. Cada paciente que se suma queda vinculado en el sistema de forma legal, segura y trazable.`,
  },
  {
    id: '5.3',
    seccion: '5',
    titulo: '¿Cuánto tarda todo?',
    texto: `Si ya tenés REPROCANN, el ingreso puede quedar listo en [PLAZO INGRESO]. Si no lo tenés, depende de la aprobación del trámite, que suele demorar [PLAZO REPROCANN]. Te acompañamos y te avisamos en cada paso.`,
  },
  {
    id: '5.4',
    seccion: '5',
    titulo: '¿Puedo ir con mi médico?',
    texto: `Sí, siempre que esté inscripto en REPROCANN. Si no lo está, podés hacer la consulta con el equipo de Clinicann, nuestra institución médica aliada.`,
  },
  {
    id: '5.5',
    seccion: '5',
    titulo: 'Ya tengo REPROCANN vinculado a otra organización. ¿Puedo sumarme?',
    texto: `[RESPUESTA A DEFINIR: cómo es el cambio de vinculación en el sistema]`,
  },
  {
    id: '5.6',
    seccion: '5',
    titulo: '¿Qué incluye cada plan?',
    texto: `[PLANES]

Si no sabés cuál elegir, contame un poco de tu tratamiento y te recomendamos el que mejor se adapte.`,
  },
  {
    id: '5.7',
    seccion: '5',
    titulo: '¿Dónde están y en qué horario?',
    texto: `Estamos en [DIRECCIÓN]. Atendemos [HORARIO DE ATENCIÓN].`,
  },

  // 6. Situaciones especiales
  {
    id: '6.1',
    seccion: '6',
    titulo: 'Consulta médica por chat (dosis, síntomas, qué producto usar)',
    texto: `Entendemos tu consulta, [NOMBRE], y queremos que tengas la mejor respuesta. Ese tipo de indicaciones las define el médico según tu caso, así que lo ideal es verlo en una consulta. Si querés, te paso los próximos turnos con nuestro equipo. 🩺`,
  },
  {
    id: '6.2',
    seccion: '6',
    titulo: 'Cupo completo',
    texto: `Gracias por tu interés, [NOMBRE] 💚 En este momento tenemos el cupo de pacientes completo. Si querés, te sumamos a nuestra lista de espera y te avisamos apenas se libere un lugar.`,
  },
  {
    id: '6.3',
    seccion: '6',
    titulo: 'Vive lejos de la sede',
    texto: `¡Gracias por escribirnos! Los retiros son presenciales en [DIRECCIÓN], 1 o 2 veces por mes. También hacemos envíos a domicilio y al interior por correo. Si alguna de esas opciones te queda cómoda, seguimos con tu ingreso sin problema.`,
  },
  {
    id: '6.4',
    seccion: '6',
    titulo: 'Menores de edad',
    texto: `En el caso de menores, el trámite lo realiza su madre, padre o tutor legal junto con el médico tratante. Si es tu caso, contanos y te explicamos los pasos.`,
  },
  {
    id: '6.5',
    seccion: '6',
    titulo: 'Insultos, spam o pedidos de venta sin REPROCANN',
    texto: `[CLUB] es una ONG de la salud que trabaja solo con pacientes dentro del marco de REPROCANN. Si en algún momento querés hacer el trámite, estamos para acompañarte.`,
  },
];

// ── Relleno ────────────────────────────────────────────────────────────────

export function planesTexto(): string {
  const planes = PLANES.map((p) => `• *${p.title}:* ${p.desc} — ${p.precio}/mes`).join('\n');
  const adicionales = ADICIONALES.map((a) => `${a.title} ${a.precio}`).join(' · ');
  return `${planes}\n\nAdicionales (se suman a cualquier plan): ${adicionales}`;
}

export type Contexto = {
  club: string;
  operador?: string | null;
  datos: DatosMensajes;
  linkPreinscripcion?: string | null;
  // Datos del socio (solo en la ficha).
  socio?: {
    nombre: string | null;
    plan: string | null;
    adicionales: string[];
    reprExp: string | null;
  };
};

function fmtFecha(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

// Reemplaza los corchetes que tienen dato. Los que no, quedan visibles para
// completarlos a mano. [NOMBRE] sin dato: en la ficha se saca del saludo
// ("¡Excelente!" en vez de "¡Excelente, [NOMBRE]!"); en la pantalla de
// mensajes genéricos queda visible para completarlo.
export function rellenar(texto: string, ctx: Contexto): string {
  const d = ctx.datos;
  const planElegido = ctx.socio?.plan
    ? [labelDe(PLANES, ctx.socio.plan), ...ctx.socio.adicionales.map((a) => labelDe(ADICIONALES, a))]
        .filter(Boolean)
        .join(' + ')
    : null;
  const vars: Record<string, string | null | undefined> = {
    CLUB: ctx.club,
    'TU NOMBRE': ctx.operador,
    WHATSAPP: d.whatsapp,
    DIRECCIÓN: d.direccion,
    'HORARIO DE ATENCIÓN': d.horario_atencion,
    'HORARIO DE RETIRO': d.horario_retiro,
    'VALOR CONSULTA': d.valor_consulta,
    'MODALIDAD CONSULTA': d.modalidad_consulta,
    'PLAZO INGRESO': d.plazo_ingreso,
    'PLAZO REPROCANN': d.plazo_reprocann,
    PLANES: planesTexto(),
    'LINK PRE-INSCRIPCIÓN': ctx.linkPreinscripcion,
    'PLAN ELEGIDO': planElegido,
    'FECHA DE VENCIMIENTO': ctx.socio?.reprExp ? fmtFecha(ctx.socio.reprExp) : null,
    NOMBRE: ctx.socio?.nombre,
  };

  let out = texto;
  if (ctx.socio && !ctx.socio.nombre) {
    out = out.replace(/(,\s*|\s+)\[NOMBRE\]/g, '').replace(/\[NOMBRE\]\s*/g, '');
  }
  return out.replace(/\[([^\]]+)\]/g, (match, key: string) => {
    const v = vars[key];
    return v ? v : match;
  });
}

// ── Qué mensajes ofrecer en la ficha según el estado del socio ─────────────

export type EstadoSocio = {
  status: string;
  reprocann: string;
  etapa2Enviada: boolean;
  tieneVencimiento: boolean;
};

// Devuelve los ids de plantilla en orden; el primero es el recomendado.
export function mensajesParaEstado(e: EstadoSocio): string[] {
  if (e.status === 'preinscripto') {
    if (e.reprocann === 'vigente') return ['2.3', '2.2', '4.1', '4.2'];
    return [
      e.etapa2Enviada ? '4.4' : '3.1',
      '3.2',
      '3.3',
      '3.4',
      '4.3',
      '3.5',
      '4.4',
      '3.6',
      '4.1',
      '4.2',
    ].filter((id, i, arr) => arr.indexOf(id) === i);
  }
  if (e.status === 'pending') return ['4.1', '4.2'];
  if (e.status === 'valid') return ['2.4', '4.5', ...(e.tieneVencimiento ? ['4.6'] : []), '6.1'];
  if (e.status === 'draft') return ['2.1', '1.1', '4.1'];
  return [];
}

export function plantilla(id: string) {
  return PLANTILLAS.find((p) => p.id === id);
}
