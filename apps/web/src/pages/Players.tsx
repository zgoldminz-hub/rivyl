import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { api } from "../api/client";

const POS_COLORS: Record<string, string> = {
  QB: "#e74c3c", RB: "#1A2A8E", WR: "#00D4FF",
  TE: "#FF6B00", K: "#A0B0C0", DEF: "#27AE60",
};

export function PlayerPhoto({ playerId, position, size = 40 }: { playerId: string; position: string; size?: number }) {
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
      alt="" width={size} height={size}
      style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0, background: color }}
      onError={() => setErr(true)}
    />
  );
}

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

export default function Players() {
  const navigate = useNavigate();
  const [players, setPlayers]         = useState<Player[]>([]);
  const [loading, setLoading]         = useState(true);
  const [posFilter, setPosFilter]     = useState("ALL");
  const [searchQ,  setSearchQ]        = useState("");
  const [selected, setSelected]       = useState<PlayerDetail | null>(null);
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
    <div style={{ minHeight: "100vh", background: "var(--color-bg)" }}>
      <Navbar />
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "32px 24px" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "32px" }}>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: 800, marginBottom: "4px", letterSpacing: "-0.5px", color: "var(--color-text)" }}>NFL Players</h1>
            <p style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>{players.length} active players · 2025 season</p>
          </div>
          <button onClick={() => navigate("/mock-draft")}
            style={{ padding: "10px 22px", background: "var(--color-accent)", color: "#fff", border: "none", borderRadius: "8px", fontWeight: 700, cursor: "pointer", fontSize: "14px" }}>
            Run Mock Draft →
          </button>
        </div>

        {/* Filters */}
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
                }}>
                  {pos}
                </button>
              );
            })}
          </div>
          <input
            placeholder="Search player or team…"
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            style={{
              padding: "8px 16px", borderRadius: "8px",
              border: "1px solid var(--color-border)",
              background: "var(--color-surface)", color: "var(--color-text)",
              fontSize: "13px", minWidth: "220px", outline: "none",
            }}
          />
        </div>

        {/* Column Headers */}
        {!loading && (
          <div style={{ display: "grid", gridTemplateColumns: "52px 1fr 90px 110px", padding: "0 16px 10px 20px", borderBottom: "2px solid var(--color-border)", marginBottom: "2px" }}>
            {[["RANK","left"],["PLAYER","left"],["ADP","right"],["PROJ PPG","right"]].map(([h, align]) => (
              <span key={h} style={{ fontSize: "10px", fontWeight: 700, color: "var(--color-text-muted)", letterSpacing: "0.8px", textAlign: align as "left"|"right" }}>{h}</span>
            ))}
          </div>
        )}

        {/* Player List */}
        {loading ? (
          <p style={{ textAlign: "center", color: "var(--color-text-muted)", padding: "60px" }}>Loading players…</p>
        ) : (
          <div>
            {filtered.slice(0, 200).map((p, i) => (
              <PlayerRow key={p.id} player={p} index={i} onClick={() => openPlayer(p.id)} />
            ))}
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      {(detailLoading || selected) && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 200, display: "flex", justifyContent: "flex-end" }}
          onClick={() => { setSelected(null); setDetailLoading(false); }}>
          <div style={{ width: "min(460px, 100vw)", height: "100vh", background: "var(--color-surface)", overflowY: "auto", boxShadow: "-8px 0 48px rgba(0,0,0,0.5)", position: "relative" }}
            onClick={e => e.stopPropagation()}>
            <button onClick={() => { setSelected(null); setDetailLoading(false); }}
              style={{ position: "sticky", top: "16px", float: "right", marginRight: "16px", background: "rgba(255,255,255,0.08)", border: "none", color: "var(--color-text-muted)", width: "32px", height: "32px", borderRadius: "8px", cursor: "pointer", fontSize: "16px", zIndex: 1 }}>
              ✕
            </button>
            {detailLoading && !selected
              ? <div style={{ padding: "80px", textAlign: "center", color: "var(--color-text-muted)" }}>Loading…</div>
              : selected ? <DrawerContent player={selected} /> : null}
          </div>
        </div>
      )}
    </div>
  );
}

function PlayerRow({ player: p, index, onClick }: { player: Player; index: number; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  const posColor = POS_COLORS[p.position] ?? "#555";
  const pts = p.projPts2025.halfPpr;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "grid",
        gridTemplateColumns: "52px 1fr 90px 110px",
        alignItems: "center",
        padding: "12px 16px",
        borderBottom: "1px solid var(--color-border)",
        borderLeft: `3px solid ${posColor}`,
        cursor: "pointer",
        background: hov ? "rgba(255,255,255,0.03)" : "transparent",
        transition: "background 0.1s",
      }}>
      <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--color-text-muted)", paddingLeft: "2px" }}>
        {p.searchRank ? `#${p.searchRank}` : `${index + 1}`}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
        <PlayerPhoto playerId={p.id} position={p.position} size={38} />
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: "14px", fontWeight: 700, marginBottom: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "var(--color-text)" }}>{p.name}</p>
          <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
            <span style={{ fontSize: "10px", fontWeight: 700, color: "#fff", background: posColor, padding: "1px 5px", borderRadius: "3px" }}>{p.position}</span>
            {p.team && <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>{p.team}</span>}
            {p.age  && <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>· {p.age}y</span>}
          </div>
        </div>
      </div>
      <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-muted)", textAlign: "right" }}>
        {p.searchRank ? `#${p.searchRank}` : "—"}
      </span>
      <span style={{ fontSize: "16px", fontWeight: 800, color: pts > 0 ? posColor : "var(--color-text-muted)", textAlign: "right" }}>
        {pts > 0 ? pts.toFixed(1) : "—"}
      </span>
    </div>
  );
}

function DrawerContent({ player: p }: { player: PlayerDetail }) {
  const posColor = POS_COLORS[p.position] ?? "#555";
  const fmt = (iso: string) => {
    try { return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
    catch { return iso; }
  };

  return (
    <div>
      {/* Hero */}
      <div style={{ padding: "36px 24px 24px", background: `linear-gradient(135deg, ${posColor}22 0%, transparent 60%)`, borderBottom: "1px solid var(--color-border)" }}>
        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <PlayerPhoto playerId={p.id} position={p.position} size={80} />
            <span style={{ position: "absolute", bottom: -6, left: "50%", transform: "translateX(-50%)", fontSize: "9px", fontWeight: 700, color: "#fff", background: posColor, padding: "2px 7px", borderRadius: "4px", whiteSpace: "nowrap" }}>{p.position}</span>
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: "22px", fontWeight: 800, marginBottom: "6px", color: "var(--color-text)", letterSpacing: "-0.3px" }}>{p.name}</h2>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", marginBottom: "4px" }}>
              {p.team       && <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text)" }}>{p.team}</span>}
              {p.age        && <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>{p.age} yrs</span>}
              {p.yearsExp != null && <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Year {p.yearsExp + 1}</span>}
            </div>
            {(p.height || p.weight) && (
              <p style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                {[p.height ? `${Math.floor(Number(p.height)/12)}\'${Number(p.height)%12}"` : null, p.weight && `${p.weight} lbs`].filter(Boolean).join(" · ")}
              </p>
            )}
            {p.college && <p style={{ fontSize: "12px", color: "var(--color-text-muted)", marginTop: "2px" }}>{p.college}</p>}
          </div>
        </div>
      </div>

      <div style={{ padding: "24px" }}>
        {/* ADP */}
        {p.searchRank && (
          <div style={{ marginBottom: "24px", paddingBottom: "24px", borderBottom: "1px solid var(--color-border)" }}>
            <p style={secLabel}>ADP (Average Draft Position)</p>
            <p style={{ fontSize: "38px", fontWeight: 800, color: "var(--color-text)", lineHeight: 1 }}>#{p.searchRank}</p>
          </div>
        )}

        {/* Fantasy Points */}
        <div style={{ marginBottom: "24px", paddingBottom: "24px", borderBottom: "1px solid var(--color-border)" }}>
          <p style={secLabel}>Fantasy Points — Half PPR</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div style={{ padding: "16px", borderRadius: "10px", border: "1px solid var(--color-border)", background: "var(--color-bg)", textAlign: "center" }}>
              <span style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "var(--color-text-muted)", marginBottom: "6px" }}>2024 ACTUAL</span>
              <span style={{ display: "block", fontSize: "28px", fontWeight: 800, color: "var(--color-text)" }}>{p.fantasyPts2024.halfPpr || "—"}</span>
            </div>
            <div style={{ padding: "16px", borderRadius: "10px", border: `1px solid ${posColor}44`, background: `${posColor}11`, textAlign: "center" }}>
              <span style={{ display: "block", fontSize: "10px", fontWeight: 700, color: posColor, marginBottom: "6px" }}>2025 PROJ</span>
              <span style={{ display: "block", fontSize: "28px", fontWeight: 800, color: posColor }}>{p.projPts2025.halfPpr || "—"}</span>
            </div>
          </div>
        </div>

        {/* 2025 Projected Stats */}
        {p.projStats2025 && (
          <div style={{ marginBottom: "24px", paddingBottom: "24px", borderBottom: "1px solid var(--color-border)" }}>
            <p style={secLabel}>2025 Projected Stats</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
              <Stat label="Pass Yds" value={p.projStats2025.passYds} color={posColor} />
              <Stat label="Pass TD"  value={p.projStats2025.passTds} color={posColor} />
              <Stat label="Rush Yds" value={p.projStats2025.rushYds} color={posColor} />
              <Stat label="Rush TD"  value={p.projStats2025.rushTds} color={posColor} />
              <Stat label="Rec"      value={p.projStats2025.rec}     color={posColor} />
              <Stat label="Rec Yds"  value={p.projStats2025.recYds}  color={posColor} />
              <Stat label="Rec TD"   value={p.projStats2025.recTds}  color={posColor} />
            </div>
          </div>
        )}

        {/* 2024 Stats */}
        {p.stats2024 && (
          <div style={{ marginBottom: "24px", paddingBottom: "24px", borderBottom: "1px solid var(--color-border)" }}>
            <p style={secLabel}>2024 Stats</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
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

        {/* News */}
        <div>
          <p style={secLabel}>Latest News</p>
          {p.news.length === 0 ? (
            <p style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>No recent news available.</p>
          ) : p.news.map((item, i) => (
            <div key={i} style={{ padding: "14px", background: "var(--color-bg)", borderRadius: "10px", border: "1px solid var(--color-border)", marginBottom: "8px" }}>
              <p style={{ fontSize: "11px", color: "var(--color-text-muted)", marginBottom: "4px" }}>{fmt(item.published)}</p>
              <p style={{ fontSize: "13px", fontWeight: 700, lineHeight: "1.4", marginBottom: "4px", color: "var(--color-text)" }}>{item.headline}</p>
              {item.description && <p style={{ fontSize: "12px", color: "var(--color-text-muted)", lineHeight: "1.5", marginBottom: "6px" }}>{item.description}</p>}
              {item.link && <a href={item.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: "12px", color: posColor, textDecoration: "none", fontWeight: 600 }}>Read more →</a>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const secLabel: React.CSSProperties = { fontSize: "10px", fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "12px" };

function Stat({ label, value, color }: { label: string; value: number | null | undefined; color?: string }) {
  if (value == null) return null;
  return (
    <div style={{ textAlign: "center", padding: "10px 6px", background: color ? `${color}0d` : "var(--color-bg)", borderRadius: "8px", border: `1px solid ${color ? `${color}33` : "var(--color-border)"}` }}>
      <p style={{ fontSize: "10px", color: color ?? "var(--color-text-muted)", marginBottom: "4px", fontWeight: 700 }}>{label}</p>
      <p style={{ fontSize: "15px", fontWeight: 800, color: color ?? "var(--color-text)" }}>{value}</p>
    </div>
  );
}
