// Tiny inline sparkline for tabular use. No axes, no labels — just
// a thin line that traces the value sequence so users can spot a
// trend at a glance. Width / height in pixels (default 56 × 16).

export function Sparkline({
  values,
  width = 56,
  height = 16,
  stroke = "var(--accent)",
}: {
  values: number[];
  width?: number;
  height?: number;
  stroke?: string;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);
  const path = values
    .map((v, i) => {
      const x = (i * stepX).toFixed(1);
      const y = (height - ((v - min) / range) * height).toFixed(1);
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");
  // Highlight the latest value as a dot.
  const lastX = ((values.length - 1) * stepX).toFixed(1);
  const lastY = (
    height - ((values[values.length - 1] - min) / range) * height
  ).toFixed(1);
  // Tone the stroke based on first→last direction.
  const direction =
    values[values.length - 1] > values[0]
      ? "var(--positive)"
      : values[values.length - 1] < values[0]
      ? "var(--negative)"
      : stroke;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Revenue trend"
      className="inline-block align-middle"
    >
      <path d={path} fill="none" stroke={direction} strokeWidth="1.25" />
      <circle cx={lastX} cy={lastY} r="1.5" fill={direction} />
    </svg>
  );
}
