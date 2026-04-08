import styles from "./Notification.module.css";
import { useNotification } from "../../context/NotificationContext";

export default function Notification() {
  const { notification } = useNotification();

  if (!notification) return null;

  return <div className={styles.toast}>✓ {notification}</div>;
}
