// Opciones del alta de socio en dos etapas (ver migración 0060).
//
// Planes, adicionales y formas de entrega salen de la "Propuesta para
// pacientes" de Green Level. Por ahora viven acá (no hay tabla de planes
// por club): si otro club usa el alta en dos etapas, esto pasa a ser
// configuración por tenant.
//
// PRECIOS: son los de la propuesta vigente (octubre 2026). Cuando cambien,
// se actualizan acá — es el único lugar donde están.

export const CATEGORIAS_SOCIO = [
  { value: 'activo', title: 'Socio Activo', desc: 'Adulto mayor de 18 años, uso medicinal con REPROCANN.' },
  { value: 'autocultivador', title: 'Socio Autocultivador', desc: 'Inscripto en REPROCANN como autocultivador. Cede parcela al club.' },
  { value: 'adherente_menor', title: 'Socio Adherente — Menor de edad', desc: 'Requiere representante legal o tutor responsable.' },
  { value: 'adherente', title: 'Socio Adherente', desc: 'Familiar o cuidador de paciente medicinal. Sin REPROCANN propio.' },
] as const;

// autocultivo: equivalencia para el socio autocultivador (Contrato de
// Locación de Servicios). BASIC = Flores 10, STANDARD = Flores 20,
// FULL GREEN = Flores 40. El plan Medicinal no aplica a autocultivo.
export const PLANES = [
  {
    value: 'flores_10',
    title: 'Flores 10',
    desc: '10 g de flores secas por mes',
    precio: '$120.000',
    autocultivo: { nombre: 'BASIC', superficie: '0,25 m²', produccion: '10 g' },
  },
  {
    value: 'flores_20',
    title: 'Flores 20',
    desc: '20 g de flores secas por mes',
    precio: '$220.000',
    autocultivo: { nombre: 'STANDARD', superficie: '0,50 m²', produccion: '20 g' },
  },
  {
    value: 'flores_40',
    title: 'Flores 40',
    desc: '40 g de flores secas por mes',
    precio: '$420.000',
    autocultivo: { nombre: 'FULL GREEN', superficie: '0,75 m²', produccion: '40 g' },
  },
  {
    value: 'medicinal',
    title: 'Medicinal',
    desc: 'Aceite + crema: 1 aceite de 30 ml y 1 crema por mes. Sin flores.',
    precio: '$60.000',
    autocultivo: null,
  },
] as const;

export function planAutocultivo(plan: string | null | undefined) {
  return PLANES.find((p) => p.value === plan)?.autocultivo ?? null;
}

export const ADICIONALES = [
  { value: 'aceite_10', title: 'Aceite 10 ml', precio: '$20.000' },
  { value: 'aceite_30', title: 'Aceite 30 ml', precio: '$50.000' },
  { value: 'crema', title: 'Crema', precio: '$15.000' },
] as const;

export const ENTREGAS = [
  { value: 'retiro', title: 'Retiro en la sede', desc: '1 o 2 veces por mes' },
  { value: 'envio', title: 'Envío a domicilio', desc: 'Lo recibís en tu casa' },
  { value: 'interior', title: 'Interior del país', desc: 'Envío por correo' },
] as const;

export function labelDe(list: readonly { value: string; title: string }[], value: string | null | undefined) {
  if (!value) return null;
  return list.find((o) => o.value === value)?.title ?? value;
}

// Pre-inscripción sin REPROCANN: cómo lo va a tramitar. Requisitos según
// la Res. 3132/2024 (Ministerio de Salud) y el instructivo oficial de
// REPROCANN (feb. 2025). Revisar si cambia la normativa.
export const TRAMITES_REPROCANN = [
  {
    value: 'propio',
    title: 'Lo tramito por mi cuenta',
    corto: 'Por su cuenta',
    info: [
      'El trámite es gratuito y se hace online desde Mi Argentina, eligiendo el rol "Paciente".',
      'Necesitás la indicación de un médico inscripto en REPROCANN (matriculado en REFEPS y con formación en cannabis medicinal). El médico carga la indicación y firma el consentimiento informado.',
      'Al registrarte, en "Tipo de cultivo" elegí "Otro": así te vinculás con [CLUB] como organización cultivadora. El sistema te da un código de vinculación: pasáselo a tu médico y a nosotros.',
      'La autorización dura 1 año y hay que renovarla antes de que venza.',
      'Para menores de edad, el trámite lo hace la madre, el padre o el tutor desde "Mis personas a cargo".',
      'Cuando te aprueben, cargás los datos de tu credencial en la segunda parte del formulario.',
    ],
  },
  {
    value: 'acompanado',
    title: 'Quiero que me acompañen con el trámite',
    corto: 'Acompañado (Clinicann)',
    info: [
      'Trabajamos con CLINICANN, nuestra institución médica aliada.',
      'Te van a contactar a la brevedad para coordinar la consulta médica y acompañarte en todo el trámite de REPROCANN.',
      'El trámite de REPROCANN es gratuito; solo la consulta médica tiene costo (te lo informan al contactarte).',
    ],
  },
] as const;

// Los textos de los mensajes de WhatsApp están en ./mensajes.ts.

// wa.me necesita el número en formato internacional sin '+' ni espacios.
// Para Argentina los celulares van como 549 + característica + número
// (sin el 0 ni el 15). Best effort: si no se puede normalizar, devuelve
// null y el link de WhatsApp abre sin destinatario (se elige el contacto).
export function telefonoWhatsApp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('54')) {
    d = d.slice(2);
    if (d.startsWith('9')) d = d.slice(1);
  }
  if (d.startsWith('0')) d = d.slice(1);
  // Saca el 15 después de la característica (2 a 4 dígitos): 11 15 xxxx xxxx
  const m = d.match(/^(\d{2,4})15(\d{6,8})$/);
  if (m && (m[1] + m[2]).length === 10) d = m[1] + m[2];
  if (d.length !== 10) return null;
  return `549${d}`;
}

export function linkWhatsApp(telefono: string | null | undefined, texto: string) {
  const tel = telefonoWhatsApp(telefono);
  return `https://wa.me/${tel ?? ''}?text=${encodeURIComponent(texto)}`;
}

// ── Cuota mensual (plan + adicionales) para los contratos ─────────────────

function precioNumero(precio: string): number {
  return Number(precio.replace(/[^\d]/g, '')) || 0;
}

export function cuotaMensual(plan: string | null | undefined, adicionales: string[] | null | undefined): number {
  const p = PLANES.find((x) => x.value === plan);
  if (!p) return 0;
  const extras = (adicionales ?? [])
    .map((a) => ADICIONALES.find((x) => x.value === a))
    .reduce((s, a) => s + (a ? precioNumero(a.precio) : 0), 0);
  return precioNumero(p.precio) + extras;
}

export function formatPesos(n: number): string {
  return `$${n.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
}

const UNIDADES = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
const DECENAS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const CENTENAS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

function menorQueMil(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'cien';
  const c = Math.floor(n / 100);
  const r = n % 100;
  let texto = CENTENAS[c];
  if (r > 0) {
    let dec: string;
    if (r < 30) dec = UNIDADES[r];
    else {
      const d = Math.floor(r / 10);
      const u = r % 10;
      dec = u === 0 ? DECENAS[d] : `${DECENAS[d]} y ${UNIDADES[u]}`;
    }
    texto = texto ? `${texto} ${dec}` : dec;
  }
  return texto;
}

// Número entero a letras, para montos de contratos ("ciento cuarenta mil").
export function numeroALetras(n: number): string {
  n = Math.floor(Math.abs(n));
  if (n === 0) return 'cero';
  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  const partes: string[] = [];
  if (millones > 0) partes.push(millones === 1 ? 'un millón' : `${menorQueMil(millones).replace(/veintiuno$/, 'veintiún').replace(/uno$/, 'un')} millones`);
  if (miles > 0) partes.push(miles === 1 ? 'mil' : `${menorQueMil(miles).replace(/veintiuno$/, 'veintiún').replace(/uno$/, 'un')} mil`);
  if (resto > 0) partes.push(menorQueMil(resto));
  return partes.join(' ');
}
