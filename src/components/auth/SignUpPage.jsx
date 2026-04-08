import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import styles from "./LoginPage.module.css";

export default function SignUpPage() {
  const { currentUser, signUp } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (currentUser) return <Navigate to="/" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);
    setError(false);

    const result = await signUp(email, password, name);

    if (!result.success) {
      setError(true);
    } else {
      setSuccess(true);
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

        <h1 className={styles.heading}>Create Account</h1>
        <p className={styles.subtitle}>
          Sign up to access the scheduling dashboard
        </p>

        <form onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label>Name</label>
            <input
              type="text"
              placeholder="Enter your name"
              value={name}
              required
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label>Email</label>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              required
              onChange={(e) => {
                setEmail(e.target.value);
                setError(false);
              }}
            />
          </div>

          <div className={styles.field}>
            <label>Password</label>
            <input
              type="password"
              placeholder="Create a password"
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
              ⚠ Failed to create account.
            </div>
          )}

          {success && (
            <div className={styles.successMsg}>
              ✓ Account created. You may now log in.
            </div>
          )}

          <button type="submit" className={styles.btnLogin} disabled={loading}>
            {loading ? "Creating account…" : "Sign Up →"}
          </button>

            <p style={{ textAlign: 'center' }}>
                Already have an account? <a href="/login">Log in</a>
            </p>
        </form>

        <p className={styles.footerNote}>
          AY 2025–2026 · 1st Semester · v1.0 BETA
        </p>
      </div>
    </div>
  );
}