import type { createAdminClient } from '@/lib/supabase/admin';
import { ESTADOS_QUE_VENCEN, topeGenetica, VIGENCIA_RESERVA_HORAS, type Tope } from './reglas';

type Admin = ReturnType<typeof createAdminClient>;

// Pedidos todavía no entregados: lo que piden ya no está disponible para otros.
const ESTADOS_ABIERTOS = ['reservado', 'preparacion', 'listo', 'enviando'];

// Tope por artículo del club: genéticas = 70% de (dispensa + general) menos
// lo ya pedido, 0 si hay menos de 30 g; accesorios = stock de dispensa menos
// lo ya pedido. Solo servidor.
export async function topesDelClub(admin: Admin, tenantId: string): Promise<Map<string, Tope>> {
  await vencerReservas(admin);
  const [{ data: articulos }, { data: disp }, { data: gral }, { data: pedidos }] = await Promise.all([
    admin.from('strains').select('id, name, item_type, status').eq('tenant_id', tenantId),
    admin.from('stock').select('strain_id, grams').eq('tenant_id', tenantId),
    admin.from('stock_general').select('strain_id, grams').eq('tenant_id', tenantId),
    admin
      .from('order_items')
      .select('strain_id, grams, order:orders!inner(status, created_at)')
      .eq('tenant_id', tenantId)
      .in('order.status', ESTADOS_ABIERTOS),
  ]);

  const suma = (filas: { strain_id: string; grams: number }[] | null) => {
    const m = new Map<string, number>();
    for (const f of filas ?? []) m.set(f.strain_id, (m.get(f.strain_id) ?? 0) + Number(f.grams || 0));
    return m;
  };
  const dispensa = suma(disp as { strain_id: string; grams: number }[] | null);
  const general = suma(gral as { strain_id: string; grams: number }[] | null);
  // Una reserva vencida ya no compromete stock (aunque todavía no la haya
  // cancelado la tarea automática).
  const corte = Date.now() - VIGENCIA_RESERVA_HORAS * 3600_000;
  type FilaPedido = { strain_id: string; grams: number; order: { status: string; created_at: string } | { status: string; created_at: string }[] };
  const vigentes = ((pedidos ?? []) as unknown as FilaPedido[]).filter((f) => {
    const o = Array.isArray(f.order) ? f.order[0] : f.order;
    return !o || !ESTADOS_QUE_VENCEN.includes(o.status) || new Date(o.created_at).getTime() >= corte;
  });
  const pedido = suma(vigentes);

  const topes = new Map<string, Tope>();
  for (const a of (articulos ?? []) as { id: string; name: string; item_type: string; status: string }[]) {
    const esGenetica = a.item_type === 'genetica';
    let tope = 0;
    if (a.status === 'activa') {
      tope = esGenetica
        ? topeGenetica(dispensa.get(a.id) ?? 0, general.get(a.id) ?? 0, pedido.get(a.id) ?? 0)
        : Math.max(0, Math.floor((dispensa.get(a.id) ?? 0) - (pedido.get(a.id) ?? 0)));
    }
    topes.set(a.id, { tope, esGenetica, nombre: a.name });
  }
  return topes;
}

// Cancela las reservas de más de 24 h (la misma función corre cada 15 min en
// la base). Si falla, no frena nada: la disponibilidad igual las ignora.
export async function vencerReservas(admin: Admin): Promise<void> {
  try {
    await admin.rpc('vencer_reservas');
  } catch {
    // nada
  }
}
