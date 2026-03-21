import { useState, useEffect } from "react";
import { useDraft, PlayerResult } from "../../store/draft";

const POSITIONS = ["ALL", "QB", "RB", "WR", "TE", "K", "DEF"];

const POS_COLORS: Record<string, string> = {
  QB: "#f59e0b", RB: "#22c55e", WR: "#4f7cff", TE: "#a78bfa", K: "#6b7280", DEF: "#ef4444",
};

interface Props {
  onPick?: (player: PlayerResult) => void;
  onNominate?: (player: PlayerResult, openingBid: number) => void;
  isMyTurn: boolean;
  draftType: "SNAKE" | "AUCTION";
  myBudget?: number;
}

export default function PlayerSearch({ onPick, onNominate, isMyTurn, draftType, myBudget }: Props) {
  const { search, searchResults } = useDraft();
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState("ALL");
  const [nominatingPlayer, setNominatingPlayer] = useState<PlayerResult | null>(null);
  const [openingBid, setOpeningBid] = useState(1);

  useEffect(() => {
    const timeout = setTimeout(() => search(query, position === "ALL" ? undefined : position), 200);
    return () => clearTimeout(timeout);
  }, [query, position]);

  // Initial load
  useEffect(() => { search(""); }, []);

  function handlePick(player: PlayerResult) {
    if (!isMyTurn) return;
    if (draftType === "SNAKE") {
      onPick?.(player);
    } else {
      setNominatingPlayer(player);
      setOpeningBid(1);
    }
  }

  function handleNominate() {
    if (!nominatingPlayer) return;
    onNominate?.(nominatingPlayer, openingBid as any);
    setNominatingPlayer(null);
  }

  return (
    <div style={styles.root}>
      <div style={styles.filters}>
        <input
          style={styles.search}
          placeholder="Search players…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div style={styles.positions}>
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

      {/* Auction nominate confirm */}
      {nominatingPlayer && (
        <div style={styles.nominateBox}>
          <p style={styles.nominateTitle}>Nominate {nominatingPlayer.full_name}</p>
          <div style={styles.nominateRow}>
            <label style={styles.nominateLabel}>Opening bid: $</label>
            <input
              type="number"
              min={1}
              max={myBudget ?? 200}
              value={openingBid}
              onChange={(e) => setOpeningBid(Math.max(1, parseInt(e.target.value) || 1))}
              style={styles.bidInput}
            />
          </div>
          <div style={styles.nominateActions}>
            <button style={styles.cancelBtn} onClick={() => setNominatingPlayer(null)}>Cancel</button>
            <button style={styles.nominateBtn} onClick={handleNominate}>Nominate</button>
          </div>
        </div>
      )}

      <div style={styles.list}>
        {searchResults.length === 0 && (
          <p style={styles.empty}>No players found</p>
        )}
        {searchResults.map((player) => (
          <PlayerRow
            key={player.player_id}
            player={player}
            isMyTurn={isMyTurn}
            onSelect={() => handlePick(player)}
            draftType={draftType}
          />
        ))}
      </div>
    </div>
  );
}

function PlayerRow({ player, isMyTurn, onSelect, draftType }: {
  player: PlayerResult;
  isMyTurn: boolean;
  onSelect: () => void;
  draftType: "SNAKE" | "AUCTION";
}) {
  const injuryColor = player.injury_status ? "var(--color-danger)" : "var(--color-success)";

  return (
    <div style={styles.playerRow}>
      <div style={styles.playerLeft}>
        <span style={{ ...styles.posPill, background: `${POS_COLORS[player.position]}20`, color: POS_COLORS[player.position] }}>
          {player.position}
        </span>
        <div>
          <p style={styles.playerName}>{player.full_name}</p>
          <p style={styles.playerMeta}>
            {player.team ?? "FA"}
            {player.injury_status && <span style={{ color: injuryColor, marginLeft: "6px" }}>● {player.injury_status}</span>}
          </p>
        </div>
      </div>
      {isMyTurn && (
        <button style={styles.pickBtn} onClick={onSelect}>
          {draftType === "SNAKE" ? "Draft" : "Nominate"}
        </button>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { display: "flex", flexDirection: "column", gap: "12px", height: "100%", overflow: "hidden" },
  filters: { display: "flex", flexDirection: "column", gap: "8px" },
  search: {
    padding: "9px 14px", background: "var(--color-surface-2)", border: "1px solid var(--color-border)",
    borderRadius: "var(--radius)", color: "var(--color-text)", fontSize: "14px", outline: "none", fontFamily: "var(--font)",
  },
  positions: { display: "flex", gap: "6px", flexWrap: "wrap" },
  posBtn: {
    padding: "4px 10px", background: "var(--color-surface-2)", border: "1px solid var(--color-border)",
    borderRadius: "999px", color: "var(--color-text-muted)", fontSize: "12px", fontWeight: 500, cursor: "pointer", fontFamily: "var(--font)",
  },
  posBtnActive: { background: "var(--color-accent)", color: "#fff", borderColor: "var(--color-accent)" },
  list: { overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "2px" },
  empty: { fontSize: "13px", color: "var(--color-text-muted)", padding: "16px 0", textAlign: "center" },
  playerRow: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "10px 12px", borderRadius: "8px", transition: "background 0.1s",
  },
  playerLeft: { display: "flex", alignItems: "center", gap: "12px" },
  posPill: { fontSize: "11px", fontWeight: 700, padding: "3px 7px", borderRadius: "999px", minWidth: "36px", textAlign: "center" },
  playerName: { fontSize: "14px", fontWeight: 500 },
  playerMeta: { fontSize: "12px", color: "var(--color-text-muted)", marginTop: "1px" },
  pickBtn: {
    padding: "5px 14px", background: "var(--color-accent)", border: "none", borderRadius: "6px",
    color: "#fff", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "var(--font)",
  },
  nominateBox: {
    background: "var(--color-surface-2)", border: "1px solid var(--color-border)",
    borderRadius: "var(--radius)", padding: "14px", display: "flex", flexDirection: "column", gap: "10px",
  },
  nominateTitle: { fontSize: "14px", fontWeight: 600 },
  nominateRow: { display: "flex", alignItems: "center", gap: "8px" },
  nominateLabel: { fontSize: "13px", color: "var(--color-text-muted)" },
  bidInput: {
    width: "80px", padding: "6px 10px", background: "var(--color-surface)", border: "1px solid var(--color-border)",
    borderRadius: "6px", color: "var(--color-text)", fontSize: "14px", outline: "none", fontFamily: "var(--font)",
  },
  nominateActions: { display: "flex", gap: "8px" },
  cancelBtn: {
    flex: 1, padding: "7px", background: "transparent", border: "1px solid var(--color-border)",
    borderRadius: "6px", color: "var(--color-text-muted)", fontSize: "13px", cursor: "pointer", fontFamily: "var(--font)",
  },
  nominateBtn: {
    flex: 2, padding: "7px", background: "var(--color-accent)", border: "none",
    borderRadius: "6px", color: "#fff", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "var(--font)",
  },
};
