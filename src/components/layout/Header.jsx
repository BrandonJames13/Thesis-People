import { useState, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { useNotification } from "../../context/NotificationContext";
import { useClickOutside } from "../../hooks/useClickOutside";
import Modal from "../common/Modal";
import styles from "./Header.module.css";

export default function Header() {
  const { currentUser, logout, changePassword } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { showNotification } = useNotification();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pwModalOpen, setPwModalOpen] = useState(false);
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

  return (
    <header className={styles.header}>
      <div className={styles.logo}>
        <div className={styles.logoIcon}>📅</div>
        TSU&nbsp;·&nbsp;CCS&nbsp;&nbsp;
        <span className={styles.logoSub}>/ Room Scheduling System</span>
      </div>
      <div className={styles.headerRight}>
        <span className={styles.badge}>v1.0 · BETA</span>
        <button
          className={`btn btn-secondary ${styles.themeBtn}`}
          onClick={toggleTheme}
          title={
            theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
          }
        >
          {theme === "dark" ? "🌙" : "🌞"}
        </button>

        {/* //! User Menu */}
        <div className={styles.userWrap} ref={menuRef}>
          <div
            className={styles.userTrigger}
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
          >
            <div className="avatar">{currentUser?.initials || "—"}</div>
            <div className={styles.userName}>{currentUser?.name || "—"}</div>
            <span
              className={styles.caret}
              style={{
                transform: menuOpen ? "rotate(180deg)" : "rotate(0deg)",
              }}
            >
              ▾
            </span>
          </div>
          {/* //* User Menu Dropdown */}
          {menuOpen && (
            <div className={styles.dropdown}>
              <div className={styles.menuName}>{currentUser?.name || "—"}</div>
              <div className={styles.menuName}>{currentUser?.email || "—"}</div>
              <div className={styles.menuRole}>
                {currentUser?.role === "admin" ? "Administrator" : "Faculty"}
              </div>
              <button className={styles.menuItem} onClick={openPwModal}>
                🔑 Change Password
              </button>
              <button
                className={`${styles.menuItem} ${styles.menuLogout}`}
                onClick={logout}
              >
                ↩ Logout
              </button>
            </div>
          )}
        </div>


      </div>
{/* //! change password modal */}
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
    </header>
  );
}
