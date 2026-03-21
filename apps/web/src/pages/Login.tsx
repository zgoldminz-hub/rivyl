import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../store/auth";
import AuthLayout from "../components/AuthLayout";
import Input from "../components/Input";
import Button from "../components/Button";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const err = await login(form.email, form.password);
    setLoading(false);
    if (err) {
      setError(err);
    } else {
      navigate("/dashboard");
    }
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your Rivyl account">
      <form onSubmit={handleSubmit} style={styles.form}>
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
        />
        {error && <p style={styles.error}>{error}</p>}
        <Button type="submit" loading={loading} style={{ width: "100%", marginTop: "8px" }}>
          Sign in
        </Button>
      </form>
      <p style={styles.footer}>
        Don't have an account? <Link to="/register">Create one</Link>
      </p>
    </AuthLayout>
  );
}

const styles: Record<string, React.CSSProperties> = {
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    marginTop: "20px",
  },
  error: {
    fontSize: "13px",
    color: "var(--color-danger)",
    background: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.3)",
    padding: "10px 12px",
    borderRadius: "8px",
  },
  footer: {
    fontSize: "13px",
    color: "var(--color-text-muted)",
    textAlign: "center",
    marginTop: "20px",
  },
};
