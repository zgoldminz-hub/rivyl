import { DraftStateData } from "../../store/draft";

const POS_COLORS: Record<string, string> = {
  QB: "#e74c3c", RB: "#1A2A8E", WR: "#00D4FF", TE: "#FF6B00", K: "#A0B0C0", DEF: "#27AE60",
};

interface Props {
  state: DraftStateData;
  myTeamId: string;
}

export default function SnakeBoard({ state, myTeamId }: Props) {
  const totalRounds = 15;
  const numTeams = state.teams.length;

  return (
    <div style={styles.root}>
      {/* Header row — team names */}
      <div style={{ ...styles.row, borderBottom: "2px solid var(--color-border)" }}>
        <div style={styles.roundCell} />
        {state.teams
          .slice()
          .sort((a, b) => a.draftOrder - b.draftOrder)
          .map((team) => (
            <div
              key={team.id}
              style={{
                ...styles.teamHeader,
                ...(team.id === myTeamId ? styles.myTeamHeader : {}),
              }}
            >
              {team.name}
            </div>
          ))}
      </div>

      {/* Pick grid */}
      {Array.from({ length: totalRounds }, (_, roundIdx) => {
        const round = roundIdx + 1;
        const roundPicks = state.picks.filter((p) => p.round === round);
        const isEvenRound = round % 2 === 0;
        const orderedPicks = isEvenRound ? [...roundPicks].reverse() : roundPicks;

        return (
          <div key={round} style={styles.row}>
            <div style={styles.roundCell}>R{round}</div>
            {orderedPicks.map((pick) => {
              const isCurrent = pick.pickNumber === state.currentPickNumber;
              const isPast = pick.pickNumber < state.currentPickNumber;

              return (
                <div
                  key={pick.pickNumber}
                  style={{
                    ...styles.pickCell,
                    ...(isCurrent ? styles.currentCell : {}),
                    ...(pick.teamId === myTeamId ? styles.myPickCell : {}),
                  }}
                >
                  {pick.playerId ? (
                    <>
                      <span style={{
                        fontSize: "9px",
                        fontWeight: 700,
                        color: POS_COLORS[pick.playerPosition ?? ""] ?? "var(--color-text-muted)",
                      }}>
                        {pick.playerPosition}
                      </span>
                      <span style={styles.pickedName}>{pick.playerName?.split(" ").pop()}</span>
                      {pick.isAutoPick && <span style={styles.autoBadge}>AUTO</span>}
                    </>
                  ) : isCurrent ? (
                    <span style={styles.onClock}>●</span>
                  ) : isPast ? (
                    <span style={{ fontSize: "10px", color: "var(--color-text-muted)" }}>—</span>
                  ) : (
                    <span style={{ fontSize: "10px", color: "var(--color-surface-2)" }}>{pick.pickNumber}</span>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { overflowX: "auto", overflowY: "auto", maxHeight: "420px", fontSize: "11px" },
  row: { display: "flex", borderBottom: "1px solid var(--color-border)" },
  roundCell: {
    minWidth: "32px", width: "32px", padding: "6px 4px", fontSize: "10px",
    color: "var(--color-text-muted)", display: "flex", alignItems: "center", justifyContent: "center",
    borderRight: "1px solid var(--color-border)", flexShrink: 0,
  },
  teamHeader: {
    flex: 1, minWidth: "80px", padding: "8px 6px", fontSize: "10px", fontWeight: 600,
    color: "var(--color-text-muted)", textAlign: "center", overflow: "hidden",
    textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  myTeamHeader: { color: "var(--color-accent)" },
  pickCell: {
    flex: 1, minWidth: "80px", minHeight: "44px", padding: "4px 6px",
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    gap: "2px", borderRight: "1px solid var(--color-border)",
  },
  currentCell: { background: "rgba(79,124,255,0.12)", outline: "1px solid var(--color-accent)" },
  myPickCell: { background: "rgba(79,124,255,0.05)" },
  pickedName: { fontSize: "11px", fontWeight: 600, color: "var(--color-text)", textAlign: "center", lineHeight: 1.2 },
  autoBadge: { fontSize: "8px", color: "var(--color-text-muted)", background: "var(--color-surface-2)", padding: "1px 4px", borderRadius: "3px" },
  onClock: { color: "var(--color-accent)", fontSize: "16px", animation: "pulse 1s infinite" },
};
