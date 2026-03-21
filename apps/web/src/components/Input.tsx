import React from "react";

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export default function Input({ label, error, id, ...props }: Props) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div style={styles.field}>
      <label htmlFor={inputId} style={styles.label}>
        {label}
      </label>
      <input
        id={inputId}
        style={{
          ...styles.input,
          ...(error ? styles.inputError : {}),
        }}
        {...props}
      />
      {error && <span style={styles.error}>{error}</span>}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  label: {
    fontSize: "13px",
    fontWeight: 500,
    color: "var(--color-text-muted)",
  },
  input: {
    padding: "10px 14px",
    background: "var(--color-surface-2)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius)",
    color: "var(--color-text)",
    fontSize: "15px",
    outline: "none",
    transition: "border-color 0.15s",
  },
  inputError: {
    borderColor: "var(--color-danger)",
  },
  error: {
    fontSize: "12px",
    color: "var(--color-danger)",
  },
};
