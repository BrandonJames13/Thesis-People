import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNotification } from "../context/NotificationContext";
import { AddRoomModal } from "../components/modals/addRoomModal";

export default function RoomsPage() {
  const { showNotification } = useNotification();

  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchRooms();
  }, []);

  async function fetchRooms() {
    const { data, error } = await supabase
      .from("rooms")
      .select("*")
      .order("number");

    if (error) {
      console.error(error);
      return;
    }

    setRooms(data);
    setLoading(false);
  }

  async function addRoom(room) {
    const { data, error } = await supabase
      .from("rooms")
      .insert([room])
      .select();

    if (error) {
      alert(error.message);
      return;
    }

    setRooms([...rooms, data[0]]);
  }

  async function handleDelete(id, number) {
    if (!window.confirm(`Delete ${number}? This cannot be undone.`)) return;

    const { error } = await supabase
      .from("rooms")
      .delete()
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    setRooms(rooms.filter((r) => r.id !== id));
    showNotification(`${number} deleted.`);
  }

  const filtered = rooms.filter((room) => {
    const matchSearch = room.number.toLowerCase().includes(search.toLowerCase());
    const matchType = !typeFilter || room.type === typeFilter;
    const matchStatus = !statusFilter || room.status === statusFilter;
    return matchSearch && matchType && matchStatus;
  });

  if (loading) {
    return <div className="page-container">Loading rooms...</div>;
  }

  return (
    <div className="page-container">
      <div className="section-header">
        <div>
          <div className="section-title">Room Inventory</div>
          <div className="section-subtitle">Manage lecture rooms and computer labs</div>
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
              setTypeFilter(e.target.value === "All Types" ? "" : e.target.value)
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
              setStatusFilter(e.target.value === "All Status" ? "" : e.target.value)
            }
          >
            <option>All Status</option>
            <option>Available</option>
            <option>Occupied</option>
            <option>Maintenance</option>
          </select>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
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
                <div className="room-card" key={room.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div className="room-number">{room.number}</div>
                    <button
                      onClick={() => handleDelete(room.id, room.number)}
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
                    <span className={`pill pill-${statusColor}`}>{room.status}</span>
                  </div>
                  <div className="room-capacity">
                    <span style={{ fontSize: 11, color: "var(--text3)" }}>Cap:</span>
                    <div className="cap-bar">
                      <div
                        className="cap-fill"
                        style={{ width: `${Math.round((room.capacity / 50) * 100)}%` }}
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
          onAdd={async (room) => {
            await addRoom(room);
            setShowModal(false);
            showNotification("Room added successfully!");
          }}
        />
      )}
    </div>
  );
}