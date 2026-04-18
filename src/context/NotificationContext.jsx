import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
} from "react";

const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const [notification, setNotification] = useState(null);
  const [progress, setProgress] = useState(null);
  const timerRef = useRef(null);

  const showNotification = useCallback(
    (message, { noConfetti = false } = {}) => {
      const isError =
        message.startsWith("⚠") ||
        message.toLowerCase().includes("failed") ||
        message.toLowerCase().includes("required");
      const isDelete =
        message.toLowerCase().includes("deleted") ||
        message.toLowerCase().includes("removed") ||
        message.toLowerCase().includes("reset");
      const type = isError ? "error" : isDelete ? "delete" : "success";

      // Clear any existing timer before setting new notification
      if (timerRef.current) clearTimeout(timerRef.current);

      setNotification({ text: message, type, noConfetti, id: Date.now() });

      timerRef.current = setTimeout(() => setNotification(null), 3800);
    },
    [],
  );

  const showProgress = useCallback((step, pct) => {
    setProgress({ step, pct });
  }, []);

  const clearProgress = useCallback(() => {
    setProgress(null);
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notification,
        showNotification,
        progress,
        showProgress,
        clearProgress,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const ctx = useContext(NotificationContext);
  if (!ctx)
    throw new Error("useNotification must be used within NotificationProvider");
  return ctx;
}
