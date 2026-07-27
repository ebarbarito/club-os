import { createClient } from '@/lib/supabase/server';
import { SensoresView } from './sensores-view';

export default async function SensoresPage() {
  const supabase = await createClient();
  const { data: salas } = await supabase
    .from('salas')
    .select(
      'id, name, etapa, etapa_dias, sensor_id, temp_min, temp_max, hum_min, hum_max, sala_strains(strain:strains(name))',
    )
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

  return <SensoresView salas={items} />;
}
