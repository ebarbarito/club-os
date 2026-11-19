import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth/get-session-profile';
import { ROLES } from '@/lib/roles';
import { ModalTrigger } from '@/components/modal-trigger';
import { Badge } from '@/components/badge';
import { money } from '@/lib/format';
import { StrainForm } from './strain-form';
import { StrainImages } from './strain-images';
import { FotosLote } from './fotos-lote';

const STATUS_META: Record<string, { label: string; color: 'green' | 'amber' | 'gray' }> = {
  activa: { label: 'Activa', color: 'green' },
  sin_stock: { label: 'Sin stock', color: 'amber' },
  inactiva: { label: 'Inactiva', color: 'gray' },
};

const ITEM_TYPE_LABEL: Record<string, string> = {
  genetica: 'Genética',
  accesorio: 'Accesorio',
};

export default async function CatalogoPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect('/panel/login');
  if (profile.role !== 'admin' && profile.role !== 'dispensador') redirect(`/panel/${ROLES[profile.role].home}`);
  const isAdmin = profile.role === 'admin';

  const supabase = await createClient();
  const [{ data: rows }, { data: disp }, { data: gral }] = await Promise.all([
    supabase.from('strains').select('*').order('name'),
    supabase.from('stock').select('strain_id, grams'),
    supabase.from('stock_general').select('strain_id, grams'),
  ]);
  // Stock real (dispensa + general). Primero los artículos con stock.
  const stockTotal = new Map<string, number>();
  for (const r of [...(disp ?? []), ...(gral ?? [])] as { strain_id: string; grams: number }[]) {
    stockTotal.set(r.strain_id, (stockTotal.get(r.strain_id) ?? 0) + Number(r.grams || 0));
  }
  const conStock = (id: string) => (stockTotal.get(id) ?? 0) > 0;
  const strains = [...(rows ?? [])].sort(
    (a, b) => Number(conStock(b.id)) - Number(conStock(a.id)) || String(a.name).localeCompare(String(b.name), 'es'),
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-text">Catálogo</h1>
          <p className="text-text-soft">Artículos del club (genéticas y accesorios) — alimentan Stock y Dispensa</p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <ModalTrigger
              label="📷 Subir fotos en lote"
              title="Subir fotos en lote"
              className="rounded-lg border border-line-2 text-sm font-semibold px-4 py-2 hover:border-accent hover:text-accent"
            >
              <FotosLote />
            </ModalTrigger>
            <ModalTrigger label="+ Nuevo artículo" title="Nuevo artículo">
              <StrainForm />
            </ModalTrigger>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-line bg-surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-text-soft text-left">
            <tr>
              <th className="px-4 py-2.5 font-medium">Código</th>
              <th className="px-4 py-2.5 font-medium">Artículo</th>
              <th className="px-4 py-2.5 font-medium">Tipo</th>
              <th className="px-4 py-2.5 font-medium">Precio</th>
              <th className="px-4 py-2.5 font-medium text-right">Stock</th>
              <th className="px-4 py-2.5 font-medium">Estado</th>
              {isAdmin && <th className="px-4 py-2.5 font-medium"></th>}
            </tr>
          </thead>
          <tbody>
            {strains.map((s) => (
              <tr key={s.id} className="border-t border-line">
                <td className="px-4 py-2.5 text-text-mute">{s.code ?? '—'}</td>
                <td className="px-4 py-2.5">
                  <div className="font-medium text-text">{s.name}</div>
                  {s.type && <div className="text-text-mute text-xs">{s.type}</div>}
                </td>
                <td className="px-4 py-2.5 text-text-soft">{ITEM_TYPE_LABEL[s.item_type]}</td>
                <td className="px-4 py-2.5 text-text-soft">{money(s.price_per_gram)}</td>
                <td className={`px-4 py-2.5 text-right tabular-nums ${conStock(s.id) ? 'text-text' : 'text-text-mute'}`}>
                  {(stockTotal.get(s.id) ?? 0).toLocaleString('es-AR', { maximumFractionDigits: 1 })} {s.item_type === 'genetica' ? 'g' : 'u.'}
                </td>
                <td className="px-4 py-2.5">
                  <Badge label={STATUS_META[s.status].label} color={STATUS_META[s.status].color} />
                </td>
                {isAdmin && (
                  <td className="px-4 py-2.5 text-right">
                    <ModalTrigger
                      label="Editar"
                      className="rounded-lg border border-line-2 text-xs font-semibold px-3 py-1.5 hover:border-accent hover:text-accent"
                      title={`Editar — ${s.name}`}
                    >
                      <StrainForm strain={s} />
                      {s.item_type === 'genetica' && <StrainImages strainId={s.id} images={s.images ?? []} />}
                    </ModalTrigger>
                  </td>
                )}
              </tr>
            ))}
            {(strains ?? []).length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 6 : 5} className="px-4 py-10 text-center text-text-mute">
                  Sin artículos cargados todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
