import { Component, ErrorInfo, ReactNode } from "react";

interface Props { children: ReactNode }
interface State { hasError: boolean; error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: "16px",
          background: "var(--color-bg)", padding: "24px",
        }}>
          <p style={{ fontSize: "40px" }}>⚠️</p>
          <h1 style={{ fontSize: "20px", fontWeight: 700 }}>Something went wrong</h1>
          <p style={{ fontSize: "14px", color: "var(--color-text-muted)", maxWidth: "380px", textAlign: "center" }}>
            {this.state.error?.message ?? "An unexpected error occurred."}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "10px 24px", background: "var(--color-accent)", border: "none",
              borderRadius: "8px", color: "#fff", fontSize: "14px", fontWeight: 600,
              cursor: "pointer", fontFamily: "var(--font)",
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
