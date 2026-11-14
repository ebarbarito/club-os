import { createHash, randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto';

// Contraseñas y claves provisorias de los socios: se guardan solo como hash
// (scrypt con sal propia). Los tokens de sesión, como sha256.

function scryptAsync(clave: string, sal: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(clave, sal, 64, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashClave(clave: string): Promise<string> {
  const sal = randomBytes(16);
  const hash = await scryptAsync(clave, sal);
  return `scrypt$${sal.toString('base64')}$${hash.toString('base64')}`;
}

export async function verificarClave(clave: string, guardado: string | null | undefined): Promise<boolean> {
  if (!guardado || !clave) return false;
  const [tipo, sal, hash] = guardado.split('$');
  if (tipo !== 'scrypt' || !sal || !hash) return false;
  const esperado = Buffer.from(hash, 'base64');
  const calculado = await scryptAsync(clave, Buffer.from(sal, 'base64'));
  return esperado.length === calculado.length && timingSafeEqual(esperado, calculado);
}

// Clave provisoria: 8 caracteres sin los que se confunden (0/O, 1/I/L).
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function generarClaveProvisoria(): string {
  let s = '';
  for (let i = 0; i < 8; i++) s += ALFABETO[randomInt(ALFABETO.length)];
  return s;
}

// Lo que escribe el socio al usar la provisoria: sin espacios ni guiones,
// en mayúsculas.
export function normalizarProvisoria(s: string) {
  return s.toUpperCase().replace(/[\s-]/g, '');
}

export function soloDigitos(s: string) {
  return s.replace(/\D/g, '');
}

export function nuevoToken() {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

// Reglas de la contraseña definitiva.
export function problemaClaveNueva(clave: string, dni: string): string | null {
  if (clave.length < 8) return 'La contraseña tiene que tener al menos 8 caracteres.';
  if (clave.length > 72) return 'La contraseña es demasiado larga.';
  if (!/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(clave) || !/\d/.test(clave)) return 'Usá al menos una letra y un número.';
  if (soloDigitos(clave) === soloDigitos(dni) && soloDigitos(dni)) return 'La contraseña no puede ser tu DNI.';
  return null;
}

export const PROVISORIA_MINUTOS = 30;
export const MAX_INTENTOS = 5;
export const BLOQUEO_MINUTOS = 15;
export const MAX_ENVIOS_DIA = 5;
