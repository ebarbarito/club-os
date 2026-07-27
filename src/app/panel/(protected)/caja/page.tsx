import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth/get-session-profile';
import { ModalTrigger } from '@/components/modal-trigger';
import { money, fmtDateTime } from '@/lib/format';
import { ROLES } from '@/lib/roles';
import { OpenShiftForm } from './open-shift-form';
import { MovementForm } from './movement-form';
import { CloseShiftForm } from './close-shift-form';
import { EditMovementForm } from './edit-movement-form';

export default async function CajaPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect('/panel/login');
  if (profile.role !== 'admin') redirect(`/panel/${ROLES[profile.role].home}`);

  const supabase = await createClient();
  const { data: shift } = await supabase
    .from('caja_shifts')
    .select('*, opened_by_profile:profiles(name)')
    .is('closed_at', null)
    .maybeSingle();

  let movements: { id: string; type: string; category: string; concept: string; amount: number; method: string; created_at: string }[] = [];
  let ingEfectivo = 0;
  let egEfectivo = 0;
  let ingTransf = 0;

  if (shift) {
    const { data } = await supabase
      .from('ledger')
      .select('*')
      .eq('shift_id', shift.id)
      .order('created_at', { ascending: false });
    movements = data ?? [];
    ingEfectivo = movements.filter((m) => m.type === 'ingreso' && m.method === 'efectivo').reduce((s, m) => s + m.amount, 0);
    egEfectivo = movements.filter((m) => m.type === 'egreso' && m.method === 'efectivo').reduce((s, m) => s + m.amount, 0);
    ingTransf = movements.filter((m) => m.type === 'ingreso' && m.method === 'transferencia').reduce((s, m) => s + m.amount, 0);
  }

  const expectedCash = shift ? shift.opening_cash + ingEfectivo - egEfectivo : 0;

  const { data: history } = await supabase
    .from('caja_shifts')
    .select('*')
    .not('closed_at', 'is', null)
    .order('closed_at', { ascending: false })
    .limit(10);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-text">Caja</h1>
      <p className="text-text-soft mb-4">Turno, movimientos y arqueo</p>

      {!shift ? (
        <div className="rounded-xl border border-line bg-surface p-6 text-center">
          <p className="text-text-soft mb-4">No hay un turno de caja abierto.</p>
          <ModalTrigger label="Abrir caja" title="Abrir caja">
            <OpenShiftForm />
          </ModalTrigger>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-line bg-surface p-5 mb-4">
            <div className="grid grid-cols-4 gap-4 mb-4 text-sm">
              <div>
                <p className="text-text-mute">Apertura</p>
                <p className="font-display font-bold text-text">{money(shift.opening_cash)}</p>
              </div>
              <div>
                <p className="text-text-mute">Efectivo en caja</p>
                <p className="font-display font-bold text-text">{money(expectedCash)}</p>
              </div>
              <div>
                <p className="text-text-mute">Transferencias</p>
                <p className="font-display font-bold text-text">{money(ingTransf)}</p>
              </div>
              <div>
                <p className="text-text-mute">Total</p>
                <p className="font-display font-bold text-accent">{money(expectedCash + ingTransf)}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <ModalTrigger
                label="+ Ingreso"
                className="rounded-lg border border-line-2 text-sm font-semibold px-3 py-1.5 hover:border-accent hover:text-accent"
                title="Registrar ingreso"
              >
                <MovementForm type="ingreso" />
              </ModalTrigger>
              <ModalTrigger
                label="+ Egreso"
                className="rounded-lg border border-line-2 text-sm font-semibold px-3 py-1.5 hover:border-accent hover:text-accent"
                title="Registrar egreso"
              >
                <MovementForm type="egreso" />
              </ModalTrigger>
              <ModalTrigger
                label="Cerrar caja (arqueo)"
                className="ml-auto rounded-lg bg-accent text-white text-sm font-semibold px-3 py-1.5"
                title="Arqueo de cierre"
              >
                <CloseShiftForm expected={expectedCash} />
              </ModalTrigger>
            </div>
          </div>

          <div className="rounded-xl border border-line bg-surface overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-text-soft text-left">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Concepto</th>
                  <th className="px-4 py-2.5 font-medium">Categoría</th>
                  <th className="px-4 py-2.5 font-medium">Medio</th>
                  <th className="px-4 py-2.5 font-medium">Monto</th>
                  <th className="px-4 py-2.5 font-medium">Fecha</th>
                  <th className="px-4 py-2.5 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id} className="border-t border-line">
                    <td className="px-4 py-2.5 text-text">{m.concept}</td>
                    <td className="px-4 py-2.5 text-text-soft">{m.category}</td>
                    <td className="px-4 py-2.5 text-text-soft capitalize">{m.method}</td>
                    <td className={`px-4 py-2.5 font-medium ${m.type === 'ingreso' ? 'text-accent' : 'text-red'}`}>
                      {m.type === 'ingreso' ? '+' : '-'}
                      {money(m.amount)}
                    </td>
                    <td className="px-4 py-2.5 text-text-soft">{fmtDateTime(m.created_at)}</td>
                    <td className="px-4 py-2.5 text-right">
                      {m.category !== 'Dispensa' && (
                        <ModalTrigger
                          label="Editar"
                          className="rounded-lg border border-line-2 text-xs font-semibold px-3 py-1.5 hover:border-accent hover:text-accent"
                          title="Editar movimiento"
                        >
                          <EditMovementForm movement={m} />
                        </ModalTrigger>
                      )}
                    </td>
                  </tr>
                ))}
                {movements.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-text-mute">
                      Sin movimientos en este turno.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2 className="font-display font-bold text-text mb-2">Historial de cierres</h2>
      <div className="rounded-xl border border-line bg-surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-text-soft text-left">
            <tr>
              <th className="px-4 py-2.5 font-medium">Cierre</th>
              <th className="px-4 py-2.5 font-medium">Apertura</th>
              <th className="px-4 py-2.5 font-medium">Contado</th>
              <th className="px-4 py-2.5 font-medium">Diferencia</th>
            </tr>
          </thead>
          <tbody>
            {(history ?? []).map((h) => (
              <tr key={h.id} className="border-t border-line">
                <td className="px-4 py-2.5 text-text-soft">{fmtDateTime(h.closed_at)}</td>
                <td className="px-4 py-2.5 text-text-soft">{money(h.opening_cash)}</td>
                <td className="px-4 py-2.5 text-text-soft">{money(h.counted_cash ?? 0)}</td>
                <td className={`px-4 py-2.5 font-medium ${h.difference === 0 ? 'text-accent' : 'text-red'}`}>
                  {h.difference === 0 ? 'Exacto' : money(h.difference ?? 0)}
                </td>
              </tr>
            ))}
            {(history ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-text-mute">
                  Sin cierres anteriores.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
