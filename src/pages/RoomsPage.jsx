import { useState } from "react";
import { useData } from "../context/DataContext";
import { useNotification } from "../context/NotificationContext";
import Modal from "../components/common/Modal";
import ConfirmModal from "../components/common/ConfirmModal";

export default function RoomsPage() {
  const { rooms, addRoom, deleteRoom } = useData();
  const { showNotification } = useNotification();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const filtered = rooms.filter((room) => {
    const matchSearch = room.number
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchType = !typeFilter || room.type === typeFilter;
    const matchStatus = !statusFilter || room.status === statusFilter;
    return matchSearch && matchType && matchStatus;
  });

  const handleDeleteConfirm = () => {
    const realIndex = rooms.indexOf(deleteTarget);
    deleteRoom(realIndex);
    showNotification(`${deleteTarget.number} deleted.`);
    setDeleteTarget(null);
  };

  return (
    <div className="page-container">
      <div className="section-header">
        <div>
          <div className="section-title">Room Inventory</div>
          <div className="section-subtitle">
            Manage lecture rooms and computer labs
          </div>
        </div>
        <div className="filter-row">
          <input
            className="search-input"
            type="text"
            placeholder="Search rooms…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="search-input"
            style={{ width: 140 }}
            value={typeFilter || "All Types"}
            onChange={(e) =>
              setTypeFilter(
                e.target.value === "All Types" ? "" : e.target.value,
              )
            }
          >
            <option>All Types</option>
            <option>Lecture</option>
            <option>Computer Lab</option>
          </select>
          <select
            className="search-input"
            style={{ width: 140 }}
            value={statusFilter || "All Status"}
            onChange={(e) =>
              setStatusFilter(
                e.target.value === "All Status" ? "" : e.target.value,
              )
            }
          >
            <option>All Status</option>
            <option>Available</option>
            <option>Occupied</option>
            <option>Maintenance</option>
          </select>
          <button
            className="btn btn-primary"
            onClick={() => setShowModal(true)}
          >
            + Add Room
          </button>
        </div>
      </div>

      <div className="card">
        <div className="rooms-grid">
          {filtered.length === 0 ? (
            <div
              style={{
                gridColumn: "1 / -1",
                textAlign: "center",
                padding: 40,
                color: "var(--text3)",
                fontSize: 13,
              }}
            >
              No rooms match your search.
            </div>
          ) : (
            filtered.map((room) => {
              const statusColor =
                room.status === "Available"
                  ? "green"
                  : room.status === "Maintenance"
                    ? "orange"
                    : "blue";
              return (
                <div className="room-card" key={room.number}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                    }}
                  >
                    <div className="room-number">{room.number}</div>
                    <button
                      onClick={() => setDeleteTarget(room)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--text3)",
                        cursor: "pointer",
                        fontSize: 16,
                        lineHeight: 1,
                        padding: 0,
                      }}
                      title="Delete"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="room-type">{room.type}</div>
                  <div style={{ marginBottom: 10 }}>
                    <span className={`pill pill-${statusColor}`}>
                      {room.status}
                    </span>
                  </div>
                  <div className="room-capacity">
                    <span style={{ fontSize: 11, color: "var(--text3)" }}>
                      Cap:
                    </span>
                    <div className="cap-bar">
                      <div
                        className="cap-fill"
                        style={{
                          width: `${Math.round((room.capacity / 50) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="monospace">{room.capacity}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {showModal && (
        <AddRoomModal
          onClose={() => setShowModal(false)}
          onAdd={(room) => {
            addRoom(room);
            setShowModal(false);
            showNotification("Room added successfully!");
          }}
          showNotification={showNotification}
        />
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        title="🗑 Delete Room"
        message={`Are you sure you want to delete ${deleteTarget?.number}? This cannot be undone.`}
        confirmLabel="🗑 Yes, Delete"
        danger
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function AddRoomModal({ onClose, onAdd, showNotification }) {
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
          {error && (
            <div style={{ color: "var(--red)", fontSize: 12 }}>⚠ {error}</div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
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
