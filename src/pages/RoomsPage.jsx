import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import ConfirmModal from "../components/common/ConfirmModal";
import { AddRoomModal } from "../components/modals/addRoomModal";
import {
  getRoomCapacityLimit,
  normalizeRoomType,
  sanitizeRoomCapacity,
} from "../data/constants";

const WINGS = [
  { code: "L", label: "Left Wing (L)" },
  { code: "R", label: "Right Wing (R)" },
  { code: "C", label: "Center Wing (C)" },
];

export default function RoomsPage() {
  const { isAdmin } = useAuth();
  const { showNotification } = useNotification();

  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [wingFilter, setWingFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchRooms = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("rooms")
        .select("*")
        .order("number");

      if (error) {
        console.error(error);
        showNotification(`⚠ ${error.message}`);
        return;
      }

      setRooms(
        (data ?? []).map((room) => {
          const normalizedType = normalizeRoomType(room.type);
          return {
            ...room,
            type: normalizedType,
            capacity: sanitizeRoomCapacity(normalizedType, room.capacity),
          };
        }),
      );
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  async function addRoom(room) {
    if (!isAdmin) {
      showNotification("Admin access required for this action.");
      return false;
    }

    const normalizedType = normalizeRoomType(room.type);
    const normalizedCapacity = sanitizeRoomCapacity(
      normalizedType,
      room.capacity,
    );

    const payload = {
      number: room.number,
      type: normalizedType,
      capacity: normalizedCapacity,
      status: room.status,
      wing: room.wing ?? null,
    };

    const { data, error } = await supabase
      .from("rooms")
      .insert([payload])
      .select();

    if (error) {
      showNotification(`⚠ ${error.message}`);
      return false;
    }

    setRooms((current) => [...current, ...(data ?? [])]);
    return true;
  }

  async function editRoom(id, room) {
    if (!isAdmin) {
      showNotification("Admin access required for this action.");
      return false;
    }

    const normalizedType = normalizeRoomType(room.type);
    const normalizedCapacity = sanitizeRoomCapacity(
      normalizedType,
      room.capacity,
    );

    const payload = {
      number: room.number,
      type: normalizedType,
      capacity: normalizedCapacity,
      status: room.status,
      wing: room.wing ?? null,
    };

    const { data, error } = await supabase
      .from("rooms")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      showNotification(`⚠ ${error.message}`);
      return false;
    }

    setRooms((current) =>
      current.map((roomItem) =>
        roomItem.id === id ? (data ?? { ...roomItem, ...payload }) : roomItem,
      ),
    );
    return true;
  }

  function openAddModal() {
    if (!isAdmin) return;
    setEditingRoom(null);
    setShowModal(true);
  }

  function openEditModal(room) {
    if (!isAdmin) return;
    setEditingRoom(room);
    setShowModal(true);
  }

  function closeRoomModal() {
    setShowModal(false);
    setEditingRoom(null);
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;

    if (!isAdmin) {
      showNotification("Admin access required for this action.");
      return;
    }

    const { error } = await supabase
      .from("rooms")
      .delete()
      .eq("id", deleteTarget.id);

    if (error) {
      showNotification(`⚠ ${error.message}`);
      return;
    }

    setRooms((current) =>
      current.filter((room) => room.id !== deleteTarget.id),
    );
    showNotification(`${deleteTarget.number} deleted.`);
    setDeleteTarget(null);
  }

  const filtered = rooms.filter((room) => {
    const matchSearch = room.number
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchType =
      !typeFilter || normalizeRoomType(room.type) === typeFilter;
    const matchStatus = !statusFilter || room.status === statusFilter;
    const matchWing = !wingFilter || room.wing === wingFilter;
    return matchSearch && matchType && matchStatus && matchWing;
  });

  if (loading) {
    return <div className="page-container">Loading rooms...</div>;
  }

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
          {isAdmin && (
            <button className="btn btn-primary" onClick={openAddModal}>
              + Add Room
            </button>
          )}
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
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                    }}
                  >
                    <div className="room-number">{room.number}</div>
                    {isAdmin && (
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={() => openEditModal(room)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--text3)",
                            cursor: "pointer",
                            fontSize: 13,
                            lineHeight: 1,
                            padding: 0,
                          }}
                          title="Edit"
                        >
                          Edit
                        </button>
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
                    )}
                  </div>
                  <div className="room-type">
                    {normalizeRoomType(room.type)}
                  </div>
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
                    {(() => {
                      const normalizedType = normalizeRoomType(room.type);
                      const { max } = getRoomCapacityLimit(normalizedType);
                      const safeCapacity = sanitizeRoomCapacity(
                        normalizedType,
                        room.capacity,
                      );
                      const percent = Math.min(
                        100,
                        Math.max(
                          0,
                          Math.round((safeCapacity / Math.max(max, 1)) * 100),
                        ),
                      );

                      return (
                        <>
                          <div className="cap-bar">
                            <div
                              className="cap-fill"
                              style={{
                                width: `${percent}%`,
                              }}
                            />
                          </div>
                          <span className="monospace">{safeCapacity}</span>
                        </>
                      );
                    })()}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {showModal && isAdmin && (
        <AddRoomModal
          key={editingRoom?.id ?? "add-room"}
          onClose={closeRoomModal}
          mode={editingRoom ? "edit" : "add"}
          initialRoom={editingRoom}
          onSubmit={async (room) => {
            if (editingRoom) {
              const saved = await editRoom(editingRoom.id, room);
              if (!saved) return;
              closeRoomModal();
              showNotification("Room updated successfully!");
              return;
            }

            const saved = await addRoom(room);
            if (!saved) return;

            closeRoomModal();
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
