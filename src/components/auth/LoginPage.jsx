import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import styles from "./LoginPage.module.css";

const demoAccounts = [
  { username: "admin", password: "admin123", role: "admin" },
  { username: "reyes", password: "reyes2025", role: "faculty" },
  { username: "garcia", password: "garcia2025", role: "faculty" },
  { username: "santos", password: "santos2025", role: "faculty" },
];

export default function LoginPage() {
  const { currentUser, login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  if (currentUser) return <Navigate to="/" replace />;

  const handleSubmit = (e) => {
    e?.preventDefault();
    const result = login(username, password);
    if (!result.success) {
      setError(true);
      setPassword("");
    }
  };

  const fillDemo = (u, p) => {
    setUsername(u);
    setPassword(p);
    setError(false);
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
            <label htmlFor="login-username">Username</label>
            <input
              id="login-username"
              type="text"
              placeholder="Enter your username"
              autoComplete="username"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
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
              onChange={(e) => {
                setPassword(e.target.value);
                setError(false);
              }}
            />
          </div>

          {error && (
            <div className={styles.errorMsg}>
              ⚠ Incorrect username or password.
            </div>
          )}

          <button type="submit" className={styles.btnLogin}>
            Sign In →
          </button>
        </form>

        <div className={styles.demoHint}>
          <div className={styles.demoTitle}>Demo Accounts — click to fill</div>
          <div className={styles.demoAccounts}>
            {demoAccounts.map((acc) => (
              <div
                key={acc.username}
                className={styles.demoRow}
                onClick={() => fillDemo(acc.username, acc.password)}
              >
                <div className={styles.demoInfo}>
                  <div className={styles.demoUser}>{acc.username}</div>
                  <div className={styles.demoPass}>{acc.password}</div>
                </div>
                <span className={`${styles.demoRole} ${styles[acc.role]}`}>
                  {acc.role.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>

        <p className={styles.footerNote}>
          AY 2025–2026 · 1st Semester · v1.0 BETA
        </p>
      </div>
    </div>
  );
}
