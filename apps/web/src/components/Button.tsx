import React from "react";

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  variant?: "primary" | "ghost";
}

export default function Button({
  children,
  loading,
  variant = "primary",
  disabled,
  style,
  ...props
}: Props) {
  const base: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    padding: "11px 20px",
    borderRadius: "var(--radius)",
    fontSize: "15px",
    fontWeight: 600,
    border: "none",
    transition: "background 0.15s, opacity 0.15s",
    opacity: disabled || loading ? 0.6 : 1,
    cursor: disabled || loading ? "not-allowed" : "pointer",
    ...(variant === "primary"
      ? { background: "var(--color-accent)", color: "#fff" }
      : { background: "transparent", color: "var(--color-text-muted)", border: "1px solid var(--color-border)" }),
    ...style,
  };

  return (
    <button style={base} disabled={disabled || loading} {...props}>
      {loading ? "Loading…" : children}
    </button>
  );
}
