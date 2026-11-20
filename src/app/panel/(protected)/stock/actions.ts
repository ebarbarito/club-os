'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth/get-session-profile';

async function requireAdminProfile() {
  const profile = await getSessionProfile();
  if (!profile) throw new Error('No autenticado');
  if (profile.role !== 'admin') throw new Error('Solo un administrador puede operar el stock general');
  return profile;
}

export async function sendStock(formData: FormData) {
  await requireAdminProfile();
  const supabase = await createClient();

  const { error } = await supabase.rpc('send_stock', {
    p_strain_id: String(formData.get('strain_id')),
    p_quantity: Number(formData.get('quantity')),
    p_type: String(formData.get('type')),
    p_note: (formData.get('note') as string) || null,
  });
  if (error) return { error: error.message };

  revalidatePath('/panel/stock');
  return {};
}

export async function adjustGeneralStock(formData: FormData) {
  await requireAdminProfile();
  const supabase = await createClient();

  const { error } = await supabase.rpc('adjust_stock_general', {
    p_strain_id: String(formData.get('strain_id')),
    p_mode: String(formData.get('mode')),
    p_value: Number(formData.get('value')),
    p_note: (formData.get('note') as string) || null,
  });
  if (error) return { error: error.message };

  revalidatePath('/panel/stock');
  return {};
}

export async function adjustDispensaStock(formData: FormData) {
  await requireAdminProfile();
  const supabase = await createClient();

  const { error } = await supabase.rpc('adjust_stock_dispensa', {
    p_strain_id: String(formData.get('strain_id')),
    p_mode: String(formData.get('mode')),
    p_value: Number(formData.get('value')),
    p_note: (formData.get('note') as string) || null,
  });
  if (error) return { error: error.message };

  revalidatePath('/panel/stock');
  revalidatePath('/panel/asientos');
  return {};
}

// ── Historial de stock dispensa: ingresos, egresos y saldo ───────────────
export type MovimientoDispensa = {
  fecha: string;
  concepto: string;
  detalle: string | null;
  ingreso: number;
  egreso: number;
  saldo: number;
};

// Arma el libro de la sala dispensa de un artículo:
// ingresos = envíos desde stock general y ajustes para arriba;
// egresos = dispensas (no anuladas) y ajustes para abajo.
// El saldo se calcula hacia atrás desde el stock actual, así siempre
// coincide con lo que hay hoy.
export async function historialDispensa(
  strainId: string,
): Promise<{ error: string } | { movimientos: MovimientoDispensa[]; actual: number }> {
  const profile = await getSessionProfile();
  if (!profile || profile.role !== 'admin') return { error: 'Sin permiso' };
  const supabase = await createClient();

  const [stockRes, itemsRes, movRes, auditRes] = await Promise.all([
    supabase.from('stock').select('grams').eq('strain_id', strainId).maybeSingle(),
    supabase
      .from('dispensa_items')
      .select('quantity, dispensa:dispensas!inner(number, created_at, voided_at, member:members(name, member_number))')
      .eq('strain_id', strainId)
      .is('dispensa.voided_at', null),
    supabase
      .from('stock_movements')
      .select('type, quantity, note, created_at, by:profiles(name)')
      .eq('strain_id', strainId)
      .in('type', ['envio_dispensa', 'ajuste']),
    supabase
      .from('audit_log')
      .select('created_at')
      .eq('entity_type', 'stock_dispensa')
      .eq('entity_id', strainId),
  ]);
  const error = itemsRes.error ?? movRes.error ?? stockRes.error;
  if (error) return { error: error.message };

  // Los ajustes de dispensa dejan constancia en Asientos en la misma
  // operación (misma hora exacta); los ajustes sin esa constancia son del
  // stock general y no van acá.
  const ajustesDispensa = new Set((auditRes.data ?? []).map((a) => new Date(a.created_at as string).getTime()));

  type Mov = Omit<MovimientoDispensa, 'saldo'>;
  const uno = <T,>(x: T | T[] | null | undefined): T | null => (Array.isArray(x) ? (x[0] ?? null) : (x ?? null));
  const movs: Mov[] = [];

  for (const it of itemsRes.data ?? []) {
    const d = uno(it.dispensa as unknown) as {
      number: number | null;
      created_at: string;
      member: unknown;
    } | null;
    if (!d) continue;
    const socio = uno(d.member as unknown) as { name: string; member_number: number | null } | null;
    movs.push({
      fecha: d.created_at,
      concepto: d.number != null ? `Dispensa N° ${d.number}` : 'Dispensa',
      detalle: socio ? `${socio.member_number != null ? `#${socio.member_number} ` : ''}${socio.name}` : null,
      ingreso: 0,
      egreso: Number(it.quantity) || 0,
    });
  }

  for (const m of movRes.data ?? []) {
    const q = Number(m.quantity) || 0;
    const por = uno(m.by as unknown) as { name: string } | null;
    const detalle = [m.note, por?.name].filter(Boolean).join(' · ') || null;
    if (m.type === 'envio_dispensa') {
      movs.push({ fecha: m.created_at as string, concepto: 'Envío desde stock general', detalle, ingreso: q, egreso: 0 });
    } else if (ajustesDispensa.has(new Date(m.created_at as string).getTime()) && q !== 0) {
      movs.push({
        fecha: m.created_at as string,
        concepto: 'Ajuste',
        detalle,
        ingreso: q > 0 ? q : 0,
        egreso: q < 0 ? -q : 0,
      });
    }
  }

  // Más nuevo primero; saldo después de cada movimiento.
  movs.sort((a, b) => b.fecha.localeCompare(a.fecha));
  const actual = Number(stockRes.data?.grams ?? 0);
  let saldo = actual;
  const movimientos: MovimientoDispensa[] = movs.map((m) => {
    const fila = { ...m, saldo };
    saldo = saldo - m.ingreso + m.egreso;
    return fila;
  });
  return { movimientos, actual };
}
