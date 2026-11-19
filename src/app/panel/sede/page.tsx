import Link from 'next/link';
import { headers } from 'next/headers';
import { getTenantBySlug } from '@/lib/tenant/get-tenant';

export const metadata = { title: 'Sede' };

function IconoAlta() {
  return (
    <svg viewBox="0 0 48 48" className="h-16 w-16" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <circle cx="20" cy="16" r="8" />
      <path d="M6 40c1.5-8 7-12 14-12s12.5 4 14 12" strokeLinecap="round" />
      <path d="M38 14v12M32 20h12" strokeLinecap="round" />
    </svg>
  );
}

function IconoPedidos() {
  return (
    <svg viewBox="0 0 48 48" className="h-16 w-16" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <path d="M10 16h28l-2.5 24h-23z" strokeLinejoin="round" />
      <path d="M17 16v-3a7 7 0 0 1 14 0v3" strokeLinecap="round" />
      <path d="M24 24c-3 3-3 7 0 10 3-3 3-7 0-10z" strokeLinejoin="round" />
    </svg>
  );
}

// Inicio de la tablet de la sede: solo las dos opciones, con la marca del club.
export default async function SedeInicioPage() {
  const slug = (await headers()).get('x-club-os-tenant-slug');
  const tenant = slug ? await getTenantBySlug(slug) : null;

  return (
    // Fondo verde con trama del manual en toda la pantalla de inicio.
    <div
      className="min-h-[calc(100vh-4.75rem)] text-white"
      style={{ backgroundImage: 'var(--gl-trama-oscura), linear-gradient(135deg, #006838 0%, #053a1c 55%, #05221c 100%)' }}
    >
      <div className="mx-auto flex min-h-[calc(100vh-4.75rem)] max-w-5xl flex-col justify-center px-6 py-10">
        <div className="mb-10 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gold">{tenant?.name ?? 'Club'}</p>
          <h1 className="font-display text-5xl text-white sm:text-6xl">¡Bienvenido/a!</h1>
          <p className="mt-2 text-lg text-white/75">¿Qué querés hacer?</p>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <Link
            href="/panel/sede/alta"
            className="group flex min-h-72 flex-col items-center justify-center gap-4 rounded-3xl bg-surface p-8 text-center shadow-lg transition active:scale-[0.98]"
            style={{ backgroundImage: 'var(--gl-trama-clara)' }}
          >
            <span className="text-accent">
              <IconoAlta />
            </span>
            <span className="font-display text-4xl text-green-900">Alta de socios</span>
            <span className="text-text-soft">Inscripción completa en el momento</span>
          </Link>
          <Link
            href="/panel/sede/pedidos"
            className="group flex min-h-72 flex-col items-center justify-center gap-4 rounded-3xl bg-gold p-8 text-center shadow-lg transition active:scale-[0.98]"
          >
            <span className="text-green-900">
              <IconoPedidos />
            </span>
            <span className="font-display text-4xl text-green-900">Pedidos</span>
            <span className="text-green-900/75">Elegí tu pedido del catálogo</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
