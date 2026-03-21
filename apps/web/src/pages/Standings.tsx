import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { api } from "../api/client";
import { useAuth } from "../store/auth";

interface StandingsEntry {
  teamId: string;
  teamName: string;
  userId: string;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
}

interface Matchup {
  id: string;
  week: number;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  isPlayoff: boolean;
  homeTeam: { id: string; name: string };
  awayTeam: { id: string; name: string };
}

export default function Standings() {
  const { id: leagueId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [standings, setStandings] = useState<StandingsEntry[]>([]);
  const [matchups, setMatchups] = useState<Matchup[]>([]);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [leagueName, setLeagueName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!leagueId) return;
    Promise.all([
      api.get<{ standings: StandingsEntry[]; currentWeek: number }>(`/season/${leagueId}/standings`),
      api.get<{ leagues: any[] }>("/leagues/mine"),
    ]).then(([standRes, leagueRes]) => {
      if (standRes.ok) {
        setStandings(standRes.data.standings);
        setCurrentWeek(standRes.data.currentWeek);
        setSelectedWeek(standRes.data.currentWeek);
      }
      if (leagueRes.ok) {
        const league = leagueRes.data.leagues.find((l: any) => l.id === leagueId);
        if (league) setLeagueName(league.name);
      }
      setLoading(false);
    });
  }, [leagueId]);

  useEffect(() => {
    if (!leagueId || !selectedWeek) return;
    api.get<{ matchups: Matchup[] }>(`/season/${leagueId}/matchups/${selectedWeek}`)
      .then((res) => { if (res.ok) setMatchups(res.data.matchups); });
  }, [leagueId, selectedWeek]);

  const playoffLine = 4;

  return (
    <div style={styles.root}>
      <Navbar />
      <main style={styles.main}>
        <div style={styles.backRow}>
          <button style={styles.back} onClick={() => navigate(`/leagues/${leagueId}`)}>← {leagueName}</button>
        </div>

        <div style={styles.layout}>
          {/* Standings table */}
          <div style={styles.standingsSection}>
            <h2 style={styles.sectionTitle}>Standings</h2>
            {loading ? <p style={styles.muted}>Loading…</p> : (
              <div style={styles.table}>
                <div style={styles.tableHeader}>
                  <span style={styles.rank}>#</span>
                  <span style={{ flex: 1 }}>Team</span>
                  <span style={styles.stat}>W</span>
                  <span style={styles.stat}>L</span>
                  <span style={styles.stat}>PF</span>
                  <span style={styles.stat}>PA</span>
                </div>
                {standings.map((entry, i) => {
                  const isPlayoffLine = i === playoffLine - 1 && i !== standings.length - 1;
                  const inPlayoffs = i < playoffLine;
                  return (
                    <div key={entry.teamId}>
                      <div style={{ ...styles.tableRow, ...(inPlayoffs ? styles.playoffRow : {}) }}>
                        <span style={{ ...styles.rank, color: inPlayoffs ? "var(--color-success)" : "var(--color-text-muted)" }}>
                          {i + 1}
                        </span>
                        <span style={{ flex: 1, fontSize: "14px", fontWeight: 500 }}>{entry.teamName}</span>
                        <span style={styles.stat}>{entry.wins}</span>
                        <span style={styles.stat}>{entry.losses}</span>
                        <span style={styles.stat}>{entry.pointsFor.toFixed(1)}</span>
                        <span style={styles.stat}>{entry.pointsAgainst.toFixed(1)}</span>
                      </div>
                      {isPlayoffLine && (
                        <div style={styles.playoffDivider}>
                          <span>Playoff line</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Weekly matchups */}
          <div style={styles.matchupsSection}>
            <div style={styles.weekHeader}>
              <h2 style={styles.sectionTitle}>Matchups</h2>
              <div style={styles.weekNav}>
                <button style={styles.weekBtn} onClick={() => setSelectedWeek((w) => Math.max(1, w - 1))}>‹</button>
                <span style={styles.weekLabel}>Week {selectedWeek}</span>
                <button style={styles.weekBtn} onClick={() => setSelectedWeek((w) => Math.min(17, w + 1))}>›</button>
              </div>
            </div>

            <div style={styles.matchupsList}>
              {matchups.length === 0 ? (
                <p style={styles.muted}>No matchups for this week yet.</p>
              ) : matchups.map((m) => (
                <div
                  key={m.id}
                  style={styles.matchupCard}
                  onClick={() => navigate(`/leagues/${leagueId}/matchup/${m.id}`)}
                  role="button"
                  tabIndex={0}
                >
                  {m.isPlayoff && <span style={styles.playoffBadge}>Playoff</span>}
                  <div style={styles.matchupTeams}>
                    <div style={styles.matchupTeam}>
                      <span style={styles.teamName}>{m.homeTeam.name}</span>
                      <span style={{
                        ...styles.score,
                        color: m.homeScore > m.awayScore && (m.homeScore > 0 || m.awayScore > 0) ? "var(--color-success)" : "var(--color-text)",
                      }}>{m.homeScore.toFixed(1)}</span>
                    </div>
                    <span style={styles.vs}>vs</span>
                    <div style={{ ...styles.matchupTeam, textAlign: "right" }}>
                      <span style={styles.teamName}>{m.awayTeam.name}</span>
                      <span style={{
                        ...styles.score,
                        color: m.awayScore > m.homeScore && (m.homeScore > 0 || m.awayScore > 0) ? "var(--color-success)" : "var(--color-text)",
                      }}>{m.awayScore.toFixed(1)}</span>
                    </div>
                  </div>
                  {(m.homeScore === 0 && m.awayScore === 0) && (
                    <p style={styles.upcoming}>
                      {selectedWeek > currentWeek ? "Upcoming" : selectedWeek === currentWeek ? "In Progress" : "Final"}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <button style={styles.myTeamBtn} onClick={() => navigate(`/leagues/${leagueId}/my-team`)}>
              My Team & Lineup →
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { minHeight: "100vh", background: "var(--color-bg)" },
  main: { maxWidth: "1060px", margin: "0 auto", padding: "32px 24px" },
  backRow: { marginBottom: "24px" },
  back: { background: "none", border: "none", color: "var(--color-text-muted)", fontSize: "13px", cursor: "pointer", padding: 0 },
  layout: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" },
  standingsSection: { display: "flex", flexDirection: "column", gap: "16px" },
  matchupsSection: { display: "flex", flexDirection: "column", gap: "16px" },
  sectionTitle: { fontSize: "16px", fontWeight: 700 },
  muted: { fontSize: "14px", color: "var(--color-text-muted)" },
  table: { background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius)", overflow: "hidden" },
  tableHeader: {
    display: "flex", alignItems: "center", padding: "10px 16px",
    borderBottom: "1px solid var(--color-border)", fontSize: "11px",
    fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.5px",
  },
  tableRow: { display: "flex", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid var(--color-border)" },
  playoffRow: { background: "rgba(34,197,94,0.04)" },
  rank: { width: "24px", fontSize: "13px", fontWeight: 700 },
  stat: { width: "48px", textAlign: "right", fontSize: "13px", color: "var(--color-text-muted)" },
  playoffDivider: {
    display: "flex", alignItems: "center", gap: "8px", padding: "4px 16px",
    fontSize: "10px", color: "var(--color-success)", background: "rgba(34,197,94,0.06)",
    borderBottom: "1px dashed rgba(34,197,94,0.3)",
  },
  weekHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  weekNav: { display: "flex", alignItems: "center", gap: "12px" },
  weekBtn: { background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "6px", color: "var(--color-text)", width: "28px", height: "28px", cursor: "pointer", fontSize: "16px", display: "flex", alignItems: "center", justifyContent: "center" },
  weekLabel: { fontSize: "14px", fontWeight: 600, minWidth: "60px", textAlign: "center" },
  matchupsList: { display: "flex", flexDirection: "column", gap: "10px" },
  matchupCard: {
    background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius)",
    padding: "16px", cursor: "pointer", transition: "border-color 0.15s", position: "relative",
  },
  playoffBadge: { position: "absolute", top: "10px", right: "12px", fontSize: "10px", fontWeight: 600, background: "rgba(245,158,11,0.15)", color: "#f59e0b", padding: "2px 8px", borderRadius: "999px" },
  matchupTeams: { display: "flex", alignItems: "center", gap: "12px" },
  matchupTeam: { flex: 1, display: "flex", flexDirection: "column", gap: "4px" },
  teamName: { fontSize: "14px", fontWeight: 600 },
  score: { fontSize: "22px", fontWeight: 800 },
  vs: { fontSize: "12px", color: "var(--color-text-muted)", fontWeight: 500 },
  upcoming: { fontSize: "11px", color: "var(--color-text-muted)", textAlign: "center", marginTop: "8px" },
  myTeamBtn: {
    marginTop: "8px", padding: "11px", background: "var(--color-surface-2)", border: "1px solid var(--color-border)",
    borderRadius: "var(--radius)", color: "var(--color-accent)", fontSize: "14px", fontWeight: 600,
    cursor: "pointer", fontFamily: "var(--font)", textAlign: "center",
  },
};
