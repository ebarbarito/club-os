'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { TITLES, type ViewId } from '@/lib/roles';
import type { SessionProfile } from '@/lib/auth/get-session-profile';
import { ThemeToggle } from '@/components/theme-toggle';
import { CambiarPasswordForm } from './cambiar-password-form';

function SidebarContent({
  tenantName,
  logoUrl,
  profile,
  nav,
  alertas,
  pathname,
  onNavigate,
  onLogout,
}: {
  tenantName: string;
  logoUrl: string | null;
  profile: SessionProfile;
  nav: ViewId[];
  alertas: Partial<Record<string, number>>;
  pathname: string;
  onNavigate?: () => void;
  onLogout: () => void;
}) {
  const [showCambiarPassword, setShowCambiarPassword] = useState(false);
  return (
    <div className="bg-green-900 text-white flex flex-col h-full">
      <div className="h-36 flex items-center justify-center p-5 border-b border-white/10">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={tenantName} className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="font-display font-semibold truncate text-center">{tenantName}</span>
        )}
      </div>

      <nav className="flex-1 py-3">
        {nav.map((view) => {
          // Las páginas agrupadas bajo ConfigTabs (balance, historial, empleados,
          // asientos, cuentas, usuarios) no están en el nav — solo "configuracion"
          // lo está. Si el pathname corresponde a una de ellas, marcamos
          // "configuracion" como activo para que el menú lo muestre seleccionado.
          const CONFIG_SUBROUTES = ['/panel/balance', '/panel/historial', '/panel/empleados', '/panel/asientos', '/panel/cuentas', '/panel/usuarios'];
          const active =
            pathname === `/panel/${view}` ||
            pathname.startsWith(`/panel/${view}/`) ||
            (view === 'configuracion' && CONFIG_SUBROUTES.some((r) => pathname.startsWith(r)));
          return (
            <Link
              key={view}
              href={`/panel/${view}`}
              onClick={onNavigate}
              className={`flex items-center justify-between gap-2 px-4 py-2.5 text-sm ${
                active ? 'bg-white/10 font-semibold' : 'text-white/80 hover:bg-white/5'
              }`}
            >
              <span>{TITLES[view][0]}</span>
              {(alertas[view] ?? 0) > 0 && (
                <span
                  className="flex items-center gap-1.5 text-xs font-semibold text-white"
                  title={`${alertas[view]} con acciones pendientes`}
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-red ring-2 ring-red/30" />
                  {alertas[view]}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-4 space-y-2">
        <div className="text-sm font-medium">{profile.name}</div>
        <div className="text-xs text-white/60 mb-1 capitalize">{profile.role}</div>
        <ThemeToggle />
        <button onClick={() => setShowCambiarPassword(true)} className="block text-xs text-white/70 hover:text-white underline">
          Cambiar contraseña
        </button>
        <button onClick={onLogout} className="block text-xs text-white/70 hover:text-white underline">
          Cambiar perfil / salir
        </button>
      </div>

      {showCambiarPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCambiarPassword(false)} />
          <div className="relative bg-surface text-foreground rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h2 className="font-display text-lg font-bold text-text mb-4">Cambiar contraseña</h2>
            <CambiarPasswordForm onSuccess={() => { setShowCambiarPassword(false); }} />
            <button
              onClick={() => setShowCambiarPassword(false)}
              className="mt-3 w-full text-sm text-text-soft hover:text-text"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Sidebar({
  tenantName,
  logoUrl,
  profile,
  nav,
  alertas = {},
}: {
  tenantName: string;
  logoUrl: string | null;
  profile: SessionProfile;
  nav: ViewId[];
  alertas?: Partial<Record<string, number>>;
}) {
  const hayAlertas = Object.values(alertas).some((n) => (n ?? 0) > 0);
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace('/panel/login');
    router.refresh();
  }

  return (
    <>
      {/* Topbar mobile — reemplaza al sidebar fijo por debajo de lg */}
      <div className="lg:hidden sticky top-0 z-30 h-14 flex items-center justify-between px-4 bg-green-900 text-white">
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir menú"
          className="relative h-8 w-8 flex items-center justify-center rounded-lg hover:bg-white/10"
        >
          ☰
          {hayAlertas && <span className="absolute top-0.5 right-0.5 h-2.5 w-2.5 rounded-full bg-red ring-2 ring-green-900" />}
        </button>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={tenantName} className="h-10 w-auto object-contain" />
        ) : (
          <span className="font-display font-semibold text-sm">{tenantName}</span>
        )}
        <div className="w-8" />
      </div>

      {/* Drawer mobile */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative w-64 h-full">
            <SidebarContent
              tenantName={tenantName}
              logoUrl={logoUrl}
              profile={profile}
              nav={nav}
              alertas={alertas}
              pathname={pathname}
              onNavigate={() => setOpen(false)}
              onLogout={handleLogout}
            />
          </div>
        </div>
      )}

      {/* Sidebar fijo desktop */}
      <aside className="hidden lg:block w-[248px] shrink-0">
        <SidebarContent
          tenantName={tenantName}
          logoUrl={logoUrl}
          profile={profile}
          nav={nav}
          alertas={alertas}
          pathname={pathname}
          onLogout={handleLogout}
        />
      </aside>
    </>
  );
}
