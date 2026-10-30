// Mensajes de WhatsApp del alta — versión simple: uno por cada paso del
// circuito (los demás de la guía "Mensajes para socios" se definen más
// adelante):
//   preinscripcion → link del primer formulario (Configuración)
//   segunda-parte  → link personal para firmar (lista de socios / ficha)
//   bienvenida     → una vez validado (ficha)
//
// Los corchetes se completan solos con los datos del club y del socio; los
// que no tienen dato quedan a la vista para completarlos a mano (en la
// ficha el texto es editable).

import { ADICIONALES, PLANES, labelDe } from './opciones';

// ── Datos del club ─────────────────────────────────────────────────────────

export const CAMPOS_DATOS = [
  { key: 'direccion', label: 'Dirección de la sede', placeholder: 'Calle 123, Monte Grande' },
  { key: 'horario_retiro', label: 'Días y horarios de retiro', placeholder: 'martes y jueves de 14 a 19 h' },
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
  titulo: string;
  texto: string;
};

export const PLANTILLAS: Plantilla[] = [
  {
    id: 'preinscripcion',
    titulo: 'Pre-inscripción',
    texto: `¡Hola! 👋 Gracias por tu interés en [CLUB] 🌿

Para empezar tu ingreso, completá este formulario (te lleva unos 5 minutos ⏱️):
👉 [LINK PRE-INSCRIPCIÓN]

📝 Ahí cargás tus datos, elegís tu plan y nos contás si ya tenés REPROCANN (si no lo tenés, te acompañamos con el trámite).

📎 *Tené a mano:* tu DNI, tu CUIL y tu credencial REPROCANN, si ya la tenés.

Cualquier duda, escribinos por acá 💬`,
  },
  {
    id: 'segunda-parte',
    titulo: 'Segunda parte (firma)',
    texto: `¡Hola [NOMBRE]! 👋 Ya revisamos tus datos ✅
Anotamos el plan *[PLAN ELEGIDO]* 🌿

Para cerrar tu ingreso solo falta la segunda parte: cargar tu indicación médica y leer y firmar la documentación ✍️
👉 [LINK SEGUNDA PARTE]
🔒 Es personal, no lo compartas.

📎 *Tené a mano:*
• La indicación médica con las cantidades prescriptas
• Tu credencial REPROCANN
• Una foto de tu DNI (frente y dorso)

Una vez completo, coordinamos tu alta y tu primer retiro 🗓️`,
  },
  {
    id: 'bienvenida',
    titulo: 'Bienvenida',
    texto: `🎉 ¡Te damos la bienvenida a [CLUB], [NOMBRE]!

Ya sos parte del club 💚 Algunos datos útiles:
📍 *Dirección:* [DIRECCIÓN]
🕒 *Horarios de retiro:* [HORARIO DE RETIRO]
🌐 *Nuestro sitio:* [LINK SITIO]
💬 Ante cualquier duda, este es tu canal directo con nosotros.

¡Gracias por elegirnos! 🌿`,
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
  // Sitio público del club.
  linkSitio?: string | null;
  // Link personal de la segunda parte (solo socios pre-inscriptos).
  linkEtapa2?: string | null;
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
    DIRECCIÓN: d.direccion,
    'HORARIO DE RETIRO': d.horario_retiro,
    PLANES: planesTexto(),
    'LINK PRE-INSCRIPCIÓN': ctx.linkPreinscripcion,
    'LINK SITIO': ctx.linkSitio,
    'LINK SEGUNDA PARTE': ctx.linkEtapa2,
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

// ── Qué mensaje corresponde según el estado del socio ──────────────────────

export function mensajesParaEstado(status: string): string[] {
  if (status === 'preinscripto') return ['segunda-parte'];
  if (status === 'valid') return ['bienvenida'];
  return [];
}

export function plantilla(id: string) {
  return PLANTILLAS.find((p) => p.id === id);
}
