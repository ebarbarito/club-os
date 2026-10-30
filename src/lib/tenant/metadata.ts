import type { Metadata } from 'next';
import { headers } from 'next/headers';
import type { Tenant } from './types';
import { marcaDe } from '@/components/public/marca';

// Título, descripción e imagen que muestran WhatsApp (y redes) en la vista
// previa cuando se comparte un link del sitio público. Los clubes con marca
// propia muestran su imagen (public/marca/<marca>-og.jpg, 1200×630).
export async function metadataPublica(
  tenant: Pick<Tenant, 'name' | 'theme'>,
  { title, description, path }: { title: string; description: string; path: string },
): Promise<Metadata> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  const marca = marcaDe(tenant);
  return {
    title,
    description,
    metadataBase: new URL(`${proto}://${host}`),
    openGraph: {
      title,
      description,
      siteName: tenant.name,
      url: path,
      type: 'website',
      locale: 'es_AR',
      images: marca ? [{ url: `/marca/${marca}-og.jpg`, width: 1200, height: 630, alt: tenant.name }] : undefined,
    },
    twitter: { card: marca ? 'summary_large_image' : 'summary', title, description },
  };
}
