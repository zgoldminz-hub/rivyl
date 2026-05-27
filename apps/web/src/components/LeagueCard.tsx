import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { League } from "../store/leagues";

interface Props {
  league: League;
  showJoin?: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  SETUP: "Open",
  DRAFTING: "Drafting",
  ACTIVE: "In Season",
  PLAYOFFS: "Playoffs",
  COMPLETE: "Complete",
};

const STATUS_COLOR: Record<string, string> = {
  SETUP: "var(--color-crimson)",
  DRAFTING: "var(--color-accent)",
  ACTIVE: "var(--color-accent)",
  PLAYOFFS: "#f59e0b",
  COMPLETE: "var(--color-text-muted)",
};

export default function LeagueCard({ league, showJoin }: Props) {
  const navigate = useNavigate();

  return (
    <div
      style={styles.card}
      onClick={() => navigate(`/leagues/${league.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && navigate(`/leagues/${league.id}`)}
    >
      <div style={styles.top}>
        <span style={styles.name}>{league.name}</span>
        <span style={{ ...styles.statusBadge, background: STATUS_COLOR[league.status] + "22", color: STATUS_COLOR[league.status] }}>
          {STATUS_LABEL[league.status]}
        </span>
      </div>

      {league.isCommissioner && (
        <div style={styles.commBadge}>Commissioner</div>
      )}

      <div style={styles.meta}>
        <MetaItem label="Buy-in" value={`$${league.buyIn}`} highlight />
        <MetaItem label="Teams" value={`${league.memberCount}/${league.maxTeams}`} />
        <MetaItem label="Scoring" value={league.scoringType === "FULL_PPR" ? "Full PPR" : "Half PPR"} />
        <MetaItem label="Draft" value={league.draftType === "SNAKE" ? "Snake" : "Auction"} />
      </div>

      {showJoin && league.status === "SETUP" && league.memberCount < league.maxTeams && (
        <div style={styles.joinHint}>Tap to view &amp; join →</div>
      )}

      {league.draftStartsAt && (
        <DraftDateRow draftStartsAt={league.draftStartsAt} />
      )}
    </div>
  );
}

function DraftDateRow({ draftStartsAt }: { draftStartsAt: string }) {
  const [label, setLabel] = useState("");

  useEffect(() => {
    function tick() {
      const diff = new Date(draftStartsAt).getTime() - Date.now();
      if (diff <= 0) { setLabel("Starting now!"); return; }
      const d = Math.floor(diff / 86_400_000);
      const h = Math.floor((diff % 86_400_000) / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      setLabel(d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`);
    }
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [draftStartsAt]);

  const dateStr = new Date(draftStartsAt).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });

  return (
    <div style={styles.draftDateRow}>
      <div>
        <p style={styles.draftDateLabel}>Draft Date</p>
        <p style={styles.draftDateValue}>{dateStr}</p>
      </div>
      {label && <span style={styles.countdownPill}>● {label}</span>}
    </div>
  );
}

function MetaItem({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={styles.metaItem}>
      <span style={styles.metaLabel}>{label}</span>
      <span style={{ ...styles.metaValue, ...(highlight ? { color: "var(--color-success)", fontWeight: 600 } : {}) }}>
        {value}
      </span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    border: "1px solid transparent",
    background: "linear-gradient(var(--color-surface), var(--color-surface)) padding-box, linear-gradient(135deg, var(--color-accent), var(--color-crimson)) border-box",
    borderRadius: "var(--radius)",
    padding: "18px 20px",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  top: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" },
  name: { fontSize: "16px", fontWeight: 600, color: "var(--color-text)" },
  statusBadge: {
    fontSize: "11px", fontWeight: 700, padding: "3px 10px",
    borderRadius: "999px", textTransform: "uppercase", letterSpacing: "0.5px", flexShrink: 0,
  },
  commBadge: {
    display: "inline-block", alignSelf: "flex-start",
    fontSize: "10px", fontWeight: 600,
    background: "rgba(30,75,216,0.15)", color: "var(--color-accent)",
    padding: "3px 10px", borderRadius: "999px",
    textTransform: "uppercase", letterSpacing: "0.5px",
    marginTop: "-4px",
  },
  meta: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" },
  metaItem: { display: "flex", flexDirection: "column", gap: "2px" },
  metaLabel: { fontSize: "11px", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" },
  metaValue: { fontSize: "14px", color: "var(--color-text)" },
  joinHint: { fontSize: "12px", color: "var(--color-accent)" },
  draftDateRow: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "12px",
  },
  draftDateLabel: { fontSize: "10px", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "2px" },
  draftDateValue: { fontSize: "14px", fontWeight: 600 },
  countdownPill: {
    fontSize: "11px", fontWeight: 700,
    background: "rgba(30,75,216,0.15)", color: "var(--color-accent)",
    padding: "4px 10px", borderRadius: "999px",
  },
};
