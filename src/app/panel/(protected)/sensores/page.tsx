import { createClient } from '@/lib/supabase/server';
import { fetchSalaSeries, RANGE_KEYS } from '@/lib/influx';
import { SensoresView } from './sensores-view';

export default async function SensoresPage({
  searchParams,
}: {
  searchParams: Promise<{ sala?: string; range?: string }>;
}) {
  const { sala: salaParam, range: rangeParam } = await searchParams;
  const range = RANGE_KEYS.includes(rangeParam ?? '') ? (rangeParam as string) : '24h';

  const supabase = await createClient();
  const { data: salas } = await supabase
    .from('salas')
    .select(
      'id, name, etapa, etapa_dias, sensor_id, temp_min, temp_max, hum_min, hum_max, sala_strains(strain:strains(name))',
    )
    .not('sensor_id', 'is', null)
    .order('name');

  const items = (salas ?? []).map((s) => {
    const names = (s.sala_strains ?? [])
      .map((ss: { strain: { name: string } | { name: string }[] | null }) => {
        const strain = Array.isArray(ss.strain) ? ss.strain[0] : ss.strain;
        return strain?.name;
      })
      .filter(Boolean);
    return { ...s, strainName: names.length > 0 ? names.join(', ') : null };
  });

  const selected = items.find((s) => s.id === salaParam) ?? items[0] ?? null;
  const series = selected?.sensor_id ? await fetchSalaSeries(selected.sensor_id, range) : null;

  return <SensoresView salas={items} selectedId={selected?.id ?? null} range={range} series={series} />;
}
