'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAtras } from './use-atras';

// En el inicio de la tablet, la flecha "atrás" llevaba a la pantalla de
// ingreso como si se hubiera cerrado la sesión. Ahora pregunta primero.
export function GuardiaInicio() {
  const router = useRouter();
  useAtras(() => {
    if (!window.confirm('¿Cerrar la sesión de la tablet?')) return true;
    void createClient()
      .auth.signOut()
      .finally(() => {
        router.replace('/panel/login');
        router.refresh();
      });
    return false;
  });
  return null;
}
