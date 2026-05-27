import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { api } from "../api/client";

// ─── Shared PlayerPhoto (imported by MockDraft too) ───────────────────────────
const POS_COLORS: Record<string, string> = {
  QB: "#e74c3c", RB: "#2ecc71", WR: "#3498db",
  TE: "#f39c12", K: "#9b59b6", DEF: "#1abc9c",
};

export function PlayerPhoto({
  playerId, position, size = 40,
}: { playerId: string; position: string; size?: number }) {
  const [err, setErr] = useState(false);
  const color = POS_COLORS[position] ?? "#555";
  if (err) {
    return (
      <div style={{ width: size, height: size, borderRadius: "50%", background: color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <span style={{ color: "#fff", fontSize: size * 0.32, fontWeight: 700 }}>{position.slice(0, 2)}</span>
      </div>
    );
  }
  return (
    <img
      src={`https://sleepercdn.com/content/nfl/players/thumb/${playerId}.jpg`}
      alt=""
      width={size}
      height={size}
      style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0, background: color }}
      onError={() => setErr(true)}
    />
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Player {
  id: string;
  name: string;
  position: string;
  team: string | null;
  age: number | null;
  searchRank: number | null;
  espnId: string | null;
  fantasyPts2024: { halfPpr: number; fullPpr: number };
  projPts2025:    { halfPpr: number; fullPpr: number };
}

interface PlayerDetail extends Player {
  yearsExp: number | null;
  college:  string | null;
  height:   string | null;
  weight:   string | null;
  stats2024: {
    games: number | null; passYds: number | null; passTds: number | null; passInt: number | null;
    rushAtt: number | null; rushYds: number | null; rushTds: number | null;
    rec: number | null; targets: number | null; recYds: number | null; recTds: number | null;
  } | null;
  projStats2025: {
    passYds: number | null; passTds: number | null;
    rushYds: number | null; rushTds: number | null;
    rec: number | null; recYds: number | null; recTds: number | null;
  } | null;
  news: { headline: string; description: string; published: string; link: string | null }[];
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Players() {
  const navigate = useNavigate();
  const [players, setPlayers]     = useState<Player[]>([]);
  const [loading, setLoading]     = useState(true);
  const [posFilter, setPosFilter] = useState("ALL");
  const [searchQ,  setSearchQ]    = useState("");
  const [selected, setSelected]   = useState<PlayerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    api.get<{ players: Player[] }>("/players?limit=300").then(res => {
      if (res.ok) setPlayers(res.data.players);
      setLoading(false);
    });
  }, []);

  async function openPlayer(id: string) {
    setDetailLoading(true);
    setSelected(null);
    const res = await api.get<PlayerDetail>(`/players/${id}`);
    if (res.ok) setSelected(res.data);
    setDetailLoading(false);
  }

  const filtered = players.filter(p => {
    if (posFilter !== "ALL" && p.position !== posFilter) return false;
    if (searchQ && !p.name.toLowerCase().includes(searchQ.toLowerCase()) &&
        !(p.team ?? "").toLowerCase().includes(searchQ.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={s.page}>
      <Navbar />
      <div style={s.container}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "24px" }}>
          <div>
            <h1 style={s.title}>NFL Players</h1>
            <p style={s.subtitle}>{players.length} active players · 2025 season</p>
          </div>
          <button style={s.mockBtn} onClick={() => navigate("/mock-draft")}>Run Mock Draft →</button>
        </div>

        {/* Filters */}
        <div style={s.filterBar}>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {["ALL", "QB", "RB", "WR", "TE", "K", "DEF"].map(pos => (
              <button key={pos}
                style={{ ...s.filterTab, ...(posFilter === pos ? { background: POS_COLORS[pos] ?? "var(--color-accent)", color: "#fff", borderColor: "transparent" } : {}) }}
                onClick={() => setPosFilter(pos)}>
                {pos}
              </button>
            ))}
          </div>
          <input
            style={s.searchInput}
            placeholder="Search name or team…"
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
          />
        </div>

        {loading ? (
          <p style={s.loadingText}>Loading players…</p>
        ) : (
          <div style={s.grid}>
            {filtered.slice(0, 200).map(p => (
              <PlayerCard key={p.id} player={p} onClick={() => openPlayer(p.id)} />
            ))}
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      {(detailLoading || selected) && (
        <div style={s.overlay} onClick={() => { setSelected(null); setDetailLoading(false); }}>
          <div style={s.drawer} onClick={e => e.stopPropagation()}>
            <button style={s.closeBtn} onClick={() => { setSelected(null); setDetailLoading(false); }}>✕</button>
            {detailLoading && !selected ? (
              <div style={{ padding: "60px", textAlign: "center", color: "var(--color-text-muted)" }}>Loading…</div>
            ) : selected ? (
              <DrawerContent player={selected} />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Player Card ──────────────────────────────────────────────────────────────
function PlayerCard({ player: p, onClick }: { player: Player; onClick: () => void }) {
  const pts24  = p.fantasyPts2024.halfPpr;
  const pts25  = p.projPts2025.halfPpr;

  return (
    <div style={s.card} onClick={onClick}>
      <div style={s.cardTop}>
        <PlayerPhoto playerId={p.id} position={p.position} size={48} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={s.playerName}>{p.name}</p>
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <span style={{ ...s.posBadge, background: POS_COLORS[p.position] ?? "#555" }}>{p.position}</span>
            {p.team && <span style={s.metaLabel}>{p.team}</span>}
            {p.age   && <span style={s.metaLabel}>{p.age}y</span>}
          </div>
        </div>
        {p.searchRank && <span style={s.adpBadge}>#{p.searchRank}</span>}
      </div>

      {(pts24 > 0 || pts25 > 0) && (
        <div style={s.ptsRow}>
          {pts24 > 0 && (
            <div style={s.ptsTile}>
              <span style={s.ptsTileLabel}>2024</span>
              <span style={s.ptsTileVal}>{pts24}</span>
            </div>
          )}
          {pts25 > 0 && (
            <div style={{ ...s.ptsTile, borderColor: "rgba(30,75,216,0.3)", background: "rgba(30,75,216,0.06)" }}>
              <span style={{ ...s.ptsTileLabel, color: "var(--color-accent)" }}>2025 PROJ</span>
              <span style={{ ...s.ptsTileVal, color: "var(--color-accent)" }}>{pts25}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Drawer Content ───────────────────────────────────────────────────────────
function DrawerContent({ player: p }: { player: PlayerDetail }) {
  const fmt = (iso: string) => {
    try { return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
    catch { return iso; }
  };

  return (
    <div style={d.wrap}>
      {/* Hero */}
      <div style={d.hero}>
        <PlayerPhoto playerId={p.id} position={p.position} size={76} />
        <div style={{ flex: 1, paddingRight: "36px" }}>
          <h2 style={d.heroName}>{p.name}</h2>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", marginBottom: "4px" }}>
            <span style={{ ...d.badge, background: POS_COLORS[p.position] ?? "#555" }}>{p.position}</span>
            {p.team      && <span style={d.info}>{p.team}</span>}
            {p.age       && <span style={d.info}>{p.age} yrs old</span>}
            {p.yearsExp != null && <span style={d.info}>Year {p.yearsExp + 1}</span>}
          </div>
          {(p.height || p.weight) && (
            <p style={d.info}>{[p.height, p.weight && `${p.weight} lbs`].filter(Boolean).join(" · ")}</p>
          )}
          {p.college && <p style={d.info}>{p.college}</p>}
        </div>
      </div>

      {/* ADP */}
      {p.searchRank && (
        <div style={d.section}>
          <p style={d.sectionTitle}>ADP (Average Draft Position)</p>
          <p style={{ fontSize: "32px", fontWeight: 800, color: "var(--color-text)" }}>#{p.searchRank}</p>
        </div>
      )}

      {/* Fantasy Points */}
      <div style={d.section}>
        <p style={d.sectionTitle}>Fantasy Points — Half PPR</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          <div style={d.ptsTile}>
            <span style={d.ptsTileLabel}>2024 Actual</span>
            <span style={d.ptsTileVal}>{p.fantasyPts2024.halfPpr || "—"}</span>
          </div>
          <div style={{ ...d.ptsTile, borderColor: "rgba(30,75,216,0.3)", background: "rgba(30,75,216,0.07)" }}>
            <span style={{ ...d.ptsTileLabel, color: "var(--color-accent)" }}>2025 Projected</span>
            <span style={{ ...d.ptsTileVal, color: "var(--color-accent)" }}>{p.projPts2025.halfPpr || "—"}</span>
          </div>
        </div>
      </div>

      {/* 2024 Stats */}
      {p.stats2024 && (
        <div style={d.section}>
          <p style={d.sectionTitle}>2024 Stats</p>
          <div style={d.statGrid}>
            <Stat label="GP"       value={p.stats2024.games} />
            <Stat label="Pass Yds" value={p.stats2024.passYds} />
            <Stat label="Pass TD"  value={p.stats2024.passTds} />
            <Stat label="INT"      value={p.stats2024.passInt} />
            <Stat label="Rush Att" value={p.stats2024.rushAtt} />
            <Stat label="Rush Yds" value={p.stats2024.rushYds} />
            <Stat label="Rush TD"  value={p.stats2024.rushTds} />
            <Stat label="Targets"  value={p.stats2024.targets} />
            <Stat label="Rec"      value={p.stats2024.rec} />
            <Stat label="Rec Yds"  value={p.stats2024.recYds} />
            <Stat label="Rec TD"   value={p.stats2024.recTds} />
          </div>
        </div>
      )}

      {/* 2025 Projected Stats */}
      {p.projStats2025 && (
        <div style={d.section}>
          <p style={d.sectionTitle}>2025 Projected Stats</p>
          <div style={d.statGrid}>
            <Stat label="Pass Yds" value={p.projStats2025.passYds} accent />
            <Stat label="Pass TD"  value={p.projStats2025.passTds} accent />
            <Stat label="Rush Yds" value={p.projStats2025.rushYds} accent />
            <Stat label="Rush TD"  value={p.projStats2025.rushTds} accent />
            <Stat label="Rec"      value={p.projStats2025.rec}     accent />
            <Stat label="Rec Yds"  value={p.projStats2025.recYds}  accent />
            <Stat label="Rec TD"   value={p.projStats2025.recTds}  accent />
          </div>
        </div>
      )}

      {/* News */}
      <div style={d.section}>
        <p style={d.sectionTitle}>Latest News</p>
        {p.news.length === 0 ? (
          <p style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>No recent news available.</p>
        ) : p.news.map((item, i) => (
          <div key={i} style={d.newsItem}>
            <p style={d.newsDate}>{fmt(item.published)}</p>
            <p style={d.newsHeadline}>{item.headline}</p>
            {item.description && <p style={d.newsDesc}>{item.description}</p>}
            {item.link && (
              <a href={item.link} target="_blank" rel="noopener noreferrer" style={d.newsLink}>
                Read more →
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | null | undefined; accent?: boolean }) {
  if (value == null) return null;
  return (
    <div style={{ textAlign: "center", padding: "8px 4px", background: accent ? "rgba(30,75,216,0.06)" : "var(--color-bg)", borderRadius: "8px", border: `1px solid ${accent ? "rgba(30,75,216,0.2)" : "var(--color-border)"}` }}>
      <p style={{ fontSize: "10px", color: accent ? "var(--color-accent)" : "var(--color-text-muted)", marginBottom: "3px", fontWeight: 600 }}>{label}</p>
      <p style={{ fontSize: "15px", fontWeight: 800, color: accent ? "var(--color-accent)" : "var(--color-text)" }}>{value}</p>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  page:       { minHeight: "100vh", background: "var(--color-bg)" },
  container:  { maxWidth: "1200px", margin: "0 auto", padding: "32px 24px" },
  title:      { fontSize: "26px", fontWeight: 700, marginBottom: "4px" },
  subtitle:   { fontSize: "13px", color: "var(--color-text-muted)" },
  mockBtn:    { padding: "10px 20px", background: "var(--color-accent)", color: "#fff", border: "none", borderRadius: "8px", fontWeight: 700, cursor: "pointer", fontSize: "14px" },
  filterBar:  { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "20px" },
  filterTab:  { padding: "6px 14px", borderRadius: "20px", border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-muted)", cursor: "pointer", fontSize: "12px", fontWeight: 600 },
  searchInput:{ padding: "7px 14px", borderRadius: "20px", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text)", fontSize: "13px", minWidth: "200px" },
  loadingText:{ textAlign: "center", color: "var(--color-text-muted)", padding: "60px" },
  grid:       { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "12px" },

  card:       { background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius)", padding: "14px", cursor: "pointer" },
  cardTop:    { display: "flex", gap: "10px", alignItems: "center", marginBottom: "10px" },
  playerName: { fontSize: "14px", fontWeight: 700, marginBottom: "4px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  posBadge:   { fontSize: "10px", fontWeight: 700, color: "#fff", padding: "2px 6px", borderRadius: "4px", flexShrink: 0 },
  metaLabel:  { fontSize: "11px", color: "var(--color-text-muted)" },
  adpBadge:   { fontSize: "12px", fontWeight: 700, color: "var(--color-text-muted)", alignSelf: "flex-start", flexShrink: 0 },
  ptsRow:     { display: "flex", gap: "8px" },
  ptsTile:    { flex: 1, textAlign: "center", padding: "6px", borderRadius: "6px", border: "1px solid var(--color-border)", background: "var(--color-bg)" },
  ptsTileLabel:{ display: "block", fontSize: "9px", color: "var(--color-text-muted)", fontWeight: 700, marginBottom: "2px" },
  ptsTileVal: { display: "block", fontSize: "17px", fontWeight: 800 },

  overlay:    { position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", justifyContent: "flex-end" },
  drawer:     { width: "min(440px, 100vw)", height: "100vh", background: "var(--color-surface)", overflowY: "auto", boxShadow: "-4px 0 32px rgba(0,0,0,0.4)", position: "relative" },
  closeBtn:   { position: "sticky", top: "12px", float: "right", marginRight: "12px", background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)", width: "32px", height: "32px", borderRadius: "8px", cursor: "pointer", fontSize: "14px", zIndex: 1 },
};

const d: Record<string, React.CSSProperties> = {
  wrap:       { padding: "20px" },
  hero:       { display: "flex", gap: "14px", alignItems: "flex-start", marginBottom: "20px", marginTop: "8px" },
  heroName:   { fontSize: "22px", fontWeight: 800, marginBottom: "6px" },
  badge:      { fontSize: "11px", fontWeight: 700, color: "#fff", padding: "2px 8px", borderRadius: "4px" },
  info:       { fontSize: "12px", color: "var(--color-text-muted)" },

  section:      { marginBottom: "22px", paddingBottom: "22px", borderBottom: "1px solid var(--color-border)" },
  sectionTitle: { fontSize: "11px", fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: "10px" },

  ptsTile:      { textAlign: "center", padding: "12px", borderRadius: "10px", border: "1px solid var(--color-border)", background: "var(--color-bg)" },
  ptsTileLabel: { display: "block", fontSize: "10px", fontWeight: 700, color: "var(--color-text-muted)", marginBottom: "4px" },
  ptsTileVal:   { display: "block", fontSize: "30px", fontWeight: 800 },

  statGrid:   { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" },

  newsItem:     { padding: "12px", background: "var(--color-bg)", borderRadius: "8px", border: "1px solid var(--color-border)", marginBottom: "8px" },
  newsDate:     { fontSize: "11px", color: "var(--color-text-muted)", marginBottom: "4px" },
  newsHeadline: { fontSize: "13px", fontWeight: 700, lineHeight: "1.4", marginBottom: "4px" },
  newsDesc:     { fontSize: "12px", color: "var(--color-text-muted)", lineHeight: "1.5", marginBottom: "6px" },
  newsLink:     { fontSize: "12px", color: "var(--color-accent)", textDecoration: "none", fontWeight: 600 },
};
