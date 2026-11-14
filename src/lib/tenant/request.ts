import { headers } from 'next/headers';
import { slugFromHost } from './resolve';
import { getTenantBySlug } from './get-tenant';

// Club del pedido actual, resuelto server-side desde el Host (proxy.ts pone
// x-club-os-tenant-slug). Nunca de un dato que mande el cliente.
export async function getRequestTenant() {
  const h = await headers();
  const slug = h.get('x-club-os-tenant-slug') ?? slugFromHost(h.get('host'));
  if (!slug) return null;
  return getTenantBySlug(slug);
}

// "https://gl.miclub.site" — para armar links en mails.
export async function getRequestBaseUrl() {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? '';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}
