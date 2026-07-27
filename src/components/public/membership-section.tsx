import { ModalTrigger } from '@/components/modal-trigger';
import { SignupForm } from './signup-form';
import { Eyebrow } from './eyebrow';

const PLANS = [
  { name: 'Neón', price: '$8.000/mes', desc: 'Acceso a catálogo y reservas básicas.', featured: false },
  { name: 'Premium', price: '$16.000/mes', desc: 'Prioridad en dispensa + descuentos.', featured: true },
  { name: 'VIP', price: '$28.000/mes', desc: 'Beneficios completos + eventos del club.', featured: false },
];

export function MembershipSection() {
  return (
    <section id="membresia" className="py-16 px-6 max-w-6xl mx-auto">
      <Eyebrow>Planes</Eyebrow>
      <h2 className="font-display text-3xl font-bold text-text mb-2">Membresía</h2>
      <p className="text-text-soft mb-8">Elegí el plan que mejor se adapte a vos.</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {PLANS.map((p) => (
          <div
            key={p.name}
            className={`relative rounded-xl border bg-surface p-5 ${p.featured ? 'border-gold border-2' : 'border-line'}`}
          >
            {p.featured && (
              <span className="absolute -top-3 left-5 rounded-full bg-gold text-green-900 text-[10px] font-bold uppercase tracking-wide px-3 py-1">
                Más elegido
              </span>
            )}
            <h3 className="font-display font-bold text-text mb-1">{p.name}</h3>
            <p className={`font-semibold mb-3 ${p.featured ? 'text-amber-tx' : 'text-accent'}`}>{p.price}</p>
            <p className="text-text-soft text-sm">{p.desc}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-dashed border-line-2 p-5 mb-8">
        <h3 className="font-display font-bold text-text mb-1">Green Box — suscripción mensual</h3>
        <p className="text-text-soft text-sm">
          Una selección curada de genéticas todos los meses, coordinada con tu dispensador/a.
        </p>
      </div>

      <ModalTrigger
        label="Quiero ser socio/a"
        className="rounded-lg bg-gold text-green-900 text-sm font-semibold px-4 py-2"
        title="Alta de socio"
      >
        <SignupForm />
      </ModalTrigger>
    </section>
  );
}
