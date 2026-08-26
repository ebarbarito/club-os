import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth/get-session-profile';
import { ROLES } from '@/lib/roles';
import { ModalTrigger } from '@/components/modal-trigger';
import { Badge } from '@/components/badge';
import { money } from '@/lib/format';
import { StrainForm } from './strain-form';
import { StrainImages } from './strain-images';

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
  const { data: strains } = await supabase.from('strains').select('*').order('name');

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-text">Catálogo</h1>
          <p className="text-text-soft">Artículos del club (genéticas y accesorios) — alimentan Stock y Dispensa</p>
        </div>
        {isAdmin && (
          <ModalTrigger label="+ Nuevo artículo" title="Nuevo artículo">
            <StrainForm />
          </ModalTrigger>
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
              <th className="px-4 py-2.5 font-medium">Estado</th>
              {isAdmin && <th className="px-4 py-2.5 font-medium"></th>}
            </tr>
          </thead>
          <tbody>
            {(strains ?? []).map((s) => (
              <tr key={s.id} className="border-t border-line">
                <td className="px-4 py-2.5 text-text-mute">{s.code ?? '—'}</td>
                <td className="px-4 py-2.5">
                  <div className="font-medium text-text">{s.name}</div>
                  {s.type && <div className="text-text-mute text-xs">{s.type}</div>}
                </td>
                <td className="px-4 py-2.5 text-text-soft">{ITEM_TYPE_LABEL[s.item_type]}</td>
                <td className="px-4 py-2.5 text-text-soft">{money(s.price_per_gram)}</td>
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
