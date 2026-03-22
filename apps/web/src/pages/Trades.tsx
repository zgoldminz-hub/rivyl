import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Button from "../components/Button";
import Modal from "../components/Modal";
import { api } from "../api/client";

interface SleeperPlayer {
  player_id: string;
  full_name: string;
  position: string;
  team: string | null;
}

interface TradeItem {
  id: string;
  fromTeamId: string;
  playerId: string;
}

interface Trade {
  id: string;
  status: string;
  note: string | null;
  createdAt: string;
  proposingTeam: { id: string; name: string; userId: string };
  receivingTeam: { id: string; name: string; userId: string };
  items: TradeItem[];
}

interface TeamRoster {
  id: string;
  name: string;
  rosterSlots: { id: string; playerId: string; slot: string }[];
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: "#f59e0b",
  ACCEPTED: "#22c55e",
  REJECTED: "#ef4444",
  CANCELLED: "#6b7280",
};

export default function Trades() {
  const { id: leagueId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [trades, setTrades] = useState<Trade[]>([]);
  const [myTeamId, setMyTeamId] = useState("");
  const [myRoster, setMyRoster] = useState<{ playerId: string; slot: string }[]>([]);
  const [allTeams, setAllTeams] = useState<TeamRoster[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"active" | "history">("active");

  // Propose modal
  const [showPropose, setShowPropose] = useState(false);
  const [targetTeamId, setTargetTeamId] = useState("");
  const [targetRoster, setTargetRoster] = useState<{ playerId: string; slot: string }[]>([]);
  const [offeredIds, setOfferedIds] = useState<Set<string>>(new Set());
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());
  const [tradeNote, setTradeNote] = useState("");
  const [proposing, setProposing] = useState(false);
  const [proposeError, setProposeError] = useState("");

  useEffect(() => {
    if (!leagueId) return;
    Promise.all([
      api.get<{ trades: Trade[]; myTeamId: string }>(`/trades/${leagueId}`),
      api.get<{ team: any; roster: any[] }>(`/season/${leagueId}/my-team`),
      api.get<{ teams: TeamRoster[] }>(`/leagues/${leagueId}`),
    ]).then(([tradesRes, teamRes, leagueRes]) => {
      if (tradesRes.ok) { setTrades(tradesRes.data.trades); setMyTeamId(tradesRes.data.myTeamId); }
      if (teamRes.ok) setMyRoster(teamRes.data.roster.map((r: any) => ({ playerId: r.playerId, slot: r.slot })));
      if (leagueRes.ok) {
        const leagueData = (leagueRes as any).data;
        if (leagueData.teams) setAllTeams(leagueData.teams.map((t: any) => ({ id: t.id, name: t.name, rosterSlots: [] })));
      }
      setLoading(false);
    });
  }, [leagueId]);

  async function loadTargetRoster(teamId: string) {
    setTargetTeamId(teamId);
    setRequestedIds(new Set());
    if (!teamId || !leagueId) { setTargetRoster([]); return; }
    // Fetch target team roster via league detail (teams include roster via DB join)
    const res = await api.get<any>(`/leagues/${leagueId}`);
    if (res.ok) {
      const found = res.data.teams?.find((t: any) => t.id === teamId);
      if (found?.rosterSlots) setTargetRoster(found.rosterSlots.map((s: any) => ({ playerId: s.playerId, slot: s.slot })));
      else setTargetRoster([]);
    }
  }

  function toggleOffered(pid: string) {
    setOfferedIds((prev) => { const n = new Set(prev); n.has(pid) ? n.delete(pid) : n.add(pid); return n; });
  }
  function toggleRequested(pid: string) {
    setRequestedIds((prev) => { const n = new Set(prev); n.has(pid) ? n.delete(pid) : n.add(pid); return n; });
  }

  async function proposeTrade() {
    if (!leagueId || offeredIds.size === 0 || requestedIds.size === 0 || !targetTeamId) return;
    setProposing(true);
    setProposeError("");
    const res = await api.post(`/trades/${leagueId}`, {
      receivingTeamId: targetTeamId,
      offeredPlayerIds: Array.from(offeredIds),
      requestedPlayerIds: Array.from(requestedIds),
      note: tradeNote || undefined,
    });
    setProposing(false);
    if (res.ok) {
      setTrades((prev) => [(res as any).data.trade, ...prev]);
      setShowPropose(false);
      setOfferedIds(new Set());
      setRequestedIds(new Set());
      setTargetTeamId("");
      setTradeNote("");
    } else {
      setProposeError((res as any).error ?? "Failed to propose trade");
    }
  }

  async function respondToTrade(tradeId: string, action: "accept" | "reject") {
    if (!leagueId) return;
    const res = action === "accept"
      ? await api.post(`/trades/${leagueId}/${tradeId}/accept`, {})
      : await api.post(`/trades/${leagueId}/${tradeId}/reject`, {});
    if (res.ok) {
      setTrades((prev) => prev.map((t) => t.id === tradeId ? { ...t, status: action === "accept" ? "ACCEPTED" : "REJECTED" } : t));
    }
  }

  async function cancelTrade(tradeId: string) {
    if (!leagueId) return;
    const res = await api.del(`/trades/${leagueId}/${tradeId}`);
    if (res.ok) {
      setTrades((prev) => prev.map((t) => t.id === tradeId ? { ...t, status: "CANCELLED" } : t));
    }
  }

  const activeTrades = trades.filter((t) => t.status === "PENDING");
  const historyTrades = trades.filter((t) => t.status !== "PENDING");

  if (loading) return <div style={styles.root}><Navbar /></div>;

  return (
    <div style={styles.root}>
      <Navbar />
      <main style={styles.main}>
        <div style={styles.header}>
          <div>
            <button style={styles.back} onClick={() => navigate(`/leagues/${leagueId}/standings`)}>← Standings</button>
            <h1 style={styles.title}>Trades</h1>
            <p style={styles.subtitle}>Propose and manage player trades</p>
          </div>
          <Button onClick={() => setShowPropose(true)}>+ Propose Trade</Button>
        </div>

        {/* Tabs */}
        <div style={styles.tabs}>
          <button style={{ ...styles.tab, ...(tab === "active" ? styles.activeTab : {}) }} onClick={() => setTab("active")}>
            Active {activeTrades.length > 0 && <span style={styles.badge}>{activeTrades.length}</span>}
          </button>
          <button style={{ ...styles.tab, ...(tab === "history" ? styles.activeTab : {}) }} onClick={() => setTab("history")}>
            History
          </button>
        </div>

        <div style={styles.list}>
          {(tab === "active" ? activeTrades : historyTrades).length === 0 ? (
            <p style={styles.empty}>{tab === "active" ? "No active trades." : "No trade history."}</p>
          ) : (tab === "active" ? activeTrades : historyTrades).map((trade) => {
            const isProposer = trade.proposingTeam.id === myTeamId;
            const isReceiver = trade.receivingTeam.id === myTeamId;
            const offered = trade.items.filter((i) => i.fromTeamId === trade.proposingTeam.id);
            const requested = trade.items.filter((i) => i.fromTeamId === trade.receivingTeam.id);

            return (
              <div key={trade.id} style={styles.tradeCard}>
                <div style={styles.tradeHeader}>
                  <div style={styles.tradeTeams}>
                    <span style={styles.teamName}>{trade.proposingTeam.name}</span>
                    <span style={styles.vs}>↔</span>
                    <span style={styles.teamName}>{trade.receivingTeam.name}</span>
                  </div>
                  <span style={{ ...styles.statusBadge, color: STATUS_COLOR[trade.status] ?? "#6b7280", background: `${STATUS_COLOR[trade.status] ?? "#6b7280"}18` }}>
                    {trade.status}
                  </span>
                </div>

                <div style={styles.tradePlayers}>
                  <div style={styles.tradeCol}>
                    <span style={styles.tradeColLabel}>{trade.proposingTeam.name} sends</span>
                    {offered.map((i) => <span key={i.id} style={styles.tradePill}>{i.playerId}</span>)}
                  </div>
                  <div style={styles.tradeCol}>
                    <span style={styles.tradeColLabel}>{trade.receivingTeam.name} sends</span>
                    {requested.map((i) => <span key={i.id} style={styles.tradePill}>{i.playerId}</span>)}
                  </div>
                </div>

                {trade.note && <p style={styles.tradeNote}>"{trade.note}"</p>}

                {trade.status === "PENDING" && (
                  <div style={styles.tradeActions}>
                    {isReceiver && (
                      <>
                        <Button style={{ fontSize: "12px", padding: "6px 14px" }} onClick={() => respondToTrade(trade.id, "accept")}>Accept</Button>
                        <Button variant="ghost" style={{ fontSize: "12px", padding: "6px 14px" }} onClick={() => respondToTrade(trade.id, "reject")}>Reject</Button>
                      </>
                    )}
                    {isProposer && (
                      <button style={styles.cancelTradeBtn} onClick={() => cancelTrade(trade.id)}>Cancel offer</button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>

      {/* Propose trade modal */}
      <Modal open={showPropose} onClose={() => { setShowPropose(false); setProposeError(""); }} title="Propose a Trade" width={600}>
          <label style={styles.label}>Trade with</label>
          <select
            style={styles.select}
            value={targetTeamId}
            onChange={(e) => loadTargetRoster(e.target.value)}
          >
            <option value="">— Select a team —</option>
            {allTeams.filter((t) => t.id !== myTeamId).map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          <div style={styles.tradeBuilder}>
            {/* My players */}
            <div>
              <p style={styles.tradeColLabel}>Your players (select to offer)</p>
              <div style={styles.selectList}>
                {myRoster.filter((s) => s.slot !== "BENCH" || true).map((s) => (
                  <div
                    key={s.playerId}
                    style={{ ...styles.selectRow, ...(offeredIds.has(s.playerId) ? styles.selectedRow : {}) }}
                    onClick={() => toggleOffered(s.playerId)}
                  >
                    <span style={styles.slotTag}>{s.slot}</span>
                    <span style={styles.selectName}>{s.playerId}</span>
                    {offeredIds.has(s.playerId) && <span style={styles.checkmark}>✓</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Their players */}
            <div>
              <p style={styles.tradeColLabel}>Their players (select to request)</p>
              <div style={styles.selectList}>
                {targetRoster.length === 0 ? (
                  <p style={styles.empty}>Select a team first</p>
                ) : targetRoster.map((s) => (
                  <div
                    key={s.playerId}
                    style={{ ...styles.selectRow, ...(requestedIds.has(s.playerId) ? styles.selectedRow : {}) }}
                    onClick={() => toggleRequested(s.playerId)}
                  >
                    <span style={styles.slotTag}>{s.slot}</span>
                    <span style={styles.selectName}>{s.playerId}</span>
                    {requestedIds.has(s.playerId) && <span style={styles.checkmark}>✓</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <label style={{ ...styles.label, marginTop: "16px" }}>Note (optional)</label>
          <input
            style={styles.noteInput}
            placeholder="Add a message with your offer…"
            value={tradeNote}
            onChange={(e) => setTradeNote(e.target.value)}
          />

          {proposeError && <p style={styles.error}>{proposeError}</p>}

          <div style={styles.modalActions}>
            <Button variant="ghost" onClick={() => { setShowPropose(false); setProposeError(""); }}>Cancel</Button>
            <Button
              onClick={proposeTrade}
              loading={proposing}
              disabled={offeredIds.size === 0 || requestedIds.size === 0 || !targetTeamId}
            >
              Send Trade Offer
            </Button>
          </div>
        </Modal>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { minHeight: "100vh", background: "var(--color-bg)" },
  main: { maxWidth: "960px", margin: "0 auto", padding: "32px 24px" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "24px" },
  back: { background: "none", border: "none", color: "var(--color-text-muted)", fontSize: "13px", cursor: "pointer", padding: 0, marginBottom: "8px", display: "block" },
  title: { fontSize: "24px", fontWeight: 700, marginBottom: "4px" },
  subtitle: { fontSize: "14px", color: "var(--color-text-muted)" },
  tabs: { display: "flex", gap: "4px", marginBottom: "20px", borderBottom: "1px solid var(--color-border)" },
  tab: { padding: "8px 16px", background: "none", border: "none", color: "var(--color-text-muted)", cursor: "pointer", fontSize: "14px", fontWeight: 500, borderBottom: "2px solid transparent", marginBottom: "-1px" },
  activeTab: { color: "var(--color-accent)", borderBottomColor: "var(--color-accent)" },
  badge: { background: "var(--color-accent)", color: "#fff", borderRadius: "999px", fontSize: "11px", padding: "1px 6px", marginLeft: "6px" },
  list: { display: "flex", flexDirection: "column", gap: "12px" },
  empty: { fontSize: "14px", color: "var(--color-text-muted)", padding: "24px 0" },
  tradeCard: { background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "10px", padding: "16px 20px", display: "flex", flexDirection: "column", gap: "12px" },
  tradeHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  tradeTeams: { display: "flex", alignItems: "center", gap: "10px" },
  teamName: { fontSize: "15px", fontWeight: 600 },
  vs: { color: "var(--color-text-muted)", fontSize: "16px" },
  statusBadge: { fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "999px", textTransform: "uppercase", letterSpacing: "0.5px" },
  tradePlayers: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" },
  tradeCol: { display: "flex", flexDirection: "column", gap: "6px" },
  tradeColLabel: { fontSize: "11px", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "2px" },
  tradePill: { fontSize: "13px", fontWeight: 500, background: "rgba(79,124,255,0.1)", color: "var(--color-accent)", padding: "4px 10px", borderRadius: "6px", display: "inline-block" },
  tradeNote: { fontSize: "13px", color: "var(--color-text-muted)", fontStyle: "italic" },
  tradeActions: { display: "flex", gap: "8px", alignItems: "center" },
  cancelTradeBtn: { background: "none", border: "1px solid var(--color-border)", borderRadius: "6px", padding: "5px 12px", color: "var(--color-text-muted)", cursor: "pointer", fontSize: "12px" },
  modalTitle: { fontSize: "18px", fontWeight: 700, marginBottom: "16px" },
  label: { fontSize: "12px", fontWeight: 600, color: "var(--color-text-muted)", display: "block", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" },
  select: { width: "100%", padding: "10px 12px", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "8px", color: "var(--color-text)", fontSize: "14px", marginBottom: "16px" },
  tradeBuilder: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" },
  selectList: { display: "flex", flexDirection: "column", gap: "4px", maxHeight: "240px", overflowY: "auto" },
  selectRow: { display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px", background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: "6px", cursor: "pointer" },
  selectedRow: { borderColor: "var(--color-accent)", background: "rgba(79,124,255,0.08)" },
  slotTag: { fontSize: "10px", fontWeight: 700, color: "var(--color-text-muted)", minWidth: "36px" },
  selectName: { fontSize: "13px", fontWeight: 500, flex: 1 },
  checkmark: { color: "var(--color-accent)", fontWeight: 700 },
  noteInput: { width: "100%", padding: "10px 12px", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "8px", color: "var(--color-text)", fontSize: "14px", boxSizing: "border-box" },
  error: { color: "#ef4444", fontSize: "13px", margin: "8px 0" },
  modalActions: { display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "16px" },
};
