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
  injury_status: string | null;
}

interface WaiverClaim {
  id: string;
  addPlayerId: string;
  dropPlayerId: string | null;
  priority: number;
  status: string;
}

interface RosterSlot {
  id: string;
  playerId: string;
  slot: string;
}

const POSITIONS = ["ALL", "QB", "RB", "WR", "TE", "K", "DEF"];
const POS_COLORS: Record<string, string> = {
  QB: "#e74c3c", RB: "#1A2A8E", WR: "#00D4FF", TE: "#FF6B00", K: "#A0B0C0", DEF: "#27AE60",
};

export default function WaiverWire() {
  const { id: leagueId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [players, setPlayers] = useState<SleeperPlayer[]>([]);
  const [claims, setClaims] = useState<WaiverClaim[]>([]);
  const [myRoster, setMyRoster] = useState<RosterSlot[]>([]);
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"browse" | "claims">("browse");

  // Claim modal
  const [claimPlayer, setClaimPlayer] = useState<SleeperPlayer | null>(null);
  const [dropPlayerId, setDropPlayerId] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState("");

  const fetchFreeAgents = useCallback(() => {
    if (!leagueId) return;
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (position !== "ALL") params.set("position", position);
    api.get<{ players: SleeperPlayer[] }>(`/waivers/${leagueId}/available?${params}`).then((res) => {
      if (res.ok) setPlayers(res.data.players);
    });
  }, [leagueId, search, position]);

  useEffect(() => {
    if (!leagueId) return;
    Promise.all([
      api.get<{ claims: WaiverClaim[] }>(`/waivers/${leagueId}/claims`),
      api.get<{ team: any; roster: RosterSlot[] }>(`/season/${leagueId}/my-team`),
    ]).then(([claimsRes, teamRes]) => {
      if (claimsRes.ok) setClaims(claimsRes.data.claims);
      if (teamRes.ok) setMyRoster(teamRes.data.roster);
      setLoading(false);
    });
  }, [leagueId]);

  useEffect(() => {
    const t = setTimeout(fetchFreeAgents, 300);
    return () => clearTimeout(t);
  }, [fetchFreeAgents]);

  async function submitClaim() {
    if (!claimPlayer || !leagueId) return;
    setClaiming(true);
    setClaimError("");
    const res = await api.post(`/waivers/${leagueId}/claim`, {
      addPlayerId: claimPlayer.player_id,
      dropPlayerId: dropPlayerId || undefined,
    });
    setClaiming(false);
    if (res.ok) {
      setClaims((prev) => [...prev, (res as any).data.claim]);
      setClaimPlayer(null);
      setDropPlayerId("");
    } else {
      setClaimError((res as any).error ?? "Failed to submit claim");
    }
  }

  async function cancelClaim(claimId: string) {
    if (!leagueId) return;
    const res = await api.del(`/waivers/${leagueId}/claims/${claimId}`);
    if (res.ok) setClaims((prev) => prev.filter((c) => c.id !== claimId));
  }

  async function dropPlayer(playerId: string) {
    if (!leagueId || !confirm("Drop this player from your roster?")) return;
    const res = await api.del(`/waivers/${leagueId}/drop/${playerId}`);
    if (res.ok) setMyRoster((prev) => prev.filter((s) => s.playerId !== playerId));
  }

  if (loading) return <div style={styles.root}><Navbar /></div>;

  return (
    <div style={styles.root}>
      <Navbar />
      <main style={styles.main}>
        <div style={styles.header}>
          <div>
            <button style={styles.back} onClick={() => navigate(`/leagues/${leagueId}/standings`)}>← Standings</button>
            <h1 style={styles.title}>Waiver Wire</h1>
            <p style={styles.subtitle}>Add free agents to your roster</p>
          </div>
        </div>

        {/* Tabs */}
        <div style={styles.tabs}>
          <button style={{ ...styles.tab, ...(tab === "browse" ? styles.activeTab : {}) }} onClick={() => setTab("browse")}>
            Free Agents
          </button>
          <button style={{ ...styles.tab, ...(tab === "claims" ? styles.activeTab : {}) }} onClick={() => setTab("claims")}>
            My Claims {claims.length > 0 && <span style={styles.badge}>{claims.length}</span>}
          </button>
          <button style={{ ...styles.tab, ...(tab === "browse" ? {} : {}) }} onClick={() => setTab("claims" === tab ? "browse" : "claims")}>
          </button>
        </div>

        {tab === "browse" && (
          <>
            {/* Filters */}
            <div style={styles.filters}>
              <input
                style={styles.searchInput}
                placeholder="Search players…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div style={styles.posFilters}>
                {POSITIONS.map((pos) => (
                  <button
                    key={pos}
                    style={{ ...styles.posBtn, ...(position === pos ? styles.posBtnActive : {}) }}
                    onClick={() => setPosition(pos)}
                  >
                    {pos}
                  </button>
                ))}
              </div>
            </div>

            {/* Player list */}
            <div style={styles.list}>
              {players.length === 0 ? (
                <p style={styles.empty}>No free agents found.</p>
              ) : players.map((p) => (
                <div key={p.player_id} style={styles.playerRow}>
                  <span style={{ ...styles.posBadge, background: `${POS_COLORS[p.position] ?? "#374151"}20`, color: POS_COLORS[p.position] ?? "#6b7280" }}>
                    {p.position}
                  </span>
                  <div style={styles.playerInfo}>
                    <span style={styles.playerName}>{p.full_name}</span>
                    <span style={styles.playerMeta}>{p.team ?? "FA"}{p.injury_status ? ` · ${p.injury_status}` : ""}</span>
                  </div>
                  <Button style={{ fontSize: "12px", padding: "6px 14px" }} onClick={() => setClaimPlayer(p)}>
                    Claim
                  </Button>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === "claims" && (
          <div style={styles.list}>
            {claims.length === 0 ? (
              <p style={styles.empty}>No pending waiver claims.</p>
            ) : claims.map((c) => (
              <div key={c.id} style={styles.claimRow}>
                <div style={styles.claimInfo}>
                  <span style={styles.claimLabel}>Add</span>
                  <span style={styles.claimPlayer}>{c.addPlayerId}</span>
                  {c.dropPlayerId && (
                    <>
                      <span style={styles.claimLabel}>Drop</span>
                      <span style={{ ...styles.claimPlayer, color: "#ef4444" }}>{c.dropPlayerId}</span>
                    </>
                  )}
                </div>
                <button style={styles.cancelBtn} onClick={() => cancelClaim(c.id)}>Cancel</button>
              </div>
            ))}
            <p style={styles.claimsNote}>Claims are processed by the commissioner. Priority is first-come, first-served.</p>
          </div>
        )}

        {/* Roster section — drop players */}
        <div style={{ marginTop: "32px" }}>
          <h2 style={styles.sectionTitle}>My Roster</h2>
          <p style={styles.subtitle}>Click Drop to release a player to free agency.</p>
          <div style={styles.list}>
            {myRoster.map((s) => (
              <div key={s.id} style={styles.playerRow}>
                <span style={{ ...styles.posBadge, background: "#374151", color: "#9ca3af" }}>{s.slot}</span>
                <div style={styles.playerInfo}>
                  <span style={styles.playerName}>{s.playerId}</span>
                </div>
                {s.slot !== "DEF" && (
                  <button style={styles.dropBtn} onClick={() => dropPlayer(s.playerId)}>Drop</button>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Claim modal */}
      <Modal open={!!claimPlayer} onClose={() => { setClaimPlayer(null); setClaimError(""); }} title={`Claim ${claimPlayer?.full_name ?? ""}`} width={440}>
          <p style={styles.modalSub}>{claimPlayer?.position} · {claimPlayer?.team ?? "FA"}</p>

          <label style={styles.label}>Drop a player (optional)</label>
          <select
            style={styles.select}
            value={dropPlayerId}
            onChange={(e) => setDropPlayerId(e.target.value)}
          >
            <option value="">— No drop —</option>
            {myRoster.map((s) => (
              <option key={s.id} value={s.playerId}>{s.playerId} ({s.slot})</option>
            ))}
          </select>

          {claimError && <p style={styles.error}>{claimError}</p>}

          <div style={styles.modalActions}>
            <Button variant="ghost" onClick={() => { setClaimPlayer(null); setClaimError(""); }}>Cancel</Button>
            <Button onClick={submitClaim} loading={claiming}>Submit Claim</Button>
          </div>
        </Modal>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { minHeight: "100vh", background: "var(--color-bg)" },
  main: { maxWidth: "960px", margin: "0 auto", padding: "32px 24px" },
  header: { marginBottom: "24px" },
  back: { background: "none", border: "none", color: "var(--color-text-muted)", fontSize: "13px", cursor: "pointer", padding: 0, marginBottom: "8px", display: "block" },
  title: { fontSize: "24px", fontWeight: 700, marginBottom: "4px" },
  subtitle: { fontSize: "14px", color: "var(--color-text-muted)", marginBottom: 0 },
  tabs: { display: "flex", gap: "4px", marginBottom: "20px", borderBottom: "1px solid var(--color-border)", paddingBottom: "0" },
  tab: { padding: "8px 16px", background: "none", border: "none", color: "var(--color-text-muted)", cursor: "pointer", fontSize: "14px", fontWeight: 500, borderBottom: "2px solid transparent", marginBottom: "-1px" },
  activeTab: { color: "var(--color-accent)", borderBottomColor: "var(--color-accent)" },
  badge: { background: "var(--color-accent)", color: "#fff", borderRadius: "999px", fontSize: "11px", padding: "1px 6px", marginLeft: "6px" },
  filters: { display: "flex", flexDirection: "column", gap: "12px", marginBottom: "16px" },
  searchInput: { padding: "10px 14px", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "8px", color: "var(--color-text)", fontSize: "14px", outline: "none" },
  posFilters: { display: "flex", gap: "6px", flexWrap: "wrap" },
  posBtn: { padding: "5px 12px", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "6px", color: "var(--color-text-muted)", fontSize: "12px", fontWeight: 600, cursor: "pointer" },
  posBtnActive: { background: "var(--color-accent)", borderColor: "var(--color-accent)", color: "#fff" },
  list: { display: "flex", flexDirection: "column", gap: "6px" },
  playerRow: { display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "8px" },
  posBadge: { fontSize: "10px", fontWeight: 700, padding: "3px 7px", borderRadius: "4px", minWidth: "38px", textAlign: "center" },
  playerInfo: { flex: 1 },
  playerName: { fontSize: "14px", fontWeight: 600, display: "block" },
  playerMeta: { fontSize: "12px", color: "var(--color-text-muted)" },
  empty: { fontSize: "14px", color: "var(--color-text-muted)", padding: "24px 0" },
  claimRow: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "8px" },
  claimInfo: { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" },
  claimLabel: { fontSize: "11px", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase" },
  claimPlayer: { fontSize: "13px", fontWeight: 600 },
  cancelBtn: { background: "none", border: "1px solid var(--color-border)", borderRadius: "6px", padding: "4px 12px", color: "var(--color-text-muted)", cursor: "pointer", fontSize: "12px" },
  claimsNote: { fontSize: "12px", color: "var(--color-text-muted)", marginTop: "12px" },
  sectionTitle: { fontSize: "16px", fontWeight: 700, marginBottom: "4px" },
  dropBtn: { background: "none", border: "1px solid #ef4444", borderRadius: "6px", padding: "4px 12px", color: "#ef4444", cursor: "pointer", fontSize: "12px" },
  modalTitle: { fontSize: "18px", fontWeight: 700, marginBottom: "4px" },
  modalSub: { fontSize: "13px", color: "var(--color-text-muted)", marginBottom: "20px" },
  label: { fontSize: "12px", fontWeight: 600, color: "var(--color-text-muted)", display: "block", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" },
  select: { width: "100%", padding: "10px 12px", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "8px", color: "var(--color-text)", fontSize: "14px", marginBottom: "16px" },
  error: { color: "#ef4444", fontSize: "13px", marginBottom: "12px" },
  modalActions: { display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "8px" },
};
