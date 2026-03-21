import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../store/auth";
import { useDraft } from "../store/draft";
import { api } from "../api/client";
import DraftTimer from "../components/draft/DraftTimer";
import PlayerSearch from "../components/draft/PlayerSearch";
import SnakeBoard from "../components/draft/SnakeBoard";
import AuctionBlock from "../components/draft/AuctionBlock";

export default function DraftRoom() {
  const { id: leagueId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { state, error, connect, disconnect, pick, nominate, clearError } = useDraft();

  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [leagueName, setLeagueName] = useState("");

  useEffect(() => {
    if (!leagueId) return;

    // Fetch team membership
    api.get<{ leagues: any[] }>("/leagues/mine").then((res) => {
      if (res.ok) {
        const entry = res.data.leagues.find((l: any) => l.id === leagueId);
        if (entry) {
          setMyTeamId(entry.teamId);
          setLeagueName(entry.name);
        }
      }
    });

    const token = localStorage.getItem("accessToken") ?? "";
    connect(leagueId, token);

    return () => disconnect();
  }, [leagueId]);

  const myTeam = state?.teams.find((t) => t.id === myTeamId);
  const isMyTurn = state?.currentTeamId === myTeamId && state?.status === "ACTIVE";
  const currentTeam = state?.teams.find((t) => t.id === state.currentTeamId);

  function handlePick(player: any) {
    pick(player.player_id);
  }

  function handleNominate(player: any, openingBid?: number) {
    nominate(player.player_id, openingBid ?? 1);
  }

  if (!state) {
    return (
      <div style={styles.loading}>
        <div style={styles.loadingCard}>
          <p style={styles.logo}>Rivyl</p>
          <p style={styles.loadingText}>Connecting to draft room…</p>
        </div>
      </div>
    );
  }

  if (state.status === "COMPLETE") {
    return (
      <div style={styles.loading}>
        <div style={styles.loadingCard}>
          <p style={styles.logo}>Rivyl</p>
          <h2 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "8px" }}>Draft Complete!</h2>
          <p style={{ color: "var(--color-text-muted)", marginBottom: "24px" }}>The season is about to begin.</p>
          <button style={styles.doneBtn} onClick={() => navigate(`/leagues/${leagueId}`)}>
            View League →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.root}>
      {/* Top bar */}
      <div style={styles.topBar}>
        <div style={styles.topLeft}>
          <span style={styles.logo}>Rivyl</span>
          <span style={styles.leagueName}>{leagueName} — Draft</span>
        </div>
        <div style={styles.topCenter}>
          {state.status === "ACTIVE" && (
            <DraftTimer endsAt={state.timerEndsAt} isMyTurn={isMyTurn} />
          )}
        </div>
        <div style={styles.topRight}>
          {state.draftType === "SNAKE" && (
            <span style={styles.roundBadge}>Round {state.currentRound} / 15</span>
          )}
          <span style={styles.turnLabel}>
            {isMyTurn ? "YOUR TURN" : `${currentTeam?.name ?? "…"} is picking`}
          </span>
        </div>
      </div>

      {/* Error toast */}
      {error && (
        <div style={styles.toast}>
          {error}
          <button style={styles.toastClose} onClick={clearError}>✕</button>
        </div>
      )}

      <div style={styles.body}>
        {/* Left: draft board */}
        <div style={styles.leftPanel}>
          {state.draftType === "SNAKE" ? (
            <div style={styles.section}>
              <p style={styles.sectionTitle}>Draft Board</p>
              {myTeamId && <SnakeBoard state={state} myTeamId={myTeamId} />}
            </div>
          ) : (
            <div style={styles.section}>
              <p style={styles.sectionTitle}>Auction</p>
              {myTeamId && <AuctionBlock state={state} myTeamId={myTeamId} />}
            </div>
          )}
        </div>

        {/* Center: player search */}
        <div style={styles.centerPanel}>
          <p style={styles.sectionTitle}>Available Players</p>
          <PlayerSearch
            onPick={handlePick}
            onNominate={handleNominate}
            isMyTurn={isMyTurn}
            draftType={state.draftType}
            myBudget={myTeam?.auctionBudget}
          />
        </div>

        {/* Right: my roster */}
        <div style={styles.rightPanel}>
          <p style={styles.sectionTitle}>My Roster</p>
          <MyRoster roster={myTeam?.roster ?? []} draftType={state.draftType} budget={myTeam?.auctionBudget} />
        </div>
      </div>
    </div>
  );
}

// ─── My Roster ────────────────────────────────────────────────────────────────

const SLOT_ORDER = ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "K", "DEF", "BENCH", "BENCH", "BENCH", "BENCH", "BENCH", "BENCH"];

const POS_COLORS: Record<string, string> = {
  QB: "#f59e0b", RB: "#22c55e", WR: "#4f7cff", TE: "#a78bfa", K: "#6b7280", DEF: "#ef4444", FLEX: "#22c55e", BENCH: "#374151",
};

function MyRoster({ roster, draftType, budget }: { roster: { playerId: string; slot: string }[]; draftType: string; budget?: number }) {
  const slotCounts: Record<string, number> = {};

  return (
    <div style={styles.rosterList}>
      {draftType === "AUCTION" && budget !== undefined && (
        <div style={styles.budgetDisplay}>
          <span style={styles.budgetLabel}>Remaining budget</span>
          <span style={styles.budgetNum}>${budget}</span>
        </div>
      )}
      {SLOT_ORDER.map((slot, i) => {
        slotCounts[slot] = (slotCounts[slot] ?? 0);
        const slotRoster = roster.filter((r) => r.slot === slot);
        const entry = slotRoster[slotCounts[slot]];
        slotCounts[slot]++;

        return (
          <div key={`${slot}-${i}`} style={styles.rosterRow}>
            <span style={{ ...styles.slotBadge, background: `${POS_COLORS[slot] ?? "#374151"}20`, color: POS_COLORS[slot] ?? "#6b7280" }}>
              {slot}
            </span>
            <span style={entry ? styles.rosterPlayer : styles.rosterEmpty}>
              {entry ? entry.playerId : "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  root: { height: "100vh", display: "flex", flexDirection: "column", background: "var(--color-bg)", overflow: "hidden" },
  topBar: {
    display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px",
    height: "64px", background: "var(--color-surface)", borderBottom: "1px solid var(--color-border)",
    flexShrink: 0, gap: "16px",
  },
  topLeft: { display: "flex", alignItems: "center", gap: "16px" },
  logo: { fontSize: "18px", fontWeight: 700, color: "var(--color-accent)" },
  leagueName: { fontSize: "14px", color: "var(--color-text-muted)" },
  topCenter: { flex: 1, maxWidth: "300px" },
  topRight: { display: "flex", alignItems: "center", gap: "16px" },
  roundBadge: { fontSize: "13px", color: "var(--color-text-muted)" },
  turnLabel: { fontSize: "13px", fontWeight: 600, color: "var(--color-text)" },
  toast: {
    background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", padding: "10px 16px",
    margin: "8px 16px", borderRadius: "8px", fontSize: "13px", color: "var(--color-danger)",
    display: "flex", justifyContent: "space-between", alignItems: "center",
  },
  toastClose: { background: "none", border: "none", color: "var(--color-danger)", cursor: "pointer", fontSize: "14px" },
  body: { display: "grid", gridTemplateColumns: "1fr 340px 220px", gap: "0", flex: 1, overflow: "hidden" },
  leftPanel: { borderRight: "1px solid var(--color-border)", overflow: "auto", padding: "16px" },
  centerPanel: { borderRight: "1px solid var(--color-border)", display: "flex", flexDirection: "column", padding: "16px", overflow: "hidden" },
  rightPanel: { overflow: "auto", padding: "16px" },
  section: { display: "flex", flexDirection: "column", gap: "12px" },
  sectionTitle: { fontSize: "11px", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" },
  rosterList: { display: "flex", flexDirection: "column", gap: "4px" },
  rosterRow: { display: "flex", alignItems: "center", gap: "8px", padding: "5px 0", borderBottom: "1px solid var(--color-border)" },
  slotBadge: { fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: "4px", minWidth: "40px", textAlign: "center" },
  rosterPlayer: { fontSize: "12px", color: "var(--color-text)" },
  rosterEmpty: { fontSize: "12px", color: "var(--color-surface-2)" },
  budgetDisplay: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--color-border)", marginBottom: "4px" },
  budgetLabel: { fontSize: "12px", color: "var(--color-text-muted)" },
  budgetNum: { fontSize: "18px", fontWeight: 700, color: "var(--color-success)" },
  loading: { height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-bg)" },
  loadingCard: { textAlign: "center", display: "flex", flexDirection: "column", gap: "12px", alignItems: "center" },
  loadingText: { fontSize: "14px", color: "var(--color-text-muted)" },
  doneBtn: { padding: "12px 32px", background: "var(--color-accent)", border: "none", borderRadius: "var(--radius)", color: "#fff", fontSize: "15px", fontWeight: 600, cursor: "pointer", fontFamily: "var(--font)" },
};
