import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext"; // !! Make sure this path is correct based on your project structure
import styles from "./LoginPage.module.css";

export default function LoginPage() {
  const { currentUser, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  if (currentUser) return <Navigate to="/" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(false);

    const result = await login(email, password);

    if (!result.success) {
      setError(true);
      setPassword("");
    }

    setLoading(false);
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <div className={styles.brandIcon}>📅</div>
          <div>
            <div className={styles.brandText}>TSU · CCS</div>
            <div className={styles.brandSub}>Room Scheduling System</div>
          </div>
        </div>

        <h1 className={styles.heading}>Welcome back</h1>
        <p className={styles.subtitle}>
          Sign in to access the scheduling dashboard
        </p>

        <form onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              placeholder="Enter your email"
              autoComplete="email"
              value={email}
              required
              onChange={(e) => {
                setEmail(e.target.value);
                setError(false);
              }}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              placeholder="Enter your password"
              autoComplete="current-password"
              value={password}
              required
              onChange={(e) => {
                setPassword(e.target.value);
                setError(false);
              }}
            />
          </div>

          {error && (
            <div className={styles.errorMsg}>
              ⚠ Incorrect email or password.
            </div>
          )}

          <button type="submit" className={styles.btnLogin} disabled={loading}>
            {loading ? "Signing in…" : "Sign In →"}
          </button>
{/*
           <p style={{ textAlign: 'center' }}>
            Don't have an account? <a href="/signup">Sign up</a>
          </p> */}
        </form>

        <p className={styles.footerNote}>
          AY 2025–2026 · 1st Semester · v1.0 BETA
        </p>
      </div>
    </div>
  );
}