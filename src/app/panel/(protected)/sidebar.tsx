'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { TITLES, type ViewId } from '@/lib/roles';
import type { SessionProfile } from '@/lib/auth/get-session-profile';

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

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace('/panel/login');
    router.refresh();
  }

  return (
    <aside className="w-[248px] shrink-0 bg-green-900 text-white flex flex-col">
      <div className="h-[72px] flex items-center gap-2 px-4 border-b border-white/10">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={tenantName} className="h-9 w-9 rounded-lg object-cover" />
        ) : (
          <div className="h-9 w-9 rounded-lg bg-accent flex items-center justify-center font-display font-bold text-sm">
            {tenantName.slice(0, 2).toUpperCase()}
          </div>
        )}
        <span className="font-display font-semibold truncate">{tenantName}</span>
      </div>

      <nav className="flex-1 py-3">
        {nav.map((view) => {
          const active = pathname === `/panel/${view}`;
          return (
            <Link
              key={view}
              href={`/panel/${view}`}
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
        <button onClick={handleLogout} className="text-xs text-white/70 hover:text-white underline">
          Cambiar perfil / salir
        </button>
      </div>
    </aside>
  );
}
