'use client';

import { useState, useTransition } from 'react';
import { generarCuotasSociales } from './cuotas-acciones';
import { money } from '@/lib/format';

const inputCls = 'w-full rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent';
const labelCls = 'block text-xs font-medium text-text-soft mb-1';

/** Formato 'YYYY-MM' del mes actual, en hora local. */
function mesActual(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function GenerarCuotasForm({ memberCount }: { memberCount: number }) {
  const [pending, startTransition] = useTransition();
  const [periodo, setPeriodo] = useState(mesActual);
  const [monto, setMonto] = useState('');
  const [result, setResult] = useState<{ count?: number; total?: number; error?: string } | null>(null);

  function handleSubmit() {
    setResult(null);
    const formData = new FormData();
    formData.set('periodo', periodo);
    formData.set('monto', monto);
    startTransition(async () => {
      const res = await generarCuotasSociales(formData);
      setResult(res);
    });
  }

  // Nombre legible del período seleccionado
  const periodoLabel = periodo
    ? new Date(`${periodo}-15T12:00:00Z`).toLocaleDateString('es-AR', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : '—';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Período</label>
          <input
            type="month"
            value={periodo}
            onChange={(e) => { setPeriodo(e.target.value); setResult(null); }}
            className={inputCls}
          />
          {periodo && (
            <p className="mt-1 text-xs text-text-mute capitalize">{periodoLabel}</p>
          )}
        </div>
        <div>
          <label className={labelCls}>Monto por defecto (para socios sin cuota configurada)</label>
          <input
            type="number"
            min="0"
            step="1"
            placeholder="0"
            value={monto}
            onChange={(e) => { setMonto(e.target.value); setResult(null); }}
            className={inputCls}
          />
          <p className="mt-1 text-xs text-text-mute">
            Si el socio tiene su cuota configurada en su ficha, se usa esa.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <button
          type="button"
          disabled={pending || !periodo}
          onClick={handleSubmit}
          className="rounded-lg bg-accent text-white text-sm font-semibold px-4 py-2 disabled:opacity-60"
        >
          {pending ? 'Generando…' : `Generar cargos — ${periodoLabel}`}
        </button>
        <p className="text-xs text-text-soft">
          {memberCount} socio{memberCount !== 1 ? 's' : ''} activos en el padrón
        </p>
      </div>

      {result && !result.error && (
        <div className="rounded-lg border border-accent/30 bg-accent/5 px-4 py-3 text-sm">
          <p className="font-semibold text-accent">
            ✓ {result.count} cargo{result.count !== 1 ? 's' : ''} generado{result.count !== 1 ? 's' : ''}
            {result.total && result.count !== result.total
              ? ` (${result.total - (result.count ?? 0)} ya existían)`
              : ''}
          </p>
          <p className="text-xs text-text-soft mt-0.5">
            Los cargos ya están disponibles. Al registrar una dispensa del socio, el aviso de cuota
            adeudada aparecerá automáticamente.
          </p>
        </div>
      )}

      {result?.error && (
        <p className="text-red text-sm">{result.error}</p>
      )}
    </div>
  );
}
