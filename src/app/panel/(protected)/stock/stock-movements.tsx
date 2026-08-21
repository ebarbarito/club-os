import { createClient } from '@/lib/supabase/server';
import { fmtDateTime } from '@/lib/format';

const TYPE_LABEL: Record<string, string> = {
  envio_dispensa: 'Envío a dispensa',
  envio_muestra: 'Envío (muestra)',
  ajuste: 'Ajuste',
};

export async function StockMovements({ strainId, unit }: { strainId: string; unit: string }) {
  const supabase = await createClient();
  const { data: movements } = await supabase
    .from('stock_movements')
    .select('id, type, quantity, note, created_at, by:profiles(name)')
    .eq('strain_id', strainId)
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <div className="space-y-2 text-sm">
      {(movements ?? []).length === 0 && <p className="text-text-mute">Sin movimientos todavía.</p>}
      {(movements ?? []).map((m) => {
        const by = Array.isArray(m.by) ? m.by[0] : m.by;
        const signed = m.type === 'envio_dispensa' || m.type === 'envio_muestra' ? -m.quantity : m.quantity;
        return (
          <div key={m.id} className="flex items-center justify-between border-b border-line pb-2">
            <div>
              <p className="text-text font-medium">{TYPE_LABEL[m.type] ?? m.type}</p>
              <p className="text-text-mute text-xs">
                {fmtDateTime(m.created_at)} · {by?.name ?? '—'}
                {m.note ? ` · ${m.note}` : ''}
              </p>
            </div>
            <span className={`font-semibold ${signed < 0 ? 'text-red' : 'text-accent'}`}>
              {signed > 0 ? '+' : ''}
              {signed} {unit}
            </span>
          </div>
        );
      })}
    </div>
  );
}
