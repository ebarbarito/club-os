export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="inline-flex items-center gap-2 text-amber-tx text-xs font-semibold uppercase tracking-[0.2em] mb-3">
      <span className="h-px w-6 bg-gold inline-block" />
      {children}
    </p>
  );
}
