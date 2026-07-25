'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { advanceOrderStatus } from './actions';

export function AdvanceButton({
  orderId,
  status,
  delivery,
  label,
}: {
  orderId: string;
  status: string;
  delivery: 'pickup' | 'shipping';
  label: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await advanceOrderStatus(orderId, status, delivery);
          router.refresh();
        })
      }
      className="rounded-lg border border-line-2 text-xs font-semibold px-3 py-1.5 hover:border-accent hover:text-accent disabled:opacity-60"
    >
      {pending ? '…' : `→ ${label}`}
    </button>
  );
}
