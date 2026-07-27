'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { TITLES, type ViewId } from '@/lib/roles';
import type { SessionProfile } from '@/lib/auth/get-session-profile';

function SidebarContent({
  tenantName,
  logoUrl,
  profile,
  nav,
  pathname,
  onNavigate,
  onLogout,
}: {
  tenantName: string;
  logoUrl: string | null;
  profile: SessionProfile;
  nav: ViewId[];
  pathname: string;
  onNavigate?: () => void;
  onLogout: () => void;
}) {
  return (
    <div className="bg-green-900 text-white flex flex-col h-full">
      <div className="h-[72px] flex items-center px-4 border-b border-white/10">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={tenantName} className="h-12 w-auto object-contain" />
        ) : (
          <span className="font-display font-semibold truncate">{tenantName}</span>
        )}
      </div>

      <nav className="flex-1 py-3">
        {nav.map((view) => {
          const active = pathname === `/panel/${view}`;
          return (
            <Link
              key={view}
              href={`/panel/${view}`}
              onClick={onNavigate}
              className={`block px-4 py-2.5 text-sm ${
                active ? 'bg-white/10 font-semibold' : 'text-white/80 hover:bg-white/5'
              }`}
            >
              {TITLES[view][0]}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="text-sm font-medium">{profile.name}</div>
        <div className="text-xs text-white/60 mb-3 capitalize">{profile.role}</div>
        <button onClick={onLogout} className="text-xs text-white/70 hover:text-white underline">
          Cambiar perfil / salir
        </button>
      </div>
    </div>
  );
}

export function Sidebar({
  tenantName,
  logoUrl,
  profile,
  nav,
}: {
  tenantName: string;
  logoUrl: string | null;
  profile: SessionProfile;
  nav: ViewId[];
}) {
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
          className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-white/10"
        >
          ☰
        </button>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={tenantName} className="h-8 w-auto object-contain" />
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
          pathname={pathname}
          onLogout={handleLogout}
        />
      </aside>
    </>
  );
}
