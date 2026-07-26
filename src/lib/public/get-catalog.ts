import { createAdminClient } from '@/lib/supabase/admin';

export type CatalogItem = {
  id: string;
  name: string;
  type: string;
  thc: number | null;
  cbd: number | null;
  price_per_gram: number;
  grams: number;
};

// Catálogo público: no hay RLS de lectura anónima para strains/stock a
// propósito (ver ARCHITECTURE.md) — se usa service_role acá, siempre
// acotado por tenantId resuelto server-side desde el subdominio.
export async function getCatalog(tenantId: string): Promise<CatalogItem[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('strains')
    .select('id, name, type, thc, cbd, price_per_gram, stock(grams)')
    .eq('tenant_id', tenantId)
    .eq('active', true)
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
      grams: stock?.grams ?? 0,
    };
  });
}
