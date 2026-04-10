import { useState } from "react";
import Modal from "../common/Modal";
import { getWingFromRoomInput } from "../../utils/roomUtils";
import {
  getDefaultRoomCapacity,
  getRoomCapacityLimit,
  isRoomCapacityValid,
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

  const selectedRoomType = normalizeRoomType(type, "");
  const capacityLimit = selectedRoomType
    ? getRoomCapacityLimit(selectedRoomType)
    : null;

  const handleSubmit = () => {
    const trimmedNumber = number.trim();
    const normalizedType = normalizeRoomType(type, "");
    const trimmedCapacity = String(capacity ?? "").trim();

    if (!trimmedNumber || !normalizedType) {
      setError("Please fill in all fields correctly.");
      return;
    }

    const cap = trimmedCapacity
      ? parseInt(trimmedCapacity, 10)
      : getDefaultRoomCapacity(normalizedType);

    if (trimmedCapacity && (isNaN(cap) || cap <= 0)) {
      setError("Capacity must be a positive number.");
      return;
    }

    const { max } = getRoomCapacityLimit(normalizedType);
    if (!isRoomCapacityValid(normalizedType, cap)) {
      setError(`${normalizedType} capacity must be between 1 and ${max}.`);
      return;
    }

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

    setError("");
    onSubmit({
      number: trimmedNumber,
      type: normalizedType,
      capacity: cap,
      status,
      wing: resolvedWing,
    });
  };

  const modalTitle = mode === "edit" ? "✎ Edit Room" : "+ Add New Room";
  const submitLabel = mode === "edit" ? "Save Changes" : "+ Add Room";

  return (
    <Modal isOpen={true} onClose={onClose} size="sm">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
          {modalTitle}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            className="search-input"
            type="text"
            placeholder="e.g. L101, C111, R112"
            style={{ width: "100%" }}
            value={number}
            onChange={(e) => setNumber(e.target.value.toUpperCase().trimStart())}
          />
          <div style={{ fontSize: 11, color: "var(--text3)" }}>
            Format: <strong>L</strong> = Left Wing &nbsp;·&nbsp; <strong>C</strong> = Center Wing &nbsp;·&nbsp; <strong>R</strong> = Right Wing &nbsp;+&nbsp; 3 digits (e.g. L101, C202, R315)
          </div>
          <select
            className="search-input"
            style={{ width: "100%" }}
            value={type}
            onChange={(e) => {
              const nextType = normalizeRoomType(e.target.value, "");
              setType(nextType);
              if (!nextType) return;
              setCapacity((current) => {
                const parsed = Number(current);
                if (Number.isFinite(parsed) && parsed > 0) return current;
                return String(getDefaultRoomCapacity(nextType));
              });
            }}
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
            Wing is optional. Leave as Auto to infer from formatted numbers like
            L120, C211, or R222.
          </div>
          {error && (
            <div style={{ color: "var(--red)", fontSize: 12 }}>⚠ {error}</div>
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
  );
}