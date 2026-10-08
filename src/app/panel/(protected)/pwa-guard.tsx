'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function PwaGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window.navigator as any).standalone === true;

    if (!isStandalone) {
      setReady(true);
      return;
    }

    let sessionActive: string | null = null;
    try {
      sessionActive = sessionStorage.getItem('pwa-session');
    } catch {}

    if (sessionActive) {
      setReady(true);
      return;
    }

    const supabase = createClient();
    supabase.auth.signOut().finally(() => {
      router.replace('/panel/login');
    });
  }, [router]);

  if (!ready) return <div className="fixed inset-0 bg-green-900" />;
  return <>{children}</>;
}
