import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import Modal from "../components/common/Modal";
import ConfirmModal from "../components/common/ConfirmModal";

const adminSupabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
);

export default function UserManagementPage() {
  const { currentUser } = useAuth();
  const { showNotification } = useNotification();
  const isAdmin = currentUser?.role === "admin";

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);

  // Search & pagination
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await adminSupabase.auth.admin.listUsers();
    if (error) {
      showNotification(`⚠ ${error.message}`);
      setLoading(false);
      return;
    }
    setUsers(data.users || []);
    setLoading(false);
  }, [showNotification]);

  useEffect(() => {
    if (!isAdmin) return;

    let isMounted = true;
    adminSupabase.auth.admin.listUsers().then(({ data, error }) => {
      if (!isMounted) return;

      if (error) {
        showNotification(`⚠ ${error.message}`);
        setLoading(false);
        return;
      }

      setUsers(data.users || []);
      setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [isAdmin, showNotification]);

  if (!isAdmin) {
    return (
      <div className="page-container">
        <div className="card" style={{ textAlign: "center", padding: 60 }}>
          <div style={{ fontSize: 40 }}>🚫</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginTop: 12 }}>
            Access Denied
          </div>
          <div style={{ color: "var(--text3)", marginTop: 8 }}>
            This page is only accessible to administrators.
          </div>
        </div>
      </div>
    );
  }

  async function handleDeleteUser() {
    const { error } = await adminSupabase.auth.admin.deleteUser(
      deleteTarget.id,
    );
    if (error) {
      showNotification(`⚠ ${error.message}`);
    } else {
      setUsers(users.filter((u) => u.id !== deleteTarget.id));
      showNotification(`User ${deleteTarget.email} deleted.`);
    }
    setDeleteTarget(null);
  }

  async function handleUpdateUser({ name, email, password, role }) {
    const updates = {
      user_metadata: { name, role, user_role: role },
    };
    if (email && email !== editTarget.email) updates.email = email;
    if (password) updates.password = password;

    const { error } = await adminSupabase.auth.admin.updateUserById(
      editTarget.id,
      updates,
    );
    if (error) {
      showNotification(`⚠ ${error.message}`);
    } else {
      setUsers(
        users.map((u) =>
          u.id === editTarget.id
            ? {
                ...u,
                email: email || u.email,
                user_metadata: {
                  ...u.user_metadata,
                  name,
                  role,
                  user_role: role,
                },
              }
            : u,
        ),
      );
      showNotification(`${name} updated successfully!`);
    }
    setEditTarget(null);
  }

  const getRole = (user) =>
    user.user_metadata?.user_role || user.user_metadata?.role || "faculty";
  const getName = (user) =>
    user.user_metadata?.name || user.email?.split("@")[0] || "—";

  if (loading) {
    return (
      <div className="page-container">
        <div style={{ padding: 40, color: "var(--text3)" }}>
          Loading users...
        </div>
      </div>
    );
  }

  const filtered = users.filter((user) => {
    const q = search.trim().toLowerCase();
    const name = getName(user).toLowerCase();
    const email = (user.email ?? "").toLowerCase();
    const matchSearch = !q || name.includes(q) || email.includes(q);
    const matchRole = !roleFilter || getRole(user) === roleFilter;
    return matchSearch && matchRole;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  return (
    <div className="page-container">
      <div className="section-header">
        <div>
          <div className="section-title">👑 User Management</div>
          <div className="section-subtitle">
            Admin-only · Manage system accounts and roles
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            className="search-input"
            type="text"
            placeholder="Search name or email…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            style={{ width: 220 }}
          />
          <select
            className="search-input"
            style={{ width: 130 }}
            value={roleFilter || "All Roles"}
            onChange={(e) => {
              setRoleFilter(
                e.target.value === "All Roles" ? "" : e.target.value,
              );
              setPage(1);
            }}
          >
            <option>All Roles</option>
            <option value="admin">Admin</option>
            <option value="faculty">Faculty</option>
          </select>
          <button
            className="btn btn-primary"
            onClick={() => setShowAddModal(true)}
          >
            + Add User
          </button>
        </div>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Created</th>
              <th>Last Sign In</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  style={{
                    textAlign: "center",
                    padding: 40,
                    color: "var(--text3)",
                  }}
                >
                  No users found.
                </td>
              </tr>
            ) : paginated.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  style={{
                    textAlign: "center",
                    padding: 40,
                    color: "var(--text3)",
                  }}
                >
                  No users match your search.
                </td>
              </tr>
            ) : (
              paginated.map((user) => {
                const role = getRole(user);
                const isCurrentUser = user.email === currentUser?.email;
                return (
                  <tr key={user.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{getName(user)}</div>
                      {isCurrentUser && (
                        <span style={{ fontSize: 10, color: "var(--accent)" }}>
                          ● You
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: 13 }}>{user.email}</td>
                    <td>
                      {role === "admin" ? (
                        <span
                          style={{
                            display: "inline-block",
                            background: "rgba(188,140,255,0.2)",
                            color: "var(--purple)",
                            border: "1px solid var(--purple)",
                            borderRadius: 20,
                            padding: "2px 10px",
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          👑 Admin
                        </span>
                      ) : (
                        <span className="pill pill-green">🎓 Faculty</span>
                      )}
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text3)" }}>
                      {user.created_at
                        ? new Date(user.created_at).toLocaleDateString()
                        : "—"}
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text3)" }}>
                      {user.last_sign_in_at
                        ? new Date(user.last_sign_in_at).toLocaleDateString()
                        : "Never"}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: "3px 10px", fontSize: 11 }}
                          onClick={() => setEditTarget(user)}
                          disabled={isCurrentUser}
                          title={
                            isCurrentUser ? "Cannot edit yourself" : "Edit user"
                          }
                        >
                          ✏ Edit User
                        </button>
                        <button
                          className="btn btn-danger"
                          style={{ padding: "3px 10px", fontSize: 11 }}
                          onClick={() => setDeleteTarget(user)}
                          disabled={isCurrentUser}
                          title={
                            isCurrentUser
                              ? "Cannot delete yourself"
                              : "Delete user"
                          }
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

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
              {filtered.length} users
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

      {showAddModal && (
        <AddUserModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            fetchUsers();
            showNotification("User created successfully!");
            setShowAddModal(false);
          }}
        />
      )}

      {editTarget && (
        <EditUserModal
          user={editTarget}
          currentRole={getRole(editTarget)}
          currentName={getName(editTarget)}
          onClose={() => setEditTarget(null)}
          onSave={handleUpdateUser}
        />
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        title="🗑 Delete User"
        message={`Are you sure you want to delete the account for ${deleteTarget?.email}? This cannot be undone.`}
        confirmLabel="🗑 Yes, Delete"
        danger
        onConfirm={handleDeleteUser}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function AddUserModal({ onClose, onSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("faculty");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim() || !name.trim()) {
      setError("All fields are required.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    const { error: err } = await adminSupabase.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
      user_metadata: { name: name.trim(), role, user_role: role },
    });
    setLoading(false);
    if (err) {
      setError(err.message);
    } else {
      onSuccess();
    }
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
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
            + Add New User
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
        <div>
          <label style={labelStyle}>Full Name *</label>
          <input
            className="search-input"
            style={{ width: "100%", boxSizing: "border-box" }}
            placeholder="e.g. Juan dela Cruz"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label style={labelStyle}>Email *</label>
          <input
            className="search-input"
            style={{ width: "100%", boxSizing: "border-box" }}
            type="email"
            placeholder="e.g. juan@tsu.edu.ph"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label style={labelStyle}>Password *</label>
          <div style={{ position: "relative" }}>
            <input
              className="search-input"
              style={{
                width: "100%",
                boxSizing: "border-box",
                paddingRight: 40,
              }}
              type={showPassword ? "text" : "password"}
              placeholder="Min. 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: "absolute",
                right: 10,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 16,
                color: "var(--text3)",
                padding: 0,
              }}
            >
              {showPassword ? "🙈" : "👁"}
            </button>
          </div>
        </div>
        <div>
          <label style={labelStyle}>Role *</label>
          <select
            className="search-input"
            style={{ width: "100%", boxSizing: "border-box" }}
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="faculty">🎓 Faculty</option>
            <option value="admin">👑 Admin</option>
          </select>
        </div>
        {error && (
          <div style={{ color: "var(--red)", fontSize: 12 }}>⚠ {error}</div>
        )}
        <div
          style={{
            display: "flex",
            gap: 10,
            justifyContent: "flex-end",
            borderTop: "1px solid var(--border)",
            paddingTop: 10,
          }}
        >
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? "Creating..." : "+ Create User"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function EditUserModal({ user, currentRole, currentName, onClose, onSave }) {
  const [name, setName] = useState(currentName);
  const [email, setEmail] = useState(user.email || "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(currentRole);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (password && password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    onSave({
      name: name.trim(),
      email: email.trim(),
      password: password || null,
      role,
    });
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
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
            ✏ Edit User
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
        <div style={{ fontSize: 12, color: "var(--text3)" }}>
          Editing account for{" "}
          <strong style={{ color: "var(--text)" }}>{user.email}</strong>
        </div>
        <div>
          <label style={labelStyle}>Full Name *</label>
          <input
            className="search-input"
            style={{ width: "100%", boxSizing: "border-box" }}
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label style={labelStyle}>Email</label>
          <input
            className="search-input"
            style={{ width: "100%", boxSizing: "border-box" }}
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label style={labelStyle}>
            New Password{" "}
            <span style={{ fontWeight: 400, color: "var(--text3)" }}>
              (leave blank to keep current)
            </span>
          </label>
          <div style={{ position: "relative" }}>
            <input
              className="search-input"
              style={{
                width: "100%",
                boxSizing: "border-box",
                paddingRight: 40,
              }}
              type={showPassword ? "text" : "password"}
              placeholder="New password (optional)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: "absolute",
                right: 10,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 16,
                color: "var(--text3)",
                padding: 0,
              }}
            >
              {showPassword ? "🙈" : "👁"}
            </button>
          </div>
        </div>
        <div>
          <label style={labelStyle}>Role *</label>
          <select
            className="search-input"
            style={{ width: "100%", boxSizing: "border-box" }}
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="faculty">🎓 Faculty</option>
            <option value="admin">👑 Admin</option>
          </select>
        </div>
        {error && (
          <div style={{ color: "var(--red)", fontSize: 12 }}>⚠ {error}</div>
        )}
        <div
          style={{
            display: "flex",
            gap: 10,
            justifyContent: "flex-end",
            borderTop: "1px solid var(--border)",
            paddingTop: 10,
          }}
        >
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSubmit}>
            ✏ Save Changes
          </button>
        </div>
      </div>
    </Modal>
  );
}
