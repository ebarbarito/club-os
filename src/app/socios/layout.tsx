import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { getTenantBySlug, canPreviewTenant } from '@/lib/tenant/get-tenant';
import { Marca } from '@/components/public/marca';
import { metadataPublica } from '@/lib/tenant/metadata';

export async function generateMetadata(): Promise<Metadata> {
  const slug = (await headers()).get('x-club-os-tenant-slug');
  const tenant = slug ? await getTenantBySlug(slug) : null;
  if (!tenant) return { title: 'Socios' };
  return metadataPublica(tenant, {
    title: `Socios · ${tenant.name}`,
    description: 'Ingresá con tu DNI al sitio de socios.',
    path: '/socios',
  });
}

// Sitio de socios: mismo gate que el sitio público (public_site_enabled) y
// la marca del club arriba.
export default async function SociosLayout({ children }: { children: React.ReactNode }) {
  const slug = (await headers()).get('x-club-os-tenant-slug');
  const tenant = slug ? await getTenantBySlug(slug) : null;

  if (!tenant) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-2 bg-bg font-sans text-center px-4">
        <h1 className="font-display text-2xl font-bold">Club OS</h1>
        <p className="text-text-soft">Este link no corresponde a ningún club.</p>
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
    <Marca tenant={tenant}>
      <header className="bg-green-900 px-4 py-5 flex justify-center">
        <Link href="/" aria-label={`Volver a ${tenant.name}`}>
          {tenant.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tenant.logo_url} alt={tenant.name} className="h-14 w-auto object-contain" />
          ) : (
            <span className="font-display text-3xl text-white">{tenant.name}</span>
          )}
        </Link>
      </header>
      <main className="flex-1 bg-bg font-sans">{children}</main>
    </Marca>
  );
}
