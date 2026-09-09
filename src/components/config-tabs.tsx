import Link from 'next/link';

const TABS = [
  { href: '/panel/configuracion', key: 'configuracion', label: 'Ajustes generales' },
  { href: '/panel/asientos', key: 'asientos', label: 'Asientos' },
  { href: '/panel/cuentas', key: 'cuentas', label: 'Cuentas' },
  { href: '/panel/usuarios', key: 'usuarios', label: 'Usuarios' },
] as const;

// Asientos, Cuentas y Usuarios viven en sus propias rutas (no anidadas bajo
// /panel/configuracion) para no tocar todos los links/redirects que ya
// apuntan a ellas — esta barra es lo que las agrupa visualmente "dentro de"
// Configuración, un mismo tab bar repetido en las 4 páginas.
export function ConfigTabs({ active }: { active: (typeof TABS)[number]['key'] }) {
  return (
    <div className="flex gap-1 mb-4 border-b border-line">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={`px-3 py-2 text-sm border-b-2 -mb-px ${
            active === t.key ? 'border-accent text-accent font-semibold' : 'border-transparent text-text-soft hover:text-text'
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
