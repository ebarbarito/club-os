// Opciones del alta de socio en dos etapas (ver migración 0060).
//
// Planes, adicionales y formas de entrega salen de la "Propuesta para
// pacientes" de Green Level. Por ahora viven acá (no hay tabla de planes
// por club): si otro club usa el alta en dos etapas, esto pasa a ser
// configuración por tenant. Sin precios a propósito — los valores cambian
// seguido y los informa el club por WhatsApp.

export const CATEGORIAS_SOCIO = [
  { value: 'activo', title: 'Socio Activo', desc: 'Adulto mayor de 18 años, uso medicinal con REPROCANN.' },
  { value: 'autocultivador', title: 'Socio Autocultivador', desc: 'Inscripto en REPROCANN como autocultivador. Cede parcela al club.' },
  { value: 'adherente_menor', title: 'Socio Adherente — Menor de edad', desc: 'Requiere representante legal o tutor responsable.' },
  { value: 'adherente', title: 'Socio Adherente', desc: 'Familiar o cuidador de paciente medicinal. Sin REPROCANN propio.' },
] as const;

export const PLANES = [
  { value: 'flores_10', title: 'Flores 10', desc: '10 g de flores secas por mes' },
  { value: 'flores_20', title: 'Flores 20', desc: '20 g de flores secas por mes' },
  { value: 'flores_40', title: 'Flores 40', desc: '40 g de flores secas por mes' },
  { value: 'medicinal', title: 'Medicinal', desc: '1 aceite de 30 ml y 1 crema por mes, sin flores' },
] as const;

export const ADICIONALES = [
  { value: 'aceite_10', title: 'Aceite 10 ml' },
  { value: 'aceite_30', title: 'Aceite 30 ml' },
  { value: 'crema', title: 'Crema' },
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

// Mensaje instructivo de la etapa 1 — el club lo copia desde Configuración
// y lo pega en WhatsApp en la consulta inicial.
export function mensajeEtapa1(clubName: string, link: string) {
  return `¡Hola! 👋 Gracias por tu interés en ${clubName} 🌿

Para empezar tu incorporación, completá este formulario (te lleva unos 5 minutos):
👉 ${link}

*Tené a mano:*
• Tu DNI
• Tu CUIL (si no lo sabés, lo encontrás en anses.gob.ar)
• Tu credencial REPROCANN, si ya la tenés

*Cómo completarlo:*
1️⃣ *Datos personales:* cargalos tal como figuran en tu DNI.
2️⃣ *Categoría:* elegí la que corresponde a tu situación. Si dudás entre dos, escribinos antes.
3️⃣ *REPROCANN:*
   • Si ya lo tenés: cargá el número y la fecha de vencimiento.
   • Si está en trámite o no lo tenés: marcá esa opción y listo. Te ayudamos a tramitarlo.
4️⃣ Aceptá el uso de tus datos y tocá *Enviar*.

Cuando lo recibamos te escribimos por acá para elegir tu plan y mandarte la segunda parte: indicación médica y firma de la documentación.

Cualquier duda, respondé este mensaje 🙌`;
}

// Mensaje con el link personal de la etapa 2 — sale desde la ficha del
// socio con el botón "Enviar etapa 2 por WhatsApp".
// Sin el nombre en el saludo: el campo es "Apellido y nombre" en un solo
// texto y no hay forma confiable de sacar el nombre de pila.
export function mensajeEtapa2(clubName: string, link: string) {
  return `¡Hola! 👋 Ya revisamos tus datos de pre-inscripción en ${clubName} ✅

Para terminar tu incorporación, completá la segunda parte (es personal, no la compartas):
👉 ${link}

*Tené a mano:*
• La indicación médica con las cantidades prescriptas
• Tu credencial REPROCANN (si ya la tenés)
• Foto de tu DNI, frente y dorso

Ahí elegís tu plan y la forma de retiro o envío, aceptás el estatuto y firmás con el dedo desde el celular.

Cualquier duda, respondé este mensaje 🙌`;
}

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
