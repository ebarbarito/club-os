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
    impacta_caja?: boolean;
    payments?: { account_id: string; amount: number; exchange_rate: number }[];
  },
) {
  const profile = await requireAdmin();
  const supabase = await createClient();

  // Para el movimiento de proveedor guardamos la primer cuenta (o la única)
  const firstPayment = data.payments?.[0];
  const accountId = firstPayment?.account_id ?? data.account_id ?? null;
  const exchangeRate = firstPayment?.exchange_rate ?? data.exchange_rate ?? 1;

  const { error } = await supabase.from('proveedor_movimientos').insert({
    tenant_id: profile.tenantId,
    proveedor_id: proveedorId,
    type: data.type,
    amount: data.amount,
    description: data.description,
    date: data.date,
    account_id: accountId,
    exchange_rate: exchangeRate,
    created_by: profile.userId,
  });

  if (error) return { error: error.message };

  // Si es un pago y se pide impactar caja, registrar egreso(s) en ledger
  // enlazados al turno abierto actual (si hay uno).
  if (data.type === 'pago' && data.impacta_caja) {
    const payments = data.payments && data.payments.length > 0
      ? data.payments
      : accountId
      ? [{ account_id: accountId, amount: data.amount, exchange_rate: exchangeRate }]
      : [];

    if (payments.length > 0) {
      const { data: shift } = await supabase
        .from('caja_shifts')
        .select('id')
        .is('closed_at', null)
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const ledgerRows = payments.map((p) => ({
        tenant_id: profile.tenantId,
        shift_id: shift?.id ?? null,
        type: 'egreso' as const,
        category: 'Proveedores',
        concept: data.description,
        amount: p.amount / (p.exchange_rate || 1),   // monto en moneda de la cuenta
        exchange_rate: p.exchange_rate || 1,
        amount_local: p.amount,                       // ya viene en pesos
        account_id: p.account_id,
      }));

      const { error: ledgerError } = await supabase.from('ledger').insert(ledgerRows);
      if (ledgerError) return { error: ledgerError.message };
      revalidatePath('/panel/caja');
    }
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
