import { createAdminClient } from '@/lib/supabase/admin';
import { topesDelClub } from '@/lib/pedidos/disponibilidad';
import { TOPE_GRAMOS_PEDIDO } from '@/lib/pedidos/reglas';

export type CatalogItem = {
  id: string;
  name: string;
  type: string;
  thc: number | null;
  cbd: number | null;
  price_per_gram: number;
  available: boolean;
  // Máximo para reservar (≤ 40 g; no se muestra, guía la cantidad).
  maxGrams: number;
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
  const topes = await topesDelClub(admin, tenantId);
  const { data } = await admin
    .from('strains')
    .select(
      'id, name, type, thc, cbd, price_per_gram, status, cross_info, composition, aroma, effects, description, images',
    )
    .eq('tenant_id', tenantId)
    .eq('item_type', 'genetica')
    .in('status', ['activa', 'sin_stock'])
    .order('name');

  const items: CatalogItem[] = (data ?? []).map((s) => {
    // Disponible = 70% de dispensa + general (mínimo 30 g), menos lo ya pedido.
    const tope = topes.get(s.id)?.tope ?? 0;
    return {
      id: s.id,
      name: s.name,
      type: s.type,
      thc: s.thc,
      cbd: s.cbd,
      price_per_gram: s.price_per_gram,
      available: tope > 0,
      maxGrams: Math.min(tope, TOPE_GRAMOS_PEDIDO),
      crossInfo: s.cross_info,
      composition: s.composition,
      aroma: s.aroma,
      effects: s.effects,
      description: s.description,
      images: s.images ?? [],
    };
  });
  // Primero las que hay para reservar, después las sin stock (alfabético dentro de cada grupo).
  return items.sort((a, b) => Number(b.available) - Number(a.available) || a.name.localeCompare(b.name, 'es'));
}
