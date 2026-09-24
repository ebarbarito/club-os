// Helper compartido para anular movimientos de ledger.
// No es un Server Action — lo llaman las actions de cada módulo.
// Nunca borra filas: inserta contrapartidas (category = 'Anulación')
// y marca las originales con anulado = true. Escribe en audit_log.

import type { SupabaseClient } from '@supabase/supabase-js';

export async function anularPorReceiptNumber(
  supabase: SupabaseClient,
  opts: {
    tenantId: string;
    receiptNumber: number;
    motivo: string;
    description: string;
    entityType: string;
    entityId: string;   // uuid del objeto principal (pago, ledger row, etc.)
    userId: string;
  },
): Promise<{ error?: string }> {
  const { tenantId, receiptNumber, motivo, description, entityType, entityId, userId } = opts;

  // 1. Buscar filas originales (excluir las ya anuladas)
  const { data: rows, error: fetchError } = await supabase
    .from('ledger')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('receipt_number', receiptNumber)
    .eq('anulado', false);

  if (fetchError) return { error: fetchError.message };
  if (!rows || rows.length === 0) {
    // No hay filas de ledger vinculadas — igual registramos en audit_log
    const { error: auditErr } = await supabase.from('audit_log').insert({
      tenant_id: tenantId,
      user_id: userId,
      entity_type: entityType,
      entity_id: entityId,
      change_type: 'eliminacion',
      description: description + ' (sin filas de ledger vinculadas)',
      reason: motivo,
    });
    return auditErr ? { error: auditErr.message } : {};
  }

  // 2. Nuevo receipt_number para las contrapartidas
  const { data: newReceipt, error: receiptErr } = await supabase.rpc('next_receipt_number');
  if (receiptErr) return { error: receiptErr.message };

  // 3. Insertar contrapartidas (tipo invertido, category = 'Anulación')
  const contrapartidas = (rows as any[]).map((r) => ({
    tenant_id: r.tenant_id,
    shift_id: r.shift_id,
    type: r.type === 'ingreso' ? 'egreso' : 'ingreso',
    category: 'Anulación',
    concept: `Anulación: ${r.concept}`,
    amount: r.amount,
    exchange_rate: r.exchange_rate,
    amount_local: r.amount_local,
    account_id: r.account_id,
    receipt_number: newReceipt,
    employee_id: r.employee_id ?? null,
    dispensa_id: r.dispensa_id ?? null,
  }));

  const { error: insertErr } = await supabase.from('ledger').insert(contrapartidas);
  if (insertErr) return { error: insertErr.message };

  // 4. Marcar originales como anuladas
  const { error: updateErr } = await supabase
    .from('ledger')
    .update({ anulado: true })
    .eq('tenant_id', tenantId)
    .eq('receipt_number', receiptNumber);
  if (updateErr) return { error: updateErr.message };

  // 5. Asiento en audit_log
  const { error: auditErr } = await supabase.from('audit_log').insert({
    tenant_id: tenantId,
    user_id: userId,
    entity_type: entityType,
    entity_id: entityId,
    change_type: 'eliminacion',
    description,
    reason: motivo,
  });
  if (auditErr) return { error: auditErr.message };

  return {};
}
