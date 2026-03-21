import { useToastStore } from "../store/toast";

export default function Toast() {
  const { message, type, dismiss } = useToastStore();

  if (!message) return null;

  const colors: Record<string, string> = {
    success: "#22c55e",
    error: "#ef4444",
    info: "var(--color-accent)",
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: "24px",
        left: "50%",
        transform: "translateX(-50%)",
        background: "var(--color-surface)",
        border: `1px solid ${colors[type]}`,
        color: "var(--color-text)",
        borderRadius: "10px",
        padding: "12px 20px",
        fontSize: "14px",
        fontWeight: 500,
        display: "flex",
        alignItems: "center",
        gap: "12px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        zIndex: 9999,
        maxWidth: "420px",
        animation: "slideUp 0.2s ease",
      }}
    >
      <span style={{ color: colors[type], fontSize: "16px" }}>
        {type === "success" ? "✓" : type === "error" ? "✕" : "ℹ"}
      </span>
      <span style={{ flex: 1 }}>{message}</span>
      <button
        onClick={dismiss}
        style={{ background: "none", border: "none", color: "var(--color-text-muted)", cursor: "pointer", fontSize: "14px", padding: 0 }}
      >
        ✕
      </button>
    </div>
  );
}
