import type { Tenant } from '@/lib/tenant/types';

// Envoltorio del sitio público: si el club tiene marca propia
// (tenants.theme.marca), aplica sus colores, tipografías y texturas a todo
// lo que va adentro (ver .marca-greenlevel en globals.css). Si no, no cambia
// nada.
const MARCAS = new Set(['greenlevel']);

export function marcaDe(tenant: Pick<Tenant, 'theme'> | null | undefined): string | null {
  const m = tenant?.theme?.marca;
  return m && MARCAS.has(m) ? m : null;
}

export function Marca({ tenant, children }: { tenant: Pick<Tenant, 'theme'> | null | undefined; children: React.ReactNode }) {
  const marca = marcaDe(tenant);
  if (!marca) return <>{children}</>;
  return <div className={`marca-${marca} flex flex-1 flex-col font-sans`}>{children}</div>;
}
