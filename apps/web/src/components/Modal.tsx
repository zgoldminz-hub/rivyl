import React, { useEffect, useRef } from "react";
import ReactDOM from "react-dom";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: number;
}

export default function Modal({ open, onClose, title, children, width = 520 }: Props) {
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);

    const preventScroll = (e: WheelEvent | TouchEvent) => {
      if (bodyRef.current && bodyRef.current.contains(e.target as Node)) return;
      e.preventDefault();
    };

    document.addEventListener("wheel", preventScroll, { passive: false });
    document.addEventListener("touchmove", preventScroll, { passive: false });

    return () => {
      window.removeEventListener("keydown", handler);
      document.removeEventListener("wheel", preventScroll);
      document.removeEventListener("touchmove", preventScroll);
    };
  }, [open, onClose]);

  if (!open) return null;

  return ReactDOM.createPortal(
    <div style={styles.overlay} onClick={onClose}>
      <div style={{ ...styles.modal, maxWidth: width }} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <span style={styles.title}>{title}</span>
          <button style={styles.close} onClick={onClose}>✕</button>
        </div>
        <div ref={bodyRef} style={styles.body}>{children}</div>
      </div>
    </div>,
    document.body
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: "24px",
  },
  modal: {
    width: "100%",
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius)",
    display: "flex",
    flexDirection: "column",
    maxHeight: "calc(100vh - 48px)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "18px 24px",
    borderBottom: "1px solid var(--color-border)",
    flexShrink: 0,
  },
  title: {
    fontWeight: 600,
    fontSize: "16px",
  },
  close: {
    background: "none",
    border: "none",
    color: "var(--color-text-muted)",
    fontSize: "16px",
    cursor: "pointer",
    padding: "4px",
  },
  body: {
    padding: "24px",
    overflowY: "auto",
    flex: 1,
  },
};
