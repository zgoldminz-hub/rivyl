import React from "react";
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
  SETUP: "var(--color-success)",
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
        <span style={{ ...styles.status, color: STATUS_COLOR[league.status] }}>
          {STATUS_LABEL[league.status]}
        </span>
      </div>

      <div style={styles.meta}>
        <MetaItem label="Buy-in" value={`$${league.buyIn}`} highlight />
        <MetaItem label="Teams" value={`${league.memberCount}/${league.maxTeams}`} />
        <MetaItem label="Scoring" value={league.scoringType === "FULL_PPR" ? "Full PPR" : "Half PPR"} />
        <MetaItem label="Draft" value={league.draftType === "SNAKE" ? "Snake" : "Auction"} />
      </div>

      {showJoin && league.status === "SETUP" && league.memberCount < league.maxTeams && (
        <div style={styles.joinHint}>Tap to view &amp; join →</div>
      )}

      {league.isCommissioner && (
        <div style={styles.badge}>Commissioner</div>
      )}
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
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius)",
    padding: "18px 20px",
    cursor: "pointer",
    transition: "border-color 0.15s",
    position: "relative",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  top: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "8px",
  },
  name: {
    fontSize: "16px",
    fontWeight: 600,
    color: "var(--color-text)",
  },
  status: {
    fontSize: "12px",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  meta: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
  },
  metaItem: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  metaLabel: {
    fontSize: "11px",
    color: "var(--color-text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  metaValue: {
    fontSize: "14px",
    color: "var(--color-text)",
  },
  joinHint: {
    fontSize: "12px",
    color: "var(--color-accent)",
  },
  badge: {
    position: "absolute",
    top: "12px",
    right: "12px",
    fontSize: "10px",
    fontWeight: 600,
    background: "rgba(79,124,255,0.15)",
    color: "var(--color-accent)",
    padding: "3px 8px",
    borderRadius: "999px",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
};
