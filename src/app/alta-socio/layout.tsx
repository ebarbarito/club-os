import { headers } from 'next/headers';
import { getTenantBySlug } from '@/lib/tenant/get-tenant';
import { Marca, marcaDe } from '@/components/public/marca';

// Formularios de alta (pre-inscripción y segunda parte): si el club tiene
// marca propia, se muestran con su identidad y su logo arriba.
export default async function AltaSocioLayout({ children }: { children: React.ReactNode }) {
  const slug = (await headers()).get('x-club-os-tenant-slug');
  const tenant = slug ? await getTenantBySlug(slug) : null;
  if (!tenant || !marcaDe(tenant)) return <>{children}</>;

  return (
    <Marca tenant={tenant}>
      <header className="bg-green-900 px-4 py-5 flex justify-center">
        {tenant.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={tenant.logo_url} alt={tenant.name} className="h-14 w-auto object-contain" />
        ) : (
          <span className="font-display text-3xl text-white">{tenant.name}</span>
        )}
      </header>
      {children}
    </Marca>
  );
}
