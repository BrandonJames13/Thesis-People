import { useState } from "react";
import Modal from "../common/Modal";

export function AddRoomModal({ onClose, onAdd }) {
  const [number, setNumber] = useState("");
  const [type, setType] = useState("");
  const [capacity, setCapacity] = useState("");
  const [status, setStatus] = useState("Available");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    const cap = parseInt(capacity);
    if (!number.trim() || !type || isNaN(cap) || cap <= 0) {
      setError("Please fill in all fields correctly.");
      return;
    }

    if (type === "Computer Lab" && (cap < 30 || cap > 35)) {
      setError("Computer Lab capacity must be between 30 and 35.");
      return;
    }

    if (type === "Lecture" && (cap < 40 || cap > 45)) {
      setError("Lecture room capacity must be between 40 and 45.");
      return;
    }

    setError("");
    onAdd({ number: number.trim(), type, capacity: cap, status });
  };

  return (
    <Modal isOpen={true} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
          + Add New Room
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            className="search-input"
            type="text"
            placeholder="Room Number (e.g. Room 104)"
            style={{ width: "100%" }}
            value={number}
            onChange={(e) => setNumber(e.target.value)}
          />
          <select
            className="search-input"
            style={{ width: "100%" }}
            value={type}
            onChange={(e) => setType(e.target.value)}
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
                ? "Capacity (30-35)"
                : type === "Lecture"
                  ? "Capacity (40-45)"
                  : "Capacity"
            }
            min={type === "Computer Lab" ? 30 : type === "Lecture" ? 40 : 1}
            max={type === "Computer Lab" ? 35 : type === "Lecture" ? 45 : 999}
            style={{ width: "100%" }}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
          />
          {type && (
            <div style={{ fontSize: 11, color: "var(--text3)" }}>
              {type === "Computer Lab"
                ? "Lab capacity: min 30, max 35"
                : "Lecture capacity: min 40, max 45"}
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
            paddingTop: 10,
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
