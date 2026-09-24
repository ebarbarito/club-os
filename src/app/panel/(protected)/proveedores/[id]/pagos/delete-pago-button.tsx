'use client';

import { useState, useTransition } from 'react';
import { anularPagoProveedor } from '../../actions';

export function DeletePagoButton({
  id,
  proveedorId,
}: {
  id: string;
  proveedorId: string;
}) {
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleOpen() {
    setOpen(true);
    setMotivo('');
    setError(null);
  }

  function handleConfirm() {
    if (!motivo.trim()) {
      setError('Ingresá un motivo');
      return;
    }
    startTransition(async () => {
      const res = await anularPagoProveedor(id, proveedorId, motivo.trim());
      if (res?.error) {
        setError(res.error);
        return;
      }
      setOpen(false);
    });
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="text-text-mute hover:text-red disabled:opacity-40 text-xs transition-colors"
      >
        Anular
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="bg-surface rounded-xl shadow-xl p-6 w-full max-w-sm mx-4 space-y-4">
            <h3 className="font-semibold text-text">Anular pago</h3>
            <p className="text-sm text-text-soft">
              Se revertirán los saldos de los comprobantes asociados y se registrará la anulación en los Asientos.
            </p>
            <div>
              <label className="block text-xs font-medium text-text-soft mb-1">
                Motivo <span className="text-red">*</span>
              </label>
              <input
                autoFocus
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej: error de importe, proveedor incorrecto…"
                className="w-full rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
            {error && <p className="text-red text-sm">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 rounded-lg border border-line-2 text-sm font-semibold py-2"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                disabled={pending}
                className="flex-1 rounded-lg bg-red text-white text-sm font-semibold py-2 disabled:opacity-60"
              >
                {pending ? 'Anulando…' : 'Anular pago'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
