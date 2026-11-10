// Acciones pendientes del club en el ida y vuelta del alta de un socio.
// Se marcan con un punto de color: en el menú (Socios), en las pestañas y
// filas de la lista, y en la ficha, en la parte que tiene la acción.
//
//   Pre-inscripto sin 2ª parte enviada  → revisar y mandar la 2ª parte
//   En evaluación (completó la 2ª parte) → revisar la documentación y validar
//   Validado por el circuito nuevo, sin bienvenida enviada → mandar bienvenida
//
// Mientras la 2ª parte está enviada y el socio no la completó, la pelota está
// del lado del socio: no es alerta (se muestra como "esperando al socio").

export type EstadoAlta = {
  status: string;
  etapa2_enviada_at?: string | null;
  etapa2_completada_at?: string | null;
  bienvenida_enviada_at?: string | null;
};

export type AccionPendiente = { key: 'segunda-parte' | 'validar' | 'bienvenida'; label: string; detalle: string };

export function accionPendiente(m: EstadoAlta): AccionPendiente | null {
  if (m.status === 'preinscripto' && !m.etapa2_enviada_at) {
    return {
      key: 'segunda-parte',
      label: 'Enviar 2ª parte',
      detalle: 'Revisá los datos de la pre-inscripción y mandale el link de la segunda parte.',
    };
  }
  if (m.status === 'pending') {
    return {
      key: 'validar',
      label: 'Validar',
      detalle: 'Completó la segunda parte: revisá la indicación médica y la documentación firmada, y validalo o rechazalo.',
    };
  }
  if (m.status === 'valid' && m.etapa2_completada_at && !m.bienvenida_enviada_at) {
    return { key: 'bienvenida', label: 'Enviar bienvenida', detalle: 'Ya está validado: mandale el mensaje de bienvenida.' };
  }
  return null;
}

export function esperandoAlSocio(m: EstadoAlta): boolean {
  return m.status === 'preinscripto' && Boolean(m.etapa2_enviada_at) && !m.etapa2_completada_at;
}

// Punto de color (clases Tailwind) para marcar una acción pendiente.
export const PUNTO_ALERTA = 'inline-block h-2.5 w-2.5 rounded-full bg-red shrink-0 ring-2 ring-red/20';
