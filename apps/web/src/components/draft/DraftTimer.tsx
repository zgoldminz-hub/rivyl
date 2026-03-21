import { useEffect, useState } from "react";

interface Props {
  endsAt: number;
  isMyTurn: boolean;
}

export default function DraftTimer({ endsAt, isMyTurn }: Props) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    function tick() {
      setSeconds(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    }
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [endsAt]);

  const pct = Math.min(100, (seconds / 90) * 100);
  const urgent = seconds <= 15;

  return (
    <div style={styles.root}>
      <div style={styles.label}>
        {isMyTurn ? <span style={{ color: urgent ? "var(--color-danger)" : "var(--color-success)", fontWeight: 700 }}>YOUR PICK</span> : "On the clock"}
        <span style={{ ...styles.time, color: urgent ? "var(--color-danger)" : "var(--color-text)" }}>{seconds}s</span>
      </div>
      <div style={styles.track}>
        <div style={{
          ...styles.bar,
          width: `${pct}%`,
          background: urgent ? "var(--color-danger)" : isMyTurn ? "var(--color-success)" : "var(--color-accent)",
          transition: "width 0.5s linear",
        }} />
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { display: "flex", flexDirection: "column", gap: "6px" },
  label: { display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: 500, color: "var(--color-text-muted)" },
  time: { fontSize: "20px", fontWeight: 700 },
  track: { height: "6px", background: "var(--color-surface-2)", borderRadius: "3px", overflow: "hidden" },
  bar: { height: "100%", borderRadius: "3px" },
};
