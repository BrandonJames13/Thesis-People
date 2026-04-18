import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import { useData } from "../context/DataContext";
import { buildDatabaseErrorMessage } from "../utils/errorUtils";
import {
  validateRoomPayload,
} from "../utils/roomUtils";
import ConfirmModal from "../components/common/ConfirmModal";
import { AddRoomModal } from "../components/modals/addRoomModal";
import { supabase } from "../lib/supabaseClient";
import {
  getRoomCapacityLimit,
  normalizeRoomType,
  sanitizeRoomCapacity,
  detectSpecialRoomType,
} from "../data/constants";

const WINGS = [
  { code: "L", label: "Left Wing (L)" },
  { code: "R", label: "Right Wing (R)" },
  { code: "C", label: "Center Wing (C)" },
];

const PAGE_SIZE = 12;

export default function RoomsPage() {
  const { isAdmin } = useAuth();
  const { showNotification } = useNotification();
  const {
    isBootstrapping,
    isGenerationInProgress,
    clearRooms: clearRoomsData,
  } = useData();

  const notifyDbError = useCallback(
    (error, operation, entity = "room") => {
      const { userMessage } = buildDatabaseErrorMessage(error, {
        operation,
        entity,
      });
      showNotification(`⚠ ${userMessage}`);
    },
    [showNotification],
  );

  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [wingFilter, setWingFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [page, setPage] = useState(1);

  const fetchRooms = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("rooms")
        .select("*")
        .order("number");

      if (error) {
        console.error(error);
        notifyDbError(error, "load", "rooms");
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
  }, [notifyDbError]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  async function addRoom(room) {
    if (!isAdmin) {
      showNotification("Admin access required for this action.");
      return false;
    }

    // First normalize the type provided by form
    let normalizedType = normalizeRoomType(room.type);

    // Check if room name auto-detects a special type
    const detectedSpecialType = detectSpecialRoomType(room.number);
    if (detectedSpecialType && detectedSpecialType !== normalizedType) {
      // Override with detected special type for consistency
      normalizedType = detectedSpecialType;
    }

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

    // Validate payload before DB submission
    const validationError = validateRoomPayload(payload);
    if (validationError) {
      showNotification(`⚠ Validation error: ${validationError}`);
      return false;
    }

    const { data, error } = await supabase
      .from("rooms")
      .insert([payload])
      .select();

    if (error) {
      notifyDbError(error, "create");
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

    // First normalize the type provided by form
    let normalizedType = normalizeRoomType(room.type);

    // Check if room name auto-detects a special type
    const detectedSpecialType = detectSpecialRoomType(room.number);
    if (detectedSpecialType && detectedSpecialType !== normalizedType) {
      // Override with detected special type for consistency
      normalizedType = detectedSpecialType;
    }

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

    // Validate payload before DB submission
    const validationError = validateRoomPayload(payload);
    if (validationError) {
      showNotification(`⚠ Validation error: ${validationError}`);
      return false;
    }

    const { data, error } = await supabase
      .from("rooms")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      notifyDbError(error, "update");
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
      notifyDbError(error, "delete");
      return;
    }

    setRooms((current) =>
      current.filter((room) => room.id !== deleteTarget.id),
    );
    showNotification(`${deleteTarget.number} deleted.`);
    setDeleteTarget(null);
  }

  async function handleClearRoomsConfirm() {
    if (!isAdmin) {
      showNotification("Admin access required for this action.");
      return;
    }

    const result = await clearRoomsData();
    if (result.success) {
      setRooms([]);
      showNotification("✓ All rooms cleared successfully.");
    } else {
      showNotification(`⚠ ${result.error?.details ?? result.error}`);
    }
    setShowClearConfirm(false);
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

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  if (loading || isBootstrapping || isGenerationInProgress) {
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
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <select
            className="search-input"
            style={{ width: 140 }}
            value={typeFilter || "All Types"}
            onChange={(e) => {
              setTypeFilter(
                e.target.value === "All Types" ? "" : e.target.value,
              );
              setPage(1);
            }}
          >
            <option>All Types</option>
            <option>Lecture</option>
            <option>Computer Lab</option>
          </select>
          <select
            className="search-input"
            style={{ width: 140 }}
            value={wingFilter || "All Wings"}
            onChange={(e) => {
              setWingFilter(
                e.target.value === "All Wings" ? "" : e.target.value,
              );
              setPage(1);
            }}
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
            onChange={(e) => {
              setStatusFilter(
                e.target.value === "All Status" ? "" : e.target.value,
              );
              setPage(1);
            }}
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
          {isAdmin && (
            <button
              className="btn btn-secondary"
              onClick={() => setShowClearConfirm(true)}
            >
              🗑 Clear All
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="rooms-grid">
          {paginated.length === 0 ? (
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
            paginated.map((room) => {
              const statusColor =
                room.status === "Available"
                  ? "green"
                  : room.status === "Maintenance"
                    ? "orange"
                    : "blue";
              return (
                <div
                  className="room-card"
                  key={room.id}
                  style={{ position: "relative" }}
                >
                  {isAdmin && (
                    <div
                      style={{
                        position: "absolute",
                        top: 10,
                        right: 10,
                        display: "flex",
                        gap: 4,
                        alignItems: "center",
                      }}
                    >
                      <button
                        onClick={() => openEditModal(room)}
                        style={{
                          background: "var(--surface3)",
                          border: "1px solid var(--border)",
                          color: "var(--text2)",
                          cursor: "pointer",
                          fontSize: 11,
                          fontWeight: 500,
                          lineHeight: 1,
                          padding: "4px 8px",
                          borderRadius: 5,
                          whiteSpace: "nowrap",
                          transition: "background 0.15s, border-color 0.15s",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "var(--accent)";
                          e.currentTarget.style.borderColor = "var(--accent)";
                          e.currentTarget.style.color = "#fff";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "var(--surface3)";
                          e.currentTarget.style.borderColor = "var(--border)";
                          e.currentTarget.style.color = "var(--text2)";
                        }}
                        title="Edit"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteTarget(room)}
                        style={{
                          background: "var(--surface3)",
                          border: "1px solid var(--border)",
                          color: "var(--text2)",
                          cursor: "pointer",
                          fontSize: 11,
                          fontWeight: 500,
                          lineHeight: 1,
                          padding: "4px 7px",
                          borderRadius: 5,
                          transition: "background 0.15s, border-color 0.15s",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#c0392b";
                          e.currentTarget.style.borderColor = "#c0392b";
                          e.currentTarget.style.color = "#fff";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "var(--surface3)";
                          e.currentTarget.style.borderColor = "var(--border)";
                          e.currentTarget.style.color = "var(--text2)";
                        }}
                        title="Delete"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                  <div>
                    <div
                      className="room-number"
                      style={{ paddingRight: isAdmin ? 60 : 0 }}
                    >
                      {room.number}
                    </div>
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 16px",
              borderTop: "1px solid var(--border)",
            }}
          >
            <span style={{ fontSize: 12, color: "var(--text3)" }}>
              Showing {(safePage - 1) * PAGE_SIZE + 1}–
              {Math.min(safePage * PAGE_SIZE, filtered.length)} of{" "}
              {filtered.length} rooms
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                className="btn btn-secondary"
                style={{ padding: "4px 10px", fontSize: 12 }}
                onClick={() => setPage(1)}
                disabled={safePage === 1}
              >
                «
              </button>
              <button
                className="btn btn-secondary"
                style={{ padding: "4px 10px", fontSize: 12 }}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
              >
                ‹
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(
                  (p) =>
                    p === 1 || p === totalPages || Math.abs(p - safePage) <= 1,
                )
                .reduce((acc, p, i, arr) => {
                  if (i > 0 && p - arr[i - 1] > 1) acc.push("...");
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  p === "..." ? (
                    <span
                      key={`ellipsis-${i}`}
                      style={{
                        padding: "4px 6px",
                        fontSize: 12,
                        color: "var(--text3)",
                      }}
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      className={
                        p === safePage ? "btn btn-primary" : "btn btn-secondary"
                      }
                      style={{
                        padding: "4px 10px",
                        fontSize: 12,
                        minWidth: 32,
                      }}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </button>
                  ),
                )}
              <button
                className="btn btn-secondary"
                style={{ padding: "4px 10px", fontSize: 12 }}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
              >
                ›
              </button>
              <button
                className="btn btn-secondary"
                style={{ padding: "4px 10px", fontSize: 12 }}
                onClick={() => setPage(totalPages)}
                disabled={safePage === totalPages}
              >
                »
              </button>
            </div>
          </div>
        )}
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

      <ConfirmModal
        isOpen={showClearConfirm}
        title="🗑 Clear All Rooms"
        message="Are you sure you want to delete ALL rooms from the database? This will also delete all related schedule assignments and conflicts. This action cannot be undone."
        confirmLabel="🗑 Yes, Delete All"
        danger
        onConfirm={handleClearRoomsConfirm}
        onClose={() => setShowClearConfirm(false)}
      />
    </div>
  );
}
