// Borrador del alta en la tablet: se guarda en sessionStorage para que
// refrescar la página no borre lo cargado. Se borra al terminar el alta o
// al salir confirmando. Vence a las 3 horas (por si quedó uno abandonado).

const CLAVE = 'sede-alta-borrador';
export const PREFIJO_FOTO = 'sede-alta-foto:';
const VENCE_MS = 3 * 60 * 60 * 1000;

export type Borrador = {
  guardado: number;
  paso: number;
  responsable: string;
  tipo: 'paciente' | 'autocultivador';
  plan: string;
  adicionales: string[];
  reprocann: 'vigente' | 'tramite' | 'no' | '';
  campos: Record<string, string>;
  aceptadoTexto: string[];
  consiente: boolean;
};

export function leerBorrador(): Borrador | null {
  try {
    const raw = window.sessionStorage.getItem(CLAVE);
    if (!raw) return null;
    const b = JSON.parse(raw) as Borrador;
    if (!b || typeof b.guardado !== 'number' || Date.now() - b.guardado > VENCE_MS) {
      borrarBorrador();
      return null;
    }
    return b;
  } catch {
    return null;
  }
}

export function guardarBorrador(b: Omit<Borrador, 'guardado'>) {
  try {
    window.sessionStorage.setItem(CLAVE, JSON.stringify({ ...b, guardado: Date.now() }));
  } catch {
    // Sin espacio o sin storage: se sigue sin borrador.
  }
}

export function borrarBorrador() {
  try {
    const s = window.sessionStorage;
    for (let i = s.length - 1; i >= 0; i--) {
      const k = s.key(i);
      if (k && (k === CLAVE || k.startsWith(PREFIJO_FOTO))) s.removeItem(k);
    }
  } catch {
    // nada
  }
}

export function guardarFoto(name: string, dataUrl: string) {
  try {
    window.sessionStorage.setItem(PREFIJO_FOTO + name, dataUrl);
  } catch {
    // Si no entra, la foto no se recupera al refrescar (el resto sí).
  }
}

export function leerFoto(name: string): string | null {
  try {
    return window.sessionStorage.getItem(PREFIJO_FOTO + name);
  } catch {
    return null;
  }
}
