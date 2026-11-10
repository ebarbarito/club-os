import type { SupabaseClient } from '@supabase/supabase-js';

// Cuántos socios tienen una acción pendiente del club, por tipo (misma regla
// que accionPendiente en ./pendientes.ts).
export async function contarPendientesAlta(supabase: SupabaseClient) {
  const base = () => supabase.from('members').select('id', { count: 'exact', head: true }).is('deleted_at', null);
  const [a, b, c] = await Promise.all([
    base().eq('status', 'preinscripto').is('etapa2_enviada_at', null),
    base().eq('status', 'pending'),
    base().eq('status', 'valid').not('etapa2_completada_at', 'is', null).is('bienvenida_enviada_at', null),
  ]);
  const preinscripto = a.count ?? 0;
  const pending = b.count ?? 0;
  const valid = c.count ?? 0;
  return { preinscripto, pending, valid, total: preinscripto + pending + valid };
}
