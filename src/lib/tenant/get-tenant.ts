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
    .select('id, slug, name, logo_url, theme, public_site_enabled')
    .eq('slug', slug)
    .maybeSingle();

  if (error || !data) return null;
  return data as Tenant;
}

// Mismo gate que usa el sitio público (/): mientras public_site_enabled
// esté apagado, solo lo puede ver alguien logueado en el panel de ESE
// club (el admin revisándolo antes de exponerlo), nunca un visitante
// anónimo. Se reutiliza acá para /alta-socio, que resuelve tenant igual
// que la home pública.
export async function canPreviewTenant(tenantId: string): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).maybeSingle();
  return profile?.tenant_id === tenantId;
}
