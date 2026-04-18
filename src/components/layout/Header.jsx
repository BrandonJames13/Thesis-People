import { useState, useCallback, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { useNotification } from "../../context/NotificationContext";
import { useClickOutside } from "../../hooks/useClickOutside";
import Modal from "../common/Modal";
import styles from "./Header.module.css";

// ─── Drag-to-slide theme toggle ───────────────────────────────────────────────
function ThemeToggle({ theme, toggleTheme }) {
  const isDark = theme === "dark";

  const TRACK_W = 64;
  const THUMB_W = 24;
  const MAX_DRAG = TRACK_W - THUMB_W - 4; // 4px = 2px padding each side

  const [dragX, setDragX] = useState(null);
  const [hasSwitched, setHasSwitched] = useState(false);
  const startRef = useRef(null);

  const baseOffset = isDark ? 0 : MAX_DRAG;
  const thumbOffset =
    dragX !== null ? Math.max(0, Math.min(MAX_DRAG, dragX)) : baseOffset;
  const isDragging = dragX !== null;

  const handlePointerDown = (e) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    startRef.current = { clientX: e.clientX, baseOffset };
    setDragX(baseOffset);
    setHasSwitched(false);
  };

  const handlePointerMove = (e) => {
    if (startRef.current === null) return;
    const delta = e.clientX - startRef.current.clientX;
    const next = Math.max(
      0,
      Math.min(MAX_DRAG, startRef.current.baseOffset + delta),
    );
    setDragX(next);

    const midpoint = MAX_DRAG / 2;
    const crossedToLight = next > midpoint && isDark && !hasSwitched;
    const crossedToDark = next <= midpoint && !isDark && !hasSwitched;
    if (crossedToLight || crossedToDark) {
      setHasSwitched(true);
      toggleTheme();
    }
  };

  const handlePointerUp = (e) => {
    if (startRef.current === null) return;
    const totalDelta = Math.abs(e.clientX - startRef.current.clientX);
    if (totalDelta < 4 && !hasSwitched) toggleTheme();
    startRef.current = null;
    setDragX(null);
    setHasSwitched(false);
  };

  return (
    <div className={styles.toggleTrack} data-dark={isDark}>
      <span className={styles.toggleIconLeft}>🌙</span>
      <span className={styles.toggleIconRight}>☀️</span>
      <div
        className={styles.toggleThumb}
        style={{
          transform: `translateX(${thumbOffset}px)`,
          transition: isDragging
            ? "none"
            : "transform 0.28s cubic-bezier(0.4,0,0.2,1)",
          cursor: isDragging ? "grabbing" : "grab",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────
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

  const isAdmin = currentUser?.role === "admin";

  return (
    <header className={styles.header}>
      <div className={styles.logo}>
        <div className={styles.logoIcon}>📅</div>
        TSU&nbsp;·&nbsp;CCS&nbsp;&nbsp;
        <span className={styles.logoSub}>/ Room Scheduling System</span>
      </div>

      <div className={styles.headerRight}>
        <span className={styles.badge}>v1.0 · BETA</span>

        <ThemeToggle theme={theme} toggleTheme={toggleTheme} />

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
                <span className={styles.menuItemIcon}>🔑</span>
                Change Password
              </button>
              <button
                className={`${styles.menuItem} ${styles.menuLogout}`}
                onClick={logout}
              >
                <span className={styles.menuItemIcon}>↩</span>
                Logout
              </button>
            </div>
          )}
        </div>
      </div>

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
