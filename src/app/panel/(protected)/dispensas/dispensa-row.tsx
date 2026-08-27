'use client';

import { useState } from 'react';
import { Modal, ModalTrigger } from '@/components/modal-trigger';
import { Badge } from '@/components/badge';
import { money, fmtDateTime } from '@/lib/format';
import type { SearchableMember } from '@/components/member-search';
import type { PaymentAccount } from '@/components/payment-split';
import { DispensaDetail } from '../ctacorriente/dispensa-detail';
import { VoidDispensaForm } from './void-dispensa-form';
import type { CatalogItem } from './register-dispensa-form';

type Item = { strainId?: string; description: string; quantity: number; unit_price: number; bonif1_pct: number; bonif2_pct: number; total: number; itemType?: string };
type Payment = { receipt_number: number; created_at: string; amount_local: number; account_name: string; accountId?: string; amount?: number; exchangeRate?: number };

export function DispensaRow({
  id,
  number,
  createdAt,
  amount,
  suggestedAmount,
  note,
  voided,
  memberId,
  memberName,
  byName,
  items,
  payments,
  members,
  catalogItems,
  accounts,
}: {
  id: string;
  number: number;
  createdAt: string;
  amount: number;
  suggestedAmount: number | null;
  note: string | null;
  voided: boolean;
  memberId: string;
  memberName: string;
  byName: string;
  items: Item[];
  payments: Payment[];
  members: SearchableMember[];
  catalogItems: CatalogItem[];
  accounts: PaymentAccount[];
}) {
  const [open, setOpen] = useState(false);
  const paid = payments.reduce((s, p) => s + p.amount_local, 0);
  const diff = suggestedAmount != null ? amount - suggestedAmount : null;

  return (
    <>
      <tr
        onClick={() => setOpen(true)}
        className={`border-t border-line hover:bg-surface-2 cursor-pointer ${voided ? 'opacity-50' : ''}`}
      >
        <td className="px-4 py-2.5 text-accent font-medium">N° {number}</td>
        <td className="px-4 py-2.5 font-medium text-text">{memberName}</td>
        <td className="px-4 py-2.5 text-text-soft">
          {items.map((it, i) => (
            <div key={i}>
              {it.description} · {it.quantity} {it.itemType === 'genetica' ? 'g' : 'u.'}
            </div>
          ))}
        </td>
        <td className="px-4 py-2.5 text-text-soft">{suggestedAmount != null ? money(suggestedAmount) : '—'}</td>
        <td className="px-4 py-2.5 text-text font-medium">{money(paid)}</td>
        <td className={`px-4 py-2.5 ${diff == null || diff === 0 ? 'text-text-mute' : diff > 0 ? 'text-accent' : 'text-red'}`}>
          {diff == null ? '—' : diff === 0 ? 'Exacto' : `${diff > 0 ? '+' : ''}${money(diff)}`}
        </td>
        <td className="px-4 py-2.5 text-text-soft">
          {payments.map((p, i) => (
            <div key={i}>
              {p.account_name} · {money(p.amount_local)}
            </div>
          ))}
        </td>
        <td className="px-4 py-2.5 text-text-soft">{fmtDateTime(createdAt)}</td>
        <td className="px-4 py-2.5 text-text-soft">{byName}</td>
        <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
          {voided ? (
            <Badge label="Anulada" color="red" />
          ) : (
            <ModalTrigger
              label="Anular"
              className="rounded-lg border border-line-2 text-xs font-semibold px-3 py-1.5 hover:border-red hover:text-red"
              title="Anular dispensa"
            >
              <VoidDispensaForm dispensaId={id} />
            </ModalTrigger>
          )}
        </td>
      </tr>

      <Modal open={open} onClose={() => setOpen(false)} title="Detalle del comprobante" size="xl">
        <DispensaDetail
          number={number}
          memberName={memberName}
          createdAt={createdAt}
          items={items}
          payments={payments}
          amount={amount}
          note={note}
          voided={voided}
          edit={voided ? undefined : { dispensaId: id, memberId, members, catalogItems, accounts }}
        />
      </Modal>
    </>
  );
}
