// Resuelve el slug de tenant a partir del host de la request.
// Producción (con dominio propio + wildcard DNS): {slug}.miclub.site -> slug
// El dominio raíz (miclub.site / www.miclub.site) queda libre para la
// página de producto, no resuelve a ningún club.
// Cualquier otro host (localhost, *.vercel.app antes de tener dominio
// propio, etc.) -> CLUB_OS_DEFAULT_TENANT, para poder operar un solo
// club mientras no haya wildcard DNS configurado.
const ROOT_DOMAIN = process.env.CLUB_OS_ROOT_DOMAIN ?? 'tuclub.app';

// Subdominios que no coinciden 1:1 con el slug del tenant en DB.
const SUBDOMAIN_ALIASES: Record<string, string> = { gl: 'greenlevel' };

export function slugFromHost(host: string | null): string | null {
  if (!host) return process.env.CLUB_OS_DEFAULT_TENANT ?? null;
  const hostname = host.split(':')[0];

  if (hostname === ROOT_DOMAIN || hostname === `www.${ROOT_DOMAIN}`) {
    return null;
  }

  if (hostname.endsWith(`.${ROOT_DOMAIN}`)) {
    const slug = hostname.slice(0, -(ROOT_DOMAIN.length + 1));
    return SUBDOMAIN_ALIASES[slug] ?? slug;
  }

  return process.env.CLUB_OS_DEFAULT_TENANT ?? null;
}

const SLUG_TO_SUBDOMAIN: Record<string, string> = Object.fromEntries(
  Object.entries(SUBDOMAIN_ALIASES).map(([subdomain, slug]) => [slug, subdomain]),
);

// URL pública de un club para mostrar/linkear desde el panel (usa el
// alias corto si existe, ej. "gl" en vez de "greenlevel").
export function publicUrlForSlug(slug: string): string | null {
  if (!ROOT_DOMAIN || process.env.CLUB_OS_ROOT_DOMAIN == null) return null;
  const subdomain = SLUG_TO_SUBDOMAIN[slug] ?? slug;
  return `https://${subdomain}.${ROOT_DOMAIN}`;
}
