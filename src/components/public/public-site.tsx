'use client';

import { useState } from 'react';
import { StoreProvider, useStore } from './store';
import { AgeGate } from './age-gate';
import { CatalogSection } from './catalog-section';
import { MembershipSection } from './membership-section';
import { CartDrawer } from './cart-drawer';
import { ModalTrigger } from '@/components/modal-trigger';
import { SignupForm } from './signup-form';
import type { Tenant } from '@/lib/tenant/types';
import type { CatalogItem } from '@/lib/public/get-catalog';

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: 'En evaluación', cls: 'bg-amber-bg text-amber-tx' },
  valid: { label: 'Socio válido', cls: 'bg-[color:var(--color-accent)]/10 text-accent' },
  rejected: { label: 'Alta rechazada', cls: 'bg-red-bg text-red' },
};

function Nav({ tenant, onOpenCart }: { tenant: Tenant; onOpenCart: () => void }) {
  const { cart, member } = useStore();
  const statusMeta = member ? STATUS_LABEL[member.status] : null;

  return (
    <nav className="sticky top-0 z-40 bg-surface/90 backdrop-blur border-b border-line px-6 py-3 flex items-center justify-between">
      <div className="flex items-center">
        {tenant.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={tenant.logo_url} alt={tenant.name} className="h-10 w-auto object-contain" />
        ) : (
          <span className="font-display font-bold text-text">{tenant.name}</span>
        )}
      </div>
      <div className="flex items-center gap-4">
        <a href="#geneticas" className="text-sm text-text-soft hover:text-accent">
          Genéticas
        </a>
        <a href="#membresia" className="text-sm text-text-soft hover:text-accent">
          Membresía
        </a>
        {statusMeta && (
          <span className={`text-xs font-semibold rounded-full px-2.5 py-1 ${statusMeta.cls}`}>{statusMeta.label}</span>
        )}
        {!member && (
          <ModalTrigger
            label="Darme de alta"
            className="text-sm font-semibold text-amber-tx hover:text-gold"
            title="Alta de socio"
          >
            <SignupForm />
          </ModalTrigger>
        )}
        <button
          onClick={onOpenCart}
          className="rounded-lg bg-accent text-white text-sm font-semibold px-3 py-1.5"
        >
          Reserva {cart.length > 0 ? `(${cart.length})` : ''}
        </button>
      </div>
    </nav>
  );
}

function Hero({ tenant }: { tenant: Tenant }) {
  return (
    <section className="bg-green-900 text-white py-20 px-6 text-center">
      <p className="inline-flex items-center gap-2 text-gold text-xs font-semibold uppercase tracking-[0.2em] mb-4">
        <span className="h-px w-6 bg-gold inline-block" />
        Club social de cannabis
      </p>
      <h1 className="font-display text-4xl font-bold mb-3">{tenant.name}</h1>
      <p className="text-white/80 max-w-xl mx-auto mb-8">
        Genéticas, membresías y dispensa para socios validados.
      </p>
      <div className="flex justify-center gap-8 text-sm text-white/70">
        <div>
          <p className="font-display text-2xl font-bold text-gold">+500</p>
          <p>Socios</p>
        </div>
        <div>
          <p className="font-display text-2xl font-bold text-gold">6</p>
          <p>Genéticas</p>
        </div>
        <div>
          <p className="font-display text-2xl font-bold text-gold">100%</p>
          <p>REPROCANN</p>
        </div>
      </div>
    </section>
  );
}

function PublicSiteInner({ tenant, catalog }: { tenant: Tenant; catalog: CatalogItem[] }) {
  const [cartOpen, setCartOpen] = useState(false);

  return (
    <div className="flex flex-col flex-1 bg-bg">
      <AgeGate clubName={tenant.name} />
      <Nav tenant={tenant} onOpenCart={() => setCartOpen(true)} />
      <Hero tenant={tenant} />
      <CatalogSection catalog={catalog} />
      <MembershipSection />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
      <footer className="py-8 text-center text-text-mute text-xs border-t border-line">
        {tenant.name} — sitio de un club social de cannabis. Contenido para mayores de 18 años.
      </footer>
    </div>
  );
}

export function PublicSite({ tenant, catalog }: { tenant: Tenant; catalog: CatalogItem[] }) {
  return (
    <StoreProvider>
      <PublicSiteInner tenant={tenant} catalog={catalog} />
    </StoreProvider>
  );
}
