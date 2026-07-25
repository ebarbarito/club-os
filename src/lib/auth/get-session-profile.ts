import { createClient } from '@/lib/supabase/server';
import type { Role } from '@/lib/roles';

export type SessionProfile = {
  userId: string;
  name: string;
  role: Role;
  tenantId: string;
};

// null si no hay sesión o el perfil no existe (nunca debería pasar con datos
// consistentes, pero un login sin profile asociado no debe romper la app).
export async function getSessionProfile(): Promise<SessionProfile | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role, tenant_id')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile) return null;

  return { userId: user.id, name: profile.name, role: profile.role, tenantId: profile.tenant_id };
}
