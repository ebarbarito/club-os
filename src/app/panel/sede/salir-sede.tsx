'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function SalirSede({ esAdmin }: { esAdmin: boolean }) {
  const router = useRouter();

  async function salir() {
    if (!window.confirm('¿Cerrar la sesión de la tablet?')) return;
    await createClient().auth.signOut();
    router.replace('/panel/login');
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      {esAdmin && (
        <Link href="/panel/socios" className="rounded-lg border border-white/30 px-3 py-2 text-sm font-semibold">
          Volver al panel
        </Link>
      )}
      <button type="button" onClick={salir} className="rounded-lg border border-white/30 px-3 py-2 text-sm font-semibold">
        Salir
      </button>
    </div>
  );
}
