import { useState } from "react";
import { useData } from "../context/DataContext";
import { useNotification } from "../context/NotificationContext";
import Modal from "../components/common/Modal";
import ConfirmModal from "../components/common/ConfirmModal";

function exportInstructorSchedule(instructor, scheduleAssignments) {
  // Get all courses assigned to this instructor
  const myCourses = scheduleAssignments.filter(
    (a) =>
      a.instructor?.trim().toLowerCase() ===
      instructor.name.trim().toLowerCase(),
  );

  if (myCourses.length === 0) {
    alert(`${instructor.name} has no assigned courses in the schedule yet.`);
    return;
  }

  // Build CSV content matching the TSU Faculty Schedule format
  const lines = [];

  // Header info
  lines.push(`TARLAC STATE UNIVERSITY`);
  lines.push(`FACULTY SCHEDULE & TEACHING LOAD STATISTICS`);
  lines.push(`AY 2025-2026 1ST SEMESTER`);
  lines.push(``);
  lines.push(`Faculty Name:,${instructor.name}`);
  lines.push(
    `Department:,${instructor.department || "College of Computer Studies"}`,
  );
  lines.push(`Status:,${instructor.status || "Active"}`);
  lines.push(``);

  // Table header
  lines.push(
    `Subject Code,Subject Title,Section,LEC (hrs),LAB (hrs),Days/Time,Room,Total Students`,
  );

  let totalLec = 0;
  let totalLab = 0;
  let totalStudents = 0;

  myCourses.forEach((c) => {
    const isLab = c.roomType === "Lab" || c.roomType === "Computer Lab";
    const lec = isLab ? 0 : c.duration || 1.5;
    const lab = isLab ? c.duration || 1.5 : 0;
    totalLec += lec;
    totalLab += lab;
    totalStudents += c.enrolled || 0;
    lines.push(
      `${c.code},${c.title},${c.section || ""},${lec.toFixed(2)},${lab.toFixed(2)},"${c.time || ""}","${c.room || ""}",${c.enrolled || 0}`,
    );
  });

  lines.push(``);
  lines.push(
    `TOTAL,,,,${totalLec.toFixed(1)},${totalLab.toFixed(1)},,${totalStudents}`,
  );
  lines.push(``);
  lines.push(`Total Lecture Hours per week:,${totalLec.toFixed(2)}`);
  lines.push(`Total Laboratory Hours per week:,${totalLab.toFixed(2)}`);
  lines.push(``);
  lines.push(`I certify the correctness of the above report.`);
  lines.push(``);
  lines.push(`,${instructor.name}`);
  lines.push(`,Faculty`);

  const csvContent = lines.join("\n");
  const blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Schedule_${instructor.name.replace(/[^a-zA-Z0-9]/g, "_")}_AY2025-2026.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function FacultyPage() {
  const { instructors, addInstructor, updateInstructors, scheduleAssignments } =
    useData();
  const { showNotification } = useNotification();
  const [showModal, setShowModal] = useState(false);
  const [editInstructor, setEditInstructor] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const handleDeleteConfirm = () => {
    updateInstructors(instructors.filter((i) => i.name !== deleteTarget));
    showNotification(`${deleteTarget} removed.`);
    setDeleteTarget(null);
  };

  return (
    <div className="page-container">
      <div className="section-header">
        <div>
          <div className="section-title">Faculty Management</div>
          <div className="section-subtitle">
            Teaching load &amp; availability tracking
          </div>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditInstructor(null);
            setShowModal(true);
          }}
        >
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
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {instructors.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
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
                    {inst.courses?.length > 0 ? (
                      inst.courses.join(", ")
                    ) : (
                      <span style={{ color: "var(--text3)" }}>None</span>
                    )}
                  </td>
                  <td>
                    {inst.courses?.length || 0} course
                    {inst.courses?.length !== 1 ? "s" : ""}
                  </td>
                  <td style={{ fontSize: 12 }}>{inst.availability}</td>
                  <td>
                    <span
                      className={`pill pill-${inst.status === "Active" ? "green" : "red"}`}
                    >
                      {inst.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: "3px 10px", fontSize: 11 }}
                        onClick={() => {
                          setEditInstructor(inst);
                          setShowModal(true);
                        }}
                      >
                        ✏ Edit
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: "3px 10px", fontSize: 11 }}
                        onClick={() => {
                          exportInstructorSchedule(inst, scheduleAssignments);
                          showNotification(
                            `Schedule exported for ${inst.name} ✓`,
                          );
                        }}
                        title="Export this instructor's schedule"
                      >
                        ↓ Export
                      </button>
                      <button
                        className="btn btn-danger"
                        style={{ padding: "3px 10px", fontSize: 11 }}
                        onClick={() => setDeleteTarget(inst.name)}
                      >
                        🗑
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <InstructorModal
          existing={editInstructor}
          onClose={() => setShowModal(false)}
          onSave={(inst) => {
            if (editInstructor) {
              updateInstructors(
                instructors.map((i) =>
                  i.name === editInstructor.name ? inst : i,
                ),
              );
              showNotification(`${inst.name} updated!`);
            } else {
              addInstructor(inst);
              showNotification("Instructor added successfully!");
            }
            setShowModal(false);
          }}
        />
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        title="🗑 Delete Instructor"
        message={`Are you sure you want to delete ${deleteTarget}? This cannot be undone.`}
        confirmLabel="🗑 Yes, Delete"
        danger
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function InstructorModal({ existing, onClose, onSave }) {
  const [name, setName] = useState(existing?.name ?? "");
  const [dept, setDept] = useState(existing?.department ?? "");
  const [availability, setAvailability] = useState(
    existing?.availability ?? "",
  );
  const [status, setStatus] = useState(existing?.status ?? "Active");
  const isEdit = !!existing;
  const [formError, setFormError] = useState("");

  const handleSubmit = () => {
    if (!name.trim()) {
      setFormError("Please enter the instructor name.");
      return;
    }
    onSave({
      ...(existing ?? {}),
      name: name.trim(),
      department: dept || "TBD",
      availability: availability.trim() || "TBD",
      courses: existing?.courses ?? [],
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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
            {isEdit ? "✏ Edit Instructor" : "+ Add New Instructor"}
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
        {formError && (
          <div style={{ color: "var(--red)", fontSize: 12, marginBottom: 4 }}>
            ⚠ {formError}
          </div>
        )}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSubmit}>
            {isEdit ? "✏ Save Changes" : "+ Add Instructor"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
