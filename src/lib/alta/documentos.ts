// Documentos que el socio lee y acepta en la segunda parte del alta (ver
// migración 0062). El club los edita en Configuración → Documentos para
// firmar; si no cargó ninguno se usan estos por defecto.
//
// En el texto se pueden usar [CLUB], [NOMBRE COMPLETO], [DNI] y [FECHA]:
// se completan con los datos del socio al mostrarlo, y se guarda en la
// constancia tal cual lo leyó.

export type DocumentoAdhesion = { titulo: string; texto: string };

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
    .map((d) => ({ titulo: d.titulo.trim(), texto: d.texto.trim() }))
    .filter((d) => d.titulo && d.texto)
    .slice(0, MAX_DOCUMENTOS);
}

// Los que se firman: los del club, o los por defecto si no cargó ninguno.
export function documentosVigentes(raw: unknown): DocumentoAdhesion[] {
  const propios = parseDocumentos(raw);
  return propios.length > 0 ? propios : DOCUMENTOS_POR_DEFECTO;
}

export function personalizarDocumento(
  texto: string,
  datos: { club: string; nombreCompleto: string; dni: string; fecha: Date },
): string {
  const fecha = datos.fecha.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Argentina/Buenos_Aires',
  });
  return texto
    .replaceAll('[CLUB]', datos.club)
    .replaceAll('[NOMBRE COMPLETO]', datos.nombreCompleto)
    .replaceAll('[DNI]', datos.dni)
    .replaceAll('[FECHA]', fecha);
}
