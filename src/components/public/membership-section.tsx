import { ModalTrigger } from '@/components/modal-trigger';
import { SignupForm } from './signup-form';

const PLANS = [
  { name: 'Neón', price: '$8.000/mes', desc: 'Acceso a catálogo y reservas básicas.' },
  { name: 'Premium', price: '$16.000/mes', desc: 'Prioridad en dispensa + descuentos.' },
  { name: 'VIP', price: '$28.000/mes', desc: 'Beneficios completos + eventos del club.' },
];

export function MembershipSection() {
  return (
    <section id="membresia" className="py-16 px-6 max-w-6xl mx-auto">
      <h2 className="font-display text-3xl font-bold text-text mb-2">Membresía</h2>
      <p className="text-text-soft mb-8">Elegí el plan que mejor se adapte a vos.</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {PLANS.map((p) => (
          <div key={p.name} className="rounded-xl border border-line bg-surface p-5">
            <h3 className="font-display font-bold text-text mb-1">{p.name}</h3>
            <p className="text-accent font-semibold mb-3">{p.price}</p>
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

      <ModalTrigger label="Quiero ser socio/a" title="Alta de socio">
        <SignupForm />
      </ModalTrigger>
    </section>
  );
}
