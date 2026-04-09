import { useState } from "react";
import Modal from "../common/Modal";
import { useData } from "../../context/DataContext";

export function InstructorModal({ existing, onClose, onSave }) {
  const { courses } = useData();

  const [name, setName] = useState(existing?.name ?? "");
  const [dept, setDept] = useState(existing?.department ?? "");
  const [availability, setAvailability] = useState(
    existing?.availability ?? "",
  );
  const [status, setStatus] = useState(existing?.status ?? "Active");
  const [assignedCourses, setAssignedCourses] = useState(
    existing?.courses ?? [],
  );
  const [courseSearch, setCourseSearch] = useState("");

  const isEdit = !!existing;
  const [formError, setFormError] = useState("");

  // Available course options (unique by code+section)
  const courseOptions = courses.map((c) => ({
    label: `${c.code} – ${c.title} (${c.section})`,
    value: `${c.code}|${c.section}`,
    code: c.code,
  }));

  const filteredCourseOptions = courseOptions.filter(
    (opt) =>
      opt.label.toLowerCase().includes(courseSearch.toLowerCase()) &&
      !assignedCourses.includes(opt.code),
  );

  const addCourse = (code) => {
    if (!assignedCourses.includes(code)) {
      setAssignedCourses([...assignedCourses, code]);
    }
    setCourseSearch("");
  };

  const removeCourse = (code) => {
    setAssignedCourses(assignedCourses.filter((c) => c !== code));
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      setFormError("Please enter the instructor name.");
      return;
    }
    onSave({
      ...(existing ?? {}),
      name: name.trim(),
      department: dept || null,
      availability: availability.trim() || null,
      courses: assignedCourses,
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

          {/* Assigned Subjects */}
          <div>
            <label style={labelStyle}>📚 Assigned Subjects</label>
            {/* Current assignments */}
            {assignedCourses.length > 0 ? (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  marginBottom: 8,
                }}
              >
                {assignedCourses.map((code) => (
                  <span
                    key={code}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      background: "rgba(47,129,247,0.15)",
                      border: "1px solid var(--accent)",
                      borderRadius: 20,
                      padding: "3px 10px",
                      fontSize: 12,
                      color: "var(--accent)",
                      fontWeight: 600,
                    }}
                  >
                    {code}
                    <button
                      onClick={() => removeCourse(code)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--red)",
                        fontSize: 13,
                        lineHeight: 1,
                        padding: "0 0 0 2px",
                      }}
                      title="Remove subject"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <div
                style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}
              >
                No subjects assigned yet.
              </div>
            )}

            {/* Add subject search */}
            <div style={{ position: "relative" }}>
              <input
                className="search-input"
                style={{ width: "100%", boxSizing: "border-box" }}
                placeholder="🔍 Search and add a subject..."
                value={courseSearch}
                onChange={(e) => setCourseSearch(e.target.value)}
              />
              {courseSearch && filteredCourseOptions.length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: "105%",
                    left: 0,
                    right: 0,
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    zIndex: 200,
                    maxHeight: 160,
                    overflowY: "auto",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
                  }}
                >
                  {filteredCourseOptions.map((opt) => (
                    <div
                      key={opt.value}
                      onClick={() => addCourse(opt.code)}
                      style={{
                        padding: "8px 12px",
                        cursor: "pointer",
                        fontSize: 12,
                        color: "var(--text)",
                        borderBottom: "1px solid var(--border)",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = "var(--surface2)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "transparent")
                      }
                    >
                      {opt.label}
                    </div>
                  ))}
                </div>
              )}
              {courseSearch && filteredCourseOptions.length === 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: "105%",
                    left: 0,
                    right: 0,
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: "10px 12px",
                    fontSize: 12,
                    color: "var(--text3)",
                    zIndex: 200,
                  }}
                >
                  No matching subjects found.
                </div>
              )}
            </div>
          </div>
        </div>

        {formError && (
          <div style={{ color: "var(--red)", fontSize: 12 }}>⚠ {formError}</div>
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
            {isEdit ? "Save Changes" : "+ Add Instructor"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
