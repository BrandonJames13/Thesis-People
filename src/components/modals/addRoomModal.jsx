import { useState } from "react";
import Modal from "../common/Modal";

export function AddRoomModal({ onClose, onAdd }) {
  const [number, setNumber] = useState("");
  const [type, setType] = useState("");
  const [capacity, setCapacity] = useState("");
  const [status, setStatus] = useState("Available");

  const handleSubmit = () => {
    const cap = parseInt(capacity);
    if (!number.trim() || !type || isNaN(cap) || cap <= 0) {
      alert("Please fill in all fields correctly.");
      return;
    }
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
            placeholder="Capacity"
            min={1}
            style={{ width: "100%" }}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
          />
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
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", borderTop: "1px solid var(--border)", paddingTop: 10 }}>
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