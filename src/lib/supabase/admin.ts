import { createClient } from '@supabase/supabase-js';

// Cliente con service_role — bypassea RLS. Solo para scripts server-side
// de confianza (seed de tenants, jobs internos). Nunca importar desde
// código que corre en el browser ni desde rutas alcanzables por el usuario final.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
