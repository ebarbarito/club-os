import { headers } from "next/headers";
import { getTenantBySlug } from "@/lib/tenant/get-tenant";
import { getCatalog } from "@/lib/public/get-catalog";
import { PublicSite } from "@/components/public/public-site";

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

  const catalog = await getCatalog(tenant.id);

  return <PublicSite tenant={tenant} catalog={catalog} />;
}
