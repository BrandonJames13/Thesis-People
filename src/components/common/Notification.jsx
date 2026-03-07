import { useEffect, useState } from "react";
import styles from "./Notification.module.css";
import { useNotification } from "../../context/NotificationContext";

export default function Notification() {
  const { notification } = useNotification();
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (notification) {
      setVisible(true);
      setFading(false);
      const fadeTimer = setTimeout(() => setFading(true), 3000);
      const hideTimer = setTimeout(() => setVisible(false), 3300);
      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(hideTimer);
      };
    }
  }, [notification]);

  if (!visible || !notification) return null;

  return (
    <div className={`${styles.toast} ${fading ? styles.fading : ""}`}>
      ✓ {notification}
    </div>
  );
}
