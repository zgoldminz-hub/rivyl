import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { api } from "../api/client";

interface BracketMatchup {
  id: string;
  week: number;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  homeTeam: { id: string; name: string };
  awayTeam: { id: string; name: string };
}

export default function PlayoffBracket() {
  const { id: leagueId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [bracket, setBracket] = useState<BracketMatchup[]>([]);
  const [seeds, setSeeds] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!leagueId) return;
    api.get<{ bracket: BracketMatchup[]; seeds: Record<string, number> }>(`/season/${leagueId}/bracket`)
      .then((res) => {
        if (res.ok) {
          setBracket(res.data.bracket);
          setSeeds(res.data.seeds);
        }
        setLoading(false);
      });
  }, [leagueId]);

  const week15 = bracket.filter((m) => m.week === 15);
  const week16 = bracket.filter((m) => m.week === 16);
  const week17 = bracket.filter((m) => m.week === 17);

  const championship16 = week16[0] ?? null;
  const consolation16 = week16[1] ?? null;
  const championship17 = week17[0] ?? null;

  return (
    <div style={styles.root}>
      <Navbar />
      <main style={styles.main}>
        <button style={styles.back} onClick={() => navigate(`/leagues/${leagueId}/standings`)}>← Standings</button>
        <h1 style={styles.title}>Playoff Bracket</h1>

        {loading ? (
          <p style={styles.muted}>Loading…</p>
        ) : bracket.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={styles.emptyTitle}>Playoffs start after Week 14</p>
            <p style={styles.muted}>Top 4 teams qualify. The bracket will appear here once the regular season ends.</p>
          </div>
        ) : (
          <div style={styles.bracketGrid}>
            {/* Week 15 — Semifinals */}
            <div style={styles.roundCol}>
              <p style={styles.roundLabel}>Semifinals (Week 15)</p>
              {week15.map((m) => (
                <BracketCard key={m.id} matchup={m} seeds={seeds} onClick={() => navigate(`/leagues/${leagueId}/matchup/${m.id}`)} />
              ))}
            </div>

            {/* Week 16 */}
            <div style={styles.roundCol}>
              <p style={styles.roundLabel}>Championship (Week 16)</p>
              {championship16 && (
                <BracketCard matchup={championship16} seeds={seeds} highlight onClick={() => navigate(`/leagues/${leagueId}/matchup/${championship16.id}`)} />
              )}
              {consolation16 && (
                <>
                  <p style={{ ...styles.roundLabel, marginTop: "24px", color: "var(--color-text-muted)" }}>Consolation</p>
                  <BracketCard matchup={consolation16} seeds={seeds} onClick={() => navigate(`/leagues/${leagueId}/matchup/${consolation16.id}`)} />
                </>
              )}
            </div>

            {/* Week 17 — Final */}
            <div style={styles.roundCol}>
              <p style={styles.roundLabel}>🏆 Championship (Week 17)</p>
              {championship17 ? (
                <BracketCard matchup={championship17} seeds={seeds} highlight championship onClick={() => navigate(`/leagues/${leagueId}/matchup/${championship17.id}`)} />
              ) : (
                <div style={styles.tbd}>
                  <p style={styles.tbdText}>TBD</p>
                  <p style={styles.muted}>Winner determined after Week 16</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function BracketCard({ matchup, seeds, onClick, highlight, championship }: {
  matchup: BracketMatchup;
  seeds: Record<string, number>;
  onClick: () => void;
  highlight?: boolean;
  championship?: boolean;
}) {
  const homeWon = matchup.homeScore > matchup.awayScore && matchup.homeScore > 0;
  const awayWon = matchup.awayScore > matchup.homeScore && matchup.awayScore > 0;
  const hasScore = matchup.homeScore > 0 || matchup.awayScore > 0;

  return (
    <div
      style={{
        ...styles.card,
        ...(highlight ? styles.highlightCard : {}),
        ...(championship ? styles.championshipCard : {}),
      }}
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      {championship && <p style={styles.champLabel}>CHAMPIONSHIP</p>}
      <BracketTeam name={matchup.homeTeam.name} seed={seeds[matchup.homeTeamId]} score={matchup.homeScore} won={homeWon} hasScore={hasScore} />
      <div style={styles.cardDivider} />
      <BracketTeam name={matchup.awayTeam.name} seed={seeds[matchup.awayTeamId]} score={matchup.awayScore} won={awayWon} hasScore={hasScore} />
    </div>
  );
}

function BracketTeam({ name, seed, score, won, hasScore }: {
  name: string;
  seed: number;
  score: number;
  won: boolean;
  hasScore: boolean;
}) {
  return (
    <div style={styles.bracketTeam}>
      <span style={styles.seedBadge}>{seed}</span>
      <span style={{ ...styles.bracketTeamName, fontWeight: won ? 700 : 400 }}>{name}</span>
      <span style={{ ...styles.bracketScore, color: won ? "var(--color-success)" : "var(--color-text)" }}>
        {hasScore ? score.toFixed(1) : "—"}
      </span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { minHeight: "100vh", background: "var(--color-bg)" },
  main: { maxWidth: "1060px", margin: "0 auto", padding: "32px 24px", display: "flex", flexDirection: "column", gap: "28px" },
  back: { background: "none", border: "none", color: "var(--color-text-muted)", fontSize: "13px", cursor: "pointer", padding: 0, alignSelf: "flex-start" },
  title: { fontSize: "24px", fontWeight: 700 },
  muted: { fontSize: "14px", color: "var(--color-text-muted)" },
  emptyState: { display: "flex", flexDirection: "column", gap: "8px", padding: "40px 0" },
  emptyTitle: { fontSize: "16px", fontWeight: 600 },
  bracketGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "32px", alignItems: "start" },
  roundCol: { display: "flex", flexDirection: "column", gap: "16px" },
  roundLabel: { fontSize: "12px", fontWeight: 700, color: "var(--color-accent)", textTransform: "uppercase", letterSpacing: "0.5px" },
  card: {
    background: "var(--color-surface)", border: "1px solid var(--color-border)",
    borderRadius: "var(--radius)", overflow: "hidden", cursor: "pointer", transition: "border-color 0.15s",
  },
  highlightCard: { borderColor: "rgba(79,124,255,0.4)" },
  championshipCard: { borderColor: "#f59e0b", boxShadow: "0 0 0 1px rgba(245,158,11,0.3)" },
  champLabel: { fontSize: "10px", fontWeight: 700, color: "#f59e0b", textAlign: "center", padding: "6px", background: "rgba(245,158,11,0.1)", letterSpacing: "1px" },
  bracketTeam: { display: "flex", alignItems: "center", gap: "10px", padding: "12px 16px" },
  cardDivider: { height: "1px", background: "var(--color-border)", margin: "0 16px" },
  seedBadge: { fontSize: "10px", fontWeight: 700, background: "var(--color-surface-2)", color: "var(--color-text-muted)", width: "20px", height: "20px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" },
  bracketTeamName: { flex: 1, fontSize: "14px" },
  bracketScore: { fontSize: "16px", fontWeight: 700 },
  tbd: { background: "var(--color-surface)", border: "1px dashed var(--color-border)", borderRadius: "var(--radius)", padding: "24px", textAlign: "center", display: "flex", flexDirection: "column", gap: "8px" },
  tbdText: { fontSize: "18px", fontWeight: 700, color: "var(--color-text-muted)" },
};
