'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth/get-session-profile';

async function requireAdmin() {
  const profile = await getSessionProfile();
  if (!profile) throw new Error('No autenticado');
  if (profile.role !== 'admin') throw new Error('Solo un administrador puede gestionar proveedores');
  return profile;
}

export async function createProveedor(formData: FormData) {
  const profile = await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase.from('proveedores').insert({
    tenant_id: profile.tenantId,
    name: String(formData.get('name') ?? '').trim(),
    cuit: (formData.get('cuit') as string) || null,
    contact_name: (formData.get('contact_name') as string) || null,
    phone: (formData.get('phone') as string) || null,
    email: (formData.get('email') as string) || null,
    address: (formData.get('address') as string) || null,
    rubro: (formData.get('rubro') as string) || null,
    notes: (formData.get('notes') as string) || null,
  });

  if (error) return { error: error.message };
  revalidatePath('/panel/proveedores');
  return {};
}

export async function updateProveedor(id: string, formData: FormData) {
  const profile = await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from('proveedores')
    .update({
      name: String(formData.get('name') ?? '').trim(),
      cuit: (formData.get('cuit') as string) || null,
      contact_name: (formData.get('contact_name') as string) || null,
      phone: (formData.get('phone') as string) || null,
      email: (formData.get('email') as string) || null,
      address: (formData.get('address') as string) || null,
      rubro: (formData.get('rubro') as string) || null,
      notes: (formData.get('notes') as string) || null,
    })
    .eq('id', id)
    .eq('tenant_id', profile.tenantId);

  if (error) return { error: error.message };
  revalidatePath('/panel/proveedores');
  revalidatePath(`/panel/proveedores/${id}`);
  return {};
}

export async function deleteProveedor(id: string) {
  const profile = await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from('proveedores')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', profile.tenantId);

  if (error) return { error: error.message };
  revalidatePath('/panel/proveedores');
  return {};
}

export async function addMovimiento(
  proveedorId: string,
  data: {
    type: 'deuda' | 'pago';
    amount: number;
    description: string;
    date: string;
    account_id?: string | null;
    exchange_rate?: number;
  },
) {
  const profile = await requireAdmin();
  const supabase = await createClient();

  const exchangeRate = data.exchange_rate ?? 1;

  const { error } = await supabase.from('proveedor_movimientos').insert({
    tenant_id: profile.tenantId,
    proveedor_id: proveedorId,
    type: data.type,
    amount: data.amount,
    description: data.description,
    date: data.date,
    account_id: data.account_id || null,
    exchange_rate: exchangeRate,
    created_by: profile.userId,
  });

  if (error) return { error: error.message };

  // Si es un pago, también registrar el egreso en el ledger.
  // Se intenta enlazar al turno abierto actual (si hay uno).
  if (data.type === 'pago' && data.account_id) {
    const { data: shift } = await supabase
      .from('caja_shifts')
      .select('id')
      .is('closed_at', null)
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { error: ledgerError } = await supabase.from('ledger').insert({
      tenant_id: profile.tenantId,
      shift_id: shift?.id ?? null,
      type: 'egreso',
      category: 'Proveedores',
      concept: data.description,
      amount: data.amount,
      exchange_rate: exchangeRate,
      amount_local: data.amount * exchangeRate,
      account_id: data.account_id,
    });

    if (ledgerError) return { error: ledgerError.message };
    revalidatePath('/panel/caja');
  }

  revalidatePath(`/panel/proveedores/${proveedorId}`);
  return {};
}

export async function deleteMovimiento(movId: string, proveedorId: string) {
  const profile = await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from('proveedor_movimientos')
    .delete()
    .eq('id', movId)
    .eq('tenant_id', profile.tenantId);

  if (error) return { error: error.message };
  revalidatePath(`/panel/proveedores/${proveedorId}`);
  return {};
}
