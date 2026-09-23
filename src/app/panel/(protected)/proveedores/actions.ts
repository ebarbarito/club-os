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

// ── Artículos ────────────────────────────────────────────────────────────────

export async function createArticulo(formData: FormData) {
  const profile = await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase.from('proveedor_articulos').insert({
    tenant_id: profile.tenantId,
    code: (formData.get('code') as string) || null,
    description: String(formData.get('description') ?? '').trim(),
    unit: (formData.get('unit') as string) || null,
    notes: (formData.get('notes') as string) || null,
  });

  if (error) return { error: error.message };
  revalidatePath('/panel/proveedores/articulos');
  return {};
}

export async function updateArticulo(id: string, formData: FormData) {
  const profile = await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from('proveedor_articulos')
    .update({
      code: (formData.get('code') as string) || null,
      description: String(formData.get('description') ?? '').trim(),
      unit: (formData.get('unit') as string) || null,
      notes: (formData.get('notes') as string) || null,
    })
    .eq('id', id)
    .eq('tenant_id', profile.tenantId);

  if (error) return { error: error.message };
  revalidatePath('/panel/proveedores/articulos');
  return {};
}

export async function deleteArticulo(id: string) {
  const profile = await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from('proveedor_articulos')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', profile.tenantId);

  if (error) return { error: error.message };
  revalidatePath('/panel/proveedores/articulos');
  return {};
}

// ── Comprobantes ─────────────────────────────────────────────────────────────

export async function createComprobante(
  proveedorId: string,
  data: {
    tipo: 'factura' | 'nota_credito';
    fecha: string;
    punto_venta: string;
    numero: string;
    subtotal: number;
    iva: number;
    iva_adicional: number;
    otros_impuestos: number;
    total: number;
    notas: string;
    items: {
      articulo_id: string | null;
      descripcion: string;
      cantidad: number;
      precio_unitario: number;
      descuento: number;
      total: number;
      orden: number;
    }[];
  },
) {
  const profile = await requireAdmin();
  const supabase = await createClient();

  // Factura: saldo positivo (debemos) | Nota de crédito: saldo negativo (nos deben)
  const saldo = data.tipo === 'factura' ? data.total : -data.total;

  const { data: comp, error } = await supabase
    .from('proveedor_comprobantes')
    .insert({
      tenant_id: profile.tenantId,
      proveedor_id: proveedorId,
      tipo: data.tipo,
      fecha: data.fecha,
      punto_venta: data.punto_venta,
      numero: data.numero,
      subtotal: data.subtotal,
      iva: data.iva,
      iva_adicional: data.iva_adicional,
      otros_impuestos: data.otros_impuestos,
      total: data.total,
      saldo,
      notas: data.notas || null,
      created_by: profile.userId,
    })
    .select('id')
    .single();

  if (error) return { error: error.message };

  if (data.items.length > 0) {
    const { error: itemsError } = await supabase.from('proveedor_comprobante_items').insert(
      data.items.map((item) => ({
        comprobante_id: comp.id,
        tenant_id: profile.tenantId,
        articulo_id: item.articulo_id || null,
        descripcion: item.descripcion,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
        descuento: item.descuento,
        total: item.total,
        orden: item.orden,
      })),
    );
    if (itemsError) return { error: itemsError.message };
  }

  revalidatePath(`/panel/proveedores/${proveedorId}`);
  return { id: comp.id };
}

export async function deleteComprobante(comprobanteId: string, proveedorId: string) {
  const profile = await requireAdmin();
  const supabase = await createClient();

  // Los items se eliminan en cascada por FK
  const { error } = await supabase
    .from('proveedor_comprobantes')
    .delete()
    .eq('id', comprobanteId)
    .eq('tenant_id', profile.tenantId);

  if (error) return { error: error.message };
  revalidatePath(`/panel/proveedores/${proveedorId}`);
  return {};
}

// ── Pagos por comprobante ─────────────────────────────────────────────────────

export async function createPagoComprobante(
  proveedorId: string,
  data: {
    fecha: string;
    total: number;             // total efectivo (cash) — excluye la parte cubierta por NC
    notas: string;
    impacta_caja: boolean;
    items: { comprobante_id: string; monto: number; tipo: 'factura' | 'nota_credito' }[];
    payments: { account_id: string; amount: number; exchange_rate: number }[];
  },
) {
  const profile = await requireAdmin();
  const supabase = await createClient();

  // Registrar pago y actualizar saldos de comprobantes (atómico via RPC)
  const { data: pagoId, error } = await supabase.rpc('registrar_pago_proveedor', {
    p_tenant_id: profile.tenantId,
    p_proveedor_id: proveedorId,
    p_fecha: data.fecha,
    p_total: data.total,
    p_notas: data.notas || null,
    p_impacta_caja: data.impacta_caja,
    p_created_by: profile.userId,
    p_items: data.items,
  });

  if (error) return { error: error.message };

  // Si impacta caja, registrar egresos en ledger
  if (data.impacta_caja && data.payments.length > 0) {
    const { data: shift } = await supabase
      .from('caja_shifts')
      .select('id')
      .is('closed_at', null)
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const ledgerRows = data.payments.map((p) => ({
      tenant_id: profile.tenantId,
      shift_id: shift?.id ?? null,
      type: 'egreso' as const,
      category: 'Proveedores',
      concept: `Pago proveedor`,
      amount: p.amount / (p.exchange_rate || 1),
      exchange_rate: p.exchange_rate || 1,
      amount_local: p.amount,
      account_id: p.account_id,
    }));

    const { error: ledgerError } = await supabase.from('ledger').insert(ledgerRows);
    if (ledgerError) return { error: ledgerError.message };
    revalidatePath('/panel/caja');
  }

  revalidatePath(`/panel/proveedores/${proveedorId}`);
  return { id: pagoId };
}

export async function deletePagoComprobante(pagoId: string, proveedorId: string) {
  const profile = await requireAdmin();
  const supabase = await createClient();

  // RPC restaura saldos y elimina el pago atómicamente
  const { error } = await supabase.rpc('eliminar_pago_proveedor', {
    p_pago_id: pagoId,
    p_tenant_id: profile.tenantId,
  });

  if (error) return { error: error.message };
  revalidatePath(`/panel/proveedores/${proveedorId}`);
  return {};
}
