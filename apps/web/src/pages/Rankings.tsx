import React, { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import { PlayerPhoto } from "./Players";
import { api } from "../api/client";

const POS_COLORS: Record<string, string> = {
  QB: "#e74c3c", RB: "#1A2A8E", WR: "#00D4FF",
  TE: "#FF6B00", K: "#A0B0C0", DEF: "#27AE60",
};

interface Player {
  id: string;
  name: string;
  position: string;
  team: string | null;
  age: number | null;
  searchRank: number | null;
  projPts2025: { halfPpr: number; fullPpr: number };
  projSeasonPts2025: { halfPpr: number; fullPpr: number };
  projStats2025: {
    passYds: number | null; passTds: number | null;
    rushYds: number | null; rushTds: number | null;
    rec: number | null; recYds: number | null; recTds: number | null;
  } | null;
  stats2024: {
    games: number | null; passYds: number | null; passTds: number | null; passInt: number | null;
    rushAtt: number | null; rushYds: number | null; rushTds: number | null;
    rec: number | null; targets: number | null; recYds: number | null; recTds: number | null;
  } | null;
}

interface PlayerDetail extends Player {
  yearsExp: number | null;
  college: string | null;
  height: string | null;
  weight: string | null;
  fantasyPts2024: { halfPpr: number; fullPpr: number };
  news: { headline: string; description: string; published: string; link: string | null }[];
}

type SortCol = "RR" | "ADP" | "PROJ PPG" | "PASS YDS" | "PASS TD" | "RUSH YDS" | "REC" | "REC YDS";

function gridCols(pos: string) {
  return pos === "ALL" ? "60px 1fr 80px 100px" : "60px 1fr 80px 100px 80px 70px";
}

const POS_STAT_COLS: Record<string, { label: string; key: (p: Player) => number | null }[]> = {
  QB: [
    { label: "PASS YDS", key: p => p.projStats2025?.passYds ?? null },
    { label: "PASS TD",  key: p => p.projStats2025?.passTds ?? null },
  ],
  RB: [
    { label: "RUSH YDS", key: p => p.projStats2025?.rushYds ?? null },
    { label: "REC",      key: p => p.projStats2025?.rec ?? null },
  ],
  WR: [
    { label: "REC YDS",  key: p => p.projStats2025?.recYds ?? null },
    { label: "REC",      key: p => p.projStats2025?.rec ?? null },
  ],
  TE: [
    { label: "REC YDS",  key: p => p.projStats2025?.recYds ?? null },
    { label: "REC",      key: p => p.projStats2025?.rec ?? null },
  ],
};

function getStatVal(p: Player, col: SortCol, rrMap: Map<string, { rrRank: number; rrPos: string }>, posFilter: string): number {
  if (col === "RR") {
    const rr = rrMap.get(p.id);
    return (rr && (posFilter === "ALL" || rr.rrPos === posFilter)) ? rr.rrRank : 99999;
  }
  if (col === "ADP") return p.searchRank ?? 99999;
  if (col === "PROJ PPG") return p.projPts2025?.halfPpr ?? 0;
  if (col === "PASS YDS") return p.projStats2025?.passYds ?? 0;
  if (col === "PASS TD") return p.projStats2025?.passTds ?? 0;
  if (col === "RUSH YDS") return p.projStats2025?.rushYds ?? 0;
  if (col === "REC") return p.projStats2025?.rec ?? 0;
  if (col === "REC YDS") return p.projStats2025?.recYds ?? 0;
  return 0;
}

export default function Rankings() {
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [rrMap, setRrMap] = useState<Map<string, { rrRank: number; rrPos: string }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [posFilter, setPosFilter] = useState("ALL");
  const [searchQ, setSearchQ] = useState("");
  const [sortCol, setSortCol] = useState<SortCol>("RR");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selected, setSelected] = useState<PlayerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [pRes, rRes] = await Promise.all([
      api.get<{ players: Player[] }>("/players?limit=300"),
      api.get<{ rankings: { playerId: string; rank: number; notes?: string }[] }>("/rankings"),
    ]);
    if (pRes.ok) setAllPlayers(pRes.data.players);
    if (rRes.ok) {
      const map = new Map<string, { rrRank: number; rrPos: string }>();
      for (const r of rRes.data.rankings) {
        map.set(r.playerId, { rrRank: r.rank, rrPos: r.notes ?? "" });
      }
      setRrMap(map);
    }
    setLoading(false);
  }

  async function openPlayer(id: string) {
    setDetailLoading(true);
    setSelected(null);
    const res = await api.get<PlayerDetail>(`/players/${id}`);
    if (res.ok) setSelected(res.data);
    setDetailLoading(false);
  }

  function handleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortCol(col);
      // RR and ADP sort ascending by default (lower = better), stats descending (higher = better)
      setSortDir(col === "RR" || col === "ADP" ? "asc" : "desc");
    }
  }

  const filtered = allPlayers.filter(p => {
    if (posFilter !== "ALL" && p.position !== posFilter) return false;
    if (searchQ && !p.name.toLowerCase().includes(searchQ.toLowerCase()) &&
        !(p.team ?? "").toLowerCase().includes(searchQ.toLowerCase())) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const av = getStatVal(a, sortCol, rrMap, posFilter);
    const bv = getStatVal(b, sortCol, rrMap, posFilter);
    return sortDir === "asc" ? av - bv : bv - av;
  });

  const statCols = posFilter !== "ALL" ? (POS_STAT_COLS[posFilter] ?? []) : [];
  const cols = gridCols(posFilter);

  function ColHeader({ label, right }: { label: string; right?: boolean }) {
    const active = sortCol === label;
    const arrow = active ? (sortDir === "asc" ? " ^" : " v") : "";
    return (
      <span
        onClick={() => handleSort(label as SortCol)}
        style={{
          ...hdrCell,
          textAlign: right ? "right" : "left",
          cursor: "pointer",
          color: active ? "var(--color-accent)" : "var(--color-text-muted)",
          userSelect: "none",
        }}
      >
        {label}{arrow}
      </span>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg)" }}>
      <Navbar />
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "32px 24px" }}>
        <div style={{ marginBottom: "32px" }}>
          <h1 style={{ fontSize: "28px", fontWeight: 800, marginBottom: "4px", letterSpacing: "-0.5px", color: "var(--color-text)" }}>Rivyl Rankings</h1>
          <p style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>{rrMap.size} ranked · {allPlayers.length} total players · 2025 season</p>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {["ALL", "QB", "RB", "WR", "TE", "K", "DEF"].map(pos => {
              const active = posFilter === pos;
              return (
                <button key={pos} onClick={() => setPosFilter(pos)} style={{
                  padding: "7px 16px", borderRadius: "8px",
                  border: active ? "none" : "1px solid var(--color-border)",
                  background: active ? (POS_COLORS[pos] ?? "var(--color-accent)") : "transparent",
                  color: active ? "#fff" : "var(--color-text-muted)",
                  cursor: "pointer", fontSize: "12px", fontWeight: 700,
                }}>{pos}</button>
              );
            })}
          </div>
          <input
            placeholder="Search player or team..."
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text)", fontSize: "13px", minWidth: "200px", outline: "none" }}
          />
        </div>

        {!loading && (
          <div style={{ display: "grid", gridTemplateColumns: cols, padding: "0 16px 10px 20px", borderBottom: "2px solid var(--color-border)", marginBottom: "2px" }}>
            <ColHeader label="RR" />
            <span style={hdrCell}>PLAYER</span>
            <ColHeader label="ADP" right />
            <ColHeader label="PROJ PPG" right />
            {statCols.map(c => <ColHeader key={c.label} label={c.label} right />)}
          </div>
        )}

        {loading ? (
          <p style={{ textAlign: "center", color: "var(--color-text-muted)", padding: "60px" }}>Loading...</p>
        ) : (
          <div>
            {sorted.slice(0, 250).map(p => {
              const rr = rrMap.get(p.id);
              const isRanked = rr && (posFilter === "ALL" || rr.rrPos === posFilter);
              return (
                <RankingRow
                  key={p.id}
                  player={p}
                  rrRank={isRanked ? rr!.rrRank : null}
                  rrPos={isRanked ? rr!.rrPos : null}
                  posFilter={posFilter}
                  statCols={statCols}
                  cols={cols}
                  onClick={() => openPlayer(p.id)}
                />
              );
            })}
          </div>
        )}
      </div>

      {(detailLoading || selected) && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 200, display: "flex", justifyContent: "flex-end" }}
          onClick={() => { setSelected(null); setDetailLoading(false); }}>
          <div style={{ width: "min(460px, 100vw)", height: "100vh", background: "var(--color-surface)", overflowY: "auto", boxShadow: "-8px 0 48px rgba(0,0,0,0.5)" }}
            onClick={e => e.stopPropagation()}>
            <button onClick={() => { setSelected(null); setDetailLoading(false); }}
              style={{ position: "sticky", top: "16px", float: "right", marginRight: "16px", background: "rgba(255,255,255,0.08)", border: "none", color: "var(--color-text-muted)", width: "32px", height: "32px", borderRadius: "8px", cursor: "pointer", fontSize: "16px", zIndex: 1 }}>x</button>
            {detailLoading && !selected
              ? <div style={{ padding: "80px", textAlign: "center", color: "var(--color-text-muted)" }}>Loading...</div>
              : selected ? <DrawerContent player={selected} rrRank={rrMap.get(selected.id)?.rrRank ?? null} rrPos={rrMap.get(selected.id)?.rrPos ?? null} /> : null}
          </div>
        </div>
      )}
    </div>
  );
}

function RankingRow({ player: p, rrRank, rrPos, posFilter, statCols, cols, onClick }: {
  player: Player; rrRank: number | null; rrPos: string | null;
  posFilter: string; statCols: { label: string; key: (p: Player) => number | null }[];
  cols: string; onClick: () => void;
}) {
  const [hov, setHov] = useState(false);
  const posColor = POS_COLORS[p.position] ?? "#555";
  const ppg = p.projPts2025?.halfPpr ?? 0;
  const rrLabel = rrRank != null ? (posFilter === "ALL" ? `${rrPos} ${rrRank}` : `#${rrRank}`) : "-";

  return (
    <div onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: "grid", gridTemplateColumns: cols, alignItems: "center", padding: "12px 16px",
        borderBottom: "1px solid var(--color-border)", borderLeft: `3px solid ${rrRank != null ? posColor : "transparent"}`,
        cursor: "pointer", background: hov ? "rgba(255,255,255,0.03)" : "transparent", transition: "background 0.1s" }}>
      <span style={{ fontSize: "12px", fontWeight: 700, color: rrRank != null ? posColor : "var(--color-text-muted)", opacity: rrRank != null ? 1 : 0.4 }}>
        {rrLabel}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
        <PlayerPhoto playerId={p.id} position={p.position} size={38} />
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: "14px", fontWeight: 700, marginBottom: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "var(--color-text)" }}>{p.name}</p>
          <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
            <span style={{ fontSize: "10px", fontWeight: 700, color: "#fff", background: posColor, padding: "1px 5px", borderRadius: "3px" }}>{p.position}</span>
            {p.team && <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>{p.team}</span>}
          </div>
        </div>
      </div>
      <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-muted)", textAlign: "right" }}>
        {p.searchRank ? `#${p.searchRank}` : "-"}
      </span>
      <span style={{ fontSize: "16px", fontWeight: 800, color: ppg > 0 ? posColor : "var(--color-text-muted)", textAlign: "right" }}>
        {ppg > 0 ? ppg.toFixed(1) : "-"}
      </span>
      {statCols.map(c => {
        const val = c.key(p);
        return <span key={c.label} style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-muted)", textAlign: "right" }}>{val != null && val > 0 ? val.toFixed(1) : "-"}</span>;
      })}
    </div>
  );
}

function DrawerContent({ player: p, rrRank, rrPos }: { player: PlayerDetail; rrRank: number | null; rrPos: string | null }) {
  const posColor = POS_COLORS[p.position] ?? "#555";
  const fmt = (iso: string) => {
    try { return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
    catch { return iso; }
  };
  return (
    <div>
      <div style={{ padding: "36px 24px 24px", background: `linear-gradient(135deg, ${posColor}22 0%, transparent 60%)`, borderBottom: "1px solid var(--color-border)" }}>
        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <PlayerPhoto playerId={p.id} position={p.position} size={80} />
            <span style={{ position: "absolute", bottom: -6, left: "50%", transform: "translateX(-50%)", fontSize: "9px", fontWeight: 700, color: "#fff", background: posColor, padding: "2px 7px", borderRadius: "4px", whiteSpace: "nowrap" }}>{p.position}</span>
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: "22px", fontWeight: 800, marginBottom: "6px", color: "var(--color-text)", letterSpacing: "-0.3px" }}>{p.name}</h2>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", marginBottom: "4px" }}>
              {p.team && <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text)" }}>{p.team}</span>}
              {p.age && <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>{p.age} yrs</span>}
              {p.yearsExp != null && <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Year {p.yearsExp + 1}</span>}
            </div>
            {(p.height || p.weight) && (
              <p style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                {[p.height ? `${Math.floor(Number(p.height)/12)}ft ${Number(p.height)%12}in` : null, p.weight && `${p.weight} lbs`].filter(Boolean).join(" · ")}
              </p>
            )}
            {p.college && <p style={{ fontSize: "12px", color: "var(--color-text-muted)", marginTop: "2px" }}>{p.college}</p>}
          </div>
        </div>
      </div>
      <div style={{ padding: "24px" }}>
        {rrRank != null && (
          <div style={{ marginBottom: "24px", paddingBottom: "24px", borderBottom: "1px solid var(--color-border)" }}>
            <p style={secLabel}>Rivyl Ranking</p>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
              <span style={{ fontSize: "44px", fontWeight: 800, color: posColor, lineHeight: 1 }}>#{rrRank}</span>
              <span style={{ fontSize: "14px", color: "var(--color-text-muted)", fontWeight: 600 }}>{rrPos}</span>
            </div>
          </div>
        )}
        {p.searchRank && (
          <div style={{ marginBottom: "24px", paddingBottom: "24px", borderBottom: "1px solid var(--color-border)" }}>
            <p style={secLabel}>ADP (Average Draft Position)</p>
            <p style={{ fontSize: "38px", fontWeight: 800, color: "var(--color-text)", lineHeight: 1 }}>#{p.searchRank}</p>
          </div>
        )}
        <div style={{ marginBottom: "24px", paddingBottom: "24px", borderBottom: "1px solid var(--color-border)" }}>
          <p style={secLabel}>Fantasy Points - Half PPR</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div style={{ padding: "16px", borderRadius: "10px", border: "1px solid var(--color-border)", background: "var(--color-bg)", textAlign: "center" }}>
              <span style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "var(--color-text-muted)", marginBottom: "6px" }}>2024 ACTUAL</span>
              <span style={{ display: "block", fontSize: "28px", fontWeight: 800, color: "var(--color-text)" }}>{p.fantasyPts2024?.halfPpr || "-"}</span>
            </div>
            <div style={{ padding: "16px", borderRadius: "10px", border: `1px solid ${posColor}44`, background: `${posColor}11`, textAlign: "center" }}>
              <span style={{ display: "block", fontSize: "10px", fontWeight: 700, color: posColor, marginBottom: "6px" }}>2025 PROJ PPG</span>
              <span style={{ display: "block", fontSize: "28px", fontWeight: 800, color: posColor }}>{p.projPts2025?.halfPpr || "-"}</span>
            </div>
          </div>
        </div>
        {p.projStats2025 && (
          <div style={{ marginBottom: "24px", paddingBottom: "24px", borderBottom: "1px solid var(--color-border)" }}>
            <p style={secLabel}>2025 Projected (Per Game)</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
              <DStat label="Pass Yds" value={p.projStats2025.passYds} color={posColor} />
              <DStat label="Pass TD" value={p.projStats2025.passTds} color={posColor} />
              <DStat label="Rush Yds" value={p.projStats2025.rushYds} color={posColor} />
              <DStat label="Rush TD" value={p.projStats2025.rushTds} color={posColor} />
              <DStat label="Rec" value={p.projStats2025.rec} color={posColor} />
              <DStat label="Rec Yds" value={p.projStats2025.recYds} color={posColor} />
              <DStat label="Rec TD" value={p.projStats2025.recTds} color={posColor} />
            </div>
          </div>
        )}
        {p.stats2024 && (
          <div style={{ marginBottom: "24px", paddingBottom: "24px", borderBottom: "1px solid var(--color-border)" }}>
            <p style={secLabel}>2024 Stats</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
              <DStat label="GP" value={p.stats2024.games} />
              <DStat label="Pass Yds" value={p.stats2024.passYds} />
              <DStat label="Pass TD" value={p.stats2024.passTds} />
              <DStat label="INT" value={p.stats2024.passInt} />
              <DStat label="Rush Att" value={p.stats2024.rushAtt} />
              <DStat label="Rush Yds" value={p.stats2024.rushYds} />
              <DStat label="Rush TD" value={p.stats2024.rushTds} />
              <DStat label="Targets" value={p.stats2024.targets} />
              <DStat label="Rec" value={p.stats2024.rec} />
              <DStat label="Rec Yds" value={p.stats2024.recYds} />
              <DStat label="Rec TD" value={p.stats2024.recTds} />
            </div>
          </div>
        )}
        <div>
          <p style={secLabel}>Latest News</p>
          {!p.news || p.news.length === 0
            ? <p style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>No recent news available.</p>
            : p.news.map((item, i) => (
              <div key={i} style={{ padding: "14px", background: "var(--color-bg)", borderRadius: "10px", border: "1px solid var(--color-border)", marginBottom: "8px" }}>
                <p style={{ fontSize: "11px", color: "var(--color-text-muted)", marginBottom: "4px" }}>{fmt(item.published)}</p>
                <p style={{ fontSize: "13px", fontWeight: 700, lineHeight: "1.4", marginBottom: "4px", color: "var(--color-text)" }}>{item.headline}</p>
                {item.description && <p style={{ fontSize: "12px", color: "var(--color-text-muted)", lineHeight: "1.5", marginBottom: "6px" }}>{item.description}</p>}
                {item.link && <a href={item.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: "12px", color: posColor, textDecoration: "none", fontWeight: 600 }}>Read more</a>}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

const hdrCell: React.CSSProperties = { fontSize: "10px", fontWeight: 700, color: "var(--color-text-muted)", letterSpacing: "0.8px" };
const secLabel: React.CSSProperties = { fontSize: "10px", fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "12px" };

function DStat({ label, value, color }: { label: string; value: number | null | undefined; color?: string }) {
  if (value == null || value === 0) return null;
  return (
    <div style={{ textAlign: "center", padding: "10px 6px", background: color ? `${color}0d` : "var(--color-bg)", borderRadius: "8px", border: `1px solid ${color ? `${color}33` : "var(--color-border)"}` }}>
      <p style={{ fontSize: "10px", color: color ?? "var(--color-text-muted)", marginBottom: "4px", fontWeight: 700 }}>{label}</p>
      <p style={{ fontSize: "15px", fontWeight: 800, color: color ?? "var(--color-text)" }}>{value}</p>
    </div>
  );
}
