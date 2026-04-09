import { useState } from "react";
import Modal from "../common/Modal";

export function CourseModal({ subjects, existing, onClose, onSave }) {
  const [code, setCode] = useState(existing?.code ?? "");
  const [title, setTitle] = useState(existing?.title ?? "");
  const [program, setProgram] = useState(existing?.program ?? "");
  const [year, setYear] = useState(existing?.year ?? "1st");
  const [roomType, setRoomType] = useState(existing?.room_type ?? "Lecture");

  const isEdit = !!existing;
  const [formError, setFormError] = useState("");

  const handleSubmit = () => {
    const c = code.trim().toUpperCase();
    const t = title.trim();

    if (!c || !t || !program || !year || !roomType) {
      setFormError("Please fill all fields correctly.");
      return;
    }

    const duplicateSubject = subjects.find(
      (x) =>
        x.code === c &&
        x.program === program &&
        x.year === year &&
        x.id !== existing?.id,
    );

    if (duplicateSubject) {
      setFormError(`Subject ${c} (${program} ${year}) already exists.`);
      return;
    }

    onSave({
      code: c,
      title: t,
      program,
      year,
      room_type: roomType,
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
    <Modal isOpen={true} onClose={onClose} size="lg">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>
          {isEdit ? "✏ Edit Subject" : "+ Add Subject"}
        </div>

        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
        >
          <div>
            <label style={labelStyle}>Subject Code</label>
            <input
              className="search-input"
              style={{ width: "100%", boxSizing: "border-box" }}
              value={code}
              disabled={isEdit}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>

          <div>
            <label style={labelStyle}>Title</label>
            <input
              className="search-input"
              style={{ width: "100%", boxSizing: "border-box" }}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div>
            <label style={labelStyle}>Program</label>
            <select
              className="search-input"
              style={{ width: "100%", boxSizing: "border-box" }}
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
              style={{ width: "100%", boxSizing: "border-box" }}
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
            <label style={labelStyle}>Room Type</label>
            <select
              className="search-input"
              style={{ width: "100%", boxSizing: "border-box" }}
              value={roomType}
              onChange={(e) => setRoomType(e.target.value)}
            >
              <option value="Lecture">Lecture</option>
              <option value="Computer Lab">Computer Lab</option>
            </select>
          </div>
        </div>

        {formError && (
          <div style={{ color: "var(--red)", fontSize: 12, marginBottom: 4 }}>
            ⚠ {formError}
          </div>
        )}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            borderTop: "1px solid var(--border)",
            paddingTop: 16,
          }}
        >
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSubmit}>
            {isEdit ? "Save Changes" : "Add Subject"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
