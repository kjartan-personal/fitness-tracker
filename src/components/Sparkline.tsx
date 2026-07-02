interface Props {
  values: number[];
  height?: number;
  color?: string;
  fill?: boolean;
}

/**
 * Compact responsive line chart. Uses a fixed viewBox with non-scaling
 * strokes so it stays crisp at any width. Renders a dot at the latest point.
 */
export default function Sparkline({
  values,
  height = 56,
  color = "var(--accent)",
  fill = true,
}: Props) {
  const W = 100;
  const H = height;
  const pad = 6;

  if (values.length === 0) {
    return <div className="muted" style={{ fontSize: 13 }}>No data yet.</div>;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const n = values.length;

  const x = (i: number) => (n === 1 ? W / 2 : pad + (i / (n - 1)) * (W - 2 * pad));
  const y = (v: number) => pad + (1 - (v - min) / span) * (H - 2 * pad);

  const pts = values.map((v, i) => [x(i), y(v)] as const);
  const line = pts.map(([px, py], i) => `${i === 0 ? "M" : "L"}${px.toFixed(2)} ${py.toFixed(2)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(2)} ${H - pad} L${pts[0][0].toFixed(2)} ${H - pad} Z`;
  const [lastX, lastY] = pts[pts.length - 1];

  return (
    <svg
      width="100%"
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ display: "block", overflow: "visible" }}
    >
      {fill && n > 1 && <path d={area} fill={color} opacity={0.12} />}
      {n > 1 && (
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
      <circle cx={lastX} cy={lastY} r={2.6} fill={color} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
