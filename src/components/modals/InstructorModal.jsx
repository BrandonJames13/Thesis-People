import { useState } from "react";
import Modal from "../common/Modal";

const EMPLOYMENT_STATUS_OPTIONS = [
  { value: "permanent", label: "Permanent" },
  { value: "fulltime", label: "Full-time" },
  { value: "attached", label: "Attached" },
  { value: "lecturer", label: "Lecturer" },
];

export function InstructorModal({ existing, onClose, onSave }) {
  const [name, setName] = useState(existing?.name ?? "");
  const [dept, setDept] = useState(existing?.department ?? "");
  const [availability, setAvailability] = useState(existing?.availability ?? "");
  const [status, setStatus] = useState(
    existing ? String(existing?.status ?? "") : "Active"
  );
  const [employmentStatus, setEmploymentStatus] = useState(
    existing?.employment_status ?? []
  );
  const [maxUnits, setMaxUnits] = useState(existing?.max_units ?? "");
  const [allowNightClass, setAllowNightClass] = useState(
    existing?.allow_night_class ?? false
  );
  const [formError, setFormError] = useState("");

  const isEdit = !!existing;

  const isPermanent = employmentStatus.includes("permanent");

  function toggleEmploymentStatus(value) {
    setEmploymentStatus((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
    );
    // auto-uncheck night class if permanent is being removed
    if (value === "permanent" && employmentStatus.includes("permanent")) {
      setAllowNightClass(false);
    }
    setFormError("");
  }

  const handleSubmit = () => {
    setFormError("");

    if (!name.trim()) {
      setFormError("Please enter the instructor name.");
      return;
    }

    if (allowNightClass && !isPermanent) {
      setFormError("Night class is only allowed for permanent instructors.");
      return;
    }

    let parsedMaxUnits = null;
    if (maxUnits !== "") {
      const parsed = Number(maxUnits);
      if (!Number.isFinite(parsed) || parsed < 1) {
        setFormError("Max units must be a whole number of at least 1.");
        return;
      }
      parsedMaxUnits = parsed;
    }

    onSave({
      name: name.trim(),
      department: dept || null,
      availability: availability.trim() || null,
      status: String(status ?? "").trim() || null,
      employment_status: employmentStatus,
      max_units: parsedMaxUnits,
      allow_night_class: allowNightClass,
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
    <Modal isOpen={true} onClose={onClose} size="md">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
          {isEdit ? "✏ Edit Instructor" : "+ Add New Instructor"}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Name */}
          <div>
            <label style={labelStyle}>Full Name *</label>
            <input
              className="search-input"
              type="text"
              placeholder="e.g. Reyes, A."
              style={{ width: "100%", boxSizing: "border-box" }}
              value={name}
              onChange={(e) => { setName(e.target.value); setFormError(""); }}
            />
          </div>

          {/* Department */}
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

          {/* Employment Status — multi-select checkboxes */}
          <div>
            <label style={labelStyle}>Employment Status</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {EMPLOYMENT_STATUS_OPTIONS.map((opt) => {
                const isChecked = employmentStatus.includes(opt.value);
                return (
                  <label
                    key={opt.value}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 13,
                      cursor: "pointer",
                      padding: "5px 10px",
                      borderRadius: "var(--border-radius-md, 6px)",
                      border: `1px solid ${isChecked ? "var(--accent)" : "var(--border)"}`,
                      background: isChecked
                        ? "var(--accent-soft, rgba(47,129,247,0.1))"
                        : "var(--surface2)",
                      color: "var(--text)",
                      userSelect: "none",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleEmploymentStatus(opt.value)}
                      style={{ margin: 0 }}
                    />
                    {opt.label}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Max Units + Night Class — side by side */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Max Units</label>
              <input
                className="search-input"
                type="number"
                min={1}
                placeholder="e.g. 21"
                style={{ width: "100%", boxSizing: "border-box" }}
                value={maxUnits}
                onChange={(e) => setMaxUnits(e.target.value)}
              />
            </div>

            <div>
              <label style={labelStyle}>Night Class</label>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                  cursor: isPermanent ? "pointer" : "not-allowed",
                  opacity: isPermanent ? 1 : 0.45,
                  height: 36,
                }}
              >
                <input
                  type="checkbox"
                  checked={allowNightClass}
                  disabled={!isPermanent}
                  onChange={(e) => setAllowNightClass(e.target.checked)}
                />
                Allow night class
              </label>
              {!isPermanent && (
                <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>
                  Permanent only
                </div>
              )}
            </div>
          </div>

          {/* Availability */}
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

          {/* Status */}
          <div>
            <label style={labelStyle}>Status</label>
            <select
              className="search-input"
              style={{ width: "100%", boxSizing: "border-box" }}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Unspecified</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>

        {formError && (
          <div style={{ color: "var(--red)", fontSize: 12 }}>⚠ {formError}</div>
        )}

        <div style={{
          display: "flex",
          gap: 10,
          justifyContent: "flex-end",
          borderTop: "1px solid var(--border)",
          paddingTop: 16,
        }}>
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