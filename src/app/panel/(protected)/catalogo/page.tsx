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

export default async function CatalogoPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect('/panel/login');
  if (profile.role !== 'admin') redirect(`/panel/${ROLES[profile.role].home}`);

  const supabase = await createClient();
  const { data: strains } = await supabase.from('strains').select('*').order('name');

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-text">Catálogo</h1>
          <p className="text-text-soft">Genéticas del club — se muestran en el sitio público y alimentan Stock</p>
        </div>
        <ModalTrigger label="+ Nueva genética" title="Nueva genética">
          <StrainForm />
        </ModalTrigger>
      </div>

      <div className="rounded-xl border border-line bg-surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-text-soft text-left">
            <tr>
              <th className="px-4 py-2.5 font-medium">Genética</th>
              <th className="px-4 py-2.5 font-medium">THC / CBD</th>
              <th className="px-4 py-2.5 font-medium">Precio/g</th>
              <th className="px-4 py-2.5 font-medium">Estado</th>
              <th className="px-4 py-2.5 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {(strains ?? []).map((s) => (
              <tr key={s.id} className="border-t border-line">
                <td className="px-4 py-2.5">
                  <div className="font-medium text-text">{s.name}</div>
                  <div className="text-text-mute text-xs">{s.type}</div>
                </td>
                <td className="px-4 py-2.5 text-text-soft">
                  {s.thc ? `THC ${s.thc}%` : '—'} {s.cbd ? `· CBD ${s.cbd}%` : ''}
                </td>
                <td className="px-4 py-2.5 text-text-soft">{money(s.price_per_gram)}</td>
                <td className="px-4 py-2.5">
                  <Badge label={STATUS_META[s.status].label} color={STATUS_META[s.status].color} />
                </td>
                <td className="px-4 py-2.5 text-right">
                  <ModalTrigger
                    label="Editar"
                    className="rounded-lg border border-line-2 text-xs font-semibold px-3 py-1.5 hover:border-accent hover:text-accent"
                    title={`Editar — ${s.name}`}
                  >
                    <StrainForm strain={s} />
                    <StrainImages strainId={s.id} images={s.images ?? []} />
                  </ModalTrigger>
                </td>
              </tr>
            ))}
            {(strains ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-text-mute">
                  Sin genéticas cargadas todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
