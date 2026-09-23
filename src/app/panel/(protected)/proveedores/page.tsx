import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth/get-session-profile';
import { ROLES } from '@/lib/roles';
import { ModalTrigger } from '@/components/modal-trigger';
import { ProveedorForm } from './proveedor-form';
import { ProveedorPicker } from './proveedor-picker';
import { ArticuloForm } from './articulos/articulo-form';

export default async function ProveedoresPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const profile = await getSessionProfile();
  if (!profile) redirect('/panel/login');
  if (profile.role !== 'admin') redirect(`/panel/${ROLES[profile.role].home}`);

  const { tab } = await searchParams;
  const activeTab = tab === 'articulos' ? 'articulos' : 'buscar';

  const supabase = await createClient();

  const [{ data: proveedores }, { data: comprobantes }, { data: articulos }] = await Promise.all([
    supabase
      .from('proveedores')
      .select('id, name, rubro, cuit, contact_name, phone, numero')
      .is('deleted_at', null)
      .order('name', { ascending: true }),
    supabase
      .from('proveedor_comprobantes')
      .select('proveedor_id, saldo'),
    activeTab === 'articulos'
      ? supabase
          .from('proveedor_articulos')
          .select('id, code, description, unit, notes')
          .is('deleted_at', null)
          .order('description', { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);

  // Saldo neto por proveedor (facturas pendientes − NCs disponibles)
  const saldoMap: Record<string, number> = {};
  for (const c of comprobantes ?? []) {
    saldoMap[c.proveedor_id] = (saldoMap[c.proveedor_id] ?? 0) + c.saldo;
  }

  const rows = (proveedores ?? []).map((p) => ({
    id: p.id,
    numero: p.numero ?? null,
    name: p.name,
    rubro: p.rubro ?? null,
    cuit: p.cuit ?? null,
    saldo: saldoMap[p.id] ?? 0,
  }));

  return (
    <div>
      <div className="mb-4">
        <h1 className="font-display text-2xl font-bold text-text">Proveedores</h1>
        <p className="text-text-soft text-sm">Comprobantes y pagos a proveedores</p>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-4 border-b border-line">
        <Link
          href="/panel/proveedores"
          className={`px-3 py-2 text-sm border-b-2 -mb-px ${
            activeTab === 'buscar'
              ? 'border-accent text-accent font-semibold'
              : 'border-transparent text-text-soft hover:text-text'
          }`}
        >
          Buscar proveedor
        </Link>
        <Link
          href="/panel/proveedores?tab=articulos"
          className={`px-3 py-2 text-sm border-b-2 -mb-px ${
            activeTab === 'articulos'
              ? 'border-accent text-accent font-semibold'
              : 'border-transparent text-text-soft hover:text-text'
          }`}
        >
          Artículos
        </Link>

        {/* Botones de alta — visualmente alineados al tab bar, a la derecha */}
        <div className="ml-auto flex gap-2 pb-px">
          <ModalTrigger
            label="+ Nuevo proveedor"
            title="Nuevo proveedor"
            className="rounded-lg border border-line-2 text-text-soft text-sm font-semibold px-3 py-1.5 hover:border-accent hover:text-accent"
          >
            <ProveedorForm />
          </ModalTrigger>
          <ModalTrigger
            label="+ Nuevo artículo"
            title="Nuevo artículo"
            className="rounded-lg border border-line-2 text-text-soft text-sm font-semibold px-3 py-1.5 hover:border-accent hover:text-accent"
          >
            <ArticuloForm />
          </ModalTrigger>
        </div>
      </div>

      {/* Tab: Buscar proveedor */}
      {activeTab === 'buscar' && <ProveedorPicker proveedores={rows} />}

      {/* Tab: Artículos */}
      {activeTab === 'articulos' && (
        <div>
          {(articulos ?? []).length === 0 ? (
            <div className="rounded-xl border border-line-2 bg-surface p-12 text-center text-text-soft text-sm">
              No hay artículos registrados. Usá el botón &ldquo;+ Nuevo artículo&rdquo; para crear el primero.
            </div>
          ) : (
            <div className="rounded-xl border border-line-2 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface-2 text-text-soft text-xs">
                    <th className="px-4 py-3 text-left font-medium">Código</th>
                    <th className="px-4 py-3 text-left font-medium">Descripción</th>
                    <th className="px-4 py-3 text-left font-medium">Unidad</th>
                    <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">Notas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {(articulos ?? []).map((a) => (
                    <tr key={a.id} className="hover:bg-surface-2/50">
                      <td className="px-4 py-3 text-text-soft tabular-nums font-mono text-xs">
                        {a.code ?? '—'}
                      </td>
                      <td className="px-4 py-3 font-medium text-text">{a.description}</td>
                      <td className="px-4 py-3 text-text-soft">{a.unit ?? '—'}</td>
                      <td className="px-4 py-3 text-text-soft text-xs hidden sm:table-cell">
                        {a.notes ?? ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-line bg-surface-2 text-xs text-text-soft">
                    <td className="px-4 py-2" colSpan={4}>
                      {(articulos ?? []).length} artículo
                      {(articulos ?? []).length !== 1 ? 's' : ''}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
