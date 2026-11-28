import { useState, type FormEvent } from "react";
import Logo from "../../components/Logo";
import { useAdminData } from "../AdminData";
import AdminIcon from "./AdminIcon";

export default function AdminLoginPage() {
  const { login, isConfigured } = useAdminData();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Unable to sign in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="admin-login-page">
      <section className="admin-login-card">
        <div className="admin-login-brand">
          <Logo />
        </div>
        <span className="admin-login-eyebrow">CAMPUS DIRECTORY MANAGEMENT</span>
        <h1>Administrator sign in</h1>
        <p className="admin-login-intro">Sign in with an authorized WVSU WayFinder administrator account.</p>

        {!isConfigured ? (
          <div className="admin-login-message" role="alert">
            <strong>Supabase environment variables are missing.</strong>
            <span>Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your project .env file, then restart the Vite development server.</span>
          </div>
        ) : (
          <form className="admin-login-form" onSubmit={submit}>
            <label className="admin-field">
              <span className="admin-field-label">Email address</span>
              <input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@wvsu.edu.ph" />
            </label>
            <label className="admin-field">
              <span className="admin-field-label">Password</span>
              <input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" />
            </label>
            {error && <p className="admin-form-error" role="alert">{error}</p>}
            <button className="admin-button admin-button-primary admin-login-submit" type="submit" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in to Admin"}
            </button>
          </form>
        )}

        <div className="admin-login-security">
          <AdminIcon name="alert" size={16} />
          <span>Administrator access is checked against Supabase. A regular student account cannot access this dashboard.</span>
        </div>
      </section>
    </main>
  );
}
