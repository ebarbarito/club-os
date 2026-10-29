import { ADICIONALES, PLANES, cuotaMensual, formatPesos, labelDe, numeroALetras } from './opciones';

// Documentos que el socio lee y acepta en la segunda parte del alta (ver
// migración 0062). El club los edita en Configuración → Documentos para
// firmar; si no cargó ninguno se usan estos por defecto.
//
// En el texto se pueden usar [NOMBRE COMPLETO], [DNI], [DOMICILIO], [EMAIL],
// [CATEGORÍA], [FECHA], [FECHA LARGA], [CLUB], [PLAN], [CUOTA MENSUAL] y
// [CUOTA EN LETRAS]: se completan con los datos del socio al mostrarlo, y se
// guarda en la constancia tal cual lo leyó.

// soloAutocultivador: el documento lo firman solo quienes se inscriben como
// autocultivadores (el paciente firma únicamente los generales).
export type DocumentoAdhesion = { titulo: string; texto: string; soloAutocultivador?: boolean };

export const DOCUMENTOS_POR_DEFECTO: DocumentoAdhesion[] = [
  {
    titulo: 'Declaración y consentimiento',
    texto: `Yo, [NOMBRE COMPLETO], DNI [DNI], declaro conocer y aceptar el Estatuto y Reglamento Interno de la Asociación [CLUB], comprometiéndome a cumplir las obligaciones que de ellos surjan, en el marco de la Ley N° 27.350 y sus normas complementarias.

Declaro que toda la información aportada en este formulario es veraz y completa, y que el cannabis obtenido será utilizado exclusivamente con fines medicinales o terapéuticos.

Fecha: [FECHA]`,
  },
];

export const MAX_DOCUMENTOS = 6;
export const MAX_TEXTO = 60_000;

export function parseDocumentos(raw: unknown): DocumentoAdhesion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((d): d is DocumentoAdhesion => !!d && typeof d.titulo === 'string' && typeof d.texto === 'string')
    .map((d) => ({ titulo: d.titulo.trim(), texto: d.texto.trim(), soloAutocultivador: d.soloAutocultivador === true }))
    .filter((d) => d.titulo && d.texto)
    .slice(0, MAX_DOCUMENTOS);
}

// Los que se firman: los del club, o los por defecto si no cargó ninguno.
export function documentosVigentes(raw: unknown): DocumentoAdhesion[] {
  const propios = parseDocumentos(raw);
  return propios.length > 0 ? propios : DOCUMENTOS_POR_DEFECTO;
}

// Los que le corresponden a un socio según cómo se inscribe.
export function documentosParaSocio(raw: unknown, esAutocultivador: boolean): DocumentoAdhesion[] {
  return documentosVigentes(raw).filter((d) => !d.soloAutocultivador || esAutocultivador);
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export type DatosDocumento = {
  club: string;
  nombreCompleto: string;
  dni: string;
  domicilio: string;
  email: string;
  // 'autocultivador' | 'paciente' (paciente = socio Activo en los contratos)
  tipo: string | null;
  fecha: Date;
};

// Completa los datos del socio. Los del plan ([PLAN], [CUOTA MENSUAL],
// [CUOTA EN LETRAS]) se completan aparte con aplicarPlan(), porque el socio
// puede cambiar el plan en la misma pantalla de la segunda parte.
export function personalizarDocumento(texto: string, d: DatosDocumento): string {
  const partes = new Intl.DateTimeFormat('es-AR', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).formatToParts(d.fecha);
  const dia = Number(partes.find((p) => p.type === 'day')?.value ?? 0);
  const mes = Number(partes.find((p) => p.type === 'month')?.value ?? 1);
  const anio = partes.find((p) => p.type === 'year')?.value ?? '';
  const fechaCorta = `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${anio}`;
  const fechaLarga = `a los ${dia} días del mes de ${MESES[mes - 1]} del año ${anio}`;
  const categoria = d.tipo === 'autocultivador' ? 'Autocultivador' : 'Activo';

  return texto
    .replaceAll('[CLUB]', d.club)
    .replaceAll('[NOMBRE COMPLETO]', d.nombreCompleto)
    .replaceAll('[DNI]', d.dni)
    .replaceAll('[DOMICILIO]', d.domicilio || '—')
    .replaceAll('[EMAIL]', d.email || '—')
    .replaceAll('[CATEGORÍA]', categoria)
    .replaceAll('[FECHA LARGA]', fechaLarga)
    .replaceAll('[FECHA]', fechaCorta);
}

// Datos del plan elegido. Se aplica en el navegador (para mostrar el texto
// al día si el socio cambia de plan) y en el servidor al guardar la
// constancia, con el plan que efectivamente envió.
export function aplicarPlan(texto: string, plan: string | null | undefined, adicionales: string[] | null | undefined): string {
  const nombrePlan = plan
    ? [labelDe(PLANES, plan), ...(adicionales ?? []).map((a) => labelDe(ADICIONALES, a))].filter(Boolean).join(' + ')
    : '[PLAN SIN ELEGIR]';
  const cuota = cuotaMensual(plan, adicionales);
  return texto
    .replaceAll('[PLAN]', nombrePlan)
    .replaceAll('[CUOTA MENSUAL]', cuota ? formatPesos(cuota) : '$ —')
    .replaceAll('[CUOTA EN LETRAS]', cuota ? numeroALetras(cuota) : '—');
}
