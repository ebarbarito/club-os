'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth/get-session-profile';
import { DIAS_FLORA_DEFAULT, TIPOS_SALA, type ItemCosecha } from '@/lib/cultivo';

type Res = { error?: string };

// Configurar salas: solo admin. Mover plantas, cosechar y enviar a stock:
// admin y cultivo (es el trabajo diario de la sala).
async function perfil(soloAdmin: boolean) {
  const profile = await getSessionProfile();
  if (!profile) return { error: 'No autenticado' as const };
  if (soloAdmin ? profile.role !== 'admin' : profile.role !== 'admin' && profile.role !== 'cultivo') {
    return { error: 'No tenés permiso para hacer esto' as const };
  }
  return { profile };
}

function refrescar(loteId?: string) {
  revalidatePath('/panel/salas');
  revalidatePath('/panel/sensores');
  if (loteId) revalidatePath(`/panel/salas/lotes/${loteId}`);
}

function num(v: FormDataEntryValue | null) {
  return v === null || v === '' ? null : Number(v);
}

export async function upsertSala(formData: FormData): Promise<Res> {
  const p = await perfil(true);
  if ('error' in p) return { error: p.error };
  const supabase = await createClient();

  const id = formData.get('id') as string | null;
  const tipo = String(formData.get('tipo') ?? 'vege');
  const etapa = TIPOS_SALA.find((t) => t.value === tipo)?.etapa ?? 'vegetativo';
  const payload = {
    tenant_id: p.profile.tenantId,
    name: String(formData.get('name') ?? '').trim(),
    tipo,
    etapa,
    orden: Number(formData.get('orden') ?? 0),
    capacity: Number(formData.get('capacity') ?? 0),
    responsable: (formData.get('responsable') as string) || null,
    temp_min: num(formData.get('temp_min')),
    temp_max: num(formData.get('temp_max')),
    hum_min: num(formData.get('hum_min')),
    hum_max: num(formData.get('hum_max')),
    sensor_id: (formData.get('sensor_id') as string) || null,
  };
  if (!payload.name) return { error: 'Poné un nombre para la sala' };

  const { error } = id
    ? await supabase.from('salas').update(payload).eq('id', id)
    : await supabase.from('salas').insert(payload);
  if (error) return { error: error.message };

  refrescar();
  return {};
}

export async function cargarPlantas(
  salaId: string,
  items: { strainId: string; plants: number; esMadre: boolean }[],
  nota: string,
): Promise<Res> {
  const p = await perfil(false);
  if ('error' in p) return { error: p.error };
  const supabase = await createClient();
  const { error } = await supabase.rpc('cultivo_cargar', {
    p_sala_id: salaId,
    p_items: items.map((i) => ({ strain_id: i.strainId, plants: i.plants, es_madre: i.esMadre })),
    p_nota: nota || null,
  });
  if (error) return { error: error.message };
  refrescar();
  return {};
}

export async function moverPlantas(
  origen: string,
  destino: string,
  items: { id: string; plants: number }[],
): Promise<Res & { lote?: number | null }> {
  const p = await perfil(false);
  if ('error' in p) return { error: p.error };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('cultivo_mover', { p_origen: origen, p_destino: destino, p_items: items });
  if (error) return { error: error.message };
  refrescar();
  return { lote: (data as number | null) ?? null };
}

export async function descartarPlantas(id: string, plants: number, nota: string): Promise<Res> {
  const p = await perfil(false);
  if ('error' in p) return { error: p.error };
  const supabase = await createClient();
  const { error } = await supabase.rpc('cultivo_descartar', { p_id: id, p_plants: plants, p_nota: nota || null });
  if (error) return { error: error.message };
  refrescar();
  return {};
}

export async function cosecharLote(loteId: string, salaSecado: string, items: ItemCosecha[]): Promise<Res> {
  const p = await perfil(false);
  if ('error' in p) return { error: p.error };
  const supabase = await createClient();
  const { error } = await supabase.rpc('lote_cosechar', {
    p_lote_id: loteId,
    p_sala_secado: salaSecado || null,
    p_items: items.map((i) => ({
      strain_id: i.strainId,
      peso_humedo: i.pesoHumedo,
      extraccion_plantas: i.extraccionPlantas,
      aceite_plantas: i.aceitePlantas,
    })),
  });
  if (error) return { error: error.message };
  refrescar(loteId);
  return {};
}

export async function terminarProceso(
  procesoId: string,
  loteId: string,
  datos: { resultado: number; unidad: 'g' | 'ml'; productoId: string | null; nota: string },
): Promise<Res> {
  // loteId puede venir vacío (procesos que salieron del stock sin lote).
  const p = await perfil(false);
  if ('error' in p) return { error: p.error };
  const supabase = await createClient();
  const { error } = await supabase.rpc('proceso_terminar', {
    p_id: procesoId,
    p_resultado: datos.resultado,
    p_unidad: datos.unidad,
    p_producto: datos.productoId,
    p_nota: datos.nota || null,
  });
  if (error) return { error: error.message };
  refrescar(loteId || undefined);
  if (datos.productoId) revalidatePath('/panel/stock');
  return {};
}

export async function procesoDesdeStock(datos: {
  strainId: string;
  tipo: 'extraccion' | 'aceite';
  gramos: number;
  loteId: string | null;
  nota: string;
}): Promise<Res> {
  const p = await perfil(false);
  if ('error' in p) return { error: p.error };
  const supabase = await createClient();
  const { error } = await supabase.rpc('proceso_desde_stock', {
    p_strain: datos.strainId,
    p_tipo: datos.tipo,
    p_gramos: datos.gramos,
    p_lote: datos.loteId,
    p_nota: datos.nota || null,
  });
  if (error) return { error: error.message };
  refrescar(datos.loteId ?? undefined);
  revalidatePath('/panel/stock');
  return {};
}

export async function enviarLoteAStock(
  loteId: string,
  items: { strainId: string; pesoSeco: number | null; pesoTrim: number | null }[],
): Promise<Res> {
  const p = await perfil(false);
  if ('error' in p) return { error: p.error };
  const supabase = await createClient();
  const { error } = await supabase.rpc('lote_a_stock', {
    p_lote_id: loteId,
    p_items: items.map((i) => ({ strain_id: i.strainId, peso_seco: i.pesoSeco, peso_trim: i.pesoTrim })),
  });
  if (error) return { error: error.message };
  refrescar(loteId);
  revalidatePath('/panel/stock');
  return {};
}

export async function cortarEsquejes(datos: {
  salaId: string;
  items: { strainId: string; plants: number }[];
  loteId: string | null;
  destinoId: string | null;
  fecha: string;
  nota: string;
}): Promise<Res & { loteId?: string }> {
  const p = await perfil(false);
  if ('error' in p) return { error: p.error };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('cultivo_cortar_esquejes', {
    p_sala_id: datos.salaId,
    p_items: datos.items.map((i) => ({ strain_id: i.strainId, plants: i.plants })),
    p_lote: datos.loteId,
    p_destino: datos.destinoId,
    p_fecha: datos.fecha || null,
    p_nota: datos.nota || null,
  });
  if (error) return { error: error.message };
  refrescar();
  return { loteId: data as string };
}

export async function editarLote(
  loteId: string,
  datos: {
    numero: number;
    corteFecha: string | null;
    salaDestinoId: string | null;
    floraInicio: string | null;
    diasFlora: number;
    secadoInicio: string | null;
    notas: string;
  },
): Promise<Res> {
  const p = await perfil(false);
  if ('error' in p) return { error: p.error };
  if (!Number.isInteger(datos.numero) || datos.numero <= 0) return { error: 'Número de lote inválido' };
  const supabase = await createClient();
  const { error } = await supabase
    .from('lotes')
    .update({
      numero: datos.numero,
      corte_fecha: datos.corteFecha || null,
      sala_destino_id: datos.salaDestinoId || null,
      flora_inicio: datos.floraInicio || null,
      dias_flora: datos.diasFlora > 0 ? datos.diasFlora : DIAS_FLORA_DEFAULT,
      secado_inicio: datos.secadoInicio || null,
      notas: datos.notas.trim() || null,
    })
    .eq('id', loteId);
  if (error) {
    if (error.code === '23505') return { error: `Ya existe otro lote con el número ${datos.numero}` };
    return { error: error.message };
  }
  refrescar(loteId);
  return {};
}

export async function registrarManicura(datos: {
  loteId: string;
  fecha: string;
  operario: string;
  nota: string;
  items: { strainId: string; pesoSeco: number | null; pesoTrim: number | null; plantas: number | null }[];
}): Promise<Res> {
  const p = await perfil(false);
  if ('error' in p) return { error: p.error };
  const supabase = await createClient();
  const { error } = await supabase.rpc('lote_manicura', {
    p_lote_id: datos.loteId,
    p_items: datos.items.map((i) => ({
      strain_id: i.strainId,
      peso_seco: i.pesoSeco,
      peso_trim: i.pesoTrim,
      plantas: i.plantas,
    })),
    p_fecha: datos.fecha || null,
    p_operario: datos.operario || null,
    p_nota: datos.nota || null,
  });
  if (error) return { error: error.message };
  refrescar(datos.loteId);
  revalidatePath('/panel/stock');
  return {};
}

export async function terminarSecado(loteId: string): Promise<Res> {
  const p = await perfil(false);
  if ('error' in p) return { error: p.error };
  const supabase = await createClient();
  const { error } = await supabase.rpc('lote_terminar_secado', { p_lote_id: loteId });
  if (error) return { error: error.message };
  refrescar(loteId);
  return {};
}
