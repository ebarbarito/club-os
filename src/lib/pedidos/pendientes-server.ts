import type { createClient } from '@/lib/supabase/server';
import { ESTADOS_ACCION_CLUB, ESTADOS_QUE_VENCEN, VIGENCIA_RESERVA_HORAS } from './reglas';

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Cantidad de pedidos (tablet o sitio) con una acción pendiente del club.
// No cuenta reservas vencidas aunque todavía no las haya cancelado la tarea.
export async function contarPedidosPendientes(supabase: Supabase): Promise<number> {
  const { data } = await supabase.from('orders').select('status, created_at').in('status', ESTADOS_ACCION_CLUB);
  const corte = Date.now() - VIGENCIA_RESERVA_HORAS * 3600_000;
  return (data ?? []).filter(
    (o) => !ESTADOS_QUE_VENCEN.includes(o.status as string) || new Date(o.created_at as string).getTime() >= corte,
  ).length;
}
