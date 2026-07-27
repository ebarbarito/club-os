import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { ModalTrigger } from '@/components/modal-trigger';
import { money } from '@/lib/format';
import { AdjustStockForm } from './adjust-stock-form';

function levelTextColor(grams: number, min: number): string {
  if (grams <= 0) return 'text-red';
  if (grams <= min) return 'text-amber-tx';
  return 'text-text-soft';
}

export default async function StockPage() {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from('stock')
    .select('strain_id, grams, min_grams, strain:strains(id, name, type, price_per_gram)');

  const items = (rows ?? [])
    .map((r) => {
      const strain = Array.isArray(r.strain) ? r.strain[0] : r.strain;
      return strain ? { ...r, strain } : null;
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => a.strain.name.localeCompare(b.strain.name));

  const totalValue = items.reduce((sum, r) => sum + r.grams * r.strain.price_per_gram, 0);
  const totalGrams = items.reduce((sum, r) => sum + r.grams, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-text">Stock</h1>
          <p className="text-text-soft">Inventario por genética</p>
        </div>
        <Link
          href="/panel/catalogo"
          className="rounded-lg border border-line-2 text-sm font-semibold px-4 py-2 hover:border-accent hover:text-accent"
        >
          Gestionar genéticas en Catálogo
        </Link>
      </div>

      <div className="rounded-xl border border-line bg-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-text-soft text-left">
            <tr>
              <th className="px-4 py-2.5 font-medium">Genética</th>
              <th className="px-4 py-2.5 font-medium">Disponible</th>
              <th className="px-4 py-2.5 font-medium">% del total</th>
              <th className="px-4 py-2.5 font-medium">Mínimo</th>
              <th className="px-4 py-2.5 font-medium">Precio/g</th>
              <th className="px-4 py-2.5 font-medium">Valor total</th>
              <th className="px-4 py-2.5 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.strain_id} className="border-t border-line">
                <td className="px-4 py-2.5">
                  <div className="font-medium text-text">{r.strain.name}</div>
                  <div className="text-text-mute text-xs">{r.strain.type}</div>
                </td>
                <td className={`px-4 py-2.5 font-medium ${levelTextColor(r.grams, r.min_grams)}`}>{r.grams} g</td>
                <td className="px-4 py-2.5 text-text-soft">
                  {totalGrams > 0 ? `${((r.grams / totalGrams) * 100).toFixed(1)}%` : '—'}
                </td>
                <td className="px-4 py-2.5 text-text-soft">{r.min_grams} g</td>
                <td className="px-4 py-2.5 text-text-soft">{money(r.strain.price_per_gram)}</td>
                <td className="px-4 py-2.5 text-text-soft">{money(r.grams * r.strain.price_per_gram)}</td>
                <td className="px-4 py-2.5 text-right">
                  <ModalTrigger
                    label="Ajustar stock"
                    className="rounded-lg border border-line-2 text-xs font-semibold px-3 py-1.5 hover:border-accent hover:text-accent"
                    title={`Ajustar stock — ${r.strain.name}`}
                  >
                    <AdjustStockForm strainId={r.strain_id} currentGrams={r.grams} />
                  </ModalTrigger>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-text-mute">
                  Sin genéticas cargadas todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {items.length > 0 && <p className="text-text-soft text-sm mt-3">Total de stock: {money(totalValue)}</p>}
    </div>
  );
}
