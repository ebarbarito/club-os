// Resuelve el slug de tenant a partir del host de la request.
// Producción (con dominio propio + wildcard DNS): {slug}.tuclub.app -> slug
// Cualquier otro host (localhost, *.vercel.app antes de tener dominio
// propio, etc.) -> CLUB_OS_DEFAULT_TENANT, para poder operar un solo
// club mientras no haya wildcard DNS configurado.
const ROOT_DOMAIN = process.env.CLUB_OS_ROOT_DOMAIN ?? 'tuclub.app';

export function slugFromHost(host: string | null): string | null {
  if (!host) return process.env.CLUB_OS_DEFAULT_TENANT ?? null;
  const hostname = host.split(':')[0];

  if (hostname.endsWith(`.${ROOT_DOMAIN}`)) {
    const slug = hostname.slice(0, -(ROOT_DOMAIN.length + 1));
    return slug === 'www' ? (process.env.CLUB_OS_DEFAULT_TENANT ?? null) : slug;
  }

  return process.env.CLUB_OS_DEFAULT_TENANT ?? null;
}
