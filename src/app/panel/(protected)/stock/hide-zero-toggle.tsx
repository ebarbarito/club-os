'use client';

import { useRouter, useSearchParams } from 'next/navigation';

// Por defecto se ocultan los artículos sin stock; tildar/destildar solo
// agrega o saca `zeros=1` de la URL (mostrar todos), conservando el resto.
export function HideZeroToggle({ hidden }: { hidden: boolean }) {
  const router = useRouter();
  const params = useSearchParams();

  function onChange(checked: boolean) {
    const next = new URLSearchParams(params.toString());
    if (checked) next.delete('zeros');
    else next.set('zeros', '1');
    const qs = next.toString();
    router.replace(qs ? `/panel/stock?${qs}` : '/panel/stock');
  }

  return (
    <label className="flex items-center gap-2 text-sm text-text-soft cursor-pointer select-none">
      <input
        type="checkbox"
        checked={hidden}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-accent"
      />
      Ocultar artículos sin stock
    </label>
  );
}
