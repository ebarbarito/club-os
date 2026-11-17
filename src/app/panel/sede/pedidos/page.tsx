import Link from 'next/link';

export const metadata = { title: 'Pedidos' };

// Próximo paso: catálogo para cargar dispensas en la sede.
export default function SedePedidosPage() {
  return (
    <div className="mx-auto max-w-xl px-6 py-20 text-center">
      <div className="mb-4 text-6xl" aria-hidden>
        🛍️
      </div>
      <h1 className="font-display text-3xl font-bold text-text">Pedidos</h1>
      <p className="mt-2 text-lg text-text-soft">Muy pronto: el catálogo para cargar las dispensas desde acá.</p>
      <Link
        href="/panel/sede"
        className="mt-8 inline-block rounded-2xl border-2 border-line-2 px-8 py-4 text-lg font-bold text-text"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
