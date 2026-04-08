import { useState } from "react";
import Modal from "../common/Modal";

export function InstructorModal({ existing, onClose, onSave }) {
  const [name, setName] = useState(existing?.name ?? "");
  const [dept, setDept] = useState(existing?.department ?? "");
  const [availability, setAvailability] = useState(existing?.availability ?? "");
  const [status, setStatus] = useState(existing?.status ?? "Active");

  const isEdit = !!existing;

  const handleSubmit = () => {
    if (!name.trim()) {
      alert("Please enter the instructor name.");
      return;
    }

    onSave({
      name: name.trim(),
      department: dept || null,
      availability: availability.trim() || null,
      status,
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
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
          {isEdit ? "✏ Edit Instructor" : "+ Add New Instructor"}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={labelStyle}>Full Name *</label>
            <input
              className="search-input"
              type="text"
              placeholder="e.g. Reyes, A."
              style={{ width: "100%", boxSizing: "border-box" }}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label style={labelStyle}>Department</label>
            <select
              className="search-input"
              style={{ width: "100%", boxSizing: "border-box" }}
              value={dept}
              onChange={(e) => setDept(e.target.value)}
            >
              <option value="">-- Select Department --</option>
              <option value="CS">Computer Science (CS)</option>
              <option value="IT">Information Technology (IT)</option>
              <option value="IS">Information Systems (IS)</option>
            </select>
          </div>

          <div>
            <label style={labelStyle}>Availability</label>
            <textarea
              className="search-input"
              placeholder="e.g. MWF All Day, TTH Morning"
              style={{ width: "100%", height: 70, resize: "none", boxSizing: "border-box" }}
              value={availability}
              onChange={(e) => setAvailability(e.target.value)}
            />
          </div>

          <div>
            <label style={labelStyle}>Status</label>
            <select
              className="search-input"
              style={{ width: "100%", boxSizing: "border-box" }}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", borderTop: "1px solid var(--border)", paddingTop: 10 }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSubmit}>
            {isEdit ? "Save Changes" : "+ Add Instructor"}
          </button>
        </div>
      </div>
    </Modal>
  );
}