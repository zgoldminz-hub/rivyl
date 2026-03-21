import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import LeagueCard from "../components/LeagueCard";
import Input from "../components/Input";
import { useLeagues } from "../store/leagues";

export default function Discover() {
  const navigate = useNavigate();
  const { publicLeagues, loadingPublic, fetchPublic } = useLeagues();
  const [search, setSearch] = useState("");
  const [inviteCode, setInviteCode] = useState("");

  useEffect(() => {
    fetchPublic();
  }, []);

  const filtered = publicLeagues.filter((l) =>
    l.name.toLowerCase().includes(search.toLowerCase())
  );

  function handleInviteJoin(e: React.FormEvent) {
    e.preventDefault();
    if (inviteCode.trim()) {
      navigate(`/leagues/${inviteCode.trim()}`);
    }
  }

  return (
    <div style={styles.root}>
      <Navbar />
      <main style={styles.main}>
        <div style={styles.topRow}>
          <h1 style={styles.heading}>Discover Leagues</h1>
        </div>

        {/* Invite code */}
        <div style={styles.inviteBox}>
          <p style={styles.inviteLabel}>Have an invite link or code?</p>
          <form onSubmit={handleInviteJoin} style={styles.inviteForm}>
            <input
              style={styles.inviteInput}
              placeholder="Paste invite code here"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
            />
            <button type="submit" style={styles.inviteBtn}>Go →</button>
          </form>
        </div>

        <div style={styles.searchRow}>
          <Input
            label=""
            placeholder="Search public leagues…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1 }}
          />
        </div>

        {loadingPublic ? (
          <p style={styles.muted}>Loading…</p>
        ) : filtered.length === 0 ? (
          <div style={styles.empty}>
            <p style={styles.emptyTitle}>No public leagues found</p>
            <p style={styles.muted}>Create one and set it to Public so others can find it.</p>
          </div>
        ) : (
          <div style={styles.grid}>
            {filtered.map((league) => (
              <LeagueCard key={league.id} league={league} showJoin />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { minHeight: "100vh", background: "var(--color-bg)" },
  main: { maxWidth: "960px", margin: "0 auto", padding: "40px 24px", display: "flex", flexDirection: "column", gap: "24px" },
  topRow: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  heading: { fontSize: "22px", fontWeight: 700 },
  inviteBox: {
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius)",
    padding: "18px 20px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  inviteLabel: { fontSize: "14px", fontWeight: 500 },
  inviteForm: { display: "flex", gap: "10px" },
  inviteInput: {
    flex: 1,
    padding: "10px 14px",
    background: "var(--color-surface-2)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius)",
    color: "var(--color-text)",
    fontSize: "14px",
    outline: "none",
    fontFamily: "var(--font)",
  },
  inviteBtn: {
    padding: "10px 20px",
    background: "var(--color-accent)",
    color: "#fff",
    border: "none",
    borderRadius: "var(--radius)",
    fontWeight: 600,
    fontSize: "14px",
    cursor: "pointer",
    fontFamily: "var(--font)",
  },
  searchRow: { display: "flex", gap: "12px" },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: "16px",
  },
  empty: {},
  emptyTitle: { fontSize: "16px", fontWeight: 600, marginBottom: "8px" },
  muted: { color: "var(--color-text-muted)", fontSize: "14px" },
};
