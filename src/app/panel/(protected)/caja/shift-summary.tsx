import { createClient } from '@/lib/supabase/server';
import { PrintButton } from './print-button';
import { ShiftSummaryView, type SummaryMovement } from './shift-summary-view';

export async function ShiftSummary({ shiftId }: { shiftId: string }) {
  const supabase = await createClient();
  const [{ data: shift }, { data: movements }] = await Promise.all([
    supabase.from('caja_shifts').select('*, opened_by_profile:profiles(name)').eq('id', shiftId).maybeSingle(),
    supabase
      .from('ledger')
      .select('id, type, category, concept, amount, amount_local, account_id, receipt_number, created_at, account:payment_accounts(name)')
      .eq('shift_id', shiftId)
      .order('created_at'),
  ]);

  if (!shift) return <p className="text-text-mute text-sm">Turno no encontrado.</p>;

  return (
    <div className="space-y-4 text-sm">
      <ShiftSummaryView shift={shift} movements={(movements ?? []) as unknown as SummaryMovement[]} />
      <PrintButton />
    </div>
  );
}
