import { createClient } from '@/lib/supabase/server';

export async function DispensaHistory({ strainId, unit }: { strainId: string; unit: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('dispensa_items')
    .select('quantity, dispensa:dispensas(created_at, voided_at, member:members(name, member_number))')
    .eq('strain_id', strainId)
    .limit(60);

  if (error) {
    return <p className="text-red text-sm">Error al cargar historial</p>;
  }

  type Entry = { date: string; memberName: string; memberNumber: number | null; quantity: number };
  const entries: Entry[] = (data ?? [])
    .map((item) => {
      const disp = Array.isArray(item.dispensa)
        ? (item.dispensa[0] as Record<string, unknown>)
        : (item.dispensa as Record<string, unknown> | null);
      const mem = Array.isArray(disp?.['member'])
        ? (disp['member'][0] as Record<string, unknown>)
        : (disp?.['member'] as Record<string, unknown> | null);
      return {
        date: (disp?.['created_at'] ?? '') as string,
        memberName: (mem?.['name'] ?? '—') as string,
        memberNumber: (mem?.['member_number'] ?? null) as number | null,
        quantity: item.quantity as number,
        voided: !!(disp?.['voided_at']),
      };
    })
    .filter((e) => !e.voided && e.date)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 30)
    .map(({ voided: _v, ...rest }) => rest);

  if (entries.length === 0) {
    return <p className="text-text-mute text-sm">Sin retiros registrados.</p>;
  }

  return (
    <div className="space-y-0 text-sm">
      <table className="w-full">
        <thead>
          <tr className="text-text-soft text-xs">
            <th className="text-left py-1.5 pr-4 font-medium">Fecha</th>
            <th className="text-left py-1.5 pr-4 font-medium">Socio</th>
            <th className="text-right py-1.5 font-medium">Cantidad</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, i) => (
            <tr key={i} className="border-t border-line">
              <td className="py-2 pr-4 text-left text-text-soft text-xs whitespace-nowrap">
                {new Date(entry.date).toLocaleDateString('es-AR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })}
              </td>
              <td className="py-2 pr-4 text-left text-text text-xs">
                {entry.memberNumber != null && (
                  <span className="text-text-mute mr-1">#{entry.memberNumber}</span>
                )}
                {entry.memberName}
              </td>
              <td className="py-2 text-right font-semibold text-text text-xs">
                {entry.quantity} {unit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
