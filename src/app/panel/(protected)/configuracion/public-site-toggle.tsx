'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setPublicSiteEnabled } from './actions';

export function PublicSiteToggle({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    startTransition(async () => {
      const res = await setPublicSiteEnabled(!enabled);
      if (res?.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <input type="checkbox" checked={enabled} disabled={pending} onChange={toggle} className="h-5 w-5 accent-accent" />
        <span className="text-sm font-medium text-text">{enabled ? 'Sitio público visible' : 'Sitio público oculto'}</span>
      </label>
      {error && <p className="text-red text-sm mt-2">{error}</p>}
    </div>
  );
}
