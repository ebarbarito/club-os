'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth/get-session-profile';

type Resultado = { count?: number; total?: number; error?: string };

/**
 * Genera los cargos de cuota social de un período, para todos los socios
 * válidos o para uno solo (socio nuevo a mitad de mes o después de haber
 * generado las del resto).
 *
 * - periodo: 'YYYY-MM'. Si se omite, el mes actual.
 * - monto: para "todos", el monto por defecto de los socios sin cuota
 *   configurada en su ficha. Para "un socio", el monto a cobrarle (si va
 *   vacío se usa el de su ficha).
 * - Socios con cuota 100% bonificada: el cargo queda pago y el importe se
 *   acredita para retirar producto.
 * - Si el socio ya tiene la cuota del período, no se duplica.
 */
export async function generarCuotasSociales(formData: FormData): Promise<Resultado> {
  const profile = await getSessionProfile();
  if (!profile || profile.role !== 'admin') return { error: 'Solo un administrador puede generar cuotas' };

  const supabase = await createClient();

  const periodoRaw = String(formData.get('periodo') ?? '').trim();
  const montoIngresado = Number(formData.get('monto') ?? 0) || 0;
  const memberId = String(formData.get('member_id') ?? '').trim();

  let query = supabase
    .from('members')
    .select('id, name, cuota_social, cuota_social_bonificada')
    .is('deleted_at', null)
    .eq('status', 'valid');
  if (memberId) query = query.eq('id', memberId);
  const { data: members, error: membersError } = await query;
  if (membersError) return { error: membersError.message };

  if (memberId && (members ?? []).length === 0) {
    return { error: 'El socio no está validado: la cuota se genera solo a socios válidos.' };
  }

  const entries = (members ?? [])
    .map((m) => {
      const propia = Number(m.cuota_social ?? 0);
      const amount = memberId ? montoIngresado || propia : propia > 0 ? propia : montoIngresado;
      return { member_id: m.id, amount, bonificada: Boolean(m.cuota_social_bonificada) };
    })
    .filter((e) => e.amount > 0);

  if (entries.length === 0) {
    return {
      error: memberId
        ? 'Este socio no tiene cuota configurada en su ficha: ingresá el monto.'
        : 'Ningún socio tiene cuota social configurada y no se ingresó un monto por defecto. ' +
          'Configurá la cuota en la ficha de cada socio o ingresá un monto por defecto.',
    };
  }

  const periodoDate = periodoRaw ? `${periodoRaw}-01` : null;

  const { data: count, error } = await supabase.rpc('generar_cuotas_sociales', {
    p_entries: entries,
    p_periodo: periodoDate,
  });
  if (error) return { error: error.message };

  revalidatePath('/panel/dispensas');
  revalidatePath('/panel/configuracion');
  revalidatePath('/panel/ctacorriente');

  return { count: count as number, total: entries.length };
}
