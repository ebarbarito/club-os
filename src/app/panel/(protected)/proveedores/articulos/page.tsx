import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth/get-session-profile';
import { ROLES } from '@/lib/roles';
import { ModalTrigger } from '@/components/modal-trigger';
import { ArticuloForm } from './articulo-form';
import { DeleteArticuloButton } from './delete-articulo-button';

export default async function ArticulosPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect('/panel/login');
  if (profile.role !== 'admin') redirect(`/panel/${ROLES[profile.role].home}`);

  const supabase = await createClient();

  const { data: articulos } = await supabase
    .from('proveedor_articulos')
    .select('id, code, description, unit, notes')
    .is('deleted_at', null)
    .order('description', { ascending: true });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/panel/proveedores" className="text-xs text-text-mute hover:text-accent mb-1 inline-block">
            ← Proveedores
          </Link>
          <h1 className="font-display text-2xl font-bold text-text">Artículos de compras</h1>
          <p className="text-text-soft">Catálogo de artículos para usar en comprobantes</p>
        </div>
        <ModalTrigger label="+ Nuevo artículo" title="Nuevo artículo">
          <ArticuloForm />
        </ModalTrigger>
      </div>

      {(articulos ?? []).length === 0 ? (
        <div className="rounded-xl border border-line-2 bg-surface p-12 text-center text-text-soft text-sm">
          No hay artículos. Creá el primero con el botón de arriba.
        </div>
      ) : (
        <div className="rounded-xl border border-line-2 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-2 text-text-soft text-xs">
                <th className="px-4 py-3 text-left font-medium">Código</th>
                <th className="px-4 py-3 text-left font-medium">Descripción</th>
                <th className="px-4 py-3 text-left font-medium">Unidad</th>
                <th className="px-4 py-3 text-left font-medium">Notas</th>
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(articulos ?? []).map((a) => (
                <tr key={a.id} className="hover:bg-surface-2/50">
                  <td className="px-4 py-3 text-text-soft tabular-nums">{a.code ?? '—'}</td>
                  <td className="px-4 py-3 font-medium text-text">{a.description}</td>
                  <td className="px-4 py-3 text-text-soft">{a.unit ?? '—'}</td>
                  <td className="px-4 py-3 text-text-soft text-xs">{a.notes ?? ''}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <ModalTrigger label="Editar" title="Editar artículo" className="text-xs text-accent hover:underline">
                        <ArticuloForm articulo={a} />
                      </ModalTrigger>
                      <DeleteArticuloButton id={a.id} description={a.description} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-line bg-surface-2 text-xs text-text-soft">
                <td className="px-4 py-2" colSpan={5}>{(articulos ?? []).length} artículo{(articulos ?? []).length !== 1 ? 's' : ''}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
