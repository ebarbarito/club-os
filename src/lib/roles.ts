export type Role = 'admin' | 'dispensador' | 'cultivo';

export type ViewId =
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
  | 'configuracion'
  | 'asientos'
  | 'empleados';

export const ROLES: Record<Role, { name: string; desc: string; home: ViewId; nav: ViewId[] }> = {
  admin: {
    name: 'Administrador',
    desc: 'Acceso total: caja, balance, salas, socios y stock',
    home: 'dispensas',
    // Asientos, Cuentas y Usuarios quedan agrupados dentro de Configuración
    // (ver ConfigTabs) en vez de ser entradas propias del menú.
    nav: ['dispensas', 'ctacorriente', 'socios', 'catalogo', 'stock', 'salas', 'sensores', 'caja', 'balance', 'empleados', 'configuracion'],
  },
  dispensador: {
    name: 'Dispensador/a',
    desc: 'Dispensa, cta cte, catálogo, stock dispensa y caja diaria',
    home: 'dispensas',
    nav: ['dispensas', 'ctacorriente', 'catalogo', 'stock', 'caja'],
  },
  cultivo: {
    name: 'Cultivo',
    desc: 'Solo Salas: plantas, etapas y sensores',
    home: 'salas',
    nav: ['salas', 'sensores'],
  },
};

export const TITLES: Record<ViewId, [string, string]> = {
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
  asientos: ['Asientos', 'Modificaciones y eliminaciones — solo administrador'],
  empleados: ['Empleados', 'Remuneración pactada, adelantos y saldo disponible'],
};

export function isViewId(value: string): value is ViewId {
  return value in TITLES;
}
