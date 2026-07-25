export const MEMBER_STATUS = {
  draft: { label: 'Borrador', color: 'gray' },
  pending: { label: 'En evaluación', color: 'amber' },
  valid: { label: 'Válido', color: 'green' },
  rejected: { label: 'Rechazado', color: 'red' },
} as const;

export const ORDER_STATUS = {
  reservado: { label: 'Reservado', color: 'gray' },
  preparacion: { label: 'En preparación', color: 'blue' },
  listo: { label: 'Listo p/ retiro', color: 'green' },
  enviando: { label: 'En envío', color: 'blue' },
  entregado: { label: 'Entregado', color: 'gray' },
  cancelado: { label: 'Cancelado', color: 'red' },
} as const;

export const ETAPA = {
  vegetativo: { label: 'Vegetativo', color: 'green' },
  floracion: { label: 'Floración', color: 'purple' },
  secado: { label: 'Secado', color: 'amber' },
} as const;

type OrderStatus = keyof typeof ORDER_STATUS;
type Delivery = 'pickup' | 'shipping';

const NEXT_PICKUP: Partial<Record<OrderStatus, OrderStatus>> = {
  reservado: 'preparacion',
  preparacion: 'listo',
  listo: 'entregado',
};
const NEXT_SHIPPING: Partial<Record<OrderStatus, OrderStatus>> = {
  reservado: 'preparacion',
  preparacion: 'enviando',
  enviando: 'entregado',
};

export function nextOrderStatus(status: OrderStatus, delivery: Delivery): OrderStatus | null {
  const map = delivery === 'pickup' ? NEXT_PICKUP : NEXT_SHIPPING;
  return map[status] ?? null;
}
