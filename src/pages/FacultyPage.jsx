import { useState } from "react";
import { useData } from "../context/DataContext";
import { useNotification } from "../context/NotificationContext";
import Modal from "../components/common/Modal";

export default function FacultyPage() {
  const { instructors, addInstructor } = useData();
  const { showNotification } = useNotification();
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="page-container">
      <div className="section-header">
        <div>
          <div className="section-title">Faculty Management</div>
          <div className="section-subtitle">
            Teaching load &amp; availability tracking
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + Add Instructor
        </button>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Instructor</th>
              <th>Assigned Courses</th>
              <th>Load</th>
              <th>Availability</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {instructors.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  style={{
                    textAlign: "center",
                    padding: 40,
                    color: "var(--text3)",
                  }}
                >
                  No instructors added yet. Click "+ Add Instructor" to add one.
                </td>
              </tr>
            ) : (
              instructors.map((inst, i) => (
                <tr key={i}>
                  <td>
                    <strong>{inst.name}</strong>
                  </td>
                  <td className="monospace" style={{ fontSize: 12 }}>
                    {inst.courses.length > 0 ? (
                      inst.courses.join(", ")
                    ) : (
                      <span style={{ color: "var(--text3)" }}>None</span>
                    )}
                  </td>
                  <td>
                    {inst.courses.length} course
                    {inst.courses.length !== 1 ? "s" : ""}
                  </td>
                  <td style={{ fontSize: 12 }}>{inst.availability}</td>
                  <td>
                    <span
                      className={`pill pill-${inst.status === "Active" ? "green" : "red"}`}
                    >
                      {inst.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <AddInstructorModal
          onClose={() => setShowModal(false)}
          onAdd={(inst) => {
            addInstructor(inst);
            setShowModal(false);
            showNotification("Instructor added successfully!");
          }}
        />
      )}
    </div>
  );
}

function AddInstructorModal({ onClose, onAdd }) {
  const [name, setName] = useState("");
  const [dept, setDept] = useState("");
  const [availability, setAvailability] = useState("");

  const handleSubmit = () => {
    if (!name.trim()) {
      alert("Please enter the instructor name.");
      return;
    }
    onAdd({
      name: name.trim(),
      department: dept || "TBD",
      availability: availability.trim() || "TBD",
      courses: [],
      status: "Active",
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
    <Modal onClose={onClose}>
      <div
        style={{
          width: 420,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
            + Add New Instructor
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
              lineHeight: 1,
            }}
          >
            ✕
          </button>
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
              style={{
                width: "100%",
                height: 70,
                resize: "none",
                boxSizing: "border-box",
              }}
              value={availability}
              onChange={(e) => setAvailability(e.target.value)}
            />
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSubmit}>
            + Add Instructor
          </button>
        </div>
      </div>
    </Modal>
  );
}
