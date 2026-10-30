// Marca en rojo el campo con error de los formularios de alta y lleva la
// pantalla hasta él, sin borrar lo que el socio ya cargó.
//
// - Campos de texto / select: se marca el propio campo y se le da foco.
// - Opciones (radios, checkboxes, firma): se marca el bloque que las agrupa
//   (el elemento con data-campo más cercano, o la sección).
//
// El estilo rojo sale de las clases aria-[invalid=true]:… de los campos y
// secciones (CAMPO_INVALIDO).

export const CAMPO_INVALIDO =
  'aria-[invalid=true]:border-red aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-red';

export function marcarCampo(form: HTMLFormElement | null, campo: string | undefined) {
  if (!form || !campo) return;
  limpiarMarcas(form);
  const el = form.querySelector<HTMLElement>(`[name="${CSS.escape(campo)}"]`);
  const esTexto =
    (el instanceof HTMLInputElement && !['radio', 'checkbox', 'hidden', 'file'].includes(el.type)) ||
    el instanceof HTMLSelectElement ||
    el instanceof HTMLTextAreaElement;

  const destino = esTexto ? el : (el?.closest<HTMLElement>('[data-campo]') ?? el?.closest<HTMLElement>('section'));
  if (!destino) return;
  destino.setAttribute('aria-invalid', 'true');
  destino.scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (esTexto) (el as HTMLElement).focus({ preventScroll: true });
}

// Al corregir, se saca la marca del campo y de su bloque.
export function desmarcar(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return;
  target.removeAttribute('aria-invalid');
  target.closest('[data-campo]')?.removeAttribute('aria-invalid');
  target.closest('section')?.removeAttribute('aria-invalid');
}

function limpiarMarcas(form: HTMLFormElement) {
  form.querySelectorAll('[aria-invalid="true"]').forEach((e) => e.removeAttribute('aria-invalid'));
}
