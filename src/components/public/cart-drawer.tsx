'use client';

import { useState, useTransition } from 'react';
import { money } from '@/lib/format';
import { createReservation } from '@/lib/public/actions';
import { useStore } from './store';

export function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { cart, removeFromCart, setGrams, clearCart, member } = useStore();
  const [delivery, setDelivery] = useState<'pickup' | 'shipping'>('pickup');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const total = cart.reduce((s, l) => s + l.grams * l.pricePerGram, 0);
  const canConfirm = member?.status === 'valid' && cart.length > 0;

  function submit(formData: FormData) {
    if (!member) return;
    setError(null);
    formData.set('member_id', member.id);
    formData.set('delivery', delivery);
    formData.set('items', JSON.stringify(cart.map((l) => ({ strainId: l.strainId, grams: l.grams }))));

    startTransition(async () => {
      const res = await createReservation(formData);
      if (res?.error) {
        setError(res.error);
        return;
      }
      clearCart();
      setDone(true);
    });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md bg-surface h-full overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-bold text-text">Tu reserva</h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-text-mute">
            ✕
          </button>
        </div>

        {done ? (
          <div className="text-center py-8">
            <p className="font-display font-bold text-text mb-2">¡Reserva confirmada!</p>
            <p className="text-text-soft text-sm mb-4">El club te va a contactar para coordinar la entrega.</p>
            <button onClick={onClose} className="rounded-lg bg-accent text-white font-semibold text-sm px-4 py-2">
              Cerrar
            </button>
          </div>
        ) : (
          <>
            {!member && (
              <p className="text-amber-tx bg-amber-bg rounded-lg p-3 text-sm mb-4">
                Necesitás darte de alta como socio para poder confirmar una reserva.
              </p>
            )}
            {member && member.status === 'pending' && (
              <p className="text-amber-tx bg-amber-bg rounded-lg p-3 text-sm mb-4">
                Tu alta está en evaluación — todavía no podés confirmar reservas.
              </p>
            )}
            {member && member.status === 'rejected' && (
              <p className="text-red bg-red-bg rounded-lg p-3 text-sm mb-4">Tu alta fue rechazada por el club.</p>
            )}

            {cart.length === 0 ? (
              <p className="text-text-mute text-sm">Tu carrito está vacío.</p>
            ) : (
              <div className="space-y-3 mb-4">
                {cart.map((l) => (
                  <div key={l.strainId} className="flex items-center gap-2 border-b border-line pb-3">
                    <div className="flex-1">
                      <p className="font-medium text-text text-sm">{l.name}</p>
                      <p className="text-text-mute text-xs">{money(l.pricePerGram)}/g</p>
                    </div>
                    <input
                      type="number"
                      min={1}
                      value={l.grams}
                      onChange={(e) => setGrams(l.strainId, Number(e.target.value))}
                      className="w-16 rounded-lg border border-line-2 px-2 py-1 text-sm"
                    />
                    <button onClick={() => removeFromCart(l.strainId)} className="text-red text-xs">
                      Quitar
                    </button>
                  </div>
                ))}
                <div className="flex justify-between font-semibold text-text">
                  <span>Total</span>
                  <span>{money(total)}</span>
                </div>
              </div>
            )}

            {cart.length > 0 && (
              <form action={submit} className="space-y-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDelivery('pickup')}
                    className={`flex-1 rounded-lg border py-2 text-sm font-semibold ${delivery === 'pickup' ? 'border-accent text-accent' : 'border-line-2 text-text-soft'}`}
                  >
                    Retiro en el club
                  </button>
                  <button
                    type="button"
                    onClick={() => setDelivery('shipping')}
                    className={`flex-1 rounded-lg border py-2 text-sm font-semibold ${delivery === 'shipping' ? 'border-accent text-accent' : 'border-line-2 text-text-soft'}`}
                  >
                    Envío coordinado
                  </button>
                </div>

                {delivery === 'pickup' ? (
                  <div className="grid grid-cols-2 gap-2">
                    <input name="pickup_day" type="date" className="rounded-lg border border-line-2 px-2 py-1.5 text-sm" />
                    <input name="pickup_time" placeholder="Horario" className="rounded-lg border border-line-2 px-2 py-1.5 text-sm" />
                  </div>
                ) : (
                  <input name="address" placeholder="Dirección" className="w-full rounded-lg border border-line-2 px-2 py-1.5 text-sm" />
                )}
                <input name="zona" placeholder="Zona" className="w-full rounded-lg border border-line-2 px-2 py-1.5 text-sm" />

                {error && <p className="text-red text-sm">{error}</p>}

                <button
                  type="submit"
                  disabled={!canConfirm || pending}
                  className="w-full rounded-lg bg-accent text-white font-semibold text-sm py-2 disabled:opacity-50"
                >
                  {pending ? 'Confirmando…' : 'Confirmar reserva'}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
