import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Modal from "./Modal";
import Input from "./Input";
import Select from "./Select";
import Button from "./Button";
import { useLeagues, CreateLeagueData } from "../store/leagues";

interface Props {
  open: boolean;
  onClose: () => void;
}

const DEFAULT: CreateLeagueData = {
  name: "",
  maxTeams: 12,
  buyIn: 50,
  payoutPreset: "TOP_TWO",
  scoringType: "HALF_PPR",
  draftType: "SNAKE",
  visibility: "PRIVATE",
};

export default function CreateLeagueModal({ open, onClose }: Props) {
  const navigate = useNavigate();
  const { createLeague } = useLeagues();
  const [form, setForm] = useState<CreateLeagueData>(DEFAULT);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function set<K extends keyof CreateLeagueData>(key: K, value: CreateLeagueData[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const totalPot = form.buyIn * form.maxTeams;
  const afterFee = Math.floor(totalPot * 0.95);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { league, error: err } = await createLeague(form);
    setLoading(false);
    if (err) {
      setError(err);
      return;
    }
    onClose();
    setForm(DEFAULT);
    navigate(`/leagues/${league.id}`);
  }

  return (
    <Modal open={open} onClose={onClose} title="Create League" width={560}>
      <form onSubmit={handleSubmit} style={styles.form}>
        <Input
          label="League Name"
          placeholder="e.g. The Gridiron Legends"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          required
        />

        <div style={styles.row}>
          <Select
            label="Teams"
            value={form.maxTeams}
            onChange={(e) => set("maxTeams", parseInt(e.target.value))}
            options={[
              { value: 8, label: "8 Teams" },
              { value: 10, label: "10 Teams" },
              { value: 12, label: "12 Teams" },
            ]}
          />
          <Select
            label="Visibility"
            value={form.visibility}
            onChange={(e) => set("visibility", e.target.value)}
            options={[
              { value: "PRIVATE", label: "Private" },
              { value: "PUBLIC", label: "Public" },
            ]}
          />
        </div>

        <div style={styles.row}>
          <Select
            label="Scoring"
            value={form.scoringType}
            onChange={(e) => set("scoringType", e.target.value)}
            options={[
              { value: "HALF_PPR", label: "Half PPR" },
              { value: "FULL_PPR", label: "Full PPR" },
            ]}
          />
          <Select
            label="Draft Type"
            value={form.draftType}
            onChange={(e) => set("draftType", e.target.value)}
            options={[
              { value: "SNAKE", label: "Snake" },
              { value: "AUCTION", label: "Auction ($200)" },
            ]}
          />
        </div>

        <div style={styles.buyInSection}>
          <div style={styles.buyInHeader}>
            <span style={styles.label}>Buy-In</span>
            <span style={styles.buyInValue}>${form.buyIn}</span>
          </div>
          <input
            type="range"
            min={10}
            max={1000}
            step={10}
            value={form.buyIn}
            onChange={(e) => set("buyIn", parseInt(e.target.value))}
            style={styles.slider}
          />
          <div style={styles.sliderLabels}>
            <span>$10</span><span>$1,000</span>
          </div>
        </div>

        <Select
          label="Payout Structure"
          value={form.payoutPreset}
          onChange={(e) => set("payoutPreset", e.target.value)}
          options={[
            { value: "WINNER_TAKES_ALL", label: "Winner Takes All (100%)" },
            { value: "TOP_TWO", label: "Top 2 (70% / 30%)" },
            { value: "TOP_THREE", label: "Top 3 (60% / 25% / 15%)" },
          ]}
        />

        <div style={styles.potSummary}>
          <div style={styles.potRow}>
            <span style={styles.potLabel}>Total Pot</span>
            <span style={styles.potValue}>${totalPot.toLocaleString()}</span>
          </div>
          <div style={styles.potRow}>
            <span style={styles.potLabel}>Platform Fee (5%)</span>
            <span style={{ color: "var(--color-text-muted)", fontSize: "14px" }}>
              −${(totalPot - afterFee).toLocaleString()}
            </span>
          </div>
          <div style={{ ...styles.potRow, borderTop: "1px solid var(--color-border)", paddingTop: "8px" }}>
            <span style={{ ...styles.potLabel, fontWeight: 600 }}>Prize Pool</span>
            <span style={{ ...styles.potValue, color: "var(--color-success)" }}>
              ${afterFee.toLocaleString()}
            </span>
          </div>
        </div>

        {error && <p style={styles.error}>{error}</p>}

        <div style={styles.actions}>
          <Button type="button" variant="ghost" onClick={onClose} style={{ flex: 1 }}>
            Cancel
          </Button>
          <Button type="submit" loading={loading} style={{ flex: 2 }}>
            Create League
          </Button>
        </div>
      </form>
    </Modal>
  );
}

const styles: Record<string, React.CSSProperties> = {
  form: { display: "flex", flexDirection: "column", gap: "16px" },
  row: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" },
  label: { fontSize: "13px", fontWeight: 500, color: "var(--color-text-muted)" },
  buyInSection: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    background: "var(--color-surface-2)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius)",
    padding: "14px",
  },
  buyInHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  buyInValue: { fontSize: "20px", fontWeight: 700, color: "var(--color-accent)" },
  slider: { width: "100%", accentColor: "var(--color-accent)", cursor: "pointer" },
  sliderLabels: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "12px",
    color: "var(--color-text-muted)",
  },
  potSummary: {
    background: "var(--color-surface-2)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius)",
    padding: "14px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  potRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  potLabel: { fontSize: "14px", color: "var(--color-text-muted)" },
  potValue: { fontSize: "15px", fontWeight: 600 },
  error: {
    fontSize: "13px",
    color: "var(--color-danger)",
    background: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.3)",
    padding: "10px 12px",
    borderRadius: "8px",
  },
  actions: { display: "flex", gap: "12px", marginTop: "4px" },
};
