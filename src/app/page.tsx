import type { Metadata } from "next";
import { headers } from "next/headers";
import { getTenantBySlug, canPreviewTenant } from "@/lib/tenant/get-tenant";
import { getCatalog } from "@/lib/public/get-catalog";
import { PublicSite } from "@/components/public/public-site";
import { ProductLanding } from "@/components/marketing/product-landing";

export async function generateMetadata(): Promise<Metadata> {
  const slug = (await headers()).get('x-club-os-tenant-slug');
  if (!slug) {
    return { title: "Mi Club — Un solo panel para llevar tu club" };
  }
  return {};
}

export default async function Home() {
  const headerList = await headers();
  const slug = headerList.get('x-club-os-tenant-slug');

  // Sin slug: dominio raíz (miclub.site) o host sin resolver — landing del producto.
  if (!slug) {
    return <ProductLanding />;
  }

  const tenant = await getTenantBySlug(slug);

  if (!tenant) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-2 bg-bg font-sans">
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

  const catalog = await getCatalog(tenant.id);

  return <PublicSite tenant={tenant} catalog={catalog} />;
}
