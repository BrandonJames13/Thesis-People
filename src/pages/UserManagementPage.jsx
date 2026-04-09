import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import Modal from "../components/common/Modal";
import ConfirmModal from "../components/common/ConfirmModal";

// Admin client — uses service role key for user management
const adminSupabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
);

export default function UserManagementPage() {
  const { currentUser } = useAuth();
  const { showNotification } = useNotification();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);

  if (currentUser?.role !== "admin") {
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

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    const { data, error } = await adminSupabase.auth.admin.listUsers();
    if (error) {
      showNotification(`⚠ ${error.message}`);
      setLoading(false);
      return;
    }
    setUsers(data.users || []);
    setLoading(false);
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

  async function handleUpdateRole(userId, newRole) {
    const { error } = await adminSupabase.auth.admin.updateUserById(userId, {
      user_metadata: { role: newRole, user_role: newRole },
    });
    if (error) {
      showNotification(`⚠ ${error.message}`);
    } else {
      setUsers(
        users.map((u) =>
          u.id === userId
            ? {
                ...u,
                user_metadata: {
                  ...u.user_metadata,
                  role: newRole,
                  user_role: newRole,
                },
              }
            : u,
        ),
      );
      showNotification("Role updated successfully!");
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

  return (
    <div className="page-container">
      <div className="section-header">
        <div>
          <div className="section-title">👑 User Management</div>
          <div className="section-subtitle">
            Admin-only · Manage system accounts and roles
          </div>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowAddModal(true)}
        >
          + Add User
        </button>
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
            ) : (
              users.map((user) => {
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
                            isCurrentUser
                              ? "Cannot edit your own role"
                              : "Edit role"
                          }
                        >
                          ✏ Edit Role
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
      </div>

      {/* Add User Modal */}
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

      {/* Edit Role Modal */}
      {editTarget && (
        <EditRoleModal
          user={editTarget}
          currentRole={getRole(editTarget)}
          onClose={() => setEditTarget(null)}
          onSave={(newRole) => handleUpdateRole(editTarget.id, newRole)}
        />
      )}

      {/* Delete Confirm */}
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

// ─── Add User Modal ───────────────────────────────────────────────────────────
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
    <Modal isOpen={true} onClose={onClose} title="+ Add New User" width={400}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
              title={showPassword ? "Hide password" : "Show password"}
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

// ─── Edit Role Modal ──────────────────────────────────────────────────────────
function EditRoleModal({ user, currentRole, onClose, onSave }) {
  const [role, setRole] = useState(currentRole);
  const name = user.user_metadata?.name || user.email;

  const labelStyle = {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--text2)",
    marginBottom: 4,
    display: "block",
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="✏ Edit User Role" width={360}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontSize: 13, color: "var(--text2)" }}>
          Editing role for <strong>{name}</strong>
          <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>
            {user.email}
          </div>
        </div>
        <div>
          <label style={labelStyle}>Role</label>
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
          <button className="btn btn-primary" onClick={() => onSave(role)}>
            Save Changes
          </button>
        </div>
      </div>
    </Modal>
  );
}
