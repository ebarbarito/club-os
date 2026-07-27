import { createClient } from '@/lib/supabase/server';
import { SensoresView } from './sensores-view';

export default async function SensoresPage() {
  const supabase = await createClient();
  const { data: salas } = await supabase
    .from('salas')
    .select('id, name, etapa, etapa_dias, sensor_id, temp_min, temp_max, hum_min, hum_max, strain:strains(name)')
    .order('name');

  const items = (salas ?? []).map((s) => {
    const strain = Array.isArray(s.strain) ? s.strain[0] : s.strain;
    return { ...s, strainName: strain?.name ?? null };
  });

  return <SensoresView salas={items} />;
}
