import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import LeagueCard from "../components/LeagueCard";
import { useLeagues, League } from "../store/leagues";
import { useScores } from "../store/scores";
import { api } from "../api/client";

interface StandingsEntry {
  teamId: string;
  teamName: string;
  wins: number;
  losses: number;
  pointsFor: number;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { myLeagues, loadingMine, fetchMine } = useLeagues();
  const { liveScores, connect, disconnect } = useScores();
  const [standings, setStandings] = useState<Record<string, StandingsEntry[]>>({});

  useEffect(() => {
    fetchMine();
  }, []);

  useEffect(() => {
    const activeLeagues = myLeagues.filter(
      (l) => l.status === "ACTIVE" || l.status === "PLAYOFFS"
    );
    if (!activeLeagues.length) return;

    const token = localStorage.getItem("accessToken") ?? "";
    connect(activeLeagues.map((l) => l.id), token);

    for (const league of activeLeagues) {
      api
        .get<{ standings: StandingsEntry[] }>(`/season/${league.id}/standings`)
        .then((res) => {
          if (res.ok)
            setStandings((prev) => ({ ...prev, [league.id]: res.data.standings }));
        });
    }

    return () => disconnect();
  }, [myLeagues]);

  const upcomingDrafts = myLeagues.filter(
    (l) => (l.status === "SETUP" || l.status === "DRAFTING") && l.draftStartsAt
  );
  const liveLeagues = myLeagues.filter(
    (l) => (l.status === "ACTIVE" || l.status === "PLAYOFFS") && liveScores[l.id]
  );
  const hasActivity = upcomingDrafts.length > 0 || liveLeagues.length > 0;

  return (
    <div style={styles.root}>
      <Navbar />
      <main style={styles.main}>
        <div style={styles.headerRow}>
          <h1 style={styles.heading}>My Leagues</h1>
          {myLeagues.length > 0 && myLeagues.length < 5 && (
            <span style={styles.discoverHint} onClick={() => navigate("/discover")}>
              You're in {myLeagues.length} league{myLeagues.length !== 1 ? "s" : ""} — join more →
            </span>
          )}
        </div>

        {loadingMine ? (
          <p style={styles.muted}>Loading…</p>
        ) : myLeagues.length === 0 ? (
          <div style={styles.empty}>
            <p style={styles.emptyTitle}>No leagues yet</p>
            <p style={styles.muted}>
              Create a league or{" "}
              <span style={styles.link} onClick={() => navigate("/discover")}>
                browse public leagues
              </span>
              .
            </p>
          </div>
        ) : (
          <div style={styles.grid}>
            {myLeagues.map((l) => (
              <LeagueCard key={l.id} league={l} />
            ))}
          </div>
        )}

        {hasActivity && (
          <section style={styles.feed}>
            <p style={styles.feedTitle}>Activity</p>

            {upcomingDrafts.map((league) => (
              <DraftCountdown key={league.id} league={league} />
            ))}

            {liveLeagues.map((league) => {
              const scores = liveScores[league.id];
              const leagueStandings = standings[league.id] ?? [];
              const rankMap = new Map(leagueStandings.map((s, i) => [s.teamId, i + 1]));
              const myMatchup = scores.matchups.find(
                (m) => m.homeTeamId === league.teamId || m.awayTeamId === league.teamId
              );

              return (
                <div
                  key={league.id}
                  style={styles.feedCard}
                  onClick={() => navigate(`/leagues/${league.id}`)}
                >
                  <div style={styles.feedCardHeader}>
                    <span style={styles.feedLeagueName}>{league.name}</span>
                    <span style={styles.liveChip}>
                      <span style={styles.liveDot} />
                      LIVE · Wk {scores.week}
                    </span>
                  </div>

                  {myMatchup &&
                    (() => {
                      const imHome = myMatchup.homeTeamId === league.teamId;
                      const myScore = imHome ? myMatchup.homeScore : myMatchup.awayScore;
                      const oppScore = imHome ? myMatchup.awayScore : myMatchup.homeScore;
                      const myName = imHome ? myMatchup.homeTeamName : myMatchup.awayTeamName;
                      const oppName = imHome ? myMatchup.awayTeamName : myMatchup.homeTeamName;
                      const myTeamId = league.teamId ?? "";
                      const oppTeamId = imHome ? myMatchup.awayTeamId : myMatchup.homeTeamId;
                      const myRank = rankMap.get(myTeamId);
                      const oppRank = rankMap.get(oppTeamId);
                      const winning = myScore >= oppScore;

                      return (
                        <div style={styles.matchupRow}>
                          <div style={styles.matchupSide}>
                            {myRank && <span style={styles.rank}>#{myRank}</span>}
                            <span style={{ ...styles.teamLabel, color: "var(--color-text)" }}>
                              {myName}
                            </span>
                            <span style={{ ...styles.scoreNum, color: winning ? "var(--color-success)" : "var(--color-text)" }}>
                              {myScore.toFixed(1)}
                            </span>
                          </div>
                          <span style={styles.vsLabel}>vs</span>
                          <div style={styles.matchupSide}>
                            {oppRank && <span style={styles.rank}>#{oppRank}</span>}
                            <span style={styles.teamLabel}>{oppName}</span>
                            <span style={{ ...styles.scoreNum, color: !winning ? "var(--color-success)" : "var(--color-text)" }}>
                              {oppScore.toFixed(1)}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                </div>
              );
            })}
          </section>
        )}
      </main>
    </div>
  );
}

function DraftCountdown({ league }: { league: League }) {
  const navigate = useNavigate();
  const [label, setLabel] = useState("");

  useEffect(() => {
    function tick() {
      const diff = new Date(league.draftStartsAt!).getTime() - Date.now();
      if (diff <= 0) { setLabel("Starting now!"); return; }
      const d = Math.floor(diff / 86_400_000);
      const h = Math.floor((diff % 86_400_000) / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      setLabel(d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`);
    }
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, [league.draftStartsAt]);

  const urgent = new Date(league.draftStartsAt!).getTime() - Date.now() < 86_400_000;

  const mockParams = new URLSearchParams({
    numTeams: String(league.maxTeams),
    scoring: league.scoringType,
    draftType: league.draftType,
  });
  if (league.draftOrder != null) mockParams.set("userSlot", String(league.draftOrder));

  return (
    <div style={styles.feedCard} onClick={() => navigate(`/leagues/${league.id}`)}>
      <div style={styles.feedCardHeader}>
        <span style={styles.feedLeagueName}>{league.name}</span>
        <span style={{
          ...styles.chip,
          background: urgent ? "rgba(192,57,43,0.15)" : "rgba(30,75,216,0.15)",
          color: urgent ? "var(--color-crimson)" : "var(--color-accent)",
        }}>
          Draft in {label}
        </span>
      </div>
      <p style={styles.muted}>
        {new Date(league.draftStartsAt!).toLocaleDateString("en-US", {
          weekday: "short", month: "short", day: "numeric",
          hour: "numeric", minute: "2-digit",
        })}
      </p>
      <button
        style={styles.mockDraftBtn}
        onClick={(e) => { e.stopPropagation(); navigate(`/mock-draft?${mockParams}`); }}
      >
        {league.draftType === "AUCTION" ? "Mock Auction →" : "Mock Draft →"}
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { minHeight: "100vh", background: "var(--color-bg)" },
  main: { maxWidth: "960px", margin: "0 auto", padding: "40px 24px" },
  headerRow: { display: "flex", alignItems: "baseline", gap: "16px", marginBottom: "24px", flexWrap: "wrap" },
  heading: { fontSize: "22px", fontWeight: 700 },
  discoverHint: { fontSize: "13px", color: "var(--color-accent)", cursor: "pointer" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" },
  empty: { paddingTop: "40px" },
  emptyTitle: { fontSize: "16px", fontWeight: 600, marginBottom: "8px" },
  muted: { color: "var(--color-text-muted)", fontSize: "13px" },
  link: { color: "var(--color-accent)", cursor: "pointer" },
  feed: { marginTop: "48px" },
  feedTitle: {
    fontSize: "11px", fontWeight: 700, letterSpacing: "0.8px",
    textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "16px",
  },
  feedCard: {
    background: "var(--color-surface)", border: "1px solid var(--color-border)",
    borderRadius: "var(--radius)", padding: "16px 20px", marginBottom: "12px",
    cursor: "pointer", display: "flex", flexDirection: "column", gap: "8px",
  },
  feedCardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  feedLeagueName: { fontSize: "14px", fontWeight: 600 },
  liveChip: {
    display: "flex", alignItems: "center", gap: "6px",
    fontSize: "11px", fontWeight: 700, color: "var(--color-success)",
    textTransform: "uppercase", letterSpacing: "0.5px",
  },
  liveDot: { width: "7px", height: "7px", borderRadius: "50%", background: "var(--color-success)" },
  chip: {
    fontSize: "11px", fontWeight: 700, padding: "3px 10px",
    borderRadius: "999px", textTransform: "uppercase", letterSpacing: "0.5px",
  },
  mockDraftBtn: {
    alignSelf: "flex-start", padding: "7px 16px", borderRadius: "8px",
    border: "none", background: "var(--color-accent)", color: "#fff",
    fontSize: "13px", fontWeight: 600, cursor: "pointer", marginTop: "4px",
  },
  matchupRow: { display: "flex", alignItems: "center", gap: "8px" },
  matchupSide: { display: "flex", alignItems: "center", gap: "6px", flex: 1 },
  rank: { fontSize: "11px", fontWeight: 700, color: "var(--color-text-muted)", minWidth: "22px" },
  teamLabel: { fontSize: "13px", fontWeight: 500, color: "var(--color-text-muted)", flex: 1 },
  scoreNum: { fontSize: "18px", fontWeight: 700, color: "var(--color-text)" },
  vsLabel: { fontSize: "11px", color: "var(--color-text-muted)", fontWeight: 600, flexShrink: 0 },
};
