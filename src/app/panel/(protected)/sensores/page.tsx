import { createClient } from '@/lib/supabase/server';
import { fetchSalaSeries, RANGE_KEYS } from '@/lib/influx';
import { SensoresView } from './sensores-view';
import { diaDeEtapa } from '@/lib/cultivo';

export default async function SensoresPage({
  searchParams,
}: {
  searchParams: Promise<{ sala?: string; range?: string }>;
}) {
  const { sala: salaParam, range: rangeParam } = await searchParams;
  const range = RANGE_KEYS.includes(rangeParam ?? '') ? (rangeParam as string) : '24h';

  const supabase = await createClient();
  const [{ data: salas }, { data: lotes }] = await Promise.all([
    supabase
      .from('salas')
      .select(
        'id, name, tipo, etapa, sensor_id, temp_min, temp_max, hum_min, hum_max, sala_strains(plants, ingreso_at, strain:strains(name))',
      )
      .not('sensor_id', 'is', null)
      .order('name'),
    supabase.from('lotes').select('sala_id, estado, flora_inicio, secado_inicio').neq('estado', 'cerrado'),
  ]);

  // Día de la etapa calculado: flora y secado por el lote que está en la
  // sala; madres y vege por las plantas que llevan más días.
  function diaSala(s: { id: string; tipo: string; sala_strains: { ingreso_at: string }[] | null }) {
    const lote = (lotes ?? []).find((l: { sala_id: string }) => l.sala_id === s.id);
    if (s.tipo === 'flora') return lote ? diaDeEtapa(lote.flora_inicio) : 0;
    if (s.tipo === 'secado') return lote ? diaDeEtapa(lote.secado_inicio) : 0;
    return Math.max(0, ...(s.sala_strains ?? []).map((ss) => diaDeEtapa(ss.ingreso_at)));
  }

  const items = (salas ?? []).map((s) => {
    const names = (s.sala_strains ?? [])
      .map((ss: { strain: { name: string } | { name: string }[] | null }) => {
        const strain = Array.isArray(ss.strain) ? ss.strain[0] : ss.strain;
        return strain?.name;
      })
      .filter(Boolean);
    return { ...s, etapa_dias: diaSala(s), strainName: names.length > 0 ? names.join(', ') : null };
  });

  const selected = items.find((s) => s.id === salaParam) ?? items[0] ?? null;
  const series = selected?.sensor_id ? await fetchSalaSeries(selected.sensor_id, range) : null;

  return <SensoresView salas={items} selectedId={selected?.id ?? null} range={range} series={series} />;
}
