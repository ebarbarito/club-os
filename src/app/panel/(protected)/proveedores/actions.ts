'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth/get-session-profile';
import { anularPorReceiptNumber } from '@/lib/anular-ledger';

async function requireAdmin() {
  const profile = await getSessionProfile();
  if (!profile) throw new Error('No autenticado');
  if (profile.role !== 'admin') throw new Error('Solo un administrador puede gestionar proveedores');
  return profile;
}

export async function createProveedor(formData: FormData) {
  const profile = await requireAdmin();
  const supabase = await createClient();

  // Siguiente número correlativo para este tenant
  const { data: maxRow } = await supabase
    .from('proveedores')
    .select('numero')
    .eq('tenant_id', profile.tenantId)
    .order('numero', { ascending: false })
    .limit(1)
    .maybeSingle();
  const numero = (maxRow?.numero ?? 0) + 1;

  const { error } = await supabase.from('proveedores').insert({
    tenant_id: profile.tenantId,
    numero,
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
    moneda: 'ARS' | 'USD';
    notas: string;
    apply_to_factura_id?: string | null;
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

  // Saldo en la moneda original del comprobante (USD o ARS).
  // Factura: positivo (debemos) | NC: negativo (nos deben)
  const saldo = (data.tipo === 'factura' ? 1 : -1) * data.total;

  const { data: comp, error } = await supabase
    .from('proveedor_comprobantes')
    .insert({
      tenant_id: profile.tenantId,
      proveedor_id: proveedorId,
      tipo: data.tipo,
      fecha: data.fecha,
      punto_venta: data.punto_venta,
      numero: data.numero,
      moneda: data.moneda,
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

  // Si es NC y se indicó una factura pendiente a la que aplicar el crédito
  if (data.tipo === 'nota_credito' && data.apply_to_factura_id) {
    const { data: factura, error: facErr } = await supabase
      .from('proveedor_comprobantes')
      .select('saldo')
      .eq('id', data.apply_to_factura_id)
      .eq('tenant_id', profile.tenantId)
      .single();

    if (!facErr && factura && factura.saldo > 0) {
      const applyAmount = Math.min(data.total, factura.saldo);
      // NC saldo: -(total - applyAmount) — crédito remanente
      const { error: ncErr } = await supabase
        .from('proveedor_comprobantes')
        .update({ saldo: -(data.total - applyAmount) })
        .eq('id', comp.id)
        .eq('tenant_id', profile.tenantId);
      if (ncErr) return { error: ncErr.message };
      // Factura saldo: saldo - applyAmount
      const { error: facUpdErr } = await supabase
        .from('proveedor_comprobantes')
        .update({ saldo: factura.saldo - applyAmount })
        .eq('id', data.apply_to_factura_id)
        .eq('tenant_id', profile.tenantId);
      if (facUpdErr) return { error: facUpdErr.message };
    }
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

  // Registrar egresos en ledger siempre que haya medios de pago (hay dinero
  // real moviéndose). El trigger apply_account_taxes genera automáticamente
  // las filas de impuesto/descuento de cada cuenta (ej. MP GL).
  // impacta_caja controla solo si el egreso se liga al turno abierto (shift_id)
  // o queda sin turno (shift_id = null → caja general, no afecta caja diaria).
  if (data.payments.length > 0) {
    const shift = data.impacta_caja
      ? await supabase
          .from('caja_shifts')
          .select('id')
          .is('closed_at', null)
          .order('opened_at', { ascending: false })
          .limit(1)
          .maybeSingle()
          .then((r) => r.data)
      : null;

    const { data: pagoReceiptNumber, error: receiptErr } = await supabase.rpc('next_receipt_number');
    if (receiptErr) return { error: receiptErr.message };

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
      receipt_number: pagoReceiptNumber,
    }));

    const { error: ledgerError } = await supabase.from('ledger').insert(ledgerRows);
    if (ledgerError) return { error: ledgerError.message };

    // Guardar el receipt_number en proveedor_pagos para poder anular después
    await supabase
      .from('proveedor_pagos')
      .update({ receipt_number: pagoReceiptNumber })
      .eq('id', pagoId)
      .eq('tenant_id', profile.tenantId);

    revalidatePath('/panel/caja');
  }

  revalidatePath(`/panel/proveedores/${proveedorId}`);
  return { id: pagoId };
}

// deletePagoComprobante kept as alias — old button imports this name
export async function deletePagoComprobante(pagoId: string, proveedorId: string) {
  return anularPagoProveedor(pagoId, proveedorId, 'Sin motivo (eliminación directa)');
}

export async function anularPagoProveedor(
  pagoId: string,
  proveedorId: string,
  motivo: string = 'Sin motivo especificado',
) {
  const profile = await requireAdmin();
  const supabase = await createClient();

  // Obtener datos del pago antes de eliminarlo
  const { data: pago } = await supabase
    .from('proveedor_pagos')
    .select('id, total, fecha, receipt_number')
    .eq('id', pagoId)
    .eq('tenant_id', profile.tenantId)
    .maybeSingle();

  if (!pago) return { error: 'Pago no encontrado' };

  // Si tiene receipt_number, revertir las filas de ledger
  if (pago.receipt_number) {
    const anulResult = await anularPorReceiptNumber(supabase, {
      tenantId: profile.tenantId,
      receiptNumber: pago.receipt_number,
      motivo,
      description: `Anulación de pago a proveedor: $${pago.total} (${pago.fecha})`,
      entityType: 'pago_proveedor',
      entityId: pago.id,
      userId: profile.userId,
    });
    if (anulResult.error) return { error: anulResult.error };
  } else {
    // Pago viejo sin receipt_number: solo registrar en audit_log
    await supabase.from('audit_log').insert({
      tenant_id: profile.tenantId,
      user_id: profile.userId,
      entity_type: 'pago_proveedor',
      entity_id: pago.id,
      change_type: 'eliminacion',
      description: `Anulación de pago a proveedor: $${pago.total} (${pago.fecha}) — sin filas de ledger vinculadas`,
      reason: motivo,
    });
  }

  // RPC restaura saldos de comprobantes y elimina el pago atómicamente
  const { error } = await supabase.rpc('eliminar_pago_proveedor', {
    p_pago_id: pagoId,
    p_tenant_id: profile.tenantId,
  });

  if (error) return { error: error.message };
  revalidatePath(`/panel/proveedores/${proveedorId}`);
  revalidatePath('/panel/caja');
  return {};
}
