import React, { useEffect, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import Navbar from "../components/Navbar";
import { api } from "../api/client";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

interface ProfileData {
  user: { id: string; email: string; username: string; createdAt: string };
  paymentMethods: PaymentMethod[];
}

export default function Profile() {
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [accountMsg, setAccountMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [addingCard, setAddingCard] = useState(false);

  async function load() {
    const res = await api.get<ProfileData>("/profile");
    if (res.ok) {
      setData(res.data);
      setUsername(res.data.user.username);
      setEmail(res.data.user.email);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function saveAccount() {
    if (!data) return;
    setSaving(true);
    setAccountMsg(null);
    const res = await api.patch<{ user: ProfileData["user"] }>("/profile", { username, email });
    if (res.ok) {
      setData((d) => d ? { ...d, user: res.data.user } : d);
      setAccountMsg({ ok: true, text: "Saved!" });
    } else {
      setAccountMsg({ ok: false, text: res.error });
    }
    setSaving(false);
  }

  async function changePassword() {
    if (newPw !== confirmPw) { setPwMsg({ ok: false, text: "Passwords don't match" }); return; }
    if (newPw.length < 8) { setPwMsg({ ok: false, text: "Minimum 8 characters" }); return; }
    setPwSaving(true);
    setPwMsg(null);
    const res = await api.post("/profile/change-password", { currentPassword: currentPw, newPassword: newPw });
    if (res.ok) {
      setPwMsg({ ok: true, text: "Password updated!" });
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } else {
      setPwMsg({ ok: false, text: (res as { ok: false; error: string }).error });
    }
    setPwSaving(false);
  }

  async function startAddCard() {
    const res = await api.post<{ clientSecret: string }>("/profile/setup-payment", {});
    if (res.ok) { setClientSecret(res.data.clientSecret); setAddingCard(true); }
  }

  async function removeCard(pmId: string) {
    await api.del(`/profile/payment-method/${pmId}`);
    setData((d) => d ? { ...d, paymentMethods: d.paymentMethods.filter((pm) => pm.id !== pmId) } : d);
  }

  function onCardSaved() {
    setAddingCard(false);
    setClientSecret(null);
    load();
  }

  if (loading) return (
    <div style={styles.page}>
      <Navbar />
      <div style={styles.loading}>Loading…</div>
    </div>
  );

  return (
    <div style={styles.page}>
      <Navbar />
      <div style={styles.container}>
        <h1 style={styles.title}>Profile</h1>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Account Info</h2>
          <div style={styles.field}>
            <label style={styles.label}>Username</label>
            <input style={styles.input} value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input style={styles.input} value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {accountMsg && <p style={{ ...styles.msg, color: accountMsg.ok ? "var(--color-accent)" : "var(--color-crimson)" }}>{accountMsg.text}</p>}
          <button style={styles.btn} onClick={saveAccount} disabled={saving}>
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Change Password</h2>
          <div style={styles.field}>
            <label style={styles.label}>Current Password</label>
            <input style={styles.input} type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>New Password</label>
            <input style={styles.input} type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Confirm New Password</label>
            <input style={styles.input} type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
          </div>
          {pwMsg && <p style={{ ...styles.msg, color: pwMsg.ok ? "var(--color-accent)" : "var(--color-crimson)" }}>{pwMsg.text}</p>}
          <button style={styles.btn} onClick={changePassword} disabled={pwSaving}>
            {pwSaving ? "Updating…" : "Update Password"}
          </button>
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Payment Methods</h2>
          {data?.paymentMethods.length === 0 && (
            <p style={styles.empty}>No saved cards yet.</p>
          )}
          {data?.paymentMethods.map((pm) => (
            <div key={pm.id} style={styles.card}>
              <div style={styles.cardLeft}>
                <span style={styles.cardBrand}>{pm.brand?.toUpperCase()}</span>
                <span style={styles.cardNum}>•••• {pm.last4}</span>
                <span style={styles.cardExp}>Exp {pm.expMonth}/{pm.expYear}</span>
              </div>
              <button style={styles.removeBtn} onClick={() => removeCard(pm.id)}>Remove</button>
            </div>
          ))}

          {!addingCard && (
            <button style={styles.addBtn} onClick={startAddCard}>+ Add Card</button>
          )}

          {addingCard && clientSecret && (
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <CardSetupForm onSuccess={onCardSaved} onCancel={() => { setAddingCard(false); setClientSecret(null); }} />
            </Elements>
          )}
        </section>
      </div>
    </div>
  );
}

function CardSetupForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSaving(true);
    setErr(null);
    const result = await stripe.confirmSetup({
      elements,
      redirect: "if_required",
      confirmParams: { return_url: window.location.href },
    });
    if (result.error) {
      setErr(result.error.message ?? "Failed to save card");
      setSaving(false);
    } else {
      onSuccess();
    }
  }

  return (
    <form onSubmit={handleSubmit} style={styles.cardForm}>
      <PaymentElement />
      {err && <p style={{ color: "var(--color-crimson)", fontSize: "13px", marginTop: "8px" }}>{err}</p>}
      <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
        <button type="submit" style={styles.btn} disabled={saving}>{saving ? "Saving…" : "Save Card"}</button>
        <button type="button" style={styles.cancelBtn} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "var(--color-bg)" },
  loading: { display: "flex", alignItems: "center", justifyContent: "center", height: "50vh", color: "var(--color-text-muted)" },
  container: { maxWidth: "600px", margin: "0 auto", padding: "40px 24px" },
  title: { fontSize: "28px", fontWeight: 700, marginBottom: "32px" },
  section: {
    background: "var(--color-surface)", border: "1px solid var(--color-border)",
    borderRadius: "var(--radius)", padding: "24px", marginBottom: "24px",
  },
  sectionTitle: { fontSize: "16px", fontWeight: 700, marginBottom: "20px" },
  field: { marginBottom: "16px" },
  label: { display: "block", fontSize: "13px", color: "var(--color-text-muted)", marginBottom: "6px" },
  input: {
    width: "100%", padding: "10px 12px", borderRadius: "8px",
    border: "1px solid var(--color-border)", background: "var(--color-bg)",
    color: "var(--color-text)", fontSize: "14px", boxSizing: "border-box",
  },
  msg: { fontSize: "13px", marginBottom: "12px" },
  btn: {
    padding: "10px 20px", borderRadius: "8px", border: "none",
    background: "var(--color-accent)", color: "#fff", fontWeight: 600,
    fontSize: "14px", cursor: "pointer",
  },
  cancelBtn: {
    padding: "10px 20px", borderRadius: "8px", border: "1px solid var(--color-border)",
    background: "transparent", color: "var(--color-text-muted)", fontSize: "14px", cursor: "pointer",
  },
  empty: { fontSize: "14px", color: "var(--color-text-muted)", marginBottom: "16px" },
  card: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "12px 16px", border: "1px solid var(--color-border)",
    borderRadius: "8px", marginBottom: "12px",
  },
  cardLeft: { display: "flex", gap: "12px", alignItems: "center" },
  cardBrand: { fontSize: "12px", fontWeight: 700, color: "var(--color-accent)" },
  cardNum: { fontSize: "14px" },
  cardExp: { fontSize: "12px", color: "var(--color-text-muted)" },
  removeBtn: { background: "none", border: "none", color: "var(--color-crimson)", fontSize: "13px", cursor: "pointer" },
  addBtn: {
    marginTop: "8px", padding: "8px 16px", borderRadius: "8px",
    border: "1px dashed var(--color-border)", background: "transparent",
    color: "var(--color-text-muted)", fontSize: "14px", cursor: "pointer",
  },
  cardForm: { marginTop: "20px" },
};
