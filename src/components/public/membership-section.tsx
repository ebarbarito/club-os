import Link from 'next/link';
import { Eyebrow } from './eyebrow';
import { ADICIONALES, PLANES } from '@/lib/alta/opciones';

// Planes reales (los mismos que se eligen en la pre-inscripción y que figuran
// en los contratos): salen de src/lib/alta/opciones.ts, así un cambio de
// precio se actualiza en todos lados a la vez.
export function MembershipSection() {
  return (
    <section id="membresia" className="py-16 px-6 max-w-6xl mx-auto">
      <Eyebrow>Planes mensuales</Eyebrow>
      <h2 className="font-display text-3xl font-bold text-text mb-2">Membresía</h2>
      <p className="text-text-soft mb-8">
        Elegí el plan que corresponde a tu indicación médica. La cuota cubre los costos de producción: somos una
        asociación civil sin fines de lucro.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {PLANES.map((p) => {
          const destacado = p.value === 'medicinal';
          return (
            <div
              key={p.value}
              className={`flex flex-col rounded-xl border p-5 ${
                destacado ? 'bg-green-900 text-white border-transparent' : 'bg-surface border-line'
              }`}
            >
              <p className={`text-xs font-semibold uppercase tracking-[0.15em] mb-2 ${destacado ? 'text-gold' : 'text-amber-tx'}`}>
                {p.title}
              </p>
              <p className={`font-display text-3xl font-bold leading-none mb-2 ${destacado ? 'text-gold' : 'text-text'}`}>
                {p.value === 'medicinal' ? 'Aceite + crema' : p.title.replace('Flores ', '') + ' g'}
              </p>
              <p className={`text-sm flex-1 ${destacado ? 'text-white/80' : 'text-text-soft'}`}>{p.desc}</p>
              <p className={`mt-4 font-semibold text-lg ${destacado ? 'text-gold' : 'text-accent'}`}>{p.precio}</p>
              <p className={`text-xs ${destacado ? 'text-white/60' : 'text-text-mute'}`}>cuota mensual</p>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-line bg-surface p-5 mb-8">
        <p className="font-display font-bold text-text mb-3">Adicionales</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {ADICIONALES.map((a) => (
            <div key={a.value} className="flex items-center justify-between rounded-lg bg-surface-2 px-4 py-3">
              <span className="text-sm font-medium text-text">{a.title}</span>
              <span className="text-sm font-semibold text-text">{a.precio}</span>
            </div>
          ))}
        </div>
        <p className="text-text-mute text-xs mt-3">Se suman a cualquier plan, según tu indicación médica.</p>
      </div>

      <Link href="/alta-socio" className="inline-block rounded-lg bg-gold text-green-900 text-sm font-semibold px-5 py-2.5">
        Quiero ser socio/a
      </Link>
    </section>
  );
}
