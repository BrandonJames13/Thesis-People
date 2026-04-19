import { useState } from "react";
import Modal from "../common/Modal";
import ConfirmModal from "../common/ConfirmModal";
import {
  getWingFromRoomInput,
  validateRoomPayload,
  extractRoomTypeFromName,
  shouldWarnRoomTypeConflict,
} from "../../utils/roomUtils";
import {
  getDefaultRoomCapacity,
  getRoomCapacityLimit,
  normalizeRoomType,
  ROOM_TYPE_LABELS,
} from "../../data/constants";

const WING_OPTIONS = [
  { value: "", label: "Auto (infer from room number)" },
  { value: "L", label: "Left Wing (L)" },
  { value: "C", label: "Center Wing (C)" },
  { value: "R", label: "Right Wing (R)" },
];

export function AddRoomModal({
  onClose,
  onSubmit,
  initialRoom = null,
  mode = "add",
}) {
  const initialType = normalizeRoomType(initialRoom?.type ?? "", "");
  const [number, setNumber] = useState(initialRoom?.number ?? "");
  const [type, setType] = useState(initialType);
  const [capacity, setCapacity] = useState(
    initialRoom?.capacity != null
      ? String(initialRoom.capacity)
      : initialType
        ? String(getDefaultRoomCapacity(initialType))
        : "",
  );
  const [status, setStatus] = useState(initialRoom?.status ?? "Available");
  const [wing, setWing] = useState(initialRoom?.wing ?? "");
  const [error, setError] = useState("");
  const [detectedType, setDetectedType] = useState(null);
  const [showTypeConflictWarning, setShowTypeConflictWarning] = useState(false);
  const [pendingTypeSelection, setPendingTypeSelection] = useState(null);

  // Handler: When user finishes typing room number, detect special room type
  const handleRoomNumberBlur = () => {
    if (!number.trim()) {
      setDetectedType(null);
      return;
    }

    const detected = extractRoomTypeFromName(number.trim());
    setDetectedType(detected);

    // Auto-populate room type if detected and field is empty
    if (detected && !type) {
      setType(detected);
    }
  };

  // Handler: When user changes room type, check for conflicts
  const handleTypeChange = (newTypeValue) => {
    const normalizedNewType = normalizeRoomType(newTypeValue, "");

    // Check if there's a conflict with detected type
    const { conflictFound } = shouldWarnRoomTypeConflict(
      number.trim(),
      normalizedNewType,
    );

    if (conflictFound) {
      // Show warning modal, don't immediately update type
      setPendingTypeSelection(normalizedNewType);
      setShowTypeConflictWarning(true);
      return;
    }

    // No conflict, update type normally
    setType(normalizedNewType);
    if (!normalizedNewType) return;

    // Auto-adjust capacity if needed
    setCapacity((current) => {
      const parsed = Number(current);
      if (Number.isFinite(parsed) && parsed > 0) return current;
      return String(getDefaultRoomCapacity(normalizedNewType));
    });
  };

  // Handler: When user confirms override of conflicting type
  const handleConfirmTypeOverride = () => {
    setType(pendingTypeSelection);
    if (pendingTypeSelection) {
      setCapacity((current) => {
        const parsed = Number(current);
        if (Number.isFinite(parsed) && parsed > 0) return current;
        return String(getDefaultRoomCapacity(pendingTypeSelection));
      });
    }
    setShowTypeConflictWarning(false);
    setPendingTypeSelection(null);
  };

  // Handler: When user cancels override, revert to detected type
  const handleCancelTypeOverride = () => {
    setType(detectedType || "");
    if (detectedType) {
      setCapacity((current) => {
        const parsed = Number(current);
        if (Number.isFinite(parsed) && parsed > 0) return current;
        return String(getDefaultRoomCapacity(detectedType));
      });
    }
    setShowTypeConflictWarning(false);
    setPendingTypeSelection(null);
  };

  const selectedRoomType = normalizeRoomType(type, "");
  const capacityLimit = selectedRoomType
    ? getRoomCapacityLimit(selectedRoomType)
    : null;

  const handleSubmit = () => {
    const trimmedNumber = number.trim().toUpperCase();
    const normalizedType = normalizeRoomType(type, "");
    const trimmedCapacity = String(capacity ?? "").trim();

    // Validate basic required fields
    if (!trimmedNumber) {
      setError("Room name/number is required.");
      return;
    }
    if (!normalizedType) {
      setError("Room type must be selected.");
      return;
    }

    // Parse capacity: use provided value or default to type max
    const cap = trimmedCapacity
      ? parseInt(trimmedCapacity, 10)
      : getDefaultRoomCapacity(normalizedType);

    // Check for NaN or invalid capacity
    if (trimmedCapacity && (isNaN(cap) || cap <= 0)) {
      setError("Capacity must be a positive number.");
      return;
    }

    // Validate capacity against type-specific limit
    const { max: capacityMax } = getRoomCapacityLimit(normalizedType);
    if (cap > capacityMax) {
      setError(
        `Capacity cannot exceed ${capacityMax} for ${normalizedType}. Got: ${cap}`,
      );
      return;
    }

    // Get wing data and check for conflicts
    const { providedWing, inferredWing, resolvedWing } = getWingFromRoomInput(
      trimmedNumber,
      wing,
    );

    if (providedWing && inferredWing && providedWing !== inferredWing) {
      setError(
        `Wing mismatch: room number suggests ${inferredWing}, but selected wing is ${providedWing}.`,
      );
      return;
    }

    // Build final payload
    const payload = {
      number: trimmedNumber,
      type: normalizedType,
      capacity: cap,
      status,
      wing: resolvedWing,
    };

    // Validate payload using centralized validation
    const validationError = validateRoomPayload(payload);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    onSubmit(payload);
  };

  const modalTitle = mode === "edit" ? "✎ Edit Room" : "+ Add New Room";
  const submitLabel = mode === "edit" ? "Save Changes" : "+ Add Room";

  return (
    <>
      <Modal isOpen={true} onClose={onClose} size="sm">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
            {modalTitle}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input
              className="search-input"
              type="text"
              placeholder="e.g. L101, Accreditation, AVR"
              style={{ width: "100%" }}
              value={number}
              onChange={(e) => setNumber(e.target.value.trimStart())}
              onBlur={handleRoomNumberBlur}
            />
            <div style={{ fontSize: 11, color: "var(--text3)" }}>
              <strong>Standard:</strong> <strong>L</strong> = Left,{" "}
              <strong>C</strong> = Center, <strong>R</strong> = Right + 3 digits
              (e.g. L101) &nbsp;·&nbsp; <strong>Non-standard:</strong>{" "}
              Descriptive names (e.g. Accreditation, AVR)
            </div>
            {detectedType && (
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text3)",
                  padding: "6px 10px",
                  backgroundColor: "rgba(76, 175, 80, 0.1)",
                  border: "1px solid rgba(76, 175, 80, 0.3)",
                  borderRadius: 4,
                }}
              >
                📍 <strong>Detected:</strong> {detectedType}
                {type && type !== detectedType && (
                  <span style={{ marginLeft: 6, color: "var(--orange)" }}>
                    (⚠ overriding with "{type}")
                  </span>
                )}
              </div>
            )}
            <select
              className="search-input"
              style={{ width: "100%" }}
              value={type}
              onChange={(e) => handleTypeChange(e.target.value)}
            >
              <option value="">-- Select Type --</option>
              {ROOM_TYPE_LABELS.map((roomType) => (
                <option key={roomType} value={roomType}>
                  {roomType}
                </option>
              ))}
            </select>
            <input
              className="search-input"
              type="number"
              placeholder={
                capacityLimit ? `Capacity (1-${capacityLimit.max})` : "Capacity"
              }
              min={1}
              max={capacityLimit?.max ?? 999}
              style={{ width: "100%" }}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            />
            {selectedRoomType && capacityLimit && (
              <div style={{ fontSize: 11, color: "var(--text3)" }}>
                {`${selectedRoomType} capacity: max ${capacityLimit.max}`}
              </div>
            )}
            <select
              className="search-input"
              style={{ width: "100%" }}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="Available">Available</option>
              <option value="Occupied">Occupied</option>
              <option value="Maintenance">Maintenance</option>
            </select>
            <select
              className="search-input"
              style={{ width: "100%" }}
              value={wing}
              onChange={(e) => setWing(e.target.value)}
            >
              {WING_OPTIONS.map((option) => (
                <option key={option.value || "auto"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <div style={{ fontSize: 11, color: "var(--text3)" }}>
              Wing is optional. Leave as Auto to infer from formatted numbers
              like L120, C211, or R222.
            </div>
            {error && (
              <div style={{ color: "var(--red)", fontSize: 12 }}>⚠ {error}</div>
            )}
            {detectedType && type && type !== detectedType && (
              <div
                style={{
                  color: "var(--orange)",
                  fontSize: 12,
                  padding: "8px 10px",
                  backgroundColor: "rgba(255, 152, 0, 0.1)",
                  border: "1px solid rgba(255, 152, 0, 0.3)",
                  borderRadius: 4,
                }}
              >
                ℹ️ <strong>Override Confirmed:</strong> This room will be saved
                as <strong>"{type}"</strong> (detected: "{detectedType}")
              </div>
            )}
          </div>
          <div
            style={{
              display: "flex",
              gap: 8,
              justifyContent: "flex-end",
              borderTop: "1px solid var(--border)",
              paddingTop: 16,
            }}
          >
            <button className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSubmit}>
              {submitLabel}
            </button>
          </div>
        </div>
      </Modal>
      {/* Type conflict warning modal */}
      <ConfirmModal
        isOpen={showTypeConflictWarning}
        onClose={handleCancelTypeOverride}
        onConfirm={handleConfirmTypeOverride}
        title="Room Type Mismatch"
        message={
          detectedType && pendingTypeSelection
            ? `The room name "${number.trim()}" suggests type "${detectedType}", but you selected "${pendingTypeSelection}". The system will save this room as type "${pendingTypeSelection}" instead. Are you sure you want to override?`
            : "Type conflict detected. Continue?"
        }
        confirmLabel="✓ Continue Override"
        cancelLabel="↶ Use Detected Type"
      />
    </>
  );
}
