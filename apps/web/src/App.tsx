import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./store/auth";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Discover from "./pages/Discover";
import LeaguePage from "./pages/LeaguePage";
import DraftRoom from "./pages/DraftRoom";
import Standings from "./pages/Standings";
import MyTeam from "./pages/MyTeam";
import MatchupDetail from "./pages/MatchupDetail";
import PlayoffBracket from "./pages/PlayoffBracket";
import CommissionerPanel from "./pages/CommissionerPanel";
import Toast from "./components/Toast";
import ErrorBoundary from "./components/ErrorBoundary";

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", color: "var(--color-text-muted)" }}>Loading…</div>;
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return !user ? <>{children}</> : <Navigate to="/dashboard" replace />;
}

export default function App() {
  const { fetchMe } = useAuth();

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  return (
    <ErrorBoundary>
    <BrowserRouter>
      <Toast />
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
        <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />
        <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/discover" element={<PrivateRoute><Discover /></PrivateRoute>} />
        <Route path="/leagues/:id" element={<PrivateRoute><LeaguePage /></PrivateRoute>} />
        <Route path="/leagues/:id/draft" element={<PrivateRoute><DraftRoom /></PrivateRoute>} />
        <Route path="/leagues/:id/standings" element={<PrivateRoute><Standings /></PrivateRoute>} />
        <Route path="/leagues/:id/my-team" element={<PrivateRoute><MyTeam /></PrivateRoute>} />
        <Route path="/leagues/:id/matchup/:matchupId" element={<PrivateRoute><MatchupDetail /></PrivateRoute>} />
        <Route path="/leagues/:id/bracket" element={<PrivateRoute><PlayoffBracket /></PrivateRoute>} />
        <Route path="/leagues/:id/commissioner" element={<PrivateRoute><CommissionerPanel /></PrivateRoute>} />
      </Routes>
    </BrowserRouter>
    </ErrorBoundary>
  );
}
