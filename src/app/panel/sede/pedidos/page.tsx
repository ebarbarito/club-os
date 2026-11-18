import { getSessionProfile } from '@/lib/auth/get-session-profile';
import { createAdminClient } from '@/lib/supabase/admin';
import { PedidosTablet, type ArticuloCatalogo } from './pedidos-tablet';

export const metadata = { title: 'Pedidos' };

// Pedidos en la tablet: el socio se identifica, elige del catálogo y deja el
// pedido para que lo preparen. No se muestra cuánto stock hay.
export default async function SedePedidosPage() {
  const profile = await getSessionProfile();
  if (!profile) return null;

  const { data } = await createAdminClient()
    .from('strains')
    .select('id, name, type, item_type, price_per_gram, status, images, stock(grams)')
    .eq('tenant_id', profile.tenantId)
    .in('status', ['activa', 'sin_stock'])
    .order('name');

  const catalogo: ArticuloCatalogo[] = (data ?? []).map((s) => {
    const stock = Array.isArray(s.stock) ? s.stock[0] : s.stock;
    const imgs = (s.images as string[] | null) ?? [];
    return {
      id: s.id as string,
      nombre: s.name as string,
      tipo: (s.type as string | null) ?? null,
      esGenetica: s.item_type === 'genetica',
      precio: Number(s.price_per_gram) || 0,
      disponible: s.status === 'activa' && Number(stock?.grams ?? 0) > 0,
      imagenes: imgs,
    };
  });

  return <PedidosTablet catalogo={catalogo} />;
}
