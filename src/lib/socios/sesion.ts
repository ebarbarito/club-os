import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { hashToken, nuevoToken } from './clave';

// Sesión del socio en el sitio público: una cookie httpOnly con un token al
// azar; en la base se guarda solo su hash (member_sesiones). La cookie es
// del subdominio del club, así que cada club tiene su propia sesión.

const COOKIE = 'socio_sesion';
const DIAS = 30;

export type SocioSesion = {
  sesionId: string;
  memberId: string;
  tenantId: string;
  debeCambiarClave: boolean;
  socio: {
    name: string | null;
    dni: string | null;
    memberNumber: number | null;
    plan: string | null;
    email: string | null;
  };
};

type Fila = {
  id: string;
  member_id: string;
  tenant_id: string;
  debe_cambiar_clave: boolean;
  expira_at: string;
  member: {
    name: string | null;
    dni: string | null;
    member_number: number | null;
    plan_solicitado: string | null;
    email: string | null;
    status: string;
    deleted_at: string | null;
  } | null;
};

// Socio logueado en este club, o null. Solo socios validados.
export async function getSocioSesion(tenantId: string): Promise<SocioSesion | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from('member_sesiones')
    .select(
      'id, member_id, tenant_id, debe_cambiar_clave, expira_at, member:members(name, dni, member_number, plan_solicitado, email, status, deleted_at)',
    )
    .eq('token_hash', hashToken(token))
    .maybeSingle<Fila>();

  if (!data || data.tenant_id !== tenantId) return null;
  if (new Date(data.expira_at).getTime() < Date.now()) return null;
  const m = data.member;
  if (!m || m.deleted_at || m.status !== 'valid') return null;

  return {
    sesionId: data.id,
    memberId: data.member_id,
    tenantId: data.tenant_id,
    debeCambiarClave: data.debe_cambiar_clave,
    socio: {
      name: m.name,
      dni: m.dni,
      memberNumber: m.member_number,
      plan: m.plan_solicitado,
      email: m.email,
    },
  };
}

// Solo desde Server Actions (escribe la cookie).
export async function crearSesion(memberId: string, tenantId: string, debeCambiarClave: boolean) {
  const token = nuevoToken();
  const admin = createAdminClient();
  const expira = new Date(Date.now() + DIAS * 86_400_000);
  const { error } = await admin.from('member_sesiones').insert({
    token_hash: hashToken(token),
    member_id: memberId,
    tenant_id: tenantId,
    debe_cambiar_clave: debeCambiarClave,
    expira_at: expira.toISOString(),
  });
  if (error) throw new Error(error.message);

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expira,
  });
}

// Solo desde Server Actions.
export async function cerrarSesion() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) {
    await createAdminClient().from('member_sesiones').delete().eq('token_hash', hashToken(token));
  }
  store.delete(COOKIE);
}
