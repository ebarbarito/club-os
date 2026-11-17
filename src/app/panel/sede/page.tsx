import Link from 'next/link';

export const metadata = { title: 'Sede' };

// Inicio de la tablet de la sede: dos botones grandes.
export default function SedeInicioPage() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-4.5rem)] max-w-4xl flex-col justify-center px-6 py-10">
      <p className="mb-8 text-center text-xl text-text-soft">¿Qué querés hacer?</p>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Link
          href="/panel/sede/alta"
          className="flex min-h-64 flex-col items-center justify-center gap-4 rounded-3xl border-2 border-accent bg-surface p-8 text-center shadow-sm transition active:scale-[0.98] hover:bg-accent/5"
        >
          <span className="text-7xl" aria-hidden>
            📝
          </span>
          <span className="font-display text-3xl font-bold text-text">Alta de socios</span>
          <span className="text-text-soft">Inscripción completa en el momento</span>
        </Link>
        <Link
          href="/panel/sede/pedidos"
          className="flex min-h-64 flex-col items-center justify-center gap-4 rounded-3xl border-2 border-accent bg-surface p-8 text-center shadow-sm transition active:scale-[0.98] hover:bg-accent/5"
        >
          <span className="text-7xl" aria-hidden>
            🛍️
          </span>
          <span className="font-display text-3xl font-bold text-text">Pedidos</span>
          <span className="text-text-soft">Catálogo para cargar la dispensa</span>
        </Link>
      </div>
    </div>
  );
}
