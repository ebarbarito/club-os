import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth/get-session-profile';
import { ModalTrigger } from '@/components/modal-trigger';
import { SendStockForm } from './send-stock-form';
import { AdjustGeneralStockForm } from './adjust-general-stock-form';
import { StockMovements } from './stock-movements';

function levelTextColor(dispensaGrams: number, generalGrams: number): string {
  if (dispensaGrams > 0) return 'text-text-soft';
  if (generalGrams > 0) return 'text-accent';
  return 'text-red';
}

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const profile = await getSessionProfile();
  const { tab } = await searchParams;
  const activeTab = tab === 'general' && profile?.role === 'admin' ? 'general' : 'dispensa';

  const supabase = await createClient();
  const [{ data: dispensaRows }, { data: generalRows }] = await Promise.all([
    supabase.from('stock').select('strain_id, grams, strain:strains(id, code, name, type, item_type)'),
    supabase.from('stock_general').select('strain_id, grams, strain:strains(id, code, name, type, item_type)'),
  ]);

  type StrainInfo = { id: string; code: string | null; name: string; type: string | null; item_type: string };
  const oneStrain = (s: StrainInfo | StrainInfo[] | null) => (Array.isArray(s) ? s[0] : s);

  const dispensaByStrain = new Map((dispensaRows ?? []).map((r) => [r.strain_id, r.grams]));
  const generalByStrain = new Map((generalRows ?? []).map((r) => [r.strain_id, r.grams]));

  const strainMap = new Map<string, StrainInfo>();
  for (const r of dispensaRows ?? []) {
    const s = oneStrain(r.strain as StrainInfo | StrainInfo[] | null);
    if (s) strainMap.set(r.strain_id, s);
  }
  for (const r of generalRows ?? []) {
    const s = oneStrain(r.strain as StrainInfo | StrainInfo[] | null);
    if (s) strainMap.set(r.strain_id, s);
  }

  const strains = [...strainMap.values()].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-text">Stock</h1>
          <p className="text-text-soft">Inventario por artículo</p>
        </div>
      </div>

      {profile?.role === 'admin' && (
        <div className="flex gap-1 mb-4 border-b border-line">
          <Link
            href="/panel/stock"
            className={`px-3 py-2 text-sm border-b-2 -mb-px ${activeTab === 'dispensa' ? 'border-accent text-accent font-semibold' : 'border-transparent text-text-soft hover:text-text'}`}
          >
            Stock dispensa
          </Link>
          <Link
            href="/panel/stock?tab=general"
            className={`px-3 py-2 text-sm border-b-2 -mb-px ${activeTab === 'general' ? 'border-accent text-accent font-semibold' : 'border-transparent text-text-soft hover:text-text'}`}
          >
            Stock general
          </Link>
        </div>
      )}

      {activeTab === 'dispensa' ? (
        <div className="rounded-xl border border-line bg-surface overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-text-soft text-left">
              <tr>
                <th className="px-4 py-2.5 font-medium">Artículo</th>
                <th className="px-4 py-2.5 font-medium">Disponible</th>
              </tr>
            </thead>
            <tbody>
              {strains.map((s) => {
                const dGrams = dispensaByStrain.get(s.id) ?? 0;
                const gGrams = generalByStrain.get(s.id) ?? 0;
                return (
                  <tr key={s.id} className="border-t border-line">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-text">
                        {s.code ? `${s.code} · ` : ''}
                        {s.name}
                      </div>
                      <div className="text-text-mute text-xs">{s.item_type === 'genetica' ? s.type : 'Accesorio'}</div>
                    </td>
                    <td className={`px-4 py-2.5 font-medium ${levelTextColor(dGrams, gGrams)}`}>
                      {dGrams} {s.item_type === 'genetica' ? 'g' : 'u.'}
                    </td>
                  </tr>
                );
              })}
              {strains.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-10 text-center text-text-mute">
                    Sin artículos cargados todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-line bg-surface overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-text-soft text-left">
              <tr>
                <th className="px-4 py-2.5 font-medium">Artículo</th>
                <th className="px-4 py-2.5 font-medium">Disp. sala dispensa</th>
                <th className="px-4 py-2.5 font-medium">Disp. sala general</th>
                <th className="px-4 py-2.5 font-medium">Total</th>
                <th className="px-4 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {strains.map((s) => {
                const dGrams = dispensaByStrain.get(s.id) ?? 0;
                const gGrams = generalByStrain.get(s.id) ?? 0;
                const unit = s.item_type === 'genetica' ? 'g' : 'u.';
                return (
                  <tr key={s.id} className="border-t border-line">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-text">
                        {s.code ? `${s.code} · ` : ''}
                        {s.name}
                      </div>
                      <div className="text-text-mute text-xs">{s.item_type === 'genetica' ? s.type : 'Accesorio'}</div>
                    </td>
                    <td className="px-4 py-2.5 text-text-soft">{dGrams} {unit}</td>
                    <td className="px-4 py-2.5 text-text-soft">{gGrams} {unit}</td>
                    <td className="px-4 py-2.5 font-medium text-text">{dGrams + gGrams} {unit}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex gap-2 justify-end flex-wrap">
                        <ModalTrigger
                          label="Enviar"
                          className="rounded-lg border border-line-2 text-xs font-semibold px-3 py-1.5 hover:border-accent hover:text-accent"
                          title={`Enviar a dispensa — ${s.name}`}
                        >
                          <SendStockForm strainId={s.id} strainName={s.name} unit={unit} available={gGrams} />
                        </ModalTrigger>
                        <ModalTrigger
                          label="Movimientos"
                          className="rounded-lg border border-line-2 text-xs font-semibold px-3 py-1.5 hover:border-accent hover:text-accent"
                          title={`Movimientos — ${s.name}`}
                        >
                          <StockMovements strainId={s.id} unit={unit} />
                        </ModalTrigger>
                        <ModalTrigger
                          label="Ajustar"
                          className="rounded-lg border border-line-2 text-xs font-semibold px-3 py-1.5 hover:border-accent hover:text-accent"
                          title={`Ajustar stock general — ${s.name}`}
                        >
                          <AdjustGeneralStockForm strainId={s.id} currentGrams={gGrams} unit={unit} />
                        </ModalTrigger>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {strains.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-text-mute">
                    Sin artículos cargados todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
