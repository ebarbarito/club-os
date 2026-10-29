'use client';

import { ADICIONALES, PLANES } from '@/lib/alta/opciones';

// Planes mensuales + adicionales de la "Propuesta para pacientes". Se usa
// en la pre-inscripción (etapa 1) y, precargado, en el formulario de
// adhesión (etapa 2) para confirmarlo con la indicación médica.
export function PlanSelector({
  plan,
  onPlanChange,
  adicionales,
  onAdicionalesChange,
  autocultivo = false,
}: {
  plan: string;
  onPlanChange: (plan: string) => void;
  adicionales: string[];
  onAdicionalesChange: (adicionales: string[]) => void;
  // Autocultivador: cada plan de flores muestra su equivalencia (BASIC /
  // STANDARD / FULL GREEN y m²) y el Medicinal figura como "no aplica".
  autocultivo?: boolean;
}) {
  function toggleAdicional(value: string) {
    onAdicionalesChange(adicionales.includes(value) ? adicionales.filter((a) => a !== value) : [...adicionales, value]);
  }

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {PLANES.map((p) => {
          const checked = plan === p.value;
          // Autocultivador: se muestra la equivalencia (Flores 10 = BASIC…).
          // El Medicinal se ve pero no aplica al autocultivo.
          const auto = autocultivo ? p.autocultivo : null;
          const noAplica = autocultivo && !p.autocultivo;
          return (
            <label
              key={p.value}
              className={`flex flex-col rounded-lg border p-3 ${
                noAplica ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              } ${checked ? 'border-accent bg-surface-2 ring-1 ring-accent' : 'border-line-2'}`}
            >
              <input
                type="radio"
                name="plan_solicitado"
                value={p.value}
                checked={checked}
                disabled={noAplica}
                onChange={() => onPlanChange(p.value)}
                className="sr-only"
              />
              <span className="text-[11px] font-semibold uppercase tracking-wide text-text-mute">{p.title}</span>
              <span className="font-display text-lg font-bold text-text leading-tight mt-1">
                {p.value === 'medicinal' ? 'Aceite + crema' : p.title.replace('Flores ', '') + ' g'}
              </span>
              <span className="text-text-soft text-xs mt-1 flex-1">{p.desc}</span>
              {auto && (
                <span className="mt-2 text-[11px] font-semibold text-accent">
                  = {auto.nombre} · {auto.superficie}
                </span>
              )}
              {noAplica && <span className="mt-2 text-[11px] font-semibold text-text-mute">(no aplica a autocultivo)</span>}
              <span className="mt-3 font-semibold text-accent text-sm">{p.precio}</span>
              <span className="text-text-mute text-[11px]">cuota mensual</span>
            </label>
          );
        })}
      </div>

      {autocultivo && (
        <div className="mt-3 rounded-lg border border-line-2 overflow-hidden">
          <p className="px-3 py-2 text-xs font-semibold text-text bg-surface-2">Equivalencias para autocultivadores</p>
          <table className="w-full text-xs">
            <thead className="text-text-mute text-left">
              <tr>
                <th className="px-3 py-1.5 font-medium">Plan</th>
                <th className="px-3 py-1.5 font-medium">Autocultivo</th>
                <th className="px-3 py-1.5 font-medium">Parcela</th>
                <th className="px-3 py-1.5 font-medium">Producción estimada</th>
              </tr>
            </thead>
            <tbody className="text-text-soft">
              {PLANES.map((p) => (
                <tr key={p.value} className="border-t border-line-2">
                  <td className="px-3 py-1.5">{p.title}</td>
                  <td className="px-3 py-1.5 font-semibold text-text">{p.autocultivo?.nombre ?? '—'}</td>
                  <td className="px-3 py-1.5">{p.autocultivo?.superficie ?? '—'}</td>
                  <td className="px-3 py-1.5">
                    {p.autocultivo ? `hasta ${p.autocultivo.produccion} / mes` : 'No aplica a autocultivo'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-text-mute text-xs mt-2">La cantidad de cada plan se ajusta a tu indicación médica.</p>

      <p className="text-xs font-medium text-text-soft mt-4 mb-2">Adicionales (opcional, se suman a cualquier plan)</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {ADICIONALES.map((a) => {
          const checked = adicionales.includes(a.value);
          return (
            <label
              key={a.value}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 cursor-pointer ${checked ? 'border-accent bg-surface-2' : 'border-line-2'}`}
            >
              <input
                type="checkbox"
                name="adicionales_solicitados"
                value={a.value}
                checked={checked}
                onChange={() => toggleAdicional(a.value)}
              />
              <span className="flex-1 text-sm font-medium text-text">{a.title}</span>
              <span className="text-sm font-semibold text-text-soft">{a.precio}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
