import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Button from "../components/Button";
import { api } from "../api/client";
import { useToast } from "../store/toast";

interface PayoutPreviewItem { place: number; amountCents: number }
interface PayoutRecord { id: string; amountCents: number; user: { username: string }; createdAt: string }
interface TeamMember {
  id: string; name: string; paid: boolean;
  user: { username: string; email: string };
}
interface StandingsEntry {
  teamId: string; teamName: string; wins: number; losses: number; pointsFor: number;
}
interface PanelData {
  league: { id: string; name: string; status: string; payoutPreset: string; buyIn: number; scoringType: string; draftType: string; inviteCode: string; draftStartsAt?: string | null };
  teams: TeamMember[];
  prizePool: number;
  payoutPreview: PayoutPreviewItem[];
  payouts: PayoutRecord[];
  standings: StandingsEntry[];
}

const PLACE_LABELS = ["1st", "2nd", "3rd"];
const PRESET_OPTIONS = [
  { value: "WINNER_TAKES_ALL", label: "Winner Takes All (100%)" },
  { value: "TOP_TWO", label: "Top Two (70% / 30%)" },
  { value: "TOP_THREE", label: "Top Three (60% / 25% / 15%)" },
];

export default function CommissionerPanel() {
  const { id: leagueId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [data, setData] = useState<PanelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifTitle, setNotifTitle] = useState("");
  const [notifBody, setNotifBody] = useState("");
  const [sendingNotif, setSendingNotif] = useState(false);
  const [triggeringPayout, setTriggeringPayout] = useState(false);
  const [payoutPreset, setPayoutPreset] = useState("WINNER_TAKES_ALL");
  const [draftDate, setDraftDate] = useState("");
  const [savingDate, setSavingDate] = useState(false);

  useEffect(() => {
    if (!leagueId) return;
    api.get<PanelData>("/commissioner/" + leagueId + "/panel").then((res) => {
      if (res.ok) {
        setData(res.data);
        setPayoutPreset(res.data.league.payoutPreset);
        if (res.data.league.draftStartsAt) {
          setDraftDate(new Date(res.data.league.draftStartsAt).toISOString().slice(0, 16));
        }
      } else {
        navigate(-1);
      }
      setLoading(false);
    });
  }, [leagueId]);

  async function updatePreset(value: string) {
    setPayoutPreset(value);
    await api.patch("/commissioner/" + leagueId + "/settings", { payoutPreset: value });
    toast("Payout structure updated");
    const res = await api.get<PanelData>("/commissioner/" + leagueId + "/panel");
    if (res.ok) setData(res.data);
  }

  async function saveDraftDate() {
    if (!draftDate) return;
    setSavingDate(true);
    const res = await api.patch("/commissioner/" + leagueId + "/settings", { draftStartsAt: draftDate });
    setSavingDate(false);
    if (res.ok) {
      toast("Draft date saved");
      const fresh = await api.get<PanelData>("/commissioner/" + leagueId + "/panel");
      if (fresh.ok) setData(fresh.data);
    }
  }

  async function sendNotification() {
    if (!notifTitle || !notifBody) return;
    setSendingNotif(true);
    const res = await api.post("/commissioner/" + leagueId + "/notify", { title: notifTitle, body: notifBody });
    setSendingNotif(false);
    if (res.ok) { toast("Notification sent to all members"); setNotifTitle(""); setNotifBody(""); }
  }

  async function triggerPayouts() {
    if (!confirm("Issue final payouts? This cannot be undone.")) return;
    setTriggeringPayout(true);
    const res = await api.post("/commissioner/" + leagueId + "/trigger-payouts", {});
    setTriggeringPayout(false);
    if (res.ok) {
      toast("Payouts issued!");
      const fresh = await api.get<PanelData>("/commissioner/" + leagueId + "/panel");
      if (fresh.ok) setData(fresh.data);
    } else {
      toast((res as any).error ?? "Failed to issue payouts");
    }
  }

  if (loading) return <div style={styles.root}><Navbar /></div>;
  if (!data) return null;

  const payoutsIssued = data.payouts.length > 0;
  const prizePool = "$" + (data.prizePool / 100).toFixed(2);

  return (
    <div style={styles.root}>
      <Navbar />
      <main style={styles.main}>
        <div style={styles.topRow}>
          <button style={styles.back} onClick={() => navigate("/leagues/" + leagueId)}>← {data.league.name}</button>
          <span style={styles.badge}>League Settings</span>
        </div>

        <div style={styles.grid}>
          <Card title="League Info">
            <InfoRow label="Status" value={data.league.status} />
            <InfoRow label="Scoring" value={data.league.scoringType.replace("_", " ")} />
            <InfoRow label="Draft" value={data.league.draftType} />
            <InfoRow label="Buy-in" value={"$" + (data.league.buyIn / 100).toFixed(2)} />
            <InfoRow label="Invite code" value={data.league.inviteCode} mono copyable />
          </Card>

          <Card title="Draft Date">
            <p style={styles.hint}>Set the scheduled date and time for the draft.</p>
            <div style={styles.dateRow}>
              <input
                type="datetime-local"
                style={styles.dateInput}
                value={draftDate}
                onChange={(e) => setDraftDate(e.target.value)}
              />
              <Button onClick={saveDraftDate} loading={savingDate} style={{ fontSize: "13px", padding: "8px 16px" }}>
                Save
              </Button>
            </div>
            {data.league.draftStartsAt && (
              <p style={{ fontSize: "12px", color: "var(--color-success)", marginTop: "8px" }}>
                ✓ Scheduled for {new Date(data.league.draftStartsAt).toLocaleString()}
              </p>
            )}
          </Card>

          <Card title={"Members (" + data.teams.length + ")"}>
            {data.teams.map((t) => (
              <div key={t.id} style={styles.memberRow}>
                <div>
                  <p style={styles.memberName}>{t.name}</p>
                  <p style={styles.memberUsername}>@{t.user.username}</p>
                </div>
                <span style={{ ...styles.paidBadge, ...(t.paid ? styles.paidGreen : styles.paidGray) }}>
                  {t.paid ? "Paid" : "Unpaid"}
                </span>
              </div>
            ))}
          </Card>

          <Card title={"Prize Pool — " + prizePool}>
            <div style={styles.presetRow}>
              <label style={styles.label}>Payout structure</label>
              <select
                style={styles.select}
                value={payoutPreset}
                onChange={(e) => updatePreset(e.target.value)}
                disabled={payoutsIssued}
              >
                {PRESET_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div style={styles.payoutList}>
              {data.payoutPreview.map((p) => (
                <div key={p.place} style={styles.payoutRow}>
                  <span style={styles.placeLabel}>{PLACE_LABELS[p.place - 1]}</span>
                  <span style={styles.payoutAmt}>{"$" + (p.amountCents / 100).toFixed(2)}</span>
                </div>
              ))}
            </div>
            {payoutsIssued ? (
              <div style={styles.payoutsIssued}>
                <span style={styles.checkmark}>✓</span>
                <p style={styles.issuedLabel}>Payouts issued</p>
                {data.payouts.map((p) => (
                  <p key={p.id} style={styles.issuedLine}>@{p.user.username} — {"$" + (p.amountCents / 100).toFixed(2)}</p>
                ))}
              </div>
            ) : (
              <Button onClick={triggerPayouts} loading={triggeringPayout} disabled={data.league.status !== "PLAYOFFS"} style={{ marginTop: "16px", width: "100%" }}>
                Issue Payouts
              </Button>
            )}
            {data.league.status !== "PLAYOFFS" && !payoutsIssued && (
              <p style={styles.hint}>Available after Week 17 championship</p>
            )}
          </Card>

          <Card title="Current Standings">
            {data.standings.length === 0 ? (
              <p style={styles.hint}>No games played yet</p>
            ) : data.standings.map((s, i) => (
              <div key={s.teamId} style={styles.standingRow}>
                <span style={styles.rank}>{i + 1}</span>
                <span style={{ flex: 1, fontSize: "13px" }}>{s.teamName}</span>
                <span style={styles.record}>{s.wins}-{s.losses}</span>
                <span style={styles.pts}>{s.pointsFor.toFixed(0)} pts</span>
              </div>
            ))}
          </Card>

          <Card title="Message All Members" span2>
            <div style={styles.notifForm}>
              <input style={styles.input} placeholder="Title" value={notifTitle} onChange={(e) => setNotifTitle(e.target.value)} />
              <textarea style={styles.textarea} placeholder="Message body…" value={notifBody} onChange={(e) => setNotifBody(e.target.value)} rows={3} />
              <Button onClick={sendNotification} loading={sendingNotif} disabled={!notifTitle || !notifBody}>Send Notification</Button>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}

function Card({ title, children, span2 }: { title: string; children: React.ReactNode; span2?: boolean }) {
  return (
    <div style={{ ...styles.card, ...(span2 ? { gridColumn: "span 2" } : {}) }}>
      <p style={styles.cardTitle}>{title}</p>
      {children}
    </div>
  );
}

function InfoRow({ label, value, mono, copyable }: { label: string; value: string; mono?: boolean; copyable?: boolean }) {
  return (
    <div style={styles.infoRow}>
      <span style={styles.infoLabel}>{label}</span>
      <span
        style={{ ...styles.infoValue, ...(mono ? { fontFamily: "monospace", fontSize: "12px" } : {}) }}
        onClick={copyable ? () => navigator.clipboard.writeText(value) : undefined}
        title={copyable ? "Click to copy" : undefined}
      >
        {value}
      </span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { minHeight: "100vh", background: "var(--color-bg)" },
  main: { maxWidth: "1060px", margin: "0 auto", padding: "32px 24px" },
  topRow: { display: "flex", alignItems: "center", gap: "12px", marginBottom: "28px" },
  back: { background: "none", border: "none", color: "var(--color-text-muted)", fontSize: "13px", cursor: "pointer", padding: 0 },
  badge: { fontSize: "11px", fontWeight: 700, background: "rgba(245,158,11,0.15)", color: "#f59e0b", padding: "3px 10px", borderRadius: "999px", letterSpacing: "0.5px" },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" },
  card: { background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius)", padding: "20px", display: "flex", flexDirection: "column", gap: "12px" },
  cardTitle: { fontSize: "13px", fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" },
  infoRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--color-border)" },
  infoLabel: { fontSize: "13px", color: "var(--color-text-muted)" },
  infoValue: { fontSize: "13px", fontWeight: 500, cursor: "default" },
  memberRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--color-border)" },
  memberName: { fontSize: "14px", fontWeight: 600 },
  memberUsername: { fontSize: "12px", color: "var(--color-text-muted)" },
  paidBadge: { fontSize: "11px", fontWeight: 600, padding: "3px 8px", borderRadius: "999px" },
  paidGreen: { background: "rgba(34,197,94,0.15)", color: "#22c55e" },
  paidGray: { background: "rgba(156,163,175,0.15)", color: "#9ca3af" },
  presetRow: { display: "flex", flexDirection: "column" as const, gap: "6px" },
  label: { fontSize: "12px", color: "var(--color-text-muted)" },
  select: { background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: "6px", color: "var(--color-text)", padding: "8px 10px", fontSize: "13px", fontFamily: "var(--font)" },
  payoutList: { display: "flex", flexDirection: "column" as const, gap: "6px" },
  payoutRow: { display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--color-border)" },
  placeLabel: { fontSize: "13px", fontWeight: 600, color: "var(--color-text-muted)" },
  payoutAmt: { fontSize: "16px", fontWeight: 700, color: "var(--color-success)" },
  payoutsIssued: { display: "flex", flexDirection: "column" as const, gap: "4px", padding: "12px", background: "rgba(34,197,94,0.08)", borderRadius: "8px" },
  checkmark: { fontSize: "20px" },
  issuedLabel: { fontSize: "14px", fontWeight: 700, color: "var(--color-success)" },
  issuedLine: { fontSize: "13px", color: "var(--color-text-muted)" },
  hint: { fontSize: "12px", color: "var(--color-text-muted)" },
  standingRow: { display: "flex", alignItems: "center", gap: "10px", padding: "7px 0", borderBottom: "1px solid var(--color-border)" },
  rank: { fontSize: "13px", fontWeight: 700, color: "var(--color-text-muted)", width: "20px" },
  record: { fontSize: "13px", color: "var(--color-text-muted)", minWidth: "40px", textAlign: "right" as const },
  pts: { fontSize: "13px", fontWeight: 600, minWidth: "50px", textAlign: "right" as const },
  notifForm: { display: "flex", flexDirection: "column" as const, gap: "10px" },
  input: { background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: "8px", color: "var(--color-text)", padding: "10px 14px", fontSize: "14px", fontFamily: "var(--font)" },
  textarea: { background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: "8px", color: "var(--color-text)", padding: "10px 14px", fontSize: "14px", fontFamily: "var(--font)", resize: "vertical" as const },
  dateRow: { display: "flex", gap: "10px", alignItems: "center" },
  dateInput: { flex: 1, background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: "8px", color: "var(--color-text)", padding: "10px 14px", fontSize: "14px", fontFamily: "var(--font)" },
};
