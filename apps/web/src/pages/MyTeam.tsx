import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Button from "../components/Button";
import { api } from "../api/client";

interface RosterSlot {
  id: string;
  playerId: string;
  slot: string;
  points: number | null;
}

const STARTER_SLOTS = ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "K", "DEF"];
const POS_COLORS: Record<string, string> = {
  QB: "#e74c3c", RB: "#1A2A8E", WR: "#00D4FF", TE: "#FF6B00", K: "#A0B0C0", DEF: "#27AE60", FLEX: "#1A2A8E", BENCH: "#374151",
};
const FLEX_ELIGIBLE = new Set(["RB", "WR", "TE"]);

export default function MyTeam() {
  const { id: leagueId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [team, setTeam] = useState<{ id: string; name: string } | null>(null);
  const [roster, setRoster] = useState<RosterSlot[]>([]);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [isLocked, setIsLocked] = useState(false);
  const [lockTime, setLockTime] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [swapSource, setSwapSource] = useState<RosterSlot | null>(null);

  useEffect(() => {
    if (!leagueId) return;
    api.get<{ team: any; roster: RosterSlot[]; currentWeek: number; isLocked: boolean; lockTime: string }>(
      `/season/${leagueId}/my-team`
    ).then((res) => {
      if (res.ok) {
        setTeam(res.data.team);
        setRoster(res.data.roster);
        setCurrentWeek(res.data.currentWeek);
        setIsLocked(res.data.isLocked);
        setLockTime(res.data.lockTime);
      }
      setLoading(false);
    });
  }, [leagueId]);

  function canSwap(a: RosterSlot, b: RosterSlot): boolean {
    // Simple validation: bench <-> starter swaps
    return true; // server-side validates positions
  }

  function handleSlotClick(slot: RosterSlot) {
    if (isLocked) return;
    if (!swapSource) {
      setSwapSource(slot);
      return;
    }
    if (swapSource.id === slot.id) {
      setSwapSource(null);
      return;
    }
    // Swap the two slots
    setRoster((prev) =>
      prev.map((r) => {
        if (r.id === swapSource.id) return { ...r, slot: slot.slot };
        if (r.id === slot.id) return { ...r, slot: swapSource.slot };
        return r;
      })
    );
    setSwapSource(null);
  }

  async function saveLineup() {
    setSaving(true);
    const res = await api.post(`/season/${leagueId}/lineup`, {
      slots: roster.map((r) => ({ playerId: r.playerId, slot: r.slot })),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  const starters = STARTER_SLOTS.map((slotName, i) => {
    const filled = roster.find((r) => r.slot === slotName && !STARTER_SLOTS.slice(0, i).some((s, j) => s === slotName && roster.find((r2) => r2.slot === slotName && r2.id !== r.id)));
    return { slotName, player: filled ?? null };
  });

  const benchPlayers = roster.filter((r) => r.slot === "BENCH");
  const totalPoints = roster
    .filter((r) => r.slot !== "BENCH" && r.points !== null)
    .reduce((sum, r) => sum + (r.points ?? 0), 0);

  if (loading) return <div style={styles.root}><Navbar /></div>;

  return (
    <div style={styles.root}>
      <Navbar />
      <main style={styles.main}>
        <div style={styles.header}>
          <div>
            <button style={styles.back} onClick={() => navigate(`/leagues/${leagueId}/standings`)}>← Standings</button>
            <h1 style={styles.title}>{team?.name}</h1>
            <p style={styles.subtitle}>Week {currentWeek} Lineup</p>
          </div>
          <div style={styles.headerRight}>
            {isLocked ? (
              <span style={styles.lockedBadge}>🔒 Locked</span>
            ) : (
              <span style={styles.lockInfo}>Locks {new Date(lockTime).toLocaleString()}</span>
            )}
            {!isLocked && (
              <Button onClick={saveLineup} loading={saving} style={{ fontSize: "13px" }}>
                {saved ? "Saved ✓" : "Save Lineup"}
              </Button>
            )}
          </div>
        </div>

        <div style={styles.layout}>
          {/* Starters */}
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <span style={styles.sectionTitle}>Starters</span>
              <span style={styles.totalPts}>{totalPoints.toFixed(1)} pts</span>
            </div>
            {!isLocked && <p style={styles.swapHint}>{swapSource ? "Now tap a player to swap with" : "Tap a player to start a swap"}</p>}
            {roster
              .filter((r) => r.slot !== "BENCH")
              .sort((a, b) => STARTER_SLOTS.indexOf(a.slot) - STARTER_SLOTS.indexOf(b.slot))
              .map((r) => (
                <PlayerRow
                  key={r.id}
                  slot={r}
                  isSelected={swapSource?.id === r.id}
                  isLocked={isLocked}
                  onClick={() => handleSlotClick(r)}
                />
              ))}
          </div>

          {/* Bench */}
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <span style={styles.sectionTitle}>Bench</span>
            </div>
            {benchPlayers.length === 0 ? (
              <p style={styles.muted}>No bench players</p>
            ) : benchPlayers.map((r) => (
              <PlayerRow
                key={r.id}
                slot={r}
                isSelected={swapSource?.id === r.id}
                isLocked={isLocked}
                onClick={() => handleSlotClick(r)}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

function PlayerRow({ slot, isSelected, isLocked, onClick }: {
  slot: RosterSlot;
  isSelected: boolean;
  isLocked: boolean;
  onClick: () => void;
}) {
  return (
    <div
      style={{
        ...styles.playerRow,
        ...(isSelected ? styles.selectedRow : {}),
        cursor: isLocked ? "default" : "pointer",
      }}
      onClick={onClick}
    >
      <span style={{ ...styles.slotBadge, background: `${POS_COLORS[slot.slot] ?? "#374151"}20`, color: POS_COLORS[slot.slot] ?? "#6b7280" }}>
        {slot.slot}
      </span>
      <div style={styles.playerInfo}>
        <span style={styles.playerName}>{slot.playerId}</span>
      </div>
      <span style={styles.pts}>
        {slot.points !== null ? `${slot.points.toFixed(1)} pts` : "—"}
      </span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { minHeight: "100vh", background: "var(--color-bg)" },
  main: { maxWidth: "960px", margin: "0 auto", padding: "32px 24px" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "32px" },
  back: { background: "none", border: "none", color: "var(--color-text-muted)", fontSize: "13px", cursor: "pointer", padding: 0, display: "block", marginBottom: "8px" },
  title: { fontSize: "24px", fontWeight: 700, marginBottom: "4px" },
  subtitle: { fontSize: "14px", color: "var(--color-text-muted)" },
  headerRight: { display: "flex", alignItems: "center", gap: "12px" },
  lockedBadge: { fontSize: "13px", color: "var(--color-text-muted)" },
  lockInfo: { fontSize: "12px", color: "var(--color-text-muted)" },
  layout: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" },
  section: { display: "flex", flexDirection: "column", gap: "6px" },
  sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" },
  sectionTitle: { fontSize: "13px", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" },
  totalPts: { fontSize: "18px", fontWeight: 700, color: "var(--color-success)" },
  swapHint: { fontSize: "12px", color: "var(--color-accent)", marginBottom: "4px" },
  playerRow: {
    display: "flex", alignItems: "center", gap: "12px", padding: "11px 14px",
    background: "var(--color-surface)", border: "1px solid var(--color-border)",
    borderRadius: "8px", transition: "border-color 0.15s",
  },
  selectedRow: { borderColor: "var(--color-accent)", background: "rgba(79,124,255,0.08)" },
  slotBadge: { fontSize: "10px", fontWeight: 700, padding: "3px 7px", borderRadius: "4px", minWidth: "42px", textAlign: "center" },
  playerInfo: { flex: 1 },
  playerName: { fontSize: "14px", fontWeight: 500 },
  pts: { fontSize: "14px", fontWeight: 600, color: "var(--color-text-muted)", minWidth: "60px", textAlign: "right" },
  muted: { fontSize: "14px", color: "var(--color-text-muted)" },
};
