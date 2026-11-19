import { getSessionProfile } from '@/lib/auth/get-session-profile';
import { createAdminClient } from '@/lib/supabase/admin';
import { topesDelClub } from '@/lib/pedidos/disponibilidad';
import { PedidosTablet, type ArticuloCatalogo } from './pedidos-tablet';

export const metadata = { title: 'Pedidos' };

// Pedidos en la tablet: el socio se identifica, elige del catálogo y deja el
// pedido para que lo preparen. No se muestra cuánto stock hay.
export default async function SedePedidosPage() {
  const profile = await getSessionProfile();
  if (!profile) return null;

  const admin = createAdminClient();
  const [{ data }, topes] = await Promise.all([
    admin
      .from('strains')
      .select('id, name, type, item_type, price_per_gram, status, images')
      .eq('tenant_id', profile.tenantId)
      .in('status', ['activa', 'sin_stock'])
      .order('name'),
    topesDelClub(admin, profile.tenantId),
  ]);

  // Solo lo que se puede pedir: lo sin stock no se muestra y vuelve solo
  // al catálogo cuando se carga stock de nuevo (se calcula en cada visita).
  const catalogo: ArticuloCatalogo[] = (data ?? []).map((s) => {
    const imgs = (s.images as string[] | null) ?? [];
    // Hasta cuánto se puede pedir (no se muestra: solo guía los botones).
    const tope = topes.get(s.id as string)?.tope ?? 0;
    return {
      id: s.id as string,
      nombre: s.name as string,
      tipo: (s.type as string | null) ?? null,
      esGenetica: s.item_type === 'genetica',
      precio: Number(s.price_per_gram) || 0,
      tope,
      disponible: tope > 0,
      imagenes: imgs,
    };
  });

  return <PedidosTablet catalogo={catalogo.filter((a) => a.disponible)} />;
}
