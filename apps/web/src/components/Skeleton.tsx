interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  style?: React.CSSProperties;
}

export function Skeleton({ width = "100%", height = "16px", borderRadius = "6px", style }: SkeletonProps) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        background: "linear-gradient(90deg, var(--color-surface-2) 25%, var(--color-border) 50%, var(--color-surface-2) 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.4s infinite",
        ...style,
      }}
    />
  );
}

export function SkeletonText({ lines = 3, gap = "10px" }: { lines?: number; gap?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? "60%" : "100%"} />
      ))}
    </div>
  );
}

export function SkeletonCard({ style }: { style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "var(--color-surface)",
      border: "1px solid var(--color-border)",
      borderRadius: "var(--radius)",
      padding: "20px",
      display: "flex",
      flexDirection: "column",
      gap: "14px",
      ...style,
    }}>
      <Skeleton width="40%" height="14px" />
      <Skeleton height="12px" />
      <Skeleton height="12px" />
      <Skeleton width="70%" height="12px" />
    </div>
  );
}

// Inject shimmer keyframes once
if (typeof document !== "undefined" && !document.getElementById("skeleton-style")) {
  const style = document.createElement("style");
  style.id = "skeleton-style";
  style.textContent = `@keyframes shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }`;
  document.head.appendChild(style);
}
