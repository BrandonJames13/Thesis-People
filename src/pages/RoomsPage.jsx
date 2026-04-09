import { useState } from "react";
import { useData } from "../context/DataContext";
import { useNotification } from "../context/NotificationContext";
import Modal from "../components/common/Modal";
import ConfirmModal from "../components/common/ConfirmModal";

const WINGS = [
  { code: "L", label: "Left Wing (L)" },
  { code: "R", label: "Right Wing (R)" },
  { code: "C", label: "Center Wing (C)" },
];

export default function RoomsPage() {
  const { rooms, addRoom, deleteRoom } = useData();
  const { showNotification } = useNotification();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [wingFilter, setWingFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const filtered = rooms.filter((room) => {
    const matchSearch = room.number
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchType = !typeFilter || room.type === typeFilter;
    const matchStatus = !statusFilter || room.status === statusFilter;
    const matchWing = !wingFilter || room.wing === wingFilter;
    return matchSearch && matchType && matchStatus && matchWing;
  });

  const handleDeleteConfirm = () => {
    const realIndex = rooms.indexOf(deleteTarget);
    deleteRoom(realIndex);
    showNotification(`${deleteTarget.number} deleted.`);
    setDeleteTarget(null);
  };

  const getWingLabel = (code) =>
    WINGS.find((w) => w.code === code)?.label || code || "—";

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
            value={wingFilter || "All Wings"}
            onChange={(e) =>
              setWingFilter(
                e.target.value === "All Wings" ? "" : e.target.value,
              )
            }
          >
            <option>All Wings</option>
            {WINGS.map((w) => (
              <option key={w.code} value={w.code}>
                {w.label}
              </option>
            ))}
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
                  {room.wing && (
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text3)",
                        marginBottom: 4,
                      }}
                    >
                      📍 {getWingLabel(room.wing)}
                    </div>
                  )}
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

function AddRoomModal({ onClose, onAdd }) {
  const [number, setNumber] = useState("");
  const [type, setType] = useState("");
  const [wing, setWing] = useState("");
  const [capacity, setCapacity] = useState("");
  const [status, setStatus] = useState("Available");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    const cap = parseInt(capacity);
    if (!number.trim() || !type || !wing || isNaN(cap) || cap <= 0) {
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
    onAdd({ number: number.trim(), type, wing, capacity: cap, status });
  };

  const labelStyle = {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--text2)",
    marginBottom: 4,
    display: "block",
  };

  return (
    <Modal isOpen={true} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
            + Add New Room
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: 20,
              color: "var(--text3)",
              cursor: "pointer",
              padding: 0,
            }}
          >
            ✕
          </button>
        </div>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
        >
          <div>
            <label style={labelStyle}>Room Number *</label>
            <input
              className="search-input"
              type="text"
              placeholder="e.g. L101, R203, C112"
              style={{ width: "100%", boxSizing: "border-box" }}
              value={number}
              onChange={(e) => setNumber(e.target.value)}
            />
          </div>
          <div>
            <label style={labelStyle}>Room Type *</label>
            <select
              className="search-input"
              style={{ width: "100%", boxSizing: "border-box" }}
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setCapacity("");
              }}
            >
              <option value="">-- Select Type --</option>
              <option value="Lecture">Lecture</option>
              <option value="Computer Lab">Computer Lab</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Wing / Location *</label>
            <select
              className="search-input"
              style={{ width: "100%", boxSizing: "border-box" }}
              value={wing}
              onChange={(e) => setWing(e.target.value)}
            >
              <option value="">-- Select Wing --</option>
              {WINGS.map((w) => (
                <option key={w.code} value={w.code}>
                  {w.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>
              Capacity *{" "}
              {type && (
                <span style={{ fontWeight: 400, color: "var(--text3)" }}>
                  ({type === "Computer Lab" ? "30–35" : "40–45"})
                </span>
              )}
            </label>
            <input
              className="search-input"
              type="number"
              placeholder={
                type === "Computer Lab"
                  ? "30–35"
                  : type === "Lecture"
                    ? "40–45"
                    : "Capacity"
              }
              min={type === "Computer Lab" ? 30 : type === "Lecture" ? 40 : 1}
              max={type === "Computer Lab" ? 35 : type === "Lecture" ? 45 : 999}
              style={{ width: "100%", boxSizing: "border-box" }}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Status</label>
            <select
              className="search-input"
              style={{ width: "100%", boxSizing: "border-box" }}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="Available">Available</option>
              <option value="Occupied">Occupied</option>
              <option value="Maintenance">Maintenance</option>
            </select>
          </div>
        </div>
        {error && (
          <div style={{ color: "var(--red)", fontSize: 12 }}>⚠ {error}</div>
        )}
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            paddingTop: 4,
            borderTop: "1px solid var(--border)",
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
