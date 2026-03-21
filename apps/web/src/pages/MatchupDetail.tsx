import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { api } from "../api/client";

interface RosterSlotDetail {
  id: string;
  playerId: string;
  slot: string;
  points: number;
}

interface TeamDetail {
  id: string;
  name: string;
  user: { username: string };
  rosterSlots: RosterSlotDetail[];
}

interface MatchupDetail {
  id: string;
  week: number;
  homeScore: number;
  awayScore: number;
  isPlayoff: boolean;
  homeTeam: TeamDetail;
  awayTeam: TeamDetail;
}

const STARTER_ORDER = ["QB", "RB", "WR", "TE", "FLEX", "K", "DEF"];
const POS_COLORS: Record<string, string> = {
  QB: "#f59e0b", RB: "#22c55e", WR: "#4f7cff", TE: "#a78bfa", K: "#6b7280", DEF: "#ef4444", FLEX: "#22c55e",
};

export default function MatchupDetail() {
  const { id: leagueId, matchupId } = useParams<{ id: string; matchupId: string }>();
  const navigate = useNavigate();
  const [matchup, setMatchup] = useState<MatchupDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!leagueId || !matchupId) return;
    api.get<{ matchup: MatchupDetail }>(`/season/${leagueId}/matchup/${matchupId}`)
      .then((res) => {
        if (res.ok) setMatchup(res.data.matchup);
        setLoading(false);
      });
  }, [leagueId, matchupId]);

  if (loading || !matchup) {
    return <div style={styles.root}><Navbar /><p style={styles.center}>Loading…</p></div>;
  }

  const homeWinning = matchup.homeScore >= matchup.awayScore;

  function sortedStarters(slots: RosterSlotDetail[]) {
    return slots
      .filter((s) => s.slot !== "BENCH")
      .sort((a, b) => STARTER_ORDER.indexOf(a.slot) - STARTER_ORDER.indexOf(b.slot));
  }

  function benchSlots(slots: RosterSlotDetail[]) {
    return slots.filter((s) => s.slot === "BENCH");
  }

  return (
    <div style={styles.root}>
      <Navbar />
      <main style={styles.main}>
        <button style={styles.back} onClick={() => navigate(`/leagues/${leagueId}/standings`)}>← Standings</button>

        {/* Score header */}
        <div style={styles.scoreHeader}>
          {matchup.isPlayoff && <span style={styles.playoffBadge}>Playoff — Week {matchup.week}</span>}

          <div style={styles.scoreRow}>
            <div style={{ ...styles.teamScore, alignItems: "flex-start" }}>
              <span style={styles.teamName}>{matchup.homeTeam.name}</span>
              <span style={styles.username}>@{matchup.homeTeam.user.username}</span>
              <span style={{ ...styles.bigScore, color: homeWinning ? "var(--color-success)" : "var(--color-text)" }}>
                {matchup.homeScore.toFixed(2)}
              </span>
            </div>
            <div style={styles.vs}>
              <span>vs</span>
              {matchup.homeScore > 0 || matchup.awayScore > 0 ? (
                <span style={styles.resultLabel}>{homeWinning ? `${matchup.homeTeam.name} wins` : `${matchup.awayTeam.name} wins`}</span>
              ) : (
                <span style={styles.resultLabel}>Week {matchup.week}</span>
              )}
            </div>
            <div style={{ ...styles.teamScore, alignItems: "flex-end" }}>
              <span style={styles.teamName}>{matchup.awayTeam.name}</span>
              <span style={styles.username}>@{matchup.awayTeam.user.username}</span>
              <span style={{ ...styles.bigScore, color: !homeWinning ? "var(--color-success)" : "var(--color-text)" }}>
                {matchup.awayScore.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Side-by-side rosters */}
        <div style={styles.rostersGrid}>
          <RosterTable label="Starters" slots={sortedStarters(matchup.homeTeam.rosterSlots)} align="left" />
          <RosterTable label="Starters" slots={sortedStarters(matchup.awayTeam.rosterSlots)} align="right" />
        </div>
        <div style={styles.rostersGrid}>
          <RosterTable label="Bench" slots={benchSlots(matchup.homeTeam.rosterSlots)} align="left" muted />
          <RosterTable label="Bench" slots={benchSlots(matchup.awayTeam.rosterSlots)} align="right" muted />
        </div>
      </main>
    </div>
  );
}

function RosterTable({ label, slots, align, muted }: {
  label: string;
  slots: RosterSlotDetail[];
  align: "left" | "right";
  muted?: boolean;
}) {
  return (
    <div style={{ opacity: muted ? 0.6 : 1 }}>
      <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px", textAlign: align }}>
        {label}
      </p>
      {slots.map((s) => (
        <div key={s.id} style={{ ...styles.rosterRow, flexDirection: align === "right" ? "row-reverse" : "row" }}>
          <span style={{ ...styles.slotBadge, background: `${POS_COLORS[s.slot] ?? "#374151"}20`, color: POS_COLORS[s.slot] ?? "#6b7280" }}>
            {s.slot}
          </span>
          <span style={{ flex: 1, fontSize: "13px", fontWeight: 500, textAlign: align }}>{s.playerId}</span>
          <span style={{ fontSize: "14px", fontWeight: 700, color: s.points > 0 ? "var(--color-text)" : "var(--color-text-muted)" }}>
            {s.points.toFixed(1)}
          </span>
        </div>
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { minHeight: "100vh", background: "var(--color-bg)" },
  main: { maxWidth: "960px", margin: "0 auto", padding: "32px 24px", display: "flex", flexDirection: "column", gap: "24px" },
  center: { padding: "40px", textAlign: "center", color: "var(--color-text-muted)" },
  back: { background: "none", border: "none", color: "var(--color-text-muted)", fontSize: "13px", cursor: "pointer", padding: 0, alignSelf: "flex-start" },
  scoreHeader: {
    background: "var(--color-surface)", border: "1px solid var(--color-border)",
    borderRadius: "var(--radius)", padding: "28px 32px", display: "flex", flexDirection: "column", gap: "16px",
  },
  playoffBadge: { alignSelf: "flex-start", fontSize: "11px", fontWeight: 600, background: "rgba(245,158,11,0.15)", color: "#f59e0b", padding: "3px 10px", borderRadius: "999px" },
  scoreRow: { display: "flex", alignItems: "center", gap: "16px" },
  teamScore: { flex: 1, display: "flex", flexDirection: "column", gap: "4px" },
  teamName: { fontSize: "17px", fontWeight: 700 },
  username: { fontSize: "12px", color: "var(--color-text-muted)" },
  bigScore: { fontSize: "40px", fontWeight: 800, lineHeight: 1 },
  vs: { display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", color: "var(--color-text-muted)", fontSize: "13px" },
  resultLabel: { fontSize: "11px", color: "var(--color-text-muted)", textAlign: "center" },
  rostersGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" },
  rosterRow: { display: "flex", alignItems: "center", gap: "10px", padding: "8px 0", borderBottom: "1px solid var(--color-border)" },
  slotBadge: { fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: "4px", minWidth: "38px", textAlign: "center" },
};
