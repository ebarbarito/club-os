import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getTenantBySlug, canPreviewTenant } from '@/lib/tenant/get-tenant';
import { AltaSocioForm } from './alta-socio-form';

export async function generateMetadata(): Promise<Metadata> {
  const slug = (await headers()).get('x-club-os-tenant-slug');
  if (!slug) return {};
  const tenant = await getTenantBySlug(slug);
  return { title: tenant ? `Alta de socio — ${tenant.name}` : 'Alta de socio' };
}

// Pantalla independiente (no modal) para que el club pueda compartir un
// link directo de alta de socio — mismo gate que el sitio público
// (tenants.public_site_enabled) para no exponerla antes de que el club
// esté listo.
export default async function AltaSocioPage() {
  const slug = (await headers()).get('x-club-os-tenant-slug');

  if (!slug) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-2 bg-bg font-sans text-center px-4">
        <h1 className="font-display text-2xl font-bold">Club OS</h1>
        <p className="text-text-soft">Este link no corresponde a ningún club.</p>
      </main>
    );
  }

  const tenant = await getTenantBySlug(slug);
  if (!tenant) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-2 bg-bg font-sans text-center px-4">
        <h1 className="font-display text-2xl font-bold">Club OS</h1>
        <p className="text-text-soft">No existe ningún club con el slug &quot;{slug}&quot;.</p>
      </main>
    );
  }

  if (!tenant.public_site_enabled && !(await canPreviewTenant(tenant.id))) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-2 bg-bg font-sans text-center px-4">
        <h1 className="font-display text-2xl font-bold">{tenant.name}</h1>
        <p className="text-text-soft">Este sitio todavía no está disponible al público.</p>
      </main>
    );
  }

  return (
    <main className="flex-1 bg-bg font-sans">
      <AltaSocioForm tenantName={tenant.name} />
    </main>
  );
}
