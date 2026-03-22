import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import Navbar from "../components/Navbar";
import Button from "../components/Button";
import Modal from "../components/Modal";
import Input from "../components/Input";
import { LeagueDetail } from "../store/leagues";
import { api } from "../api/client";
import { useAuth } from "../store/auth";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY ?? "pk_test_placeholder");

const PAYOUT_LABEL: Record<string, string> = {
  WINNER_TAKES_ALL: "Winner Takes All",
  TOP_TWO: "Top 2 (70% / 30%)",
  TOP_THREE: "Top 3 (60% / 25% / 15%)",
};

export default function LeaguePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [league, setLeague] = useState<LeagueDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Start draft
  const [startingDraft, setStartingDraft] = useState(false);

  async function handleStartDraft() {
    setStartingDraft(true);
    const res = await api.post(`/draft/${id}/start`, {});
    setStartingDraft(false);
    if (!res.ok) {
      setError((res as any).error);
      return;
    }
    navigate(`/leagues/${id}/draft`);
  }

  // Join modal
  const [showJoin, setShowJoin] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Stripe payment
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [buyInAmount, setBuyInAmount] = useState(0);

  useEffect(() => {
    if (!id) return;
    fetchLeague();
  }, [id]);

  async function fetchLeague() {
    setLoading(true);
    const res = await api.get<{ league: LeagueDetail; teams: LeagueDetail["teams"]; isMember: boolean; isCommissioner: boolean; payoutSplit: any }>(`/leagues/${id}`);
    if (!res.ok) {
      setError(res.error);
    } else {
      setLeague({ ...res.data.league, teams: res.data.teams, isMember: res.data.isMember, payoutSplit: res.data.payoutSplit });
    }
    setLoading(false);
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!teamName.trim()) return;
    setJoinError(null);
    setJoining(true);

    const res = await api.post<{ clientSecret: string; amount: number }>(`/leagues/${id}/join`, { teamName });
    setJoining(false);

    if (!res.ok) {
      setJoinError(res.error);
      return;
    }

    setClientSecret(res.data.clientSecret);
    setBuyInAmount(res.data.amount);
    setShowJoin(false);
  }

  function copyInviteLink() {
    const url = `${window.location.origin}/leagues/${league?.inviteCode}`;
    navigator.clipboard.writeText(url);
  }

  if (loading) return <div style={styles.root}><Navbar /><p style={styles.center}>Loading…</p></div>;
  if (error || !league) return <div style={styles.root}><Navbar /><p style={styles.center}>{error ?? "League not found"}</p></div>;

  const potTotal = league.buyIn * league.maxTeams;
  const prizePool = Math.floor(potTotal * 0.95);
  const isMyLeague = league.commissionerId === user?.id;

  return (
    <div style={styles.root}>
      <Navbar />

      {/* Stripe payment overlay */}
      {clientSecret && (
        <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "night" } }}>
          <PaymentModal
            clientSecret={clientSecret}
            amount={buyInAmount}
            leagueName={league.name}
            onSuccess={() => { setClientSecret(null); fetchLeague(); }}
            onClose={() => setClientSecret(null)}
          />
        </Elements>
      )}

      <main style={styles.main}>
        {/* Header */}
        <div style={styles.pageHeader}>
          <div>
            <button style={styles.back} onClick={() => navigate(-1)}>← Back</button>
            <h1 style={styles.title}>{league.name}</h1>
            <span style={styles.status}>{league.status}</span>
          </div>
          <div style={styles.headerActions}>
            {isMyLeague && league.status === "SETUP" && (
              <Button variant="ghost" onClick={copyInviteLink} style={{ fontSize: "13px" }}>
                Copy Invite Link
              </Button>
            )}
            {isMyLeague && league.status === "SETUP" && league.memberCount >= 2 && (
              <Button onClick={handleStartDraft} loading={startingDraft}>
                Start Draft
              </Button>
            )}
            {league.status === "DRAFTING" && league.isMember && (
              <Button onClick={() => navigate(`/leagues/${league.id}/draft`)}>
                Enter Draft Room →
              </Button>
            )}
            {(league.status === "ACTIVE" || league.status === "PLAYOFFS") && league.isMember && (
              <>
                <Button variant="ghost" onClick={() => navigate(`/leagues/${league.id}/standings`)} style={{ fontSize: "13px" }}>
                  Standings
                </Button>
                <Button onClick={() => navigate(`/leagues/${league.id}/my-team`)} style={{ fontSize: "13px" }}>
                  My Team
                </Button>
                <Button variant="ghost" onClick={() => navigate(`/leagues/${league.id}/waivers`)} style={{ fontSize: "13px" }}>
                  Waivers
                </Button>
                <Button variant="ghost" onClick={() => navigate(`/leagues/${league.id}/trades`)} style={{ fontSize: "13px" }}>
                  Trades
                </Button>
                {league.status === "PLAYOFFS" && (
                  <Button variant="ghost" onClick={() => navigate(`/leagues/${league.id}/bracket`)} style={{ fontSize: "13px" }}>
                    🏆 Bracket
                  </Button>
                )}
              </>
            )}
            {!league.isMember && league.status === "SETUP" && league.memberCount < league.maxTeams && (
              <Button onClick={() => setShowJoin(true)}>Join League — ${league.buyIn}</Button>
            )}
            {isMyLeague && (
              <Button variant="ghost" onClick={() => navigate(`/leagues/${league.id}/commissioner`)} style={{ fontSize: "13px" }}>
                ⚙ Panel
              </Button>
            )}
          </div>
        </div>

        <div style={styles.layout}>
          {/* Left: settings + payout */}
          <div style={styles.sidebar}>
            <Section title="Settings">
              <InfoRow label="Buy-In" value={`$${league.buyIn}`} highlight />
              <InfoRow label="Teams" value={`${league.memberCount} / ${league.maxTeams}`} />
              <InfoRow label="Scoring" value={league.scoringType === "FULL_PPR" ? "Full PPR" : "Half PPR"} />
              <InfoRow label="Draft" value={league.draftType === "SNAKE" ? "Snake Draft" : "Auction ($200)"} />
              <InfoRow label="Visibility" value={league.visibility === "PUBLIC" ? "Public" : "Private"} />
            </Section>

            <Section title="Prize Pool">
              <InfoRow label="Total Pot" value={`$${potTotal.toLocaleString()}`} />
              <InfoRow label="Platform Fee" value="-5%" />
              <InfoRow label="Prize Pool" value={`$${prizePool.toLocaleString()}`} highlight />
              <div style={{ marginTop: "12px", borderTop: "1px solid var(--color-border)", paddingTop: "12px" }}>
                <p style={styles.sectionSubLabel}>{PAYOUT_LABEL[league.payoutPreset]}</p>
                {league.payoutSplit?.map((s: any) => (
                  <div key={s.place} style={styles.payoutRow}>
                    <span style={styles.payoutPlace}>
                      {s.place === 1 ? "🥇" : s.place === 2 ? "🥈" : "🥉"} {ordinal(s.place)} Place
                    </span>
                    <span style={styles.payoutAmount}>
                      ${Math.floor(prizePool * s.percent / 100).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          </div>

          {/* Right: roster */}
          <div style={styles.content}>
            <Section title={`Teams (${league.memberCount}/${league.maxTeams})`}>
              {league.teams.map((team) => (
                <div key={team.id} style={styles.teamRow}>
                  <div style={styles.teamLeft}>
                    <span style={styles.teamName}>{team.name}</span>
                    <span style={styles.teamUser}>@{team.username}</span>
                  </div>
                  <div style={styles.teamRight}>
                    {team.isCommissioner && <span style={styles.commBadge}>Commissioner</span>}
                    <span style={{ ...styles.paidBadge, background: team.paid ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.1)", color: team.paid ? "var(--color-success)" : "var(--color-danger)" }}>
                      {team.paid ? "Paid" : "Pending"}
                    </span>
                  </div>
                </div>
              ))}
              {Array.from({ length: league.maxTeams - league.memberCount }).map((_, i) => (
                <div key={`empty-${i}`} style={{ ...styles.teamRow, opacity: 0.3 }}>
                  <span style={{ fontSize: "14px", color: "var(--color-text-muted)" }}>Open slot</span>
                </div>
              ))}
            </Section>
          </div>
        </div>
      </main>

      {/* Join modal */}
      <Modal open={showJoin} onClose={() => setShowJoin(false)} title={`Join ${league.name}`}>
        <form onSubmit={handleJoin} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <p style={{ fontSize: "14px", color: "var(--color-text-muted)" }}>
            Buy-in: <strong style={{ color: "var(--color-text)" }}>${league.buyIn}</strong> — your card will be charged after confirming.
          </p>
          <Input
            label="Your Team Name"
            placeholder="e.g. Blitz Kings"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            required
          />
          {joinError && <p style={{ fontSize: "13px", color: "var(--color-danger)" }}>{joinError}</p>}
          <div style={{ display: "flex", gap: "12px" }}>
            <Button type="button" variant="ghost" onClick={() => setShowJoin(false)} style={{ flex: 1 }}>Cancel</Button>
            <Button type="submit" loading={joining} style={{ flex: 2 }}>Continue to Payment</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ─── Payment Modal ─────────────────────────────────────────────────────────────

function PaymentModal({ amount, leagueName, onSuccess, onClose }: {
  clientSecret: string;
  amount: number;
  leagueName: string;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setError(null);
    setLoading(true);

    const { error: stripeErr } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    setLoading(false);
    if (stripeErr) {
      setError(stripeErr.message ?? "Payment failed");
    } else {
      onSuccess();
    }
  }

  return (
    <div style={payStyles.overlay}>
      <div style={payStyles.modal}>
        <div style={payStyles.header}>
          <span style={payStyles.title}>Pay Buy-In</span>
          <button style={payStyles.close} onClick={onClose}>✕</button>
        </div>
        <div style={payStyles.body}>
          <p style={{ fontSize: "14px", color: "var(--color-text-muted)", marginBottom: "20px" }}>
            <strong style={{ color: "var(--color-text)" }}>${amount}</strong> buy-in for <strong style={{ color: "var(--color-text)" }}>{leagueName}</strong>
          </p>
          <form onSubmit={handlePay} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <PaymentElement />
            {error && <p style={{ fontSize: "13px", color: "var(--color-danger)" }}>{error}</p>}
            <Button type="submit" loading={loading}>Pay ${amount}</Button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={styles.section}>
      <h2 style={styles.sectionTitle}>{title}</h2>
      {children}
    </div>
  );
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={styles.infoRow}>
      <span style={styles.infoLabel}>{label}</span>
      <span style={{ ...styles.infoValue, ...(highlight ? { color: "var(--color-success)", fontWeight: 600 } : {}) }}>
        {value}
      </span>
    </div>
  );
}

function ordinal(n: number) {
  return n === 1 ? "1st" : n === 2 ? "2nd" : "3rd";
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  root: { minHeight: "100vh", background: "var(--color-bg)" },
  main: { maxWidth: "1060px", margin: "0 auto", padding: "32px 24px" },
  center: { padding: "40px", textAlign: "center", color: "var(--color-text-muted)" },
  pageHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: "32px",
    gap: "16px",
  },
  back: { background: "none", border: "none", color: "var(--color-text-muted)", fontSize: "13px", cursor: "pointer", padding: 0, marginBottom: "8px", display: "block" },
  title: { fontSize: "26px", fontWeight: 700, marginBottom: "6px" },
  status: { fontSize: "12px", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "1px" },
  headerActions: { display: "flex", gap: "12px", alignItems: "center" },
  layout: { display: "grid", gridTemplateColumns: "280px 1fr", gap: "24px" },
  sidebar: { display: "flex", flexDirection: "column", gap: "16px" },
  content: {},
  section: {
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius)",
    padding: "20px",
  },
  sectionTitle: { fontSize: "14px", fontWeight: 600, marginBottom: "16px", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" },
  sectionSubLabel: { fontSize: "13px", color: "var(--color-text-muted)", marginBottom: "10px" },
  infoRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" },
  infoLabel: { fontSize: "14px", color: "var(--color-text-muted)" },
  infoValue: { fontSize: "14px", color: "var(--color-text)" },
  payoutRow: { display: "flex", justifyContent: "space-between", marginBottom: "8px" },
  payoutPlace: { fontSize: "14px" },
  payoutAmount: { fontSize: "14px", fontWeight: 600, color: "var(--color-success)" },
  teamRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 0",
    borderBottom: "1px solid var(--color-border)",
  },
  teamLeft: { display: "flex", flexDirection: "column", gap: "2px" },
  teamName: { fontSize: "15px", fontWeight: 500 },
  teamUser: { fontSize: "12px", color: "var(--color-text-muted)" },
  teamRight: { display: "flex", alignItems: "center", gap: "8px" },
  commBadge: { fontSize: "11px", background: "rgba(79,124,255,0.15)", color: "var(--color-accent)", padding: "3px 8px", borderRadius: "999px" },
  paidBadge: { fontSize: "11px", padding: "3px 8px", borderRadius: "999px" },
};

const payStyles: Record<string, React.CSSProperties> = {
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1001, padding: "24px" },
  modal: { width: "100%", maxWidth: "480px", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius)", overflow: "hidden" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 24px", borderBottom: "1px solid var(--color-border)" },
  title: { fontWeight: 600, fontSize: "16px" },
  close: { background: "none", border: "none", color: "var(--color-text-muted)", fontSize: "16px", cursor: "pointer" },
  body: { padding: "24px" },
};
