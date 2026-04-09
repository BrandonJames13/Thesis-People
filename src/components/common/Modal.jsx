import styles from "./Modal.module.css";
import { useEffect } from "react";

export default function Modal({ isOpen, onClose, children, size = "md" }) {
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className={styles.overlay}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={`${styles.card} ${styles[size]}`}>{children}</div>
    </div>
  );
}
