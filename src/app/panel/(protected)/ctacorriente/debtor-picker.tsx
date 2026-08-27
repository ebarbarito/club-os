'use client';

import { useRouter } from 'next/navigation';
import { money } from '@/lib/format';

export type Debtor = { id: string; name: string; memberNumber: number | null; adeudado: number };

// Segundo combo para recorrer todos los deudores sin tener que saber de
// antemano el nombre/dni/código a tipear en la búsqueda.
export function DebtorPicker({ debtors, value }: { debtors: Debtor[]; value: string }) {
  const router = useRouter();

  if (debtors.length === 0) return null;

  return (
    <select
      value={debtors.some((d) => d.id === value) ? value : ''}
      onChange={(e) => {
        if (e.target.value) router.push(`/panel/ctacorriente?member=${e.target.value}`);
      }}
      className="rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent"
    >
      <option value="">Deudores ({debtors.length})…</option>
      {debtors.map((d) => (
        <option key={d.id} value={d.id}>
          {d.memberNumber != null ? `N° ${d.memberNumber} — ` : ''}
          {d.name} — {money(d.adeudado)}
        </option>
      ))}
    </select>
  );
}
