import { createClient } from '@/lib/supabase/server';
import type { Tenant } from './types';

// Branding (slug/name/logo/theme) es de lectura pública (ver policy
// tenants_public_read) — no requiere sesión, lo necesita el sitio público.
export async function getTenantBySlug(slug: string): Promise<Tenant | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    // Supabase todavía no está configurado (.env vacío) — no romper el
    // arranque local, simplemente no hay tenant resuelto todavía.
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('tenants')
    .select('id, slug, name, logo_url, theme')
    .eq('slug', slug)
    .maybeSingle();

  if (error || !data) return null;
  return data as Tenant;
}
