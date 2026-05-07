import { useState, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { useNotification } from "../../context/NotificationContext";
import { useClickOutside } from "../../hooks/useClickOutside";
import Modal from "../common/Modal";
import ThemeSettingsModal from "../modals/ThemeSettingsModal";
import styles from "./Header.module.css";

export default function Header() {
  const { currentUser, logout, changePassword } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { showNotification } = useNotification();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pwModalOpen, setPwModalOpen] = useState(false);
  const [themeModalOpen, setThemeModalOpen] = useState(false);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwError, setPwError] = useState("");

  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const menuRef = useClickOutside(closeMenu);

  const handlePwSubmit = () => {
    const err = changePassword(pwCurrent, pwNew, pwConfirm);
    if (err) {
      setPwError(err);
      return;
    }
    setPwModalOpen(false);
    showNotification("Password changed successfully!");
  };

  const openPwModal = () => {
    setMenuOpen(false);
    setPwCurrent("");
    setPwNew("");
    setPwConfirm("");
    setPwError("");
    setPwModalOpen(true);
  };

  const isAdmin = currentUser?.role === "admin";
  const isDark = theme === "dark";

  return (
    <header className={styles.header}>
      <div className={styles.logo}>
        <div className={styles.logoIcon}>📅</div>
        TSU&nbsp;·&nbsp;CCS&nbsp;&nbsp;
        <span className={styles.logoSub}>/ Room Scheduling System</span>
      </div>

      <div className={styles.headerRight}>
        <span className={styles.badge}>v1.0 · BETA</span>

        {/* Dark/Light mode toggle — compact pill */}
        <button
          onClick={toggleTheme}
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            background: "var(--surface3)",
            border: "1px solid var(--border)",
            borderRadius: 20,
            color: "var(--text2)",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 600,
            padding: "4px 10px",
            transition: "all 0.15s",
            whiteSpace: "nowrap",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--accent)";
            e.currentTarget.style.color = "var(--accent)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border)";
            e.currentTarget.style.color = "var(--text2)";
          }}
        >
          {isDark ? "🌙" : "☀️"} {isDark ? "Dark" : "Light"}
        </button>

        {/* Appearance settings button */}
        <button
          onClick={() => setThemeModalOpen(true)}
          title="Appearance Settings"
          style={{
            background: "var(--surface3)",
            border: "1px solid var(--border)",
            borderRadius: 7,
            color: "var(--text2)",
            cursor: "pointer",
            fontSize: 14,
            width: 32,
            height: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background 0.15s, color 0.15s, border-color 0.15s",
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--accent)";
            e.currentTarget.style.color = "#fff";
            e.currentTarget.style.borderColor = "var(--accent)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--surface3)";
            e.currentTarget.style.color = "var(--text2)";
            e.currentTarget.style.borderColor = "var(--border)";
          }}
        >
          ⚙️
        </button>

        {/* User menu */}
        <div className={styles.userWrap} ref={menuRef}>
          <button
            className={styles.userTrigger}
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((o) => !o);
            }}
            aria-label="User menu"
          >
            <div
              className={`${styles.avatar} ${isAdmin ? styles.avatarAdmin : styles.avatarFaculty}`}
            >
              {currentUser?.initials || "—"}
            </div>
            <div className={styles.userInfo}>
              <span className={styles.userName}>
                {currentUser?.name || "—"}
              </span>
              <span
                className={`${styles.userRole} ${isAdmin ? styles.userRoleAdmin : styles.userRoleFaculty}`}
              >
                {isAdmin ? "👑 Admin" : "🎓 Faculty"}
              </span>
            </div>
            <span
              className={styles.caret}
              style={{
                transform: menuOpen ? "rotate(180deg)" : "rotate(0deg)",
              }}
            >
              ▾
            </span>
          </button>

          {menuOpen && (
            <div className={styles.dropdown}>
              <div className={styles.dropdownProfile}>
                <div
                  className={`${styles.dropdownAvatar} ${isAdmin ? styles.avatarAdmin : styles.avatarFaculty}`}
                >
                  {currentUser?.initials || "—"}
                </div>
                <div className={styles.dropdownMeta}>
                  <div className={styles.dropdownName}>
                    {currentUser?.name || "—"}
                  </div>
                  <div className={styles.dropdownEmail}>
                    {currentUser?.email || "—"}
                  </div>
                  <span
                    className={`${styles.statusPill} ${isAdmin ? styles.statusAdmin : styles.statusFaculty}`}
                  >
                    {isAdmin ? "👑 Admin" : "🎓 Faculty"}
                  </span>
                </div>
              </div>
              <div className={styles.dropdownDivider} />
              <button className={styles.menuItem} onClick={openPwModal}>
                <span className={styles.menuItemIcon}>🔑</span> Change Password
              </button>
              <button
                className={`${styles.menuItem} ${styles.menuLogout}`}
                onClick={logout}
              >
                <span className={styles.menuItemIcon}>↩</span> Logout
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Change Password Modal */}
      <Modal
        isOpen={pwModalOpen}
        onClose={() => setPwModalOpen(false)}
        title="🔑 Change Password"
        width={380}
      >
        <div className={styles.pwForm}>
          <div>
            <label className={styles.pwLabel}>Current Password</label>
            <input
              className="search-input"
              type="password"
              placeholder="Enter current password"
              value={pwCurrent}
              onChange={(e) => setPwCurrent(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label className={styles.pwLabel}>New Password</label>
            <input
              className="search-input"
              type="password"
              placeholder="At least 6 characters"
              value={pwNew}
              onChange={(e) => setPwNew(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label className={styles.pwLabel}>Confirm New Password</label>
            <input
              className="search-input"
              type="password"
              placeholder="Re-enter new password"
              value={pwConfirm}
              onChange={(e) => setPwConfirm(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box" }}
            />
          </div>
          {pwError && <div className={styles.pwError}>{pwError}</div>}
        </div>
        <div className={styles.pwActions}>
          <button
            className="btn btn-secondary"
            onClick={() => setPwModalOpen(false)}
          >
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handlePwSubmit}>
            Save Password
          </button>
        </div>
      </Modal>

      {/* Theme Settings Modal */}
      {themeModalOpen && (
        <ThemeSettingsModal onClose={() => setThemeModalOpen(false)} />
      )}
    </header>
  );
}
