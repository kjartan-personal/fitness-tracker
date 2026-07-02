interface Props {
  grams: number;
  target: number;
  size?: number;
}

export default function ProteinRing({ grams, target, size = 88 }: Props) {
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = target > 0 ? Math.min(1, grams / target) : 0;
  const dash = c * pct;
  const hit = grams >= target && target > 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--surface-2)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={hit ? "var(--good)" : "var(--accent)"}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dasharray 0.4s ease" }}
      />
      <text
        x="50%"
        y="47%"
        textAnchor="middle"
        fontSize="20"
        fontWeight="800"
        fill="var(--text)"
      >
        {Math.round(grams)}
      </text>
      <text
        x="50%"
        y="63%"
        textAnchor="middle"
        fontSize="11"
        fill="var(--text-dim)"
      >
        / {Math.round(target)}g
      </text>
    </svg>
  );
}
