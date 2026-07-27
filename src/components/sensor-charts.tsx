function sparkPath(vals: number[], w: number, h: number, pad: number, fixedMin?: number, fixedMax?: number) {
  const min = fixedMin ?? (vals.length ? Math.min(...vals) : 0);
  const max = fixedMax ?? (vals.length ? Math.max(...vals) : 1);
  const span = max - min || 1;
  const pts = vals.map((v, i) => {
    const x = pad + i * ((w - pad * 2) / (Math.max(vals.length - 1, 1)));
    const y = h - pad - ((v - min) / span) * (h - pad * 2);
    return [x, y] as const;
  });
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area =
    pts.length > 0
      ? `${path} L${pts[pts.length - 1][0].toFixed(1)},${h - pad} L${pts[0][0].toFixed(1)},${h - pad} Z`
      : '';
  return { path, area, min, max };
}

export function Sparkline({
  values,
  color,
  width = 300,
  height = 70,
  fixedMin,
  fixedMax,
}: {
  values: number[];
  color: string;
  width?: number;
  height?: number;
  fixedMin?: number;
  fixedMax?: number;
}) {
  const pad = 6;
  const r = sparkPath(values, width, height, pad, fixedMin, fixedMax);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none">
      <line x1={pad} y1={pad} x2={width - 30} y2={pad} stroke="var(--color-line)" strokeWidth={1} />
      <line x1={pad} y1={height - pad} x2={width - 30} y2={height - pad} stroke="var(--color-line)" strokeWidth={1} />
      {values.length > 0 && (
        <>
          <text x={width - 26} y={pad + 3} fontSize={10} fill="var(--color-text-mute)">
            {r.max.toFixed(0)}
          </text>
          <text x={width - 26} y={height - pad + 3} fontSize={10} fill="var(--color-text-mute)">
            {r.min.toFixed(0)}
          </text>
          <path d={r.path} fill="none" stroke={color} strokeWidth={2} />
        </>
      )}
    </svg>
  );
}

export function BigChart({
  values,
  times,
  color,
  width = 760,
  height = 260,
  fixedMin,
  fixedMax,
}: {
  values: number[];
  times: string[];
  color: string;
  width?: number;
  height?: number;
  fixedMin?: number;
  fixedMax?: number;
}) {
  const pad = 34;
  const r = sparkPath(values, width, height, pad, fixedMin, fixedMax);
  const gid = `chart-gradient-${color.replace(/[^a-zA-Z0-9]/g, '')}`;
  const yLabels = [r.max, (r.max + r.min) / 2, r.min];
  const idxs = values.length ? [0, Math.floor((times.length - 1) / 2), times.length - 1] : [];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.28} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((f) => {
        const y = pad + f * (height - pad * 2);
        const label = f === 0 ? yLabels[0] : f === 1 ? yLabels[2] : yLabels[1];
        return (
          <g key={f}>
            <line x1={pad} y1={y} x2={width - 10} y2={y} stroke="var(--color-line)" strokeWidth={1} />
            {values.length > 0 && (
              <text x={pad - 8} y={y + 4} fontSize={10} fill="var(--color-text-mute)" textAnchor="end">
                {label.toFixed(1)}
              </text>
            )}
          </g>
        );
      })}
      {values.length > 0 && (
        <>
          <path d={r.area} fill={`url(#${gid})`} stroke="none" />
          <path d={r.path} fill="none" stroke={color} strokeWidth={2.2} />
        </>
      )}
      {idxs.map((i) => {
        const x = pad + i * ((width - pad * 2) / Math.max(times.length - 1, 1));
        return (
          <text key={i} x={x} y={height - 8} fontSize={10} fill="var(--color-text-mute)" textAnchor="middle">
            {times[i] ?? ''}
          </text>
        );
      })}
      {values.length === 0 && (
        <text x={width / 2} y={height / 2} fontSize={13} fill="var(--color-text-mute)" textAnchor="middle">
          Sin datos todavía
        </text>
      )}
    </svg>
  );
}
