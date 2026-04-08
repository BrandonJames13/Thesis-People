import Modal from "./Modal";

/**
 * Reusable confirmation modal.
 * Usage:
 *   <ConfirmModal
 *     isOpen={!!deleteTarget}
 *     title="Delete Room"
 *     message="Are you sure you want to delete Room 101? This cannot be undone."
 *     confirmLabel="🗑 Yes, Delete"
 *     danger
 *     onConfirm={handleConfirm}
 *     onClose={() => setDeleteTarget(null)}
 *   />
 */
export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Are you sure?",
  message = "This action cannot be undone.",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
          {title}
        </div>
        <div style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.6 }}>
          {message}
        </div>
        <div
          style={{
            display: "flex",
            gap: 10,
            justifyContent: "flex-end",
            paddingTop: 4,
            borderTop: "1px solid var(--border)",
          }}
        >
          <button className="btn btn-secondary" onClick={onClose}>
            {cancelLabel}
          </button>
          <button
            className={danger ? "btn btn-danger" : "btn btn-primary"}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
