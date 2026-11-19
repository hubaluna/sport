interface SparklineProps {
  values: number[];
  label: string;
  unit?: string;
}

export function Sparkline({values, label, unit = ''}: SparklineProps) {
  if (!values.length) {
    return <p className="text-xs text-[#9FA995]">{label}: ще немає контрольних результатів.</p>;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const points = values
    .map((n, i) => {
      const x = 10 + (i * 280) / Math.max(1, values.length - 1);
      const y = 65 - ((n - min) * 50) / Math.max(1, max - min);
      return {x, y};
    });
  const poly = points.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2 text-xs text-[#9FA995]">
        <span>{label}</span>
        <span className="font-mono tabular-nums text-[#F2F6EB]">
          {values.join(' → ')}
          {unit ? ` ${unit}` : ''}
        </span>
      </div>
      <svg
        role="img"
        aria-label={`${label}: ${values.join(', ')}`}
        viewBox="0 0 300 80"
        className="w-full h-20 overflow-visible"
      >
        <polyline
          fill="none"
          stroke="#CEFA42"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={poly}
        />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="4" fill="#CEFA42" />
        ))}
      </svg>
    </div>
  );
}
