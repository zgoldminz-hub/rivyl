import { useState } from "react";
import { DraftStateData } from "../../store/draft";
import { useDraft } from "../../store/draft";

const POS_COLORS: Record<string, string> = {
  QB: "#e74c3c", RB: "#1A2A8E", WR: "#00D4FF", TE: "#FF6B00", K: "#A0B0C0", DEF: "#27AE60",
};

interface Props {
  state: DraftStateData;
  myTeamId: string;
}

export default function AuctionBlock({ state, myTeamId }: Props) {
  const { bid } = useDraft();
  const [bidAmount, setBidAmount] = useState("");

  const nom = state.currentNomination;
  const myTeam = state.teams.find((t) => t.id === myTeamId);
  const myBudget = myTeam?.auctionBudget ?? 0;
  const isMyNomination = nom?.nominatingTeamId === myTeamId;
  const isWinning = nom?.currentBidTeamId === myTeamId;

  function handleBid() {
    const amount = parseInt(bidAmount);
    if (!amount || amount <= (nom?.currentBid ?? 0)) return;
    bid(amount);
    setBidAmount("");
  }

  return (
    <div style={styles.root}>
      {/* Budget bar */}
      <div style={styles.budgetRow}>
        {state.teams.map((team) => (
          <div key={team.id} style={{ ...styles.budgetItem, ...(team.id === myTeamId ? styles.myBudget : {}) }}>
            <span style={styles.budgetTeam}>{team.name}</span>
            <span style={styles.budgetAmount}>${team.auctionBudget ?? 0}</span>
          </div>
        ))}
      </div>

      {/* Active nomination */}
      {nom ? (
        <div style={styles.nomination}>
          <div style={styles.nomHeader}>
            <span style={{ ...styles.posPill, background: `${POS_COLORS[nom.playerPosition]}20`, color: POS_COLORS[nom.playerPosition] }}>
              {nom.playerPosition}
            </span>
            <div>
              <p style={styles.nomName}>{nom.playerName}</p>
              <p style={styles.nomTeam}>{nom.playerTeam ?? "FA"}</p>
            </div>
            {isMyNomination && <span style={styles.myNomBadge}>Your nomination</span>}
          </div>

          <div style={styles.bidArea}>
            <div style={styles.currentBid}>
              <span style={styles.bidLabel}>Current bid</span>
              <span style={styles.bidValue}>${nom.currentBid}</span>
              {nom.currentBidTeamId && (
                <span style={{ fontSize: "12px", color: isWinning ? "var(--color-success)" : "var(--color-text-muted)" }}>
                  {isWinning ? "You're winning!" : state.teams.find((t) => t.id === nom.currentBidTeamId)?.name}
                </span>
              )}
            </div>

            {!isWinning && (
              <div style={styles.bidControls}>
                <input
                  type="number"
                  min={nom.currentBid + 1}
                  max={myBudget}
                  placeholder={`$${nom.currentBid + 1}+`}
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                  style={styles.bidInput}
                  onKeyDown={(e) => e.key === "Enter" && handleBid()}
                />
                <button style={styles.bidBtn} onClick={handleBid}>Bid</button>
              </div>
            )}
            {isWinning && (
              <p style={{ fontSize: "13px", color: "var(--color-success)", fontWeight: 600 }}>
                Sit tight — you're the highest bidder
              </p>
            )}
          </div>
        </div>
      ) : (
        <div style={styles.waitingNom}>
          {state.currentTeamId === myTeamId ? (
            <p style={{ color: "var(--color-accent)", fontWeight: 600 }}>It's your turn to nominate a player →</p>
          ) : (
            <p style={{ color: "var(--color-text-muted)" }}>
              Waiting for <strong>{state.teams.find((t) => t.id === state.currentTeamId)?.name}</strong> to nominate…
            </p>
          )}
        </div>
      )}

      {/* Completed picks */}
      {state.completedAuctionPicks.length > 0 && (
        <div style={styles.completedPicks}>
          <p style={styles.sectionLabel}>Recent picks</p>
          {[...state.completedAuctionPicks].reverse().slice(0, 8).map((pick, i) => (
            <div key={i} style={styles.completedRow}>
              <span style={{ ...styles.posPill, fontSize: "10px", background: `${POS_COLORS[pick.playerPosition]}20`, color: POS_COLORS[pick.playerPosition] }}>
                {pick.playerPosition}
              </span>
              <span style={styles.completedName}>{pick.playerName}</span>
              <span style={styles.completedTeam}>{state.teams.find((t) => t.id === pick.teamId)?.name}</span>
              <span style={styles.completedBid}>${pick.amount}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { display: "flex", flexDirection: "column", gap: "16px" },
  budgetRow: { display: "flex", gap: "8px", flexWrap: "wrap" },
  budgetItem: { background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: "8px", padding: "8px 12px", display: "flex", flexDirection: "column", gap: "2px" },
  myBudget: { borderColor: "var(--color-accent)", background: "rgba(79,124,255,0.08)" },
  budgetTeam: { fontSize: "11px", color: "var(--color-text-muted)" },
  budgetAmount: { fontSize: "16px", fontWeight: 700, color: "var(--color-success)" },
  nomination: { background: "var(--color-surface-2)", border: "1px solid var(--color-accent)", borderRadius: "var(--radius)", padding: "20px", display: "flex", flexDirection: "column", gap: "16px" },
  nomHeader: { display: "flex", alignItems: "center", gap: "12px" },
  posPill: { fontSize: "11px", fontWeight: 700, padding: "4px 8px", borderRadius: "999px" },
  nomName: { fontSize: "18px", fontWeight: 700 },
  nomTeam: { fontSize: "13px", color: "var(--color-text-muted)" },
  myNomBadge: { marginLeft: "auto", fontSize: "11px", background: "rgba(79,124,255,0.15)", color: "var(--color-accent)", padding: "3px 8px", borderRadius: "999px" },
  bidArea: { display: "flex", flexDirection: "column", gap: "12px" },
  currentBid: { display: "flex", alignItems: "baseline", gap: "12px" },
  bidLabel: { fontSize: "13px", color: "var(--color-text-muted)" },
  bidValue: { fontSize: "28px", fontWeight: 800, color: "var(--color-text)" },
  bidControls: { display: "flex", gap: "8px" },
  bidInput: {
    flex: 1, padding: "10px 14px", background: "var(--color-surface)", border: "1px solid var(--color-border)",
    borderRadius: "var(--radius)", color: "var(--color-text)", fontSize: "16px", outline: "none", fontFamily: "var(--font)",
  },
  bidBtn: {
    padding: "10px 24px", background: "var(--color-accent)", border: "none", borderRadius: "var(--radius)",
    color: "#fff", fontSize: "15px", fontWeight: 700, cursor: "pointer", fontFamily: "var(--font)",
  },
  waitingNom: { padding: "24px", textAlign: "center", background: "var(--color-surface-2)", borderRadius: "var(--radius)", border: "1px solid var(--color-border)" },
  completedPicks: { display: "flex", flexDirection: "column", gap: "6px" },
  sectionLabel: { fontSize: "11px", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" },
  completedRow: { display: "flex", alignItems: "center", gap: "10px", padding: "6px 0", borderBottom: "1px solid var(--color-border)" },
  completedName: { flex: 1, fontSize: "13px", fontWeight: 500 },
  completedTeam: { fontSize: "12px", color: "var(--color-text-muted)" },
  completedBid: { fontSize: "13px", fontWeight: 600, color: "var(--color-success)" },
};
