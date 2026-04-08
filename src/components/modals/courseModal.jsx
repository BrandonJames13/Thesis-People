import { useState } from "react";
import Modal from "../common/Modal";

export function CourseModal({ courses, existing, onClose, onSave }) {
  const [code, setCode] = useState(existing?.code ?? "");
  const [title, setTitle] = useState(existing?.title ?? "");
  const [program, setProgram] = useState(existing?.program ?? "");
  const [year, setYear] = useState(existing?.year ?? "1st");
  const [section, setSection] = useState(existing?.section ?? "");
  const [enrolled, setEnrolled] = useState(existing?.enrolled ?? "");
  const [roomType, setRoomType] = useState(existing?.room_type ?? "Lecture");

  const isEdit = !!existing;

  const handleSubmit = () => {
    const c = code.trim().toUpperCase();
    const s = section.trim().toUpperCase();
    const t = title.trim();
    const e = parseInt(enrolled);

    if (!c || !s || !t || !program || isNaN(e) || e <= 0) {
      alert("Please fill all fields correctly.");
      return;
    }

    if (!isEdit && courses.find((x) => x.code === c && x.section === s)) {
      alert(`Course ${c} (${s}) already exists.`);
      return;
    }

    onSave({
      code: c,
      title: t,
      program,
      year,
      section: s,
      enrolled: e,
      room_type: roomType,
      status: existing?.status ?? "Not Assigned",
      duration: existing?.duration ?? 1.5,
    });
  };

  const labelStyle = {
    fontSize: 12,
    fontWeight: 600,
    marginBottom: 4,
    display: "block",
  };

  return (
    <Modal isOpen={true} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>
          {isEdit ? "✏ Edit Course" : "+ Add Course"}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Course Code</label>
            <input
              className="search-input"
              value={code}
              disabled={isEdit}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>

          <div>
            <label style={labelStyle}>Section</label>
            <input
              className="search-input"
              value={section}
              onChange={(e) => setSection(e.target.value)}
            />
          </div>

          <div>
            <label style={labelStyle}>Title</label>
            <input
              className="search-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div>
            <label style={labelStyle}>Program</label>
            <select
              className="search-input"
              value={program}
              onChange={(e) => setProgram(e.target.value)}
            >
              <option value="">Select</option>
              <option value="CS">CS</option>
              <option value="IT">IT</option>
              <option value="IS">IS</option>
              <option value="FREE">FREE</option>
            </select>
          </div>

          <div>
            <label style={labelStyle}>Year</label>
            <select
              className="search-input"
              value={year}
              onChange={(e) => setYear(e.target.value)}
            >
              <option value="1st">1st</option>
              <option value="2nd">2nd</option>
              <option value="3rd">3rd</option>
              <option value="4th">4th</option>
            </select>
          </div>

          <div>
            <label style={labelStyle}>Enrolled</label>
            <input
              type="number"
              className="search-input"
              value={enrolled}
              onChange={(e) => setEnrolled(e.target.value)}
            />
          </div>

          <div>
            <label style={labelStyle}>Room Type</label>
            <select
              className="search-input"
              value={roomType}
              onChange={(e) => setRoomType(e.target.value)}
            >
              <option value="Lecture">Lecture</option>
              <option value="Computer Lab">Computer Lab</option>
            </select>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            borderTop: "1px solid var(--border)",
            paddingTop: 10,
          }}
        >
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>

          <button className="btn btn-primary" onClick={handleSubmit}>
            {isEdit ? "Save Changes" : "Add Course"}
          </button>
        </div>
      </div>
    </Modal>
  );
}