// Reglas de disponibilidad para pedidos (tablet de la sede) y reservas (sitio).
// Se usan en el navegador (para guiar) y en el servidor (para validar).

// Tope por pedido: suma de gramos de todas las genéticas.
export const TOPE_GRAMOS_PEDIDO = 40;
// Las genéticas se piden de 5 en 5 g.
export const PASO_GRAMOS = 5;
// Del stock (dispensa + general) se ofrece el 70%; el 30% queda de respaldo.
export const PORCION_OFRECIDA = 0.7;
// Con menos de 30 g en total, la genética figura sin stock.
export const STOCK_MINIMO_GRAMOS = 30;
// Las reservas valen 24 horas; después se cancelan solas (salvo las que ya
// salieron con envío) y lo pedido vuelve a estar disponible.
export const VIGENCIA_RESERVA_HORAS = 24;
export const ESTADOS_QUE_VENCEN = ['reservado', 'preparacion', 'listo'];

// Horas que le quedan a una reserva (0 si ya venció).
export function horasRestantes(creadaEl: string, ahora = Date.now()): number {
  const vence = new Date(creadaEl).getTime() + VIGENCIA_RESERVA_HORAS * 3600_000;
  return Math.max(0, (vence - ahora) / 3600_000);
}

export type LineaPedido = { strainId: string; cantidad: number };
export type Tope = { tope: number; esGenetica: boolean; nombre: string };

// Cuánto se puede pedir de una genética, redondeado hacia abajo a 5 g.
export function topeGenetica(dispensa: number, general: number, yaPedido: number): number {
  const total = Math.max(0, dispensa) + Math.max(0, general);
  if (total < STOCK_MINIMO_GRAMOS) return 0;
  const libre = total * PORCION_OFRECIDA - Math.max(0, yaPedido);
  return Math.max(0, Math.floor(libre / PASO_GRAMOS) * PASO_GRAMOS);
}

// Valida un pedido completo contra los topes. Devuelve el problema o null.
// No revela cuánto stock hay: solo si alcanza o no.
export function problemaDelPedido(lineas: LineaPedido[], topes: Map<string, Tope>): string | null {
  const validas = lineas.filter((l) => l.cantidad > 0);
  if (validas.length === 0) return 'El pedido está vacío';
  let gramos = 0;
  for (const l of validas) {
    const t = topes.get(l.strainId);
    if (!t) return 'Uno de los productos ya no está disponible';
    if (t.esGenetica) {
      if (l.cantidad % PASO_GRAMOS !== 0) return `Las genéticas se piden de ${PASO_GRAMOS} en ${PASO_GRAMOS} g`;
      gramos += l.cantidad;
    } else if (!Number.isInteger(l.cantidad)) {
      return 'Los accesorios se piden por unidad';
    }
    if (l.cantidad > t.tope) return `${t.nombre} no tiene disponible la cantidad pedida`;
  }
  if (gramos > TOPE_GRAMOS_PEDIDO) return `El tope es de ${TOPE_GRAMOS_PEDIDO} g por pedido sumando todas las genéticas`;
  return null;
}
