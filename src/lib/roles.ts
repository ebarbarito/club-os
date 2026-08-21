export type Role = 'admin' | 'dispensador' | 'cultivo';

export type ViewId =
  | 'resumen'
  | 'dispensas'
  | 'ctacorriente'
  | 'socios'
  | 'catalogo'
  | 'stock'
  | 'salas'
  | 'sensores'
  | 'caja'
  | 'cuentas'
  | 'balance'
  | 'usuarios'
  | 'configuracion';

export const ROLES: Record<Role, { name: string; desc: string; home: ViewId; nav: ViewId[] }> = {
  admin: {
    name: 'Administrador',
    desc: 'Acceso total: caja, balance, salas, socios y stock',
    home: 'resumen',
    nav: [
      'resumen',
      'dispensas',
      'ctacorriente',
      'socios',
      'catalogo',
      'stock',
      'salas',
      'sensores',
      'caja',
      'cuentas',
      'balance',
      'usuarios',
      'configuracion',
    ],
  },
  dispensador: {
    name: 'Dispensador/a',
    desc: 'Dispensa, socios, stock y salas (sin caja ni balance)',
    home: 'dispensas',
    nav: ['resumen', 'dispensas', 'ctacorriente', 'socios', 'stock', 'salas'],
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
  ctacorriente: ['Cuenta Corriente', 'Comprobantes adeudados por socio'],
  socios: ['Socios', 'Altas, validaciones y padrón'],
  catalogo: ['Catálogo', 'Artículos del club — base del sitio público y del stock'],
  stock: ['Stock', 'Inventario por artículo'],
  salas: ['Salas & Cultivo', 'Plantas, etapas y sensores'],
  sensores: ['Sensores', 'Seguimiento en vivo por sala'],
  caja: ['Caja', 'Turno, movimientos y arqueo'],
  cuentas: ['Cuentas', 'Medios de pago configurables'],
  balance: ['Balance', 'Ingresos y egresos del club'],
  usuarios: ['Usuarios', 'Cuentas del equipo'],
  configuracion: ['Configuración', 'Ajustes generales del club'],
};

export function isViewId(value: string): value is ViewId {
  return value in TITLES;
}
