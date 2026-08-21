'use client';

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print-hide w-full rounded-lg border border-line-2 text-text font-semibold text-sm py-2 hover:border-accent hover:text-accent"
    >
      Imprimir
    </button>
  );
}
