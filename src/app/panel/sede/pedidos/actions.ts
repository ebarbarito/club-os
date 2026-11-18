'use server';

import { revalidatePath } from 'next/cache';
import { getSessionProfile } from '@/lib/auth/get-session-profile';
import { createAdminClient } from '@/lib/supabase/admin';
import { publicUrlForSlug } from '@/lib/tenant/resolve';
import { emitirClaveProvisoria, mailValido } from '@/lib/socios/acceso';
import { problemaClaveNueva, soloDigitos } from '@/lib/socios/clave';
import { topesDelClub } from '@/lib/pedidos/disponibilidad';
import { problemaDelPedido } from '@/lib/pedidos/reglas';
import { emitirTicket, guardarClaveDefinitiva, leerTicket, socioPorDni, verificarIngreso } from '@/lib/socios/ingreso';

async function tenantDeLaTablet() {
  const profile = await getSessionProfile();
  if (!profile || (profile.role !== 'sede' && profile.role !== 'admin')) return null;
  return profile.tenantId;
}

function primerNombre(name: string | null) {
  const n = (name ?? '').trim();
  // "Apellido Nombre" → se muestra el nombre de pila cuando se puede.
  const partes = n.split(/\s+/);
  return partes.length > 1 ? partes.slice(1).join(' ') : n;
}

export async function identificarSocio(
  dni: string,
  clave: string,
): Promise<{ error: string } | { ticket: string; nombre: string; debeCrearClave: boolean }> {
  const tenantId = await tenantDeLaTablet();
  if (!tenantId) return { error: 'La tablet no tiene la sesión iniciada' };
  const res = await verificarIngreso(tenantId, dni, clave);
  if ('error' in res) return { error: res.error };
  const { data: m } = await createAdminClient().from('members').select('nombre_pila, name').eq('id', res.socio.id).single();
  return {
    ticket: emitirTicket(res.socio.id, tenantId),
    nombre: (m?.nombre_pila as string | null) || primerNombre(res.socio.name),
    debeCrearClave: res.conProvisoria,
  };
}

// "Primera vez": manda la clave provisoria al mail. Respuesta siempre igual.
export async function pedirClaveTablet(dniCrudo: string): Promise<{ error?: string; ok?: string }> {
  const tenantId = await tenantDeLaTablet();
  if (!tenantId) return { error: 'La tablet no tiene la sesión iniciada' };
  const dni = soloDigitos(dniCrudo);
  if (dni.length < 6) return { error: 'Ingresá tu número de DNI, sin puntos.' };

  const socio = await socioPorDni(tenantId, dni);
  if (socio && socio.status === 'valid' && mailValido(socio.email)) {
    const admin = createAdminClient();
    const { data: tenant } = await admin.from('tenants').select('id, slug, name').eq('id', tenantId).single();
    if (tenant) {
      const res = await emitirClaveProvisoria(admin, {
        tenant: { id: tenant.id, name: tenant.name },
        member: { id: socio.id, name: socio.name, email: socio.email },
        baseUrl: publicUrlForSlug(tenant.slug) ?? '',
      });
      if (res.error) console.error('[tablet] pedirClave', tenant.slug, res.error);
    }
  }
  return {
    ok: 'Si tu DNI corresponde a un socio validado con mail registrado, en unos minutos te llega una clave provisoria. Con esa clave ingresás acá y creás tu contraseña.',
  };
}

export async function crearClaveTablet(ticket: string, clave: string, repetir: string): Promise<{ error?: string }> {
  const tenantId = await tenantDeLaTablet();
  if (!tenantId) return { error: 'La tablet no tiene la sesión iniciada' };
  const memberId = leerTicket(ticket, tenantId);
  if (!memberId) return { error: 'Pasó mucho tiempo. Volvé a ingresar.' };
  const { data: m } = await createAdminClient().from('members').select('dni').eq('id', memberId).single();
  const problema = problemaClaveNueva(clave, (m?.dni as string | null) ?? '');
  if (problema) return { error: problema };
  if (clave !== repetir) return { error: 'Las dos contraseñas no coinciden.' };
  return guardarClaveDefinitiva(memberId, clave);
}

export async function confirmarPedido(
  ticket: string,
  items: { strainId: string; cantidad: number }[],
  nota: string,
): Promise<{ error: string } | { ok: true }> {
  const tenantId = await tenantDeLaTablet();
  if (!tenantId) return { error: 'La tablet no tiene la sesión iniciada' };
  const memberId = leerTicket(ticket, tenantId);
  if (!memberId) return { error: 'Pasó mucho tiempo. Volvé a ingresar para confirmar el pedido.' };

  const limpios = items.filter((i) => i.strainId && Number(i.cantidad) > 0);
  if (limpios.length === 0) return { error: 'El pedido está vacío' };

  const admin = createAdminClient();
  const { data: member } = await admin.from('members').select('status').eq('id', memberId).eq('tenant_id', tenantId).maybeSingle();
  if (!member || member.status !== 'valid') return { error: 'Solo los socios validados pueden hacer pedidos' };

  // Disponibilidad (70% de dispensa + general, mínimo 30 g, tope 40 g, de a 5 g).
  const problema = problemaDelPedido(
    limpios.map((i) => ({ strainId: i.strainId, cantidad: Number(i.cantidad) })),
    await topesDelClub(admin, tenantId),
  );
  if (problema) return { error: problema };

  const { data: order, error } = await admin
    .from('orders')
    .insert({
      tenant_id: tenantId,
      member_id: memberId,
      delivery: 'pickup',
      status: 'reservado',
      canal: 'tablet',
      nota: nota.trim().slice(0, 500) || null,
    })
    .select('id')
    .single();
  if (error || !order) return { error: 'No se pudo guardar el pedido. Probá de nuevo.' };

  const { error: errItems } = await admin
    .from('order_items')
    .insert(limpios.map((i) => ({ tenant_id: tenantId, order_id: order.id, strain_id: i.strainId, grams: i.cantidad })));
  if (errItems) {
    await admin.from('orders').delete().eq('id', order.id);
    return { error: 'No se pudo guardar el pedido. Probá de nuevo.' };
  }

  revalidatePath('/panel/dispensas');
  return { ok: true };
}
