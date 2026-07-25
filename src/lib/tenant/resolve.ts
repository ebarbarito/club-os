// Resuelve el slug de tenant a partir del host de la request.
// Producción: {slug}.tuclub.app -> slug
// Local: sin subdominio real -> fallback a ?tenant=slug o CLUB_OS_DEV_TENANT
const ROOT_DOMAIN = process.env.CLUB_OS_ROOT_DOMAIN ?? 'tuclub.app';

export function slugFromHost(host: string | null): string | null {
  if (!host) return null;
  const hostname = host.split(':')[0];

  if (hostname.endsWith(`.${ROOT_DOMAIN}`)) {
    const slug = hostname.slice(0, -(ROOT_DOMAIN.length + 1));
    return slug === 'www' ? null : slug;
  }

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return process.env.CLUB_OS_DEV_TENANT ?? null;
  }

  return null;
}
