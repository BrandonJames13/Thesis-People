import { createContext, useContext, useState, useCallback } from "react";
import { USERS, hashPassword } from "../data/users";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const stored = sessionStorage.getItem("rss_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const login = useCallback((username, password) => {
    const user = USERS[username.trim().toLowerCase()];
    if (!user || user.passwordHash !== hashPassword(password)) {
      return { success: false };
    }
    const { passwordHash: _, ...safeUser } = user;
    sessionStorage.setItem("rss_user", JSON.stringify(safeUser));
    setCurrentUser(safeUser);
    return { success: true };
  }, []);

  const logout = useCallback(() => {
    try {
      sessionStorage.removeItem("rss_user");
    } catch {}
    setCurrentUser(null);
  }, []);

  const changePassword = useCallback(
    (currentPw, newPw, confirmPw) => {
      if (!currentUser) return "Not logged in.";
      const user = USERS[currentUser.username];
      if (!user || user.passwordHash !== hashPassword(currentPw))
        return "⚠ Current password is incorrect.";
      if (newPw.length < 6)
        return "⚠ New password must be at least 6 characters.";
      if (newPw !== confirmPw) return "⚠ Passwords do not match.";
      return null;
    },
    [currentUser],
  );

  return (
    <AuthContext.Provider
      value={{ currentUser, login, logout, changePassword }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
