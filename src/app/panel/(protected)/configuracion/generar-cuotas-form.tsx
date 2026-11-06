'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { generarCuotasSociales } from './cuotas-acciones';
import { money } from '@/lib/format';

const inputCls = 'w-full rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent';
const labelCls = 'block text-xs font-medium text-text-soft mb-1';

export type SocioCuota = {
  id: string;
  name: string;
  memberNumber: number | null;
  cuotaSocial: number;
  bonificada: boolean;
};

export type ResumenPeriodo = { ids: string[]; bonificadas: number; cobradas: number; pendientes: number };

/** Formato 'YYYY-MM' del mes actual, en hora local. */
function mesActual(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function etiqueta(s: SocioCuota) {
  return `${s.memberNumber != null ? `N° ${s.memberNumber} — ` : ''}${s.name}`;
}

// Genera la cuota social de un período para todos los socios válidos o para
// uno solo. `generados` resume, por período 'YYYY-MM', qué socios ya la
// tienen y cuántas están bonificadas, cobradas o pendientes.
export function GenerarCuotasForm({
  socios,
  generados,
}: {
  socios: SocioCuota[];
  generados: Record<string, ResumenPeriodo>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [modo, setModo] = useState<'todos' | 'uno'>('todos');
  const [periodo, setPeriodo] = useState(mesActual);
  const [monto, setMonto] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [socioId, setSocioId] = useState('');
  const [result, setResult] = useState<{ count?: number; total?: number; error?: string } | null>(null);

  const resumen = generados[periodo];
  const yaTienen = useMemo(() => new Set(generados[periodo]?.ids ?? []), [generados, periodo]);
  const faltan = socios.filter((s) => !yaTienen.has(s.id));
  const faltanBonif = faltan.filter((s) => s.bonificada).length;
  const socio = socios.find((s) => s.id === socioId) ?? null;

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return socios;
    return socios.filter((s) => s.name.toLowerCase().includes(q) || String(s.memberNumber ?? '').includes(q));
  }, [busqueda, socios]);

  const periodoLabel = periodo
    ? new Date(`${periodo}-15T12:00:00Z`).toLocaleDateString('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    : '—';

  function limpiar() {
    setResult(null);
  }

  function handleSubmit() {
    setResult(null);
    if (modo === 'uno' && !socioId) {
      setResult({ error: 'Elegí el socio.' });
      return;
    }
    const formData = new FormData();
    formData.set('periodo', periodo);
    formData.set('monto', monto);
    if (modo === 'uno') formData.set('member_id', socioId);
    startTransition(async () => {
      const res = await generarCuotasSociales(formData);
      setResult(res);
      if (!res.error) router.refresh();
    });
  }

  const socioYaTiene = socio ? yaTienen.has(socio.id) : false;

  return (
    <div className="space-y-4">
      <div className="flex gap-2" role="tablist" aria-label="A quién generar">
        {(
          [
            ['todos', 'Todos los socios'],
            ['uno', 'Un socio'],
          ] as const
        ).map(([v, l]) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={modo === v}
            onClick={() => {
              setModo(v);
              setMonto('');
              limpiar();
            }}
            className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${
              modo === v ? 'border-accent bg-accent text-white' : 'border-line-2 text-text-soft hover:border-accent'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls} htmlFor="cuota-periodo">
            Período
          </label>
          <input
            id="cuota-periodo"
            type="month"
            value={periodo}
            onChange={(e) => {
              setPeriodo(e.target.value);
              limpiar();
            }}
            className={inputCls}
          />
          {periodo && (
            <p className="mt-1 text-xs text-text-mute">
              <span className="capitalize">{periodoLabel}</span>
              {resumen
                ? ` · ${resumen.ids.length} generadas: ${resumen.pendientes} a cobrar, ${resumen.cobradas} cobradas, ${resumen.bonificadas} bonificadas`
                : ' · todavía no se generó ninguna'}
            </p>
          )}
        </div>

        {modo === 'todos' ? (
          <div>
            <label className={labelCls} htmlFor="cuota-monto">
              Monto por defecto (para socios sin cuota configurada)
            </label>
            <input
              id="cuota-monto"
              type="number"
              min="0"
              step="1"
              placeholder="0"
              value={monto}
              onChange={(e) => {
                setMonto(e.target.value);
                limpiar();
              }}
              className={inputCls}
            />
            <p className="mt-1 text-xs text-text-mute">Si el socio tiene su cuota configurada en su ficha, se usa esa.</p>
          </div>
        ) : (
          <div>
            <label className={labelCls} htmlFor="cuota-buscar">
              Socio
            </label>
            <input
              id="cuota-buscar"
              type="search"
              placeholder="Buscar por nombre o N°"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className={`${inputCls} mb-2`}
            />
            <select
              id="cuota-socio"
              value={socioId}
              onChange={(e) => {
                setSocioId(e.target.value);
                const s = socios.find((x) => x.id === e.target.value);
                setMonto(s && s.cuotaSocial > 0 ? String(s.cuotaSocial) : '');
                limpiar();
              }}
              className={inputCls}
            >
              <option value="">Elegí un socio…</option>
              {filtrados.map((s) => (
                <option key={s.id} value={s.id}>
                  {etiqueta(s)}
                  {s.bonificada ? ' · bonificada' : ''}
                  {yaTienen.has(s.id) ? ' (ya la tiene)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {modo === 'uno' && socio && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls} htmlFor="cuota-monto-uno">
              Monto de la cuota
            </label>
            <input
              id="cuota-monto-uno"
              type="number"
              min="0"
              step="1"
              value={monto}
              onChange={(e) => {
                setMonto(e.target.value);
                limpiar();
              }}
              className={inputCls}
            />
            <p className="mt-1 text-xs text-text-mute">
              {socio.cuotaSocial > 0 ? `En su ficha: ${money(socio.cuotaSocial)}` : 'No tiene cuota configurada en su ficha.'}
              {socio.bonificada ? ' · Bonificada al 100%: no genera deuda y se acredita para retirar producto.' : ''}
            </p>
          </div>
          {socioYaTiene && (
            <p className="self-end rounded-lg bg-amber-bg text-amber-tx text-xs px-3 py-2">
              Este socio ya tiene la cuota de {periodoLabel}. No se va a duplicar.
            </p>
          )}
        </div>
      )}

      <div className="flex items-center gap-4 flex-wrap">
        <button
          type="button"
          disabled={pending || !periodo || (modo === 'uno' && (!socioId || socioYaTiene))}
          onClick={handleSubmit}
          className="rounded-lg bg-accent text-white text-sm font-semibold px-4 py-2 disabled:opacity-60"
        >
          {pending
            ? 'Generando…'
            : modo === 'todos'
              ? `Generar cuotas de ${periodoLabel}`
              : `Generar cuota de ${periodoLabel}${socio ? ` a ${socio.name}` : ''}`}
        </button>
        {modo === 'todos' && (
          <p className="text-xs text-text-soft">
            {faltan.length === 0
              ? 'Todos los socios válidos ya tienen la cuota de este período.'
              : `Se generan para ${faltan.length} socio${faltan.length !== 1 ? 's' : ''} válido${faltan.length !== 1 ? 's' : ''} que todavía no la tienen${
                  faltanBonif > 0 ? ` (${faltanBonif} bonificada${faltanBonif !== 1 ? 's' : ''}: quedan registradas, sin deuda)` : ''
                }.`}
          </p>
        )}
      </div>

      {result && !result.error && (
        <div className="rounded-lg border border-accent/30 bg-accent/5 px-4 py-3 text-sm">
          <p className="font-semibold text-accent">
            {result.count === 0
              ? 'No se generó ninguna: ya tenían la cuota de este período.'
              : `✓ ${result.count} cuota${result.count !== 1 ? 's' : ''} generada${result.count !== 1 ? 's' : ''}`}
            {result.count && result.total && result.count !== result.total
              ? ` (${result.total - result.count} ya existían)`
              : ''}
          </p>
          <p className="text-xs text-text-soft mt-0.5">
            Al registrar una dispensa del socio aparece el aviso de cuota adeudada, y se cobra desde Cuenta Corriente.
          </p>
        </div>
      )}

      {result?.error && <p className="text-red text-sm">{result.error}</p>}
    </div>
  );
}
