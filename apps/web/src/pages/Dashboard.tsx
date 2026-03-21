import { useEffect } from "react";
import Navbar from "../components/Navbar";
import LeagueCard from "../components/LeagueCard";
import { useLeagues } from "../store/leagues";

export default function Dashboard() {
  const { myLeagues, loadingMine, fetchMine } = useLeagues();

  useEffect(() => {
    fetchMine();
  }, []);

  return (
    <div style={styles.root}>
      <Navbar />
      <main style={styles.main}>
        <h1 style={styles.heading}>My Leagues</h1>

        {loadingMine ? (
          <p style={styles.muted}>Loading…</p>
        ) : myLeagues.length === 0 ? (
          <div style={styles.empty}>
            <p style={styles.emptyTitle}>No leagues yet</p>
            <p style={styles.muted}>Create a league or join one from the Discover tab.</p>
          </div>
        ) : (
          <div style={styles.grid}>
            {myLeagues.map((league) => (
              <LeagueCard key={league.id} league={league} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { minHeight: "100vh", background: "var(--color-bg)" },
  main: { maxWidth: "960px", margin: "0 auto", padding: "40px 24px" },
  heading: { fontSize: "22px", fontWeight: 700, marginBottom: "24px" },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: "16px",
  },
  empty: { paddingTop: "40px" },
  emptyTitle: { fontSize: "16px", fontWeight: 600, marginBottom: "8px" },
  muted: { color: "var(--color-text-muted)", fontSize: "14px" },
};
