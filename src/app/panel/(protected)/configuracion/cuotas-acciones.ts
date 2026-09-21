'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

/**
 * Genera cargos de cuota social para todos los socios activos del tenant.
 * - p_periodo: 'YYYY-MM' (e.g. '2026-09'). Si se omite, usa el mes actual.
 * - p_monto: monto por defecto para socios sin cuota_social configurada.
 *   Si el socio tiene cuota_social configurada en su ficha, se usa esa.
 */
export async function generarCuotasSociales(formData: FormData) {
  const supabase = await createClient();

  const periodoRaw = String(formData.get('periodo') ?? '').trim();
  const montoDefault = Number(formData.get('monto') ?? 0);

  // Cargar socios activos (no eliminados) con o sin cuota_social configurada.
  const { data: members, error: membersError } = await supabase
    .from('members')
    .select('id, name, member_number, cuota_social')
    .is('deleted_at', null);

  if (membersError) return { error: membersError.message };

  // Armar la lista de entradas, usando cuota individual si existe o el monto global.
  const entries = (members ?? [])
    .map((m) => ({
      member_id: m.id,
      amount: (m.cuota_social ?? 0) > 0 ? (m.cuota_social as number) : montoDefault,
    }))
    .filter((e) => e.amount > 0);

  if (entries.length === 0) {
    return {
      error:
        'Ningún socio tiene cuota social configurada y no se ingresó un monto por defecto. ' +
        'Configurá la cuota en la ficha de cada socio o ingresá un monto por defecto.',
    };
  }

  // Parsear período: 'YYYY-MM' → 'YYYY-MM-01', o null para usar el mes actual.
  const periodoDate = periodoRaw ? `${periodoRaw}-01` : null;

  const { data: count, error } = await supabase.rpc('generar_cuotas_sociales', {
    p_entries: entries,
    p_periodo: periodoDate,
  });

  if (error) return { error: error.message };

  revalidatePath('/panel/dispensas');
  revalidatePath('/panel/configuracion');

  return { count: count as number, total: entries.length };
}
