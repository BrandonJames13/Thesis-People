import { useState } from "react";
import { useData } from "../context/DataContext";
import { useNotification } from "../context/NotificationContext";
import Modal from "../components/common/Modal";

export default function CoursesPage() {
  const { courses, addCourse } = useData();
  const { showNotification } = useNotification();
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="page-container">
      <div className="section-header">
        <div>
          <div className="section-title">Course Catalog</div>
          <div className="section-subtitle">
            CS · IT · IS programs · AY 2025–2026
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + Add Course
        </button>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Title</th>
              <th>Program</th>
              <th>Year</th>
              <th>Enrolled</th>
              <th>Room Type Required</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {courses.map((c) => (
              <tr key={c.code}>
                <td className="monospace">{c.code}</td>
                <td>{c.title}</td>
                <td>{c.program}</td>
                <td>{c.year}</td>
                <td>{c.enrolled}</td>
                <td>{c.roomType}</td>
                <td>
                  <span
                    className={`pill pill-${c.status === "Assigned" ? "green" : c.status === "Conflict" ? "red" : "orange"}`}
                  >
                    {c.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <AddCourseModal
          courses={courses}
          onClose={() => setShowModal(false)}
          onAdd={(course) => {
            addCourse(course);
            setShowModal(false);
            showNotification(`Course ${course.code} added successfully!`);
          }}
        />
      )}
    </div>
  );
}

function AddCourseModal({ courses, onClose, onAdd }) {
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [program, setProgram] = useState("");
  const [year, setYear] = useState("1st");
  const [enrolled, setEnrolled] = useState("");
  const [roomType, setRoomType] = useState("Lecture");

  const handleSubmit = () => {
    const c = code.trim().toUpperCase();
    const t = title.trim();
    const e = parseInt(enrolled);
    if (!c || !t || !program || isNaN(e) || e <= 0) {
      alert("Please fill in all required fields correctly.");
      return;
    }
    if (courses.find((x) => x.code === c)) {
      alert(`Course code "${c}" already exists.`);
      return;
    }
    onAdd({
      code: c,
      title: t,
      program,
      year,
      enrolled: e,
      roomType,
      status: "Pending",
      instructor: "",
      room: "",
      time: "",
      duration: 0,
      pattern: "",
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
          width: 480,
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
            + Add New Course
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
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
        >
          <div>
            <label style={labelStyle}>Course Code *</label>
            <input
              className="search-input"
              type="text"
              placeholder="e.g. CS401"
              style={{ width: "100%", boxSizing: "border-box" }}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          <div>
            <label style={labelStyle}>Title *</label>
            <input
              className="search-input"
              type="text"
              placeholder="e.g. Algorithms"
              style={{ width: "100%", boxSizing: "border-box" }}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <label style={labelStyle}>Program *</label>
            <select
              className="search-input"
              style={{ width: "100%", boxSizing: "border-box" }}
              value={program}
              onChange={(e) => setProgram(e.target.value)}
            >
              <option value="">-- Select --</option>
              <option value="CS">CS</option>
              <option value="IT">IT</option>
              <option value="IS">IS</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Year Level *</label>
            <select
              className="search-input"
              style={{ width: "100%", boxSizing: "border-box" }}
              value={year}
              onChange={(e) => setYear(e.target.value)}
            >
              <option value="1st">1st Year</option>
              <option value="2nd">2nd Year</option>
              <option value="3rd">3rd Year</option>
              <option value="4th">4th Year</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Enrolled Students *</label>
            <input
              className="search-input"
              type="number"
              min={1}
              placeholder="e.g. 35"
              style={{ width: "100%", boxSizing: "border-box" }}
              value={enrolled}
              onChange={(e) => setEnrolled(e.target.value)}
            />
          </div>
          <div>
            <label style={labelStyle}>Room Type Required *</label>
            <select
              className="search-input"
              style={{ width: "100%", boxSizing: "border-box" }}
              value={roomType}
              onChange={(e) => setRoomType(e.target.value)}
            >
              <option value="Lecture">Lecture</option>
              <option value="Lab">Lab</option>
            </select>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            gap: 10,
            justifyContent: "flex-end",
            paddingTop: 4,
            borderTop: "1px solid var(--border)",
          }}
        >
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSubmit}>
            + Add Course
          </button>
        </div>
      </div>
    </Modal>
  );
}
