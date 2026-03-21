import React from "react";

interface Option {
  value: string | number;
  label: string;
}

interface Props extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: Option[];
  error?: string;
}

export default function Select({ label, options, error, id, ...props }: Props) {
  const selectId = id ?? label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div style={styles.field}>
      <label htmlFor={selectId} style={styles.label}>{label}</label>
      <select id={selectId} style={{ ...styles.select, ...(error ? styles.selectError : {}) }} {...props}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {error && <span style={styles.error}>{error}</span>}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  field: { display: "flex", flexDirection: "column", gap: "6px" },
  label: { fontSize: "13px", fontWeight: 500, color: "var(--color-text-muted)" },
  select: {
    padding: "10px 14px",
    background: "var(--color-surface-2)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius)",
    color: "var(--color-text)",
    fontSize: "15px",
    outline: "none",
    cursor: "pointer",
  },
  selectError: { borderColor: "var(--color-danger)" },
  error: { fontSize: "12px", color: "var(--color-danger)" },
};
