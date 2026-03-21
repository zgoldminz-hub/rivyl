import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../store/auth";
import CreateLeagueModal from "./CreateLeagueModal";
import Button from "./Button";
import { api } from "../api/client";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  leagueId: string | null;
  createdAt: string;
}

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showBell, setShowBell] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  function isActive(path: string) {
    return location.pathname === path;
  }

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60_000); // poll every minute
    return () => clearInterval(interval);
  }, []);

  async function fetchNotifications() {
    const res = await api.get<{ notifications: Notification[]; unreadCount: number }>("/notifications");
    if (res.ok) {
      setNotifications(res.data.notifications);
      setUnreadCount(res.data.unreadCount);
    }
  }

  async function markAllRead() {
    await api.post("/notifications/read-all", {});
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setShowBell(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleBellClick() {
    setShowBell((v) => !v);
    if (!showBell && unreadCount > 0) markAllRead();
  }

  const NOTIF_ICONS: Record<string, string> = {
    DRAFT_PICK: "🏈",
    DRAFT_START: "⏱",
    LINEUP_LOCK: "🔒",
    SCORE_UPDATED: "📊",
    PLAYOFF_QUALIFIED: "🏆",
    PAYOUT_ISSUED: "💰",
    LEAGUE_INVITE: "📣",
  };

  return (
    <>
      <header style={styles.header}>
        <div style={styles.left}>
          <Link to="/dashboard" style={styles.logo}>Rivyl</Link>
          <nav style={styles.nav}>
            <NavLink to="/dashboard" active={isActive("/dashboard")}>My Leagues</NavLink>
            <NavLink to="/discover" active={isActive("/discover")}>Discover</NavLink>
          </nav>
        </div>
        <div style={styles.right}>
          <Button onClick={() => setShowCreate(true)} style={{ padding: "8px 16px", fontSize: "13px" }}>
            + Create League
          </Button>

          {/* Notification bell */}
          <div style={styles.bellWrap} ref={bellRef}>
            <button style={styles.bellBtn} onClick={handleBellClick} aria-label="Notifications">
              <span style={styles.bellIcon}>🔔</span>
              {unreadCount > 0 && (
                <span style={styles.badge}>{unreadCount > 9 ? "9+" : unreadCount}</span>
              )}
            </button>

            {showBell && (
              <div style={styles.dropdown}>
                <div style={styles.dropdownHeader}>
                  <span style={styles.dropdownTitle}>Notifications</span>
                  {unreadCount > 0 && (
                    <button style={styles.markRead} onClick={markAllRead}>Mark all read</button>
                  )}
                </div>
                <div style={styles.notifList}>
                  {notifications.length === 0 ? (
                    <p style={styles.empty}>No notifications yet</p>
                  ) : notifications.map((n) => (
                    <div
                      key={n.id}
                      style={{ ...styles.notifItem, ...(n.read ? {} : styles.unreadItem) }}
                      onClick={() => {
                        if (n.leagueId) navigate(`/leagues/${n.leagueId}`);
                        setShowBell(false);
                      }}
                    >
                      <span style={styles.notifIcon}>{NOTIF_ICONS[n.type] ?? "📬"}</span>
                      <div style={styles.notifContent}>
                        <p style={styles.notifTitle}>{n.title}</p>
                        <p style={styles.notifBody}>{n.body}</p>
                        <p style={styles.notifTime}>{timeAgo(n.createdAt)}</p>
                      </div>
                      {!n.read && <span style={styles.dot} />}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={styles.userMenu}>
            <span style={styles.username}>@{user?.username}</span>
            <button style={styles.signOut} onClick={() => { logout(); navigate("/login"); }}>
              Sign out
            </button>
          </div>
        </div>
      </header>
      <CreateLeagueModal open={showCreate} onClose={() => setShowCreate(false)} />
    </>
  );
}

function NavLink({ to, active, children }: { to: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      style={{
        fontSize: "14px",
        fontWeight: 500,
        color: active ? "var(--color-text)" : "var(--color-text-muted)",
        textDecoration: "none",
        padding: "4px 0",
        borderBottom: active ? "2px solid var(--color-accent)" : "2px solid transparent",
        transition: "color 0.15s",
      }}
    >
      {children}
    </Link>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 24px",
    height: "60px",
    borderBottom: "1px solid var(--color-border)",
    background: "var(--color-surface)",
    position: "sticky",
    top: 0,
    zIndex: 100,
  },
  left: { display: "flex", alignItems: "center", gap: "32px" },
  logo: { fontSize: "20px", fontWeight: 700, color: "var(--color-accent)", letterSpacing: "-0.5px", textDecoration: "none" },
  nav: { display: "flex", gap: "24px", alignItems: "center" },
  right: { display: "flex", alignItems: "center", gap: "16px" },
  userMenu: { display: "flex", alignItems: "center", gap: "12px" },
  username: { fontSize: "14px", color: "var(--color-text-muted)" },
  signOut: { background: "none", border: "none", color: "var(--color-text-muted)", fontSize: "13px", cursor: "pointer" },
  // Bell
  bellWrap: { position: "relative" },
  bellBtn: { background: "none", border: "none", cursor: "pointer", padding: "6px", display: "flex", alignItems: "center", position: "relative" },
  bellIcon: { fontSize: "18px", lineHeight: 1 },
  badge: {
    position: "absolute", top: "0", right: "0",
    background: "#ef4444", color: "#fff", fontSize: "10px", fontWeight: 700,
    minWidth: "16px", height: "16px", borderRadius: "999px",
    display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px",
  },
  // Dropdown
  dropdown: {
    position: "absolute", top: "calc(100% + 8px)", right: 0,
    width: "340px", maxHeight: "420px",
    background: "var(--color-surface)", border: "1px solid var(--color-border)",
    borderRadius: "var(--radius)", boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
    display: "flex", flexDirection: "column", overflow: "hidden", zIndex: 200,
  },
  dropdownHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "14px 16px", borderBottom: "1px solid var(--color-border)",
    flexShrink: 0,
  },
  dropdownTitle: { fontSize: "14px", fontWeight: 700 },
  markRead: { background: "none", border: "none", color: "var(--color-accent)", fontSize: "12px", cursor: "pointer" },
  notifList: { overflowY: "auto", flex: 1 },
  empty: { padding: "24px", textAlign: "center", fontSize: "14px", color: "var(--color-text-muted)" },
  notifItem: {
    display: "flex", gap: "12px", padding: "12px 16px",
    borderBottom: "1px solid var(--color-border)", cursor: "pointer",
    alignItems: "flex-start", position: "relative",
  },
  unreadItem: { background: "rgba(79,124,255,0.05)" },
  notifIcon: { fontSize: "18px", flexShrink: 0, marginTop: "2px" },
  notifContent: { flex: 1, minWidth: 0 },
  notifTitle: { fontSize: "13px", fontWeight: 600, marginBottom: "2px" },
  notifBody: { fontSize: "12px", color: "var(--color-text-muted)", lineHeight: 1.4, marginBottom: "4px" },
  notifTime: { fontSize: "11px", color: "var(--color-text-muted)" },
  dot: { width: "8px", height: "8px", borderRadius: "50%", background: "var(--color-accent)", flexShrink: 0, marginTop: "6px" },
};
