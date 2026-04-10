import { useState } from "react";
import Modal from "../common/Modal";

export function AddRoomModal({ onClose, onAdd, existingRooms = [] }) {
  const [number, setNumber] = useState("");
  const [type, setType] = useState("");
  const [capacity, setCapacity] = useState("");
  const [status, setStatus] = useState("Available");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    const trimmed = number.trim();
    const cap = parseInt(capacity);

    if (!trimmed || !type || isNaN(cap) || cap <= 0) {
      setError("Please fill in all fields correctly.");
      return;
    }

    // Validate room name format: L/C/R followed by exactly 3 digits
    const roomPattern = /^[LCR]\d{3}$/;
    if (!roomPattern.test(trimmed)) {
      setError("Room number must follow the format: L101, C111, or R112 (wing letter + 3 digits).");
      return;
    }

    // Duplicate check
    const isDuplicate = existingRooms.some(
      (r) => r.number.toUpperCase() === trimmed.toUpperCase()
    );
    if (isDuplicate) {
      setError(`Room "${trimmed}" already exists.`);
      return;
    }

    if (type === "Computer Lab" && (cap < 40 || cap > 45)) {
      setError("Computer Lab capacity must be between 40 and 45.");
      return;
    }

    if (type === "Lecture" && (cap < 50 || cap > 55)) {
      setError("Lecture room capacity must be between 50 and 55.");
      return;
    }

    setError("");
    const wing = trimmed[0].toUpperCase();
    onAdd({ number: trimmed, type, capacity: cap, status, wing });
  };

  return (
    <Modal isOpen={true} onClose={onClose} size="sm">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
          + Add New Room
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
            onChange={(e) => { setType(e.target.value); setCapacity(""); }}
          >
            <option value="">-- Select Type --</option>
            <option value="Lecture">Lecture</option>
            <option value="Computer Lab">Computer Lab</option>
          </select>
          <input
            className="search-input"
            type="number"
            placeholder={
              type === "Computer Lab"
                ? "Capacity (40-45)"
                : type === "Lecture"
                  ? "Capacity (50-55)"
                  : "Capacity"
            }
            min={type === "Computer Lab" ? 40 : type === "Lecture" ? 50 : 1}
            max={type === "Computer Lab" ? 45 : type === "Lecture" ? 55 : 999}
            style={{ width: "100%" }}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
          />
          {type && (
            <div style={{ fontSize: 11, color: "var(--text3)" }}>
              {type === "Computer Lab"
                ? "Lab capacity: min 40, max 45"
                : "Lecture capacity: min 50, max 55"}
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
            + Add Room
          </button>
        </div>
      </div>
    </Modal>
  );
}