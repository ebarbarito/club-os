// Imagen genérica para artículos que todavía no tienen foto ("en trabajo").
export function FotoEnPreparacion({ className = '', esGenetica = true }: { className?: string; esGenetica?: boolean }) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-1.5 bg-surface-3 text-text-mute ${className}`}
      style={{
        backgroundImage:
          'repeating-linear-gradient(135deg, transparent 0 14px, color-mix(in oklab, currentColor 8%, transparent) 14px 28px)',
      }}
      role="img"
      aria-label="Foto en preparación"
    >
      {esGenetica ? (
        <svg viewBox="0 0 24 24" className="h-10 w-10 opacity-70" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <path d="M12 21v-6" strokeLinecap="round" />
          <path d="M12 15c0-5 2-9 0-12-2 3 0 7 0 12Z" strokeLinejoin="round" />
          <path d="M12 15c-3-3-7-4-9-3 1 3 5 4 9 3Z" strokeLinejoin="round" />
          <path d="M12 15c3-3 7-4 9-3-1 3-5 4-9 3Z" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-10 w-10 opacity-70" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <path d="M3 7h18v13H3z" strokeLinejoin="round" />
          <path d="M8 7V4h8v3" strokeLinejoin="round" />
        </svg>
      )}
      <span className="text-xs font-semibold uppercase tracking-wide">Foto en preparación</span>
    </div>
  );
}
