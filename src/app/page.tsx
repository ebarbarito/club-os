import { headers } from "next/headers";
import { getTenantBySlug } from "@/lib/tenant/get-tenant";

export default async function Home() {
  const headerList = await headers();
  const slug = headerList.get('x-club-os-tenant-slug');
  const tenant = slug ? await getTenantBySlug(slug) : null;

  if (!tenant) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-2 bg-bg font-sans">
        <h1 className="font-display text-2xl font-bold">Club OS</h1>
        <p className="text-text-soft">
          {slug
            ? `No existe ningún club con el slug "${slug}".`
            : 'Sin tenant resuelto — probá con {slug}.tuclub.app o CLUB_OS_DEV_TENANT en local.'}
        </p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-bg font-sans">
      {tenant.logo_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={tenant.logo_url} alt={tenant.name} className="h-16 w-16 rounded-2xl" />
      )}
      <h1 className="font-display text-3xl font-bold text-accent">{tenant.name}</h1>
      <p className="text-text-soft">Sitio público — próximamente.</p>
    </main>
  );
}
