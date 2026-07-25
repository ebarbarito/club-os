const COLORS = {
  green: 'bg-[color:var(--color-accent)]/10 text-accent',
  amber: 'bg-amber-bg text-amber-tx',
  red: 'bg-red-bg text-red',
  blue: 'bg-blue-bg text-blue',
  purple: 'bg-purple-bg text-purple',
  gray: 'bg-surface-3 text-text-soft',
};

export function Badge({ label, color }: { label: string; color: keyof typeof COLORS }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${COLORS[color]}`}>
      {label}
    </span>
  );
}
