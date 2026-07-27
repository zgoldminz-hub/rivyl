import React, { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { PlayerPhoto } from "./Players";
import { api } from "../api/client";

interface Player {
  id: string;
  name: string;
  position: string;
  team: string | null;
  searchRank: number | null;
  projSeasonPts2025?: { halfPpr: number };
}

interface RankedPlayer extends Player {
  rivylRank: number;
  notes?: string;
}

const POS_COLORS: Record<string, string> = {
  QB: "#e74c3c", RB: "#1A2A8E", WR: "#00D4FF",
  TE: "#FF6B00", K: "#A0B0C0", DEF: "#27AE60",
};

export default function Rankings() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [rankings, setRankings] = useState<RankedPlayer[]>([]);
  const [unranked, setUnranked] = useState<Player[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [posFilter, setPosFilter] = useState("ALL");
  const [searchQ, setSearchQ] = useState("");
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  useEffect(() => {
    loadData();

  }, []);

  async function loadData() {
    const [pRes, rRes] = await Promise.all([
      api.get<{ players: Player[] }>("/players?limit=300"),
      api.get<{ rankings: { playerId: string; rank: number; notes?: string }[] }>("/rankings"),
    ]);
    if (!pRes.ok || !rRes.ok) return;

    const allPlayers = pRes.data.players;
    const rankMap = new Map(rRes.data.rankings.map((r) => [r.playerId, r]));

    const ranked: RankedPlayer[] = [];
    const unrankedList: Player[] = [];

    for (const p of allPlayers) {
      const r = rankMap.get(p.id);
      if (r) ranked.push({ ...p, rivylRank: r.rank, notes: r.notes });
      else unrankedList.push(p);
    }

    ranked.sort((a, b) => a.rivylRank - b.rivylRank);
    setRankings(ranked);
    setUnranked(unrankedList);
    setPlayers(allPlayers);
  }

  async function checkAdmin() {}

  async function saveRankings() {
    setSaving(true);
    const payload = rankings.map((p, i) => ({ playerId: p.id, rank: i + 1, notes: p.notes }));
    await api.put("/rankings", { rankings: payload });
    setSaving(false);
    setEditMode(false);
    loadData();
  }

  function addToRankings(player: Player) {
    const newRanked: RankedPlayer = { ...player, rivylRank: rankings.length + 1 };
    setRankings([...rankings, newRanked]);
    setUnranked(unranked.filter((p) => p.id !== player.id));
  }

  function removeFromRankings(playerId: string) {
    const removed = rankings.find((p) => p.id === playerId);
    if (!removed) return;
    setRankings(rankings.filter((p) => p.id !== playerId));
    setUnranked([...unranked, removed]);
  }

  function moveUp(idx: number) {
    if (idx === 0) return;
    const arr = [...rankings];
    [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
    setRankings(arr);
  }

  function moveDown(idx: number) {
    if (idx === rankings.length - 1) return;
    const arr = [...rankings];
    [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
    setRankings(arr);
  }

  function handleDragStart(idx: number) { setDragIdx(idx); }
  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    const arr = [...rankings];
    const [moved] = arr.splice(dragIdx, 1);
    arr.splice(idx, 0, moved);
    setRankings(arr);
    setDragIdx(idx);
  }
  function handleDragEnd() { setDragIdx(null); }

  const filteredRankings = rankings.filter((p) => {
    if (posFilter !== "ALL" && p.position !== posFilter) return false;
    if (searchQ && !p.name.toLowerCase().includes(searchQ.toLowerCase())) return false;
    return true;
  });

  const filteredUnranked = unranked.filter((p) => {
    if (posFilter !== "ALL" && p.position !== posFilter) return false;
    if (searchQ && !p.name.toLowerCase().includes(searchQ.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={styles.page}>
      <Navbar />
      <div style={styles.container}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Rivyl Rankings</h1>
            <p style={styles.subtitle}>Official staff rankings for the 2025 season</p>
          </div>
          {isAdmin && (
            <div style={{ display: "flex", gap: "10px" }}>
              {editMode ? (
                <>
                  <button style={styles.saveBtn} onClick={saveRankings} disabled={saving}>
                    {saving ? "Saving..." : "Save Rankings"}
                  </button>
                  <button style={styles.cancelBtn} onClick={() => { setEditMode(false); loadData(); }}>
                    Cancel
                  </button>
                </>
              ) : (
                <button style={styles.editBtn} onClick={() => setEditMode(true)}>
                  Edit Rankings
                </button>
              )}
            </div>
          )}
        </div>

        <div style={styles.filterRow}>
          {["ALL", "QB", "RB", "WR", "TE", "K", "DEF"].map((pos) => (
            <button key={pos} style={{ ...styles.filterTab, ...(posFilter === pos ? { background: POS_COLORS[pos] ?? "var(--color-accent)", color: "#fff", borderColor: "transparent" } : {}) }}
              onClick={() => setPosFilter(pos)}>{pos}</button>
          ))}
          <input style={styles.searchInput} placeholder="Search..." value={searchQ} onChange={(e) => setSearchQ(e.target.value)} />
        </div>

        <div style={styles.tableHeader}>
          <span style={styles.colRank}>RR</span>
          <span style={styles.colPlayer}>Player</span>
          <span style={styles.colAdp}>ADP</span>
          <span style={styles.colPts}>Proj Pts</span>
          {editMode && <span style={styles.colActions}>Actions</span>}
        </div>

        {filteredRankings.map((p, i) => {
          const actualIdx = rankings.indexOf(p);
          return (
            <div
              key={p.id}
              style={{ ...styles.playerRow, ...(dragIdx === actualIdx ? styles.dragging : {}) }}
              draggable={editMode}
              onDragStart={() => handleDragStart(actualIdx)}
              onDragOver={(e) => handleDragOver(e, actualIdx)}
              onDragEnd={handleDragEnd}
            >
              <span style={styles.colRank}>
                <span style={styles.rankNum}>{i + 1}</span>
              </span>
              <span style={styles.colPlayer}>
                <PlayerPhoto playerId={p.id} position={p.position} size={36} />
                <div style={{ minWidth: 0 }}>
                  <p style={styles.playerName}>{p.name}</p>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <span style={{ ...styles.posBadge, background: POS_COLORS[p.position] ?? "#555" }}>{p.position}</span>
                    {p.team && <span style={styles.teamLabel}>{p.team}</span>}
                  </div>
                </div>
              </span>
              <span style={styles.colAdp}>
                <span style={styles.adpVal}>#{p.searchRank ?? "—"}</span>
              </span>
              <span style={styles.colPts}>
                <span style={styles.ptsVal}>{p.projSeasonPts2025?.halfPpr?.toFixed(0) ?? "—"}</span>
              </span>
              {editMode && (
                <span style={styles.colActions}>
                  <button style={styles.actionBtn} onClick={() => moveUp(actualIdx)}>↑</button>
                  <button style={styles.actionBtn} onClick={() => moveDown(actualIdx)}>↓</button>
                  <button style={{ ...styles.actionBtn, color: "#e74c3c" }} onClick={() => removeFromRankings(p.id)}>✕</button>
                </span>
              )}
            </div>
          );
        })}

        {editMode && filteredUnranked.length > 0 && (
          <div style={{ marginTop: "32px" }}>
            <h3 style={styles.unrankedTitle}>Unranked Players — click + to add</h3>
            {filteredUnranked.slice(0, 50).map((p) => (
              <div key={p.id} style={styles.unrankedRow}>
                <PlayerPhoto playerId={p.id} position={p.position} size={30} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={styles.playerName}>{p.name}</p>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <span style={{ ...styles.posBadge, background: POS_COLORS[p.position] ?? "#555" }}>{p.position}</span>
                    {p.team && <span style={styles.teamLabel}>{p.team}</span>}
                  </div>
                </div>
                <button style={styles.addBtn} onClick={() => addToRankings(p)}>+</button>
              </div>
            ))}
          </div>
        )}

        {filteredRankings.length === 0 && !editMode && (
          <div style={styles.empty}>
            <p>No rankings yet.{isAdmin ? " Click \"Edit Rankings\" to get started." : " Check back soon!"}</p>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "var(--color-bg)" },
  container: { maxWidth: "900px", margin: "0 auto", padding: "32px 24px" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" },
  title: { fontSize: "26px", fontWeight: 700, marginBottom: "4px" },
  subtitle: { fontSize: "13px", color: "var(--color-text-muted)" },
  editBtn: { padding: "8px 18px", borderRadius: "8px", border: "none", background: "var(--color-accent)", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: "13px" },
  saveBtn: { padding: "8px 18px", borderRadius: "8px", border: "none", background: "#2ecc71", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: "13px" },
  cancelBtn: { padding: "8px 18px", borderRadius: "8px", border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-muted)", cursor: "pointer", fontSize: "13px" },
  filterRow: { display: "flex", gap: "6px", marginBottom: "16px", flexWrap: "wrap", alignItems: "center" },
  filterTab: { padding: "4px 10px", borderRadius: "12px", border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-muted)", fontSize: "11px", cursor: "pointer" },
  searchInput: { padding: "5px 10px", borderRadius: "8px", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text)", fontSize: "12px", marginLeft: "auto" },
  tableHeader: { display: "grid", gridTemplateColumns: "50px 1fr 80px 80px", padding: "8px 12px", borderBottom: "2px solid var(--color-border)", marginBottom: "4px" },
  colRank: { fontSize: "11px", fontWeight: 700, color: "var(--color-text-muted)", display: "flex", alignItems: "center" },
  colPlayer: { fontSize: "11px", fontWeight: 700, color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: "10px" },
  colAdp: { fontSize: "11px", fontWeight: 700, color: "var(--color-text-muted)", display: "flex", alignItems: "center", justifyContent: "center" },
  colPts: { fontSize: "11px", fontWeight: 700, color: "var(--color-text-muted)", display: "flex", alignItems: "center", justifyContent: "center" },
  colActions: { fontSize: "11px", fontWeight: 700, color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: "4px" },
  playerRow: { display: "grid", gridTemplateColumns: "50px 1fr 80px 80px", padding: "10px 12px", borderRadius: "8px", marginBottom: "2px", background: "var(--color-surface)", border: "1px solid var(--color-border)", cursor: "grab", alignItems: "center" },
  dragging: { opacity: 0.5, border: "1px solid var(--color-accent)" },
  rankNum: { fontSize: "16px", fontWeight: 700, color: "var(--color-accent)" },
  playerName: { fontSize: "13px", fontWeight: 600, marginBottom: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  posBadge: { fontSize: "10px", fontWeight: 700, color: "#fff", padding: "1px 5px", borderRadius: "3px" },
  teamLabel: { fontSize: "11px", color: "var(--color-text-muted)" },
  adpVal: { fontSize: "13px", color: "var(--color-text-muted)" },
  ptsVal: { fontSize: "13px", fontWeight: 600, color: "var(--color-accent)" },
  actionBtn: { padding: "2px 7px", borderRadius: "4px", border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text)", cursor: "pointer", fontSize: "12px" },
  unrankedTitle: { fontSize: "13px", fontWeight: 700, color: "var(--color-text-muted)", marginBottom: "10px", textTransform: "uppercase" },
  unrankedRow: { display: "flex", gap: "10px", alignItems: "center", padding: "8px 12px", borderRadius: "8px", background: "var(--color-surface)", border: "1px solid var(--color-border)", marginBottom: "4px" },
  addBtn: { padding: "4px 10px", borderRadius: "6px", border: "none", background: "var(--color-accent)", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: "14px" },
  empty: { textAlign: "center", padding: "60px 0", color: "var(--color-text-muted)", fontSize: "14px" },
};
