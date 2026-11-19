'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { puedeSalir } from './use-atras';
import { createClient } from '@/lib/supabase/client';

// Encabezado de la tablet. El usuario general de la sede no tiene botones
// para salir ni para ir al sistema de gestión: la sesión se cierra
// manteniendo apretado el logo unos segundos (lo sabe el equipo, no el socio).
// Fuera de la portada aparece "Inicio", que vuelve a los dos botones
// (preguntando antes si hay algo cargado). Un admin ve además "Salir".
export function CabeceraSede({
  nombre,
  logoUrl,
  esAdmin,
}: {
  nombre: string;
  logoUrl: string | null;
  esAdmin: boolean;
}) {
  const router = useRouter();
  const enPortada = usePathname() === '/panel/sede';

  function irAlInicio() {
    if (!puedeSalir()) return;
    window.location.assign('/panel/sede');
  }
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const largo = useRef(false);

  async function salir() {
    if (!window.confirm('¿Cerrar la sesión de la tablet?')) return;
    await createClient().auth.signOut();
    router.replace('/panel/login');
    router.refresh();
  }

  function apretar() {
    largo.current = false;
    timer.current = setTimeout(() => {
      largo.current = true;
      void salir();
    }, 4000);
  }

  function soltar() {
    if (timer.current) clearTimeout(timer.current);
  }

  return (
    <header className="flex items-center justify-between gap-4 bg-green-900 px-5 py-3 text-white">
      <Link
        href="/panel/sede"
        aria-label={`${nombre} · inicio`}
        className="flex select-none items-center gap-3"
        onPointerDown={apretar}
        onPointerUp={soltar}
        onPointerLeave={soltar}
        onPointerCancel={soltar}
        onContextMenu={(e) => e.preventDefault()}
        onClick={(e) => {
          if (largo.current || !puedeSalir()) e.preventDefault();
        }}
        draggable={false}
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={nombre} className="pointer-events-none h-11 w-auto object-contain" draggable={false} />
        ) : (
          <span className="font-display text-2xl">{nombre}</span>
        )}
      </Link>
      <div className="flex items-center gap-2">
        {!enPortada && (
          <button
            type="button"
            onClick={irAlInicio}
            className="rounded-xl border border-white/30 px-4 py-2.5 text-base font-semibold"
          >
            ← Inicio
          </button>
        )}
        {esAdmin && (
          <button type="button" onClick={salir} className="rounded-xl border border-white/30 px-4 py-2.5 text-base font-semibold">
            Salir
          </button>
        )}
      </div>
    </header>
  );
}
