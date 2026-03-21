import React from "react";

interface Props {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export default function AuthLayout({ title, subtitle, children }: Props) {
  return (
    <div style={styles.root}>
      <div style={styles.card}>
        <div style={styles.logo}>Rivyl</div>
        <h1 style={styles.title}>{title}</h1>
        {subtitle && <p style={styles.subtitle}>{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--color-bg)",
    padding: "24px",
  },
  card: {
    width: "100%",
    maxWidth: "420px",
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius)",
    padding: "40px 36px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  logo: {
    fontSize: "28px",
    fontWeight: 700,
    color: "var(--color-accent)",
    marginBottom: "8px",
    letterSpacing: "-0.5px",
  },
  title: {
    fontSize: "20px",
    fontWeight: 600,
    color: "var(--color-text)",
  },
  subtitle: {
    fontSize: "14px",
    color: "var(--color-text-muted)",
    marginBottom: "8px",
  },
};
