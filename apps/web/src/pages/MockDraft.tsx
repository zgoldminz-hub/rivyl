import React, { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { PlayerPhoto } from "./Players";
import { api } from "../api/client";

interface Player {
  id: string;
  name: string;
  position: string;
  team: string | null;
  searchRank: number | null;
}

type Phase = "setup" | "drafting" | "complete";

const POS_COLORS: Record<string, string> = {
  QB: "#e74c3c", RB: "#2ecc71", WR: "#3498db",
  TE: "#f39c12", K: "#9b59b6", DEF: "#1abc9c",
};

const POS_ORDER = ["QB", "RB", "WR", "TE", "K", "DEF"];

const ROSTER_SLOTS = ["QB", "RB", "RB", "WR", "WR", "WR", "TE", "FLEX", "FLEX", "K", "DEF", "BENCH", "BENCH", "BENCH", "BENCH"];

function getTeamForPick(pickIndex: number, numTeams: number): number {
  const round = Math.floor(pickIndex / numTeams);
  const slot = pickIndex % numTeams;
  return round % 2 === 0 ? slot : numTeams - 1 - slot;
}

function fitRosterToSlots(roster: Player[], slots: string[]): (Player | null)[] {
  const unplaced = [...roster];
  return slots.map((slot) => {
    let idx = -1;
    if (slot === "FLEX") {
      idx = unplaced.findIndex((p) => ["RB", "WR", "TE"].includes(p.position));
    } else if (slot === "BENCH") {
      idx = unplaced.length > 0 ? 0 : -1;
    } else {
      idx = unplaced.findIndex((p) => p.position === slot);
    }
    if (idx >= 0) {
      const player = unplaced[idx];
      unplaced.splice(idx, 1);
      return player;
    }
    return null;
  });
}

function aiPick(available: Player[], roster: Player[], round: number): Player {
  const counts: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0 };
  for (const p of roster) counts[p.position] = (counts[p.position] ?? 0) + 1;
  const totalRounds = ROSTER_SLOTS.length;
  const isLateRound = round >= totalRounds - 4;
  let pool = available;
  if (isLateRound) {
    if (counts.K === 0) pool = available.filter((p) => p.position === "K");
    else if (counts.DEF === 0) pool = available.filter((p) => p.position === "DEF");
    else if (counts.QB < 2) pool = available.filter((p) => p.position === "QB");
    else if (counts.TE < 2) pool = available.filter((p) => p.position === "TE");
    if (pool.length === 0) pool = available;
  } else {
    const overstocked = (pos: string) => {
      if (pos === "QB" && counts.QB >= 2) return true;
      if (pos === "K" && counts.K >= 1) return true;
      if (pos === "DEF" && counts.DEF >= 1) return true;
      return false;
    };
    const filtered = available.filter((p) => !overstocked(p.position));
    if (filtered.length > 0) pool = filtered;
  }
  pool.sort((a, b) => (a.searchRank ?? 999999) - (b.searchRank ?? 999999));
  return pool[0];
}

function groupByPosition(roster: Player[]): Record<string, Player[]> {
  const groups: Record<string, Player[]> = {};
  for (const pos of POS_ORDER) groups[pos] = [];
  for (const p of roster) {
    if (!groups[p.position]) groups[p.position] = [];
    groups[p.position].push(p);
  }
  return groups;
}

function SlottedRoster({ roster }: { roster: Player[] }) {
  const slotted = fitRosterToSlots(roster, ROSTER_SLOTS);
  return (
    <>
      {slotted.map((p, i) =>
        p ? (
          <div key={p.id + String(i)} style={styles.myPickRow}>
            <span style={styles.rdNum}>{ROSTER_SLOTS[i]}</span>
            <PlayerPhoto playerId={p.id} position={p.position} size={30} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={styles.myPickName}>{p.name}</p>
              <span style={{ ...styles.posBadge, background: POS_COLORS[p.position] ?? "#555", fontSize: "9px" }}>{p.position}</span>
            </div>
          </div>
        ) : (
          <div key={"e" + String(i)} style={styles.emptySlot}>
            <span style={styles.emptySlotText}>{ROSTER_SLOTS[i]}</span>
          </div>
        )
      )}
    </>
  );
}

export default function MockDraft() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("setup");
  const [numTeams, setNumTeams] = useState(12);
  const [userSlot, setUserSlot] = useState(1);
  const [scoringType, setScoringType] = useState<"FULL_PPR" | "HALF_PPR">("HALF_PPR");
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [available, setAvailable] = useState<Player[]>([]);
  const [pickIndex, setPickIndex] = useState(0);
  const [drafted, setDrafted] = useState<Set<string>>(new Set());
  const [teams, setTeams] = useState<Player[][]>([]);
  const [recentPicks, setRecentPicks] = useState<{ player: Player; teamIdx: number }[]>([]);
  const [loadingStart, setLoadingStart] = useState(false);
  const [posFilter, setPosFilter] = useState("ALL");
  const [searchQ, setSearchQ] = useState("");
  const [isPicking, setIsPicking] = useState(false);
  const [rightTab, setRightTab] = useState<"my" | "other">("my");
  const [selectedOtherTeam, setSelectedOtherTeam] = useState<number>(0);
  const [showExitModal, setShowExitModal] = useState(false);

  const draftedRef = useRef<Set<string>>(new Set());
  const teamsRef = useRef<Player[][]>([]);
  const availRef = useRef<Player[]>([]);
  const pickIndexRef = useRef(0);

  const totalPicks = numTeams * ROSTER_SLOTS.length;
  const userTeamIdx = userSlot - 1;

  async function startDraft() {
    setLoadingStart(true);
    const res = await api.get<{ players: Player[] }>("/players?limit=500");
    if (!res.ok) { setLoadingStart(false); return; }
    const players = res.data.players;
    const initTeams = Array.from({ length: numTeams }, () => [] as Player[]);
    draftedRef.current = new Set();
    teamsRef.current = initTeams;
    availRef.current = [...players];
    pickIndexRef.current = 0;
    setAllPlayers(players);
    setAvailable(players);
    setDrafted(new Set());
    setTeams(initTeams);
    setPickIndex(0);
    setRecentPicks([]);
    setLoadingStart(false);
    setPhase("drafting");
    setRightTab("my");
    setSelectedOtherTeam(userSlot === 1 ? 1 : 0);
    const firstTeam = getTeamForPick(0, numTeams);
    if (firstTeam !== userTeamIdx) {
      scheduleAiPick(0, initTeams, new Set(), players);
    }
  }

  const scheduleAiPick = useCallback((
    currentPick: number,
    currentTeams: Player[][],
    currentDrafted: Set<string>,
    currentAvail: Player[],
  ) => {
    setTimeout(() => {
      const teamIdx = getTeamForPick(currentPick, numTeams);
      const round = Math.floor(currentPick / numTeams);
      const avail = currentAvail.filter((p) => !currentDrafted.has(p.id));
      if (avail.length === 0) return;
      const pick = aiPick(avail, currentTeams[teamIdx], round);
      executePick(pick, currentPick, teamIdx, currentTeams, currentDrafted, currentAvail);
    }, 500);
  }, [numTeams]); // eslint-disable-line

  function executePick(
    player: Player,
    currentPick: number,
    teamIdx: number,
    currentTeams: Player[][],
    currentDrafted: Set<string>,
    currentAvail: Player[],
  ) {
    const newDrafted = new Set(currentDrafted);
    newDrafted.add(player.id);
    const newTeams = currentTeams.map((t, i) => i === teamIdx ? [...t, player] : t);
    const newAvail = currentAvail.filter((p) => !newDrafted.has(p.id));
    draftedRef.current = newDrafted;
    teamsRef.current = newTeams;
    availRef.current = newAvail;
    const nextPick = currentPick + 1;
    pickIndexRef.current = nextPick;
    setDrafted(new Set(newDrafted));
    setTeams([...newTeams]);
    setAvailable(newAvail);
    setPickIndex(nextPick);
    setRecentPicks((prev) => [{ player, teamIdx }, ...prev].slice(0, 8));
    setIsPicking(false);
    if (nextPick >= totalPicks) { setPhase("complete"); return; }
    const nextTeam = getTeamForPick(nextPick, numTeams);
    if (nextTeam !== userTeamIdx) {
      scheduleAiPick(nextPick, newTeams, newDrafted, newAvail);
    }
  }

  function userPick(player: Player) {
    if (isPicking) return;
    const currentTeam = getTeamForPick(pickIndex, numTeams);
    if (currentTeam !== userTeamIdx) return;
    setIsPicking(true);
    executePick(player, pickIndex, userTeamIdx, teamsRef.current, draftedRef.current, availRef.current);
  }

  function autoCompleteDraft() {
    let curPick = pickIndexRef.current;
    let curDrafted = new Set(draftedRef.current);
    let curTeams = teamsRef.current.map((t) => [...t]);
    let curAvail = availRef.current.filter((p) => !curDrafted.has(p.id));
    while (curPick < totalPicks) {
      const teamIdx = getTeamForPick(curPick, numTeams);
      const round = Math.floor(curPick / numTeams);
      if (curAvail.length === 0) break;
      const pick = aiPick(curAvail, curTeams[teamIdx], round);
      if (!pick) break;
      curDrafted.add(pick.id);
      curTeams[teamIdx] = [...curTeams[teamIdx], pick];
      curAvail = curAvail.filter((p) => !curDrafted.has(p.id));
      curPick++;
    }
    draftedRef.current = curDrafted;
    teamsRef.current = curTeams;
    availRef.current = curAvail;
    pickIndexRef.current = curPick;
    setDrafted(curDrafted);
    setTeams([...curTeams]);
    setAvailable(curAvail);
    setPickIndex(curPick);
    setPhase("complete");
  }

  function handleExitConfirm() {
    setShowExitModal(false);
    autoCompleteDraft();
  }

  const isUserTurn = phase === "drafting" && getTeamForPick(pickIndex, numTeams) === userTeamIdx;
  const currentRound = Math.floor(pickIndex / numTeams) + 1;
  const currentPickInRound = (pickIndex % numTeams) + 1;

  const filteredAvail = available.filter((p) => {
    if (posFilter !== "ALL" && p.position !== posFilter) return false;
    if (searchQ && !p.name.toLowerCase().includes(searchQ.toLowerCase())) return false;
    return true;
  });

  const myRoster = teams[userTeamIdx] ?? [];
  const otherTeamIndices = Array.from({ length: numTeams }, (_, i) => i).filter((i) => i !== userTeamIdx);
  const selectedOtherTeamActualIdx = otherTeamIndices[selectedOtherTeam] ?? otherTeamIndices[0] ?? 0;
  const otherRoster = teams[selectedOtherTeamActualIdx] ?? [];
  const otherRosterByPos = groupByPosition(otherRoster);

  if (phase === "setup") {
    return (
      <div style={styles.page}>
        <Navbar />
        <div style={styles.setupContainer}>
          <h1 style={styles.title}>Mock Draft</h1>
          <p style={styles.subtitle}>Simulate a draft against AI teams</p>
          <div style={styles.setupCard}>
            <div style={styles.field}>
              <label style={styles.label}>Number of Teams</label>
              <div style={styles.optRow}>
                {[8, 10, 12].map((n) => (
                  <button key={n} style={{ ...styles.optBtn, ...(numTeams === n ? styles.optBtnActive : {}) }}
                    onClick={() => { setNumTeams(n); setUserSlot(Math.min(userSlot, n)); }}>{n}</button>
                ))}
              </div>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Your Draft Slot</label>
              <div style={styles.optRow}>
                {Array.from({ length: numTeams }, (_, i) => i + 1).map((n) => (
                  <button key={n} style={{ ...styles.optBtn, ...(userSlot === n ? styles.optBtnActive : {}) }}
                    onClick={() => setUserSlot(n)}>{n}</button>
                ))}
              </div>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Scoring</label>
              <div style={styles.optRow}>
                {(["HALF_PPR", "FULL_PPR"] as const).map((s) => (
                  <button key={s} style={{ ...styles.optBtn, ...(scoringType === s ? styles.optBtnActive : {}) }}
                    onClick={() => setScoringType(s)}>{s.replace("_", " ")}</button>
                ))}
              </div>
            </div>
            <button style={styles.startBtn} onClick={startDraft} disabled={loadingStart}>
              {loadingStart ? "Loading Players…" : "Start Mock Draft"}
            </button>
            <button style={styles.backBtn} onClick={() => navigate("/players")}>← Back to Players</button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "complete") {
    return (
      <div style={styles.page}>
        <Navbar />
        <div style={styles.setupContainer}>
          <h1 style={styles.title}>Draft Complete!</h1>
          <p style={styles.subtitle}>Your team — {ROSTER_SLOTS.length} rounds</p>
          <div style={styles.rosterGrid}>
            {myRoster.map((p, i) => (
              <div key={p.id} style={styles.rosterCard}>
                <PlayerPhoto playerId={p.id} position={p.position} size={44} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={styles.rosterName}>{p.name}</p>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <span style={{ ...styles.posBadge, background: POS_COLORS[p.position] ?? "#555" }}>{p.position}</span>
                    {p.team && <span style={styles.rosterTeam}>{p.team}</span>}
                    <span style={styles.rosterRound}>Rd {i + 1}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
            <button style={styles.startBtn} onClick={() => setPhase("setup")}>Draft Again</button>
            <button style={styles.backBtn} onClick={() => navigate("/players")}>← Players</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <Navbar />
      {showExitModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <h2 style={styles.modalTitle}>Exit Draft?</h2>
            <p style={styles.modalBody}>
              Are you sure you want to exit? The AI will automatically complete your remaining picks.
            </p>
            <div style={styles.modalBtns}>
              <button style={styles.modalKeepBtn} onClick={() => setShowExitModal(false)}>Keep Drafting</button>
              <button style={styles.modalExitBtn} onClick={handleExitConfirm}>Exit &amp; Auto-Draft</button>
            </div>
          </div>
        </div>
      )}
      <div style={styles.draftLayout}>
        <div style={styles.leftPanel}>
          <div style={styles.draftHeader}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <span style={styles.roundLabel}>Round {currentRound} · Pick {currentPickInRound}</span>
                <span style={{ ...styles.turnBadge, background: isUserTurn ? "var(--color-accent)" : "var(--color-border)", color: isUserTurn ? "#fff" : "var(--color-text-muted)" }}>
                  {isUserTurn ? "YOUR PICK" : `Team ${getTeamForPick(pickIndex, numTeams) + 1} picking…`}
                </span>
              </div>
              <button style={styles.exitBtn} onClick={() => setShowExitModal(true)}>Exit</button>
            </div>
            <div style={styles.progressBar}>
              <div style={{ ...styles.progressFill, width: `${(pickIndex / totalPicks) * 100}%` }} />
            </div>
          </div>
          <div style={styles.filterRow}>
            {["ALL", "QB", "RB", "WR", "TE", "K", "DEF"].map((pos) => (
              <button key={pos} style={{ ...styles.filterTab, ...(posFilter === pos ? { background: POS_COLORS[pos] ?? "var(--color-accent)", color: "#fff", borderColor: "transparent" } : {}) }}
                onClick={() => setPosFilter(pos)}>{pos}</button>
            ))}
          </div>
          <input style={styles.searchInput} placeholder="Search player…" value={searchQ} onChange={(e) => setSearchQ(e.target.value)} />
          <div style={styles.playerList}>
            {filteredAvail.slice(0, 100).map((p) => (
              <div key={p.id} style={{ ...styles.playerRow, ...(!isUserTurn ? styles.playerRowDisabled : {}) }}
                onClick={() => isUserTurn && userPick(p)}>
                <PlayerPhoto playerId={p.id} position={p.position} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={styles.playerName}>{p.name}</p>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <span style={{ ...styles.posBadge, background: POS_COLORS[p.position] ?? "#555" }}>{p.position}</span>
                    {p.team && <span style={styles.playerTeam}>{p.team}</span>}
                  </div>
                </div>
                {isUserTurn && <span style={styles.pickHint}>Pick</span>}
              </div>
            ))}
          </div>
        </div>
        <div style={styles.rightPanel}>
          <div style={styles.tabRow}>
            <button style={{ ...styles.tabBtn, ...(rightTab === "my" ? styles.tabBtnActive : {}) }} onClick={() => setRightTab("my")}>My Team</button>
            <button style={{ ...styles.tabBtn, ...(rightTab === "other" ? styles.tabBtnActive : {}) }} onClick={() => setRightTab("other")}>Other Teams</button>
          </div>
          {rightTab === "my" ? (
            <>
              <div style={styles.rosterSection}>
                <h3 style={styles.panelTitle}>My Roster ({myRoster.length}/{ROSTER_SLOTS.length})</h3>
                <SlottedRoster roster={myRoster} />
              </div>
              <div style={styles.recentSection}>
                <h3 style={styles.panelTitle}>Recent Picks</h3>
                {recentPicks.map((rp, i) => (
                  <div key={i} style={styles.recentRow}>
                    <PlayerPhoto playerId={rp.player.id} position={rp.player.position} size={26} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={styles.recentName}>{rp.player.name}</p>
                      <p style={styles.recentTeam}>Team {rp.teamIdx + 1} · {rp.player.position}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={styles.otherTeamsPanel}>
              <select style={styles.teamSelect} value={selectedOtherTeam} onChange={(e) => setSelectedOtherTeam(Number(e.target.value))}>
                {otherTeamIndices.map((actualIdx, i) => (
                  <option key={actualIdx} value={i}>Team {actualIdx + 1}</option>
                ))}
              </select>
              <div style={{ ...styles.rosterSection, borderBottom: "none", padding: 0 }}>
                <SlottedRoster roster={otherRoster} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "var(--color-bg)" },
  setupContainer: { maxWidth: "560px", margin: "0 auto", padding: "40px 24px" },
  title: { fontSize: "28px", fontWeight: 700, marginBottom: "6px" },
  subtitle: { fontSize: "14px", color: "var(--color-text-muted)", marginBottom: "32px" },
  setupCard: { background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius)", padding: "28px" },
  field: { marginBottom: "24px" },
  label: { display: "block", fontSize: "13px", color: "var(--color-text-muted)", marginBottom: "10px", fontWeight: 600 },
  optRow: { display: "flex", gap: "8px", flexWrap: "wrap" },
  optBtn: { padding: "8px 16px", borderRadius: "8px", border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text)", cursor: "pointer", fontSize: "13px" },
  optBtnActive: { background: "var(--color-accent)", borderColor: "transparent", color: "#fff" },
  startBtn: { width: "100%", padding: "12px", borderRadius: "8px", border: "none", background: "var(--color-accent)", color: "#fff", fontWeight: 700, fontSize: "15px", cursor: "pointer", marginBottom: "12px" },
  backBtn: { width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-muted)", cursor: "pointer" },
  draftLayout: { display: "flex", height: "calc(100vh - 60px)", overflow: "hidden" },
  leftPanel: { flex: 1, display: "flex", flexDirection: "column", borderRight: "1px solid var(--color-border)", overflow: "hidden" },
  rightPanel: { width: "260px", display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0 },
  draftHeader: { padding: "12px 16px", borderBottom: "1px solid var(--color-border)", flexShrink: 0 },
  roundLabel: { fontSize: "13px", fontWeight: 700, marginRight: "10px" },
  turnBadge: { fontSize: "11px", fontWeight: 700, padding: "3px 8px", borderRadius: "4px" },
  progressBar: { height: "3px", background: "var(--color-border)", borderRadius: "2px", marginTop: "8px" },
  progressFill: { height: "100%", background: "var(--color-accent)", borderRadius: "2px", transition: "width 0.3s" },
  exitBtn: { padding: "5px 12px", borderRadius: "6px", border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-muted)", fontSize: "12px", cursor: "pointer", fontWeight: 600 },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modalBox: { background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius)", padding: "28px", maxWidth: "360px", width: "90%", textAlign: "center" },
  modalTitle: { fontSize: "20px", fontWeight: 700, marginBottom: "12px" },
  modalBody: { fontSize: "14px", color: "var(--color-text-muted)", marginBottom: "24px", lineHeight: "1.5" },
  modalBtns: { display: "flex", gap: "10px" },
  modalKeepBtn: { flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text)", cursor: "pointer", fontWeight: 600, fontSize: "13px" },
  modalExitBtn: { flex: 1, padding: "10px", borderRadius: "8px", border: "none", background: "#e74c3c", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: "13px" },
  filterRow: { display: "flex", gap: "6px", padding: "10px 16px", flexWrap: "wrap", flexShrink: 0 },
  filterTab: { padding: "4px 10px", borderRadius: "12px", border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-muted)", fontSize: "11px", cursor: "pointer" },
  searchInput: { margin: "0 16px 10px", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text)", fontSize: "13px" },
  playerList: { flex: 1, overflowY: "auto", padding: "0 8px 8px" },
  playerRow: { display: "flex", gap: "10px", alignItems: "center", padding: "8px", borderRadius: "8px", cursor: "pointer", marginBottom: "2px" },
  playerRowDisabled: { opacity: 0.5, cursor: "default" },
  playerName: { fontSize: "13px", fontWeight: 600, marginBottom: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  playerTeam: { fontSize: "11px", color: "var(--color-text-muted)" },
  pickHint: { fontSize: "11px", color: "var(--color-accent)", fontWeight: 600 },
  posBadge: { fontSize: "10px", fontWeight: 700, color: "#fff", padding: "1px 5px", borderRadius: "3px" },
  tabRow: { display: "flex", borderBottom: "1px solid var(--color-border)", flexShrink: 0 },
  tabBtn: { flex: 1, padding: "10px 6px", background: "transparent", border: "none", color: "var(--color-text-muted)", fontSize: "11px", fontWeight: 600, cursor: "pointer", borderBottom: "2px solid transparent" },
  tabBtnActive: { color: "var(--color-accent)", borderBottom: "2px solid var(--color-accent)" },
  rosterSection: { flex: 1, overflowY: "auto", padding: "12px", borderBottom: "1px solid var(--color-border)" },
  recentSection: { padding: "12px", overflowY: "auto", maxHeight: "200px" },
  panelTitle: { fontSize: "12px", fontWeight: 700, color: "var(--color-text-muted)", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.5px" },
  myPickRow: { display: "flex", gap: "8px", alignItems: "center", marginBottom: "6px" },
  rdNum: { fontSize: "10px", color: "var(--color-text-muted)", width: "20px", flexShrink: 0 },
  myPickName: { fontSize: "12px", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: "1px" },
  emptySlot: { height: "36px", borderRadius: "6px", border: "1px dashed var(--color-border)", display: "flex", alignItems: "center", paddingLeft: "28px", marginBottom: "4px" },
  emptySlotText: { fontSize: "11px", color: "var(--color-text-muted)" },
  recentRow: { display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" },
  recentName: { fontSize: "12px", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  recentTeam: { fontSize: "11px", color: "var(--color-text-muted)" },
  otherTeamsPanel: { display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", padding: "12px" },
  teamSelect: { width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text)", fontSize: "13px", marginBottom: "12px", cursor: "pointer" },
  posGroupLabel: { marginBottom: "4px" },
  otherPickRow: { display: "flex", gap: "8px", alignItems: "center", marginBottom: "5px", paddingLeft: "4px" },
  emptyMsg: { fontSize: "13px", color: "var(--color-text-muted)", textAlign: "center", marginTop: "24px" },
  rosterGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "8px" },
  rosterCard: { display: "flex", gap: "10px", alignItems: "center", padding: "12px", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius)" },
  rosterName: { fontSize: "13px", fontWeight: 600, marginBottom: "4px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  rosterTeam: { fontSize: "11px", color: "var(--color-text-muted)" },
  rosterRound: { fontSize: "11px", color: "var(--color-text-muted)" },
};
