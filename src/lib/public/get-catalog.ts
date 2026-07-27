import { createAdminClient } from '@/lib/supabase/admin';

export type CatalogItem = {
  id: string;
  name: string;
  type: string;
  thc: number | null;
  cbd: number | null;
  price_per_gram: number;
  available: boolean;
  crossInfo: string | null;
  composition: string | null;
  aroma: string | null;
  effects: string | null;
  description: string | null;
  images: string[];
};

// Catálogo público: no hay RLS de lectura anónima para strains/stock a
// propósito (ver ARCHITECTURE.md) — se usa service_role acá, siempre
// acotado por tenantId resuelto server-side desde el subdominio.
//
// No se expone el gramaje exacto en stock — el socio solo ve "disponible"
// o "sin stock". La cantidad real solo importa server-side, al validar
// una reserva (ver createReservation).
export async function getCatalog(tenantId: string): Promise<CatalogItem[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('strains')
    .select(
      'id, name, type, thc, cbd, price_per_gram, status, cross_info, composition, aroma, effects, description, images, stock(grams)',
    )
    .eq('tenant_id', tenantId)
    .in('status', ['activa', 'sin_stock'])
    .order('name');

  return (data ?? []).map((s) => {
    const stock = Array.isArray(s.stock) ? s.stock[0] : s.stock;
    return {
      id: s.id,
      name: s.name,
      type: s.type,
      thc: s.thc,
      cbd: s.cbd,
      price_per_gram: s.price_per_gram,
      available: s.status === 'activa' && (stock?.grams ?? 0) > 0,
      crossInfo: s.cross_info,
      composition: s.composition,
      aroma: s.aroma,
      effects: s.effects,
      description: s.description,
      images: s.images ?? [],
    };
  });
}
