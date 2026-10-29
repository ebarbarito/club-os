import { ADICIONALES, PLANES, cuotaMensual, formatPesos, labelDe, numeroALetras, planAutocultivo } from './opciones';

// Documentos que el socio lee y acepta en la segunda parte del alta (ver
// migración 0062). El club los edita en Configuración → Documentos para
// firmar; si no cargó ninguno se usan estos por defecto.
//
// En el texto se usan datos entre corchetes ([NOMBRE COMPLETO], [DNI],
// [CUOTA MENSUAL], etc. — ver personalizarDocumento y aplicarDatosEtapa2)
// que se completan con los datos del socio; la constancia guarda el texto
// tal cual lo leyó.

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

function fechaDDMMAAAA(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

// Datos de la pre-inscripción (etapa 1), conocidos al abrir la segunda parte.
export type DatosDocumento = {
  club: string;
  nombreCompleto: string;
  dni: string;
  fechaNacimiento: string | null;
  nacionalidad: string | null;
  estadoCivil: string | null;
  domicilioReal: string | null;
  localidad: string | null;
  provincia: string | null;
  codigoPostal: string | null;
  telefono: string | null;
  email: string | null;
  cuil: string | null;
  // 'autocultivador' | 'paciente' (paciente = socio Activo en los contratos)
  tipo: string | null;
  fecha: Date;
};

// Completa los datos de la pre-inscripción. Lo que se carga en la misma
// segunda parte (plan, REPROCANN pendiente, indicación médica) se completa
// después con aplicarDatosEtapa2().
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
  const esAuto = d.tipo === 'autocultivador';
  const domicilio = [d.domicilioReal, d.localidad, d.provincia].filter(Boolean).join(', ');

  const vars: Record<string, string> = {
    CLUB: d.club,
    'NOMBRE COMPLETO': d.nombreCompleto,
    DNI: d.dni,
    'FECHA DE NACIMIENTO': fechaDDMMAAAA(d.fechaNacimiento),
    NACIONALIDAD: d.nacionalidad ?? '',
    'ESTADO CIVIL': d.estadoCivil ?? '',
    'DOMICILIO REAL': d.domicilioReal ?? '',
    DOMICILIO: domicilio,
    LOCALIDAD: d.localidad ?? '',
    PROVINCIA: d.provincia ?? '',
    'CÓDIGO POSTAL': d.codigoPostal ?? '',
    TELÉFONO: d.telefono ?? '',
    EMAIL: d.email ?? '',
    CUIL: d.cuil ?? '',
    CATEGORÍA: esAuto ? 'Autocultivador' : 'Activo',
    'CATEGORÍA REPROCANN': esAuto ? 'Autocultivador' : 'Paciente',
    'FECHA LARGA': fechaLarga,
    FECHA: fechaCorta,
  };
  return reemplazar(texto, vars);
}

// Lo que el socio completa en la misma segunda parte. Se aplica en el
// navegador (el texto se actualiza mientras completa el formulario) y en el
// servidor al guardar la constancia, con lo que efectivamente envió.
export type DatosEtapa2 = {
  plan: string | null | undefined;
  adicionales: string[] | null | undefined;
  reprocann: string | null | undefined; // 'vigente' | 'tramite' | 'no'
  credencial: string | null | undefined;
  vencimiento: string | null | undefined; // yyyy-mm-dd
  medico: string | null | undefined;
  especialidad: string | null | undefined;
  diagnostico: string | null | undefined;
  producto: string | null | undefined;
  dosis: string | null | undefined;
  unidad: string | null | undefined;
};

const ESTADO_REPROCANN: Record<string, string> = { vigente: 'Sí', tramite: 'En trámite', no: 'No' };

export function aplicarDatosEtapa2(texto: string, d: DatosEtapa2): string {
  const nombrePlan = d.plan
    ? [labelDe(PLANES, d.plan), ...(d.adicionales ?? []).map((a) => labelDe(ADICIONALES, a))].filter(Boolean).join(' + ')
    : '';
  const cuota = cuotaMensual(d.plan, d.adicionales);
  const auto = planAutocultivo(d.plan);
  const t = (v: string | null | undefined) => (v ?? '').trim();
  const vars: Record<string, string> = {
    PLAN: nombrePlan,
    'CUOTA MENSUAL': cuota ? formatPesos(cuota) : '',
    'CUOTA EN LETRAS': cuota ? numeroALetras(cuota) : '',
    'PLAN AUTOCULTIVO': auto?.nombre ?? '',
    SUPERFICIE: auto?.superficie ?? '',
    PRODUCCIÓN: auto?.produccion ?? '',
    REPROCANN: d.reprocann ? (ESTADO_REPROCANN[d.reprocann] ?? '') : '',
    'CREDENCIAL REPROCANN': d.reprocann === 'vigente' ? t(d.credencial) : '',
    'VENCIMIENTO REPROCANN': d.reprocann === 'vigente' ? fechaDDMMAAAA(t(d.vencimiento)) : '',
    'MÉDICO TRATANTE': t(d.medico),
    ESPECIALIDAD: t(d.especialidad),
    DIAGNÓSTICO: t(d.diagnostico),
    'PRODUCTO PRESCRIPTO': t(d.producto),
    'DOSIS MENSUAL': t(d.dosis) ? `${t(d.dosis)} ${t(d.unidad) || 'g'}` : '',
  };
  return reemplazar(texto, vars);
}

// Reemplaza solo los corchetes conocidos; un dato vacío queda como "—".
function reemplazar(texto: string, vars: Record<string, string>): string {
  return texto.replace(/\[([^\]]+)\]/g, (m, key: string) => {
    if (!(key in vars)) return m;
    const v = vars[key];
    return v && v.trim() ? v : '—';
  });
}
