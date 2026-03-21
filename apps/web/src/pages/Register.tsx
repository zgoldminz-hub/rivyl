import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../store/auth";
import AuthLayout from "../components/AuthLayout";
import Input from "../components/Input";
import Button from "../components/Button";

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [form, setForm] = useState({ email: "", username: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function validate() {
    const e: Record<string, string> = {};
    if (!form.email.includes("@")) e.email = "Enter a valid email";
    if (form.username.length < 3) e.username = "At least 3 characters";
    if (!/^[a-zA-Z0-9_]+$/.test(form.username)) e.username = "Letters, numbers, underscores only";
    if (form.password.length < 8) e.password = "At least 8 characters";
    return e;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fieldErrors = validate();
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setServerError(null);
    setLoading(true);
    const err = await register(form.email, form.username, form.password);
    setLoading(false);
    if (err) {
      setServerError(err);
    } else {
      navigate("/dashboard");
    }
  }

  return (
    <AuthLayout title="Create your account" subtitle="Play fantasy. Win real money.">
      <form onSubmit={handleSubmit} style={styles.form}>
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          error={errors.email}
          required
        />
        <Input
          label="Username"
          type="text"
          autoComplete="username"
          placeholder="e.g. gridiron_king"
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
          error={errors.username}
          required
        />
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          error={errors.password}
          required
        />
        {serverError && <p style={styles.error}>{serverError}</p>}
        <Button type="submit" loading={loading} style={{ width: "100%", marginTop: "8px" }}>
          Create account
        </Button>
      </form>
      <p style={styles.footer}>
        Already have an account? <Link to="/login">Sign in</Link>
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
