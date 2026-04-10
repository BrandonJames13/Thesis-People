import { useMemo, useState } from "react";
import Modal from "../common/Modal";
import { PROGRAM_CODES } from "../../data/constants";

function normalizeSectionLabel(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

function buildSectionDraft(section, currentAcademicYear, currentSemester) {
  return {
    id: String(section?.id ?? "").trim() || null,
    section: normalizeSectionLabel(section?.section),
    enrolled: String(Number(section?.enrolled ?? 1)),
    status: section?.status === "Assigned" ? "Assigned" : "Not Assigned",
    academic_year: String(
      section?.academic_year ?? section?.academicYear ?? currentAcademicYear,
    ).trim(),
    semester: String(section?.semester ?? currentSemester).trim(),
  };
}

export function CourseModal({
  subjects,
  existing,
  existingSections = [],
  instructors = [],
  existingInstructorIds = [],
  currentAcademicYear,
  currentSemester,
  onClose,
  onSave,
}) {
  const [code, setCode] = useState(existing?.code ?? "");
  const [title, setTitle] = useState(existing?.title ?? "");
  const [program, setProgram] = useState(existing?.program ?? "");
  const [year, setYear] = useState(existing?.year ?? "1st");
  const [roomType, setRoomType] = useState(existing?.room_type ?? "Lecture");
  const [sections, setSections] = useState(() => {
    if (existingSections.length > 0) {
      return existingSections.map((row) =>
        buildSectionDraft(row, currentAcademicYear, currentSemester),
      );
    }

    return [buildSectionDraft({}, currentAcademicYear, currentSemester)];
  });
  const [selectedInstructorIds, setSelectedInstructorIds] = useState(() => {
    return Array.from(
      new Set(
        (existingInstructorIds ?? [])
          .map((id) => String(id ?? "").trim())
          .filter(Boolean),
      ),
    );
  });

  const isEdit = !!existing;
  const [formError, setFormError] = useState("");

  const sortedInstructors = useMemo(() => {
    return [...instructors].sort((a, b) =>
      String(a.name ?? "").localeCompare(String(b.name ?? "")),
    );
  }, [instructors]);

  const addSectionRow = () => {
    setSections((prev) => [
      ...prev,
      buildSectionDraft({}, currentAcademicYear, currentSemester),
    ]);
  };

  const removeSectionRow = (index) => {
    setSections((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  };

  const updateSectionRow = (index, field, value) => {
    setSections((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        if (field === "section") {
          return { ...row, section: normalizeSectionLabel(value) };
        }
        if (field === "enrolled") {
          return { ...row, enrolled: value.replace(/[^0-9]/g, "") };
        }
        return { ...row, [field]: value };
      }),
    );
  };

  const toggleInstructor = (id) => {
    const key = String(id ?? "").trim();
    if (!key) return;

    setSelectedInstructorIds((prev) => {
      if (prev.includes(key)) {
        return prev.filter((current) => current !== key);
      }

      return [...prev, key];
    });
  };

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

    const normalizedSections = sections
      .map((row) => ({
        id: row.id,
        section: normalizeSectionLabel(row.section),
        enrolled: Number(row.enrolled || 0),
        status: row.status === "Assigned" ? "Assigned" : "Not Assigned",
        academic_year: row.academic_year || currentAcademicYear,
        semester: row.semester || currentSemester,
      }))
      .filter((row) => row.section);

    if (normalizedSections.length === 0) {
      setFormError("Add at least one valid section assignment.");
      return;
    }

    const seenSectionKeys = new Set();
    for (const row of normalizedSections) {
      const key = `${row.section}|${row.academic_year}|${row.semester}`;
      if (seenSectionKeys.has(key)) {
        setFormError(
          `Duplicate section ${row.section} for ${row.academic_year} ${row.semester}.`,
        );
        return;
      }
      seenSectionKeys.add(key);

      if (!Number.isFinite(row.enrolled) || row.enrolled <= 0) {
        setFormError(
          `Section ${row.section} must have enrolled count above 0.`,
        );
        return;
      }
    }

    const normalizedInstructorIds = Array.from(
      new Set(
        selectedInstructorIds
          .map((id) => String(id ?? "").trim())
          .filter(Boolean),
      ),
    );

    onSave({
      code: c,
      title: t,
      program,
      year,
      room_type: roomType,
      duration: existing?.duration ?? 1.5,
      sections: normalizedSections,
      instructorIds: normalizedInstructorIds,
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

        <div style={{ fontSize: 12, color: "var(--text3)" }}>
          Subject metadata and section/instructor assignments are saved
          together.
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
              {PROGRAM_CODES.map((programCode) => (
                <option key={programCode} value={programCode}>
                  {programCode}
                </option>
              ))}
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

        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 13 }}>
              Section Assignments
            </div>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={addSectionRow}
            >
              + Add Section
            </button>
          </div>

          {sections.map((sectionRow, index) => (
            <div
              key={sectionRow.id || `section-${index}`}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr auto",
                gap: 8,
                alignItems: "end",
              }}
            >
              <div>
                <label style={labelStyle}>Section</label>
                <input
                  className="search-input"
                  value={sectionRow.section}
                  onChange={(e) =>
                    updateSectionRow(index, "section", e.target.value)
                  }
                />
              </div>
              <div>
                <label style={labelStyle}>Enrolled</label>
                <input
                  className="search-input"
                  value={sectionRow.enrolled}
                  onChange={(e) =>
                    updateSectionRow(index, "enrolled", e.target.value)
                  }
                />
              </div>
              <div>
                <label style={labelStyle}>Status</label>
                <select
                  className="search-input"
                  value={sectionRow.status}
                  onChange={(e) =>
                    updateSectionRow(index, "status", e.target.value)
                  }
                >
                  <option value="Not Assigned">Not Assigned</option>
                  <option value="Assigned">Assigned</option>
                </select>
              </div>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => removeSectionRow(index)}
                disabled={sections.length <= 1}
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 13 }}>
            Instructor Assignments
          </div>
          {sortedInstructors.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--text3)" }}>
              No instructors available yet.
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 8,
              }}
            >
              {sortedInstructors.map((inst) => {
                const id = String(inst.id ?? "").trim();
                const checked = selectedInstructorIds.includes(id);
                return (
                  <label
                    key={id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 12,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleInstructor(id)}
                    />
                    <span>{inst.name}</span>
                  </label>
                );
              })}
            </div>
          )}
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
