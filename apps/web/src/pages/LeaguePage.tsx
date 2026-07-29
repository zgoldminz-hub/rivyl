import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
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
  const [startingDraft, setStartingDraft] = useState(false);

  async function handleStartDraft() {
    setStartingDraft(true);
    const res = await api.post("/draft/" + id + "/start", {});
    setStartingDraft(false);
    if (!res.ok) { setError((res as any).error); return; }
    navigate("/leagues/" + id + "/draft");
  }

  const [showJoin, setShowJoin] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [buyInAmount, setBuyInAmount] = useState(0);

  useEffect(() => { if (id) fetchLeague(); }, [id]);

  async function fetchLeague() {
    setLoading(true);
    const res = await api.get<{ league: LeagueDetail; teams: LeagueDetail["teams"]; isMember: boolean; isCommissioner: boolean; payoutSplit: any }>("/leagues/" + id);
    if (!res.ok) { setError(res.error); } else {
      setLeague({ ...res.data.league, teams: res.data.teams, isMember: res.data.isMember, payoutSplit: res.data.payoutSplit });
    }
    setLoading(false);
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!teamName.trim()) return;
    setJoinError(null);
    setJoining(true);
    const res = await api.post<{ clientSecret: string; amount: number }>("/leagues/" + id + "/join", { teamName });
    setJoining(false);
    if (!res.ok) { setJoinError(res.error); return; }
    setClientSecret(res.data.clientSecret);
    setBuyInAmount(res.data.amount);
    setShowJoin(false);
  }

  function copyInviteLink() {
    navigator.clipboard.writeText(window.location.origin + "/leagues/" + league?.inviteCode);
  }

  if (loading) return <div style={styles.root}><Navbar /><p style={styles.center}>Loading…</p></div>;
  if (error || !league) return <div style={styles.root}><Navbar /><p style={styles.center}>{error ?? "League not found"}</p></div>;

  const potTotal = league.buyIn * league.maxTeams;
  const prizePool = Math.floor(potTotal * 0.95);
  const isMyLeague = league.commissionerId === user?.id;

  return (
    <div style={styles.root}>
      <Navbar />

      {clientSecret && (
        <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "night" } }}>
          <PaymentModal
            clientSecret={clientSecret}
            amount={buyInAmount}
            maxTeams={league.maxTeams}
            leagueName={league.name}
            onSuccess={() => { setClientSecret(null); setTimeout(() => fetchLeague(), 1500); }}
            onClose={() => setClientSecret(null)}
          />
        </Elements>
      )}

      <main style={styles.main}>
        <div style={styles.pageHeader}>
          <div>
            <button style={styles.back} onClick={() => navigate(-1)}>← Back</button>
            <h1 style={styles.title}>{league.name}</h1>
            <span style={styles.status}>{league.status}</span>
          </div>
          <div style={styles.headerActions}>
            {isMyLeague && league.status === "SETUP" && (
              <Button variant="ghost" onClick={copyInviteLink} style={{ fontSize: "13px" }}>Copy Invite Link</Button>
            )}
            {isMyLeague && league.status === "SETUP" && league.memberCount >= 2 && (
              <Button onClick={handleStartDraft} loading={startingDraft}>Start Draft</Button>
            )}
            {league.status === "DRAFTING" && league.isMember && (
              <Button onClick={() => navigate("/leagues/" + league.id + "/draft")}>Enter Draft Room →</Button>
            )}
            {(league.status === "ACTIVE" || league.status === "PLAYOFFS") && league.isMember && (
              <>
                <Button variant="ghost" onClick={() => navigate("/leagues/" + league.id + "/standings")} style={{ fontSize: "13px" }}>Standings</Button>
                <Button onClick={() => navigate("/leagues/" + league.id + "/my-team")} style={{ fontSize: "13px" }}>My Team</Button>
                <Button variant="ghost" onClick={() => navigate("/leagues/" + league.id + "/waivers")} style={{ fontSize: "13px" }}>Waivers</Button>
                <Button variant="ghost" onClick={() => navigate("/leagues/" + league.id + "/trades")} style={{ fontSize: "13px" }}>Trades</Button>
                {league.status === "PLAYOFFS" && (
                  <Button variant="ghost" onClick={() => navigate("/leagues/" + league.id + "/bracket")} style={{ fontSize: "13px" }}>🏆 Bracket</Button>
                )}
              </>
            )}
            {!league.isMember && league.status === "SETUP" && league.memberCount < league.maxTeams && (
              <Button onClick={() => setShowJoin(true)}>Join League — ${league.buyIn}</Button>
            )}
            {isMyLeague && (
              <Button variant="ghost" onClick={() => navigate("/leagues/" + league.id + "/commissioner")} style={{ fontSize: "13px" }}>⚙ League Settings</Button>
            )}
          </div>
        </div>

        <div style={styles.layout}>
          <div style={styles.sidebar}>
            <Section title="Settings">
              <InfoRow label="Buy-In" value={"$" + league.buyIn} highlight />
              <InfoRow label="Teams" value={league.memberCount + " / " + league.maxTeams} />
              <InfoRow label="Scoring" value={league.scoringType === "FULL_PPR" ? "Full PPR" : "Half PPR"} />
              <InfoRow label="Draft" value={league.draftType === "SNAKE" ? "Snake Draft" : "Auction ($200)"} />
              <InfoRow label="Visibility" value={league.visibility === "PUBLIC" ? "Public" : "Private"} />
            </Section>

            <Section title="Prize Pool">
              <InfoRow label="Total Pot" value={"$" + potTotal.toLocaleString()} />
              <InfoRow label="Prize Pool" value={"$" + prizePool.toLocaleString()} highlight />
              <div style={{ marginTop: "12px", borderTop: "1px solid var(--color-border)", paddingTop: "12px" }}>
                <p style={styles.sectionSubLabel}>{PAYOUT_LABEL[league.payoutPreset]}</p>
                {league.payoutSplit?.map((s: any) => (
                  <div key={s.place} style={styles.payoutRow}>
                    <span style={styles.payoutPlace}>
                      {s.place === 1 ? "🥇" : s.place === 2 ? "🥈" : "🥉"} {ordinal(s.place)} Place
                    </span>
                    <span style={styles.payoutAmount}>
                      {"$" + Math.floor(prizePool * s.percent / 100).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          </div>

          <div style={styles.content}>
            <Section title={"Teams (" + league.memberCount + "/" + league.maxTeams + ")"}>
              {league.teams.map((team) => (
                <div key={team.id} style={styles.teamRow}>
                  <div style={styles.teamLeft}>
                    <span style={styles.teamName}>{team.name}</span>
                    <span style={styles.teamUser}>@{team.username}</span>
                  </div>
                  <div style={styles.teamRight}>
                    {team.isCommissioner && <span style={styles.commBadge}>Commissioner</span>}
                  </div>
                </div>
              ))}
              {Array.from({ length: league.maxTeams - league.memberCount }).map((_, i) => (
                <div key={"empty-" + i} style={{ ...styles.teamRow, opacity: 0.3 }}>
                  <span style={{ fontSize: "14px", color: "var(--color-text-muted)" }}>Open slot</span>
                </div>
              ))}
            </Section>
          </div>
        </div>
      </main>

      <Modal open={showJoin} onClose={() => setShowJoin(false)} title={"Join " + league.name}>
        <form onSubmit={handleJoin} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={styles.feeBreakdown}>
            <div style={styles.feeRow}>
              <span style={styles.feeLabel}>Buy-In</span>
              <span style={styles.feeValue}>{"$" + league.buyIn}</span>
            </div>
            <div style={styles.feeRow}>
              <span style={styles.feeLabel}>Total Pot ({league.maxTeams} teams)</span>
              <span style={styles.feeValue}>{"$" + potTotal.toLocaleString()}</span>
            </div>
            <div style={styles.feeRow}>
              <span style={styles.feeLabel}>Platform Fee (5%)</span>
              <span style={{ ...styles.feeValue, color: "var(--color-text-muted)" }}>{"-$" + (potTotal - prizePool).toLocaleString()}</span>
            </div>
            <div style={{ ...styles.feeRow, borderTop: "1px solid var(--color-border)", paddingTop: "10px", marginTop: "2px" }}>
              <span style={{ ...styles.feeLabel, fontWeight: 600, color: "var(--color-text)" }}>Prize Pool</span>
              <span style={{ ...styles.feeValue, color: "var(--color-success)", fontWeight: 700 }}>{"$" + prizePool.toLocaleString()}</span>
            </div>
          </div>
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

const styles: Record<string, React.CSSProperties> = {
  root: { minHeight: "100vh", background: "var(--color-bg)" },
  main: { maxWidth: "1060px", margin: "0 auto", padding: "32px 24px" },
  center: { padding: "40px", textAlign: "center", color: "var(--color-text-muted)" },
  pageHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "32px", gap: "16px" },
  back: { background: "none", border: "none", color: "var(--color-text-muted)", fontSize: "13px", cursor: "pointer", padding: 0, marginBottom: "8px", display: "block" },
  title: { fontSize: "26px", fontWeight: 700, marginBottom: "6px" },
  status: { fontSize: "12px", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "1px" },
  headerActions: { display: "flex", gap: "12px", alignItems: "center" },
  layout: { display: "grid", gridTemplateColumns: "280px 1fr", gap: "24px" },
  sidebar: { display: "flex", flexDirection: "column", gap: "16px" },
  content: {},
  section: { background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius)", padding: "20px" },
  sectionTitle: { fontSize: "14px", fontWeight: 600, marginBottom: "16px", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" },
  sectionSubLabel: { fontSize: "13px", color: "var(--color-text-muted)", marginBottom: "10px" },
  infoRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" },
  infoLabel: { fontSize: "14px", color: "var(--color-text-muted)" },
  infoValue: { fontSize: "14px", color: "var(--color-text)" },
  payoutRow: { display: "flex", justifyContent: "space-between", marginBottom: "8px" },
  payoutPlace: { fontSize: "14px" },
  payoutAmount: { fontSize: "14px", fontWeight: 600, color: "var(--color-success)" },
  teamRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--color-border)" },
  teamLeft: { display: "flex", flexDirection: "column", gap: "2px" },
  teamName: { fontSize: "15px", fontWeight: 500 },
  teamUser: { fontSize: "12px", color: "var(--color-text-muted)" },
  teamRight: { display: "flex", alignItems: "center", gap: "8px" },
  commBadge: { fontSize: "11px", background: "rgba(30,75,216,0.15)", color: "var(--color-accent)", padding: "3px 8px", borderRadius: "999px" },
  paidBadge: { fontSize: "11px", padding: "3px 8px", borderRadius: "999px" },
  feeBreakdown: { background: "var(--color-surface-2)", borderRadius: "var(--radius)", padding: "14px 16px", display: "flex", flexDirection: "column", gap: "8px" },
  feeRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  feeLabel: { fontSize: "13px", color: "var(--color-text-muted)" },
  feeValue: { fontSize: "13px", color: "var(--color-text)", fontWeight: 500 },
};


const CARD_STYLE = {
  style: {
    base: { color: "#fff", fontFamily: "inherit", fontSize: "15px", "::placeholder": { color: "#666" } },
    invalid: { color: "#ef4444" },
  },
};

function PaymentModal({ clientSecret, amount, maxTeams, leagueName, onSuccess, onClose }: {
  clientSecret: string;
  amount: number;
  maxTeams: number;
  leagueName: string;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<"card" | "bank">("card");
  const [bankName, setBankName] = useState("");
  const [bankRouting, setBankRouting] = useState("");
  const [bankAccount, setBankAccount] = useState("");

  const totalPot = amount * maxTeams;
  const fee = totalPot - Math.floor(totalPot * 0.95);
  const prizePool = totalPot - fee;

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setError(null);
    setLoading(true);
    if (method === "card") {
      const card = elements.getElement(CardElement);
      if (!card) { setError("Card element not found"); setLoading(false); return; }
      const { error: stripeErr } = await stripe.confirmCardPayment(clientSecret, { payment_method: { card } });
      setLoading(false);
      if (stripeErr) { setError(stripeErr.message ?? "Payment failed"); } else { onSuccess(); }
    } else {
      const { error: stripeErr } = await (stripe as any).confirmUsBankAccountPayment(clientSecret, {
        payment_method: {
          us_bank_account: { routing_number: bankRouting, account_number: bankAccount, account_holder_type: "individual" },
          billing_details: { name: bankName },
        },
      });
      setLoading(false);
      if (stripeErr) { setError(stripeErr.message ?? "Payment failed"); } else { onSuccess(); }
    }
  }

  return (
    <div style={payStyles.overlay}>
      <div style={payStyles.modal}>
        <div style={payStyles.header}>
          <span style={payStyles.title}>Pay Buy-In — {leagueName}</span>
          <button style={payStyles.close} onClick={onClose}>✕</button>
        </div>
        <div style={payStyles.body}>
          <div style={payStyles.breakdown}>
            <div style={payStyles.breakdownRow}>
              <span style={payStyles.breakdownLabel}>Buy-In</span>
              <span style={payStyles.breakdownValue}>{"$" + amount}</span>
            </div>
            <div style={payStyles.breakdownRow}>
              <span style={payStyles.breakdownLabel}>{"Total Pot (" + maxTeams + " teams)"}</span>
              <span style={payStyles.breakdownValue}>{"$" + totalPot.toLocaleString()}</span>
            </div>
            <div style={payStyles.breakdownRow}>
              <span style={payStyles.breakdownLabel}>Platform Fee (5%)</span>
              <span style={{ ...payStyles.breakdownValue, color: "var(--color-text-muted)" }}>{"-$" + fee.toLocaleString()}</span>
            </div>
            <div style={{ ...payStyles.breakdownRow, borderTop: "1px solid var(--color-border)", paddingTop: "10px", marginTop: "4px" }}>
              <span style={{ ...payStyles.breakdownLabel, fontWeight: 600, color: "var(--color-text)" }}>Prize Pool</span>
              <span style={{ ...payStyles.breakdownValue, color: "var(--color-success)", fontWeight: 700 }}>{"$" + prizePool.toLocaleString()}</span>
            </div>
          </div>
          <form onSubmit={handlePay} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={payStyles.tabs}>
              <button type="button" style={{ ...payStyles.tab, ...(method === "card" ? payStyles.tabActive : {}) }} onClick={() => setMethod("card")}>Card</button>
              <button type="button" style={{ ...payStyles.tab, ...(method === "bank" ? payStyles.tabActive : {}) }} onClick={() => setMethod("bank")}>Bank Transfer</button>
            </div>
            {method === "card" ? (
              <div style={payStyles.cardWrap}>
                <CardElement options={CARD_STYLE} />
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <input placeholder="Account holder name" value={bankName} onChange={(e) => setBankName(e.target.value)} style={payStyles.bankInput} required />
                <input placeholder="Routing number (9 digits)" value={bankRouting} onChange={(e) => setBankRouting(e.target.value)} style={payStyles.bankInput} required maxLength={9} />
                <input placeholder="Account number" value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} style={payStyles.bankInput} required />
                <p style={{ fontSize: "11px", color: "var(--color-text-muted)", margin: 0 }}>Bank transfers require 1–2 business days to verify.</p>
              </div>
            )}
            {error && <p style={{ fontSize: "13px", color: "var(--color-danger)", margin: 0 }}>{error}</p>}
            <Button type="submit" loading={loading}>{"Pay $" + amount}</Button>
          </form>
        </div>
      </div>
    </div>
  );
}

const payStyles: Record<string, React.CSSProperties> = {
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1001, padding: "24px" },
  modal: { width: "100%", maxWidth: "480px", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius)", overflow: "hidden" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 24px", borderBottom: "1px solid var(--color-border)" },
  title: { fontWeight: 600, fontSize: "16px" },
  close: { background: "none", border: "none", color: "var(--color-text-muted)", fontSize: "16px", cursor: "pointer" },
  body: { padding: "24px", display: "flex", flexDirection: "column", gap: "16px" },
  breakdown: { background: "var(--color-surface-2)", borderRadius: "var(--radius)", padding: "14px 16px", display: "flex", flexDirection: "column", gap: "8px" },
  breakdownRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  breakdownLabel: { fontSize: "13px", color: "var(--color-text-muted)" },
  breakdownValue: { fontSize: "13px", color: "var(--color-text)", fontWeight: 500 },
  tabs: { display: "flex", gap: "8px" },
  tab: { flex: 1, padding: "9px", background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: "var(--radius)", color: "var(--color-text-muted)", fontSize: "14px", cursor: "pointer" },
  tabActive: { background: "var(--color-accent)", borderColor: "var(--color-accent)", color: "#fff" },
  cardWrap: { padding: "12px 14px", background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: "var(--radius)" },
  bankInput: { width: "100%", padding: "10px 12px", background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: "var(--radius)", color: "var(--color-text)", fontSize: "14px", boxSizing: "border-box" },
};
