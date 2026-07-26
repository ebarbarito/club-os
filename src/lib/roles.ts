export type Role = 'admin' | 'dispensador' | 'cultivo';

export type ViewId =
  | 'resumen'
  | 'dispensas'
  | 'socios'
  | 'catalogo'
  | 'stock'
  | 'salas'
  | 'sensores'
  | 'caja'
  | 'balance'
  | 'usuarios';

export const ROLES: Record<Role, { name: string; desc: string; home: ViewId; nav: ViewId[] }> = {
  admin: {
    name: 'Administrador',
    desc: 'Acceso total: caja, balance, salas, socios y stock',
    home: 'resumen',
    nav: ['resumen', 'dispensas', 'socios', 'catalogo', 'stock', 'salas', 'sensores', 'caja', 'balance', 'usuarios'],
  },
  dispensador: {
    name: 'Dispensador/a',
    desc: 'Dispensa, socios, stock y salas (sin caja ni balance)',
    home: 'dispensas',
    nav: ['resumen', 'dispensas', 'socios', 'stock', 'salas'],
  },
  cultivo: {
    name: 'Cultivo',
    desc: 'Solo Salas: plantas, etapas y sensores',
    home: 'salas',
    nav: ['salas', 'sensores'],
  },
};

export const TITLES: Record<ViewId, [string, string]> = {
  resumen: ['Resumen', 'Vista general del club'],
  dispensas: ['Dispensa', 'Pedidos y dispensas registradas'],
  socios: ['Socios', 'Altas, validaciones y padrón'],
  catalogo: ['Catálogo', 'Genéticas del club — base del sitio público y del stock'],
  stock: ['Stock', 'Inventario por genética'],
  salas: ['Salas & Cultivo', 'Plantas, etapas y sensores'],
  sensores: ['Sensores', 'Seguimiento en vivo por sala'],
  caja: ['Caja', 'Turno, movimientos y arqueo'],
  balance: ['Balance', 'Ingresos y egresos del club'],
  usuarios: ['Usuarios', 'Cuentas del equipo'],
};

export function isViewId(value: string): value is ViewId {
  return value in TITLES;
}
