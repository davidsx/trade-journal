interface ScoreBadgeProps {
  score: number | null;
  size?: "sm" | "md" | "lg";
}

function scoreColor(score: number): string {
  if (score >= 90) return "#15803d"; // green-700
  if (score >= 80) return "#16a34a"; // green-600
  if (score >= 70) return "#22c55e"; // green-500
  if (score >= 60) return "#84cc16"; // lime-500
  if (score >= 50) return "#eab308"; // yellow-500
  if (score >= 40) return "#f59e0b"; // amber-500
  if (score >= 30) return "#fb923c"; // orange-400
  if (score >= 20) return "#f97316"; // orange-500
  if (score >= 10) return "#ef4444"; // red-500
  return "#dc2626";                  // red-600
}

export default function ScoreBadge({ score, size = "md" }: ScoreBadgeProps) {
  if (score === null) {
    return (
      <span
        className="inline-flex items-center justify-center rounded-full text-xs font-medium"
        style={{
          width: size === "lg" ? 48 : size === "sm" ? 28 : 36,
          height: size === "lg" ? 48 : size === "sm" ? 28 : 36,
          background: "var(--bg-border)",
          color: "var(--text-muted)",
        }}
      >
        —
      </span>
    );
  }

  const color = scoreColor(score);
  const dim = size === "lg" ? 48 : size === "sm" ? 28 : 36;
  const fontSize = size === "lg" ? 14 : size === "sm" ? 10 : 12;

  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-semibold tabular-nums"
      style={{
        width: dim,
        height: dim,
        fontSize,
        background: `${color}22`,
        color,
        border: `1.5px solid ${color}`,
      }}
    >
      {score}
    </span>
  );
}
