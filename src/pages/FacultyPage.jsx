import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { useNotification } from "../context/NotificationContext";
import ConfirmModal from "../components/common/ConfirmModal";
import { InstructorModal } from "../components/modals/InstructorModal";

function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function buildInstructorPayload(instructor) {
  return {
    name: String(instructor?.name ?? "").trim(),
    department: instructor?.department || null,
    availability: String(instructor?.availability ?? "").trim() || null,
    status: instructor?.status || "Active",
  };
}

function getAssignmentInstructorMatch(assignment, instructor) {
  const assignmentInstructorId = String(
    assignment?.instructor_id ?? assignment?.instructorId ?? "",
  ).trim();
  const instructorId = String(instructor?.id ?? "").trim();

  if (assignmentInstructorId && instructorId) {
    return assignmentInstructorId === instructorId;
  }

  return (
    normalizeText(assignment?.instructor ?? assignment?.instructor_name) ===
    normalizeText(instructor?.name)
  );
}

function getAssignmentSubjectKey(assignment) {
  const subjectId = String(
    assignment?.subject_id ?? assignment?.subjectId ?? "",
  ).trim();
  if (subjectId) return `id:${subjectId.toLowerCase()}`;

  const code = String(
    assignment?.course_code ??
      assignment?.subject_code ??
      assignment?.code ??
      "",
  )
    .trim()
    .toUpperCase();
  return code ? `code:${code}` : "";
}

function getAssignmentSectionKey(assignment) {
  const sectionId = String(
    assignment?.section_id ?? assignment?.sectionId ?? "",
  ).trim();
  if (sectionId) return `id:${sectionId.toLowerCase()}`;

  const code = String(
    assignment?.course_code ??
      assignment?.subject_code ??
      assignment?.code ??
      "",
  )
    .trim()
    .toUpperCase();
  const section = String(assignment?.section ?? "").trim() || "A";
  const academicYear = String(
    assignment?.academic_year ?? assignment?.academicYear ?? "",
  ).trim();
  const semester = String(assignment?.semester ?? "").trim();

  if (code) {
    return `compound:${code}|${section}|${academicYear}|${semester}`.toLowerCase();
  }

  const assignmentId = String(
    assignment?.assignment_id ??
      assignment?.assignmentId ??
      assignment?.id ??
      "",
  ).trim();
  if (assignmentId) return `assignment:${assignmentId.toLowerCase()}`;

  return "";
}

function getAssignmentExportRow(assignment) {
  const code = String(
    assignment?.course_code ??
      assignment?.subject_code ??
      assignment?.code ??
      "",
  )
    .trim()
    .toUpperCase();
  const title = String(
    assignment?.course_title ?? assignment?.title ?? "",
  ).trim();
  const section = String(assignment?.section ?? "").trim() || "A";
  const sectionId = String(
    assignment?.section_id ?? assignment?.sectionId ?? "",
  ).trim();
  const roomType = String(
    assignment?.room_type ?? assignment?.roomType ?? "",
  ).trim();
  const duration = Number(assignment?.duration ?? 1.5) || 1.5;
  const room = String(assignment?.room_number ?? assignment?.room ?? "").trim();
  const time = String(
    assignment?.time_display ?? assignment?.time ?? "",
  ).trim();
  const enrolled = Number(assignment?.enrolled ?? 0) || 0;

  return {
    code,
    title,
    section,
    sectionId,
    roomType,
    duration,
    room,
    time,
    enrolled,
  };
}

function exportInstructorSchedule(instructor, scheduleAssignments) {
  const myCourses = scheduleAssignments.filter(
    (a) =>
      a.status === "Assigned" && getAssignmentInstructorMatch(a, instructor),
  );

  if (myCourses.length === 0) {
    alert(
      `${instructor.name} has no assigned subject sections in the schedule yet.`,
    );
    return;
  }

  const lines = [];
  lines.push("TARLAC STATE UNIVERSITY");
  lines.push("FACULTY SCHEDULE & TEACHING LOAD STATISTICS");
  lines.push("AY 2025-2026 1ST SEMESTER");
  lines.push("");
  lines.push(`Faculty Name:,${instructor.name}`);
  lines.push(
    `Department:,${instructor.department || "College of Computer Studies"}`,
  );
  lines.push(`Status:,${instructor.status || "Active"}`);
  lines.push("");
  lines.push(
    "Subject Code,Subject Title,Section,Section ID,LEC (hrs),LAB (hrs),Days/Time,Room,Total Students",
  );

  let totalLec = 0;
  let totalLab = 0;
  let totalStudents = 0;

  const seenSections = new Set();
  myCourses.forEach((assignment) => {
    const sectionKey = getAssignmentSectionKey(assignment);
    if (!sectionKey || seenSections.has(sectionKey)) {
      return;
    }
    seenSections.add(sectionKey);

    const c = getAssignmentExportRow(assignment);
    const isLab = c.roomType === "Lab" || c.roomType === "Computer Lab";
    const lec = isLab ? 0 : c.duration;
    const lab = isLab ? c.duration : 0;
    totalLec += lec;
    totalLab += lab;
    totalStudents += c.enrolled;

    lines.push(
      `${c.code},${c.title},${c.section},${c.sectionId},${lec.toFixed(2)},${lab.toFixed(2)},"${c.time}","${c.room}",${c.enrolled}`,
    );
  });

  lines.push("");
  lines.push(
    `TOTAL,,,,${totalLec.toFixed(1)},${totalLab.toFixed(1)},,${totalStudents}`,
  );
  lines.push("");
  lines.push(`Total Lecture Hours per week:,${totalLec.toFixed(2)}`);
  lines.push(`Total Laboratory Hours per week:,${totalLab.toFixed(2)}`);
  lines.push("");
  lines.push("I certify the correctness of the above report.");
  lines.push("");
  lines.push(`,${instructor.name}`);
  lines.push(",Faculty");

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
  const { isAdmin } = useAuth();
  const { scheduleAssignments, getInstructorLoad } = useData();
  const { showNotification } = useNotification();

  const [instructors, setInstructors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editInstructor, setEditInstructor] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchInstructors = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("instructors")
        .select("*")
        .order("name");

      if (error) {
        console.error(error);
        showNotification(`⚠ ${error.message}`);
        return;
      }

      setInstructors(data ?? []);
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    fetchInstructors();
  }, [fetchInstructors]);

  async function addInstructor(instructor) {
    if (!isAdmin) {
      showNotification("Admin access required for this action.");
      return false;
    }

    const instructorRow = buildInstructorPayload(instructor);
    const { data, error } = await supabase
      .from("instructors")
      .insert([instructorRow])
      .select();

    if (error) {
      showNotification(`⚠ ${error.message}`);
      return false;
    }

    setInstructors((current) => [...current, ...(data ?? [])]);
    return true;
  }

  async function updateInstructor(id, instructor) {
    if (!isAdmin) {
      showNotification("Admin access required for this action.");
      return false;
    }

    const instructorRow = buildInstructorPayload(instructor);
    const { data, error } = await supabase
      .from("instructors")
      .update(instructorRow)
      .eq("id", id)
      .select();

    if (error) {
      showNotification(`⚠ ${error.message}`);
      return false;
    }

    setInstructors((current) =>
      current.map((item) => (item.id === id ? (data?.[0] ?? item) : item)),
    );
    return true;
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;

    if (!isAdmin) {
      showNotification("Admin access required for this action.");
      return;
    }

    const { error } = await supabase
      .from("instructors")
      .delete()
      .eq("id", deleteTarget.id);

    if (error) {
      showNotification(`⚠ ${error.message}`);
      return;
    }

    setInstructors((current) =>
      current.filter((item) => item.id !== deleteTarget.id),
    );
    showNotification(`${deleteTarget.name} removed.`);
    setDeleteTarget(null);
  }

  if (loading) {
    return <div className="page-container">Loading instructors...</div>;
  }

  return (
    <div className="page-container">
      <div className="section-header">
        <div>
          <div className="section-title">Faculty Management</div>
          <div className="section-subtitle">
            Teaching load & availability tracking
          </div>
        </div>
        {isAdmin && (
          <button
            className="btn btn-primary"
            onClick={() => {
              setEditInstructor(null);
              setShowModal(true);
            }}
          >
            + Add Instructor
          </button>
        )}
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Instructor</th>
              <th>Assigned Subjects / Sections</th>
              <th>Department</th>
              <th>Availability</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {instructors.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty-table">
                  No instructors yet. Click <strong>"Add Instructor"</strong>
                  to add one.
                </td>
              </tr>
            ) : (
              instructors.map((inst) => (
                <tr key={inst.id}>
                  <td>
                    <strong>{inst.name}</strong>
                  </td>
                  <td className="monospace" style={{ fontSize: 12 }}>
                    {(() => {
                      const counts = getInstructorLoad(inst);
                      if (
                        counts.subjectCount === 0 &&
                        counts.sectionCount === 0
                      ) {
                        return (
                          <span style={{ color: "var(--text3)" }}>
                            None assigned
                          </span>
                        );
                      }

                      return `${counts.subjectCount} subject${counts.subjectCount === 1 ? "" : "s"} / ${counts.sectionCount} section${counts.sectionCount === 1 ? "" : "s"}`;
                    })()}
                  </td>
                  <td>{inst.department || "TBD"}</td>
                  <td style={{ fontSize: 12 }}>{inst.availability || "TBD"}</td>
                  <td>
                    <span
                      className={`pill pill-${inst.status === "Active" ? "green" : "red"}`}
                    >
                      {inst.status}
                    </span>
                  </td>
                  <td>
                    {isAdmin && (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          className="btn btn-secondary"
                          onClick={() => {
                            setEditInstructor(inst);
                            setShowModal(true);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-secondary"
                          onClick={() => {
                            exportInstructorSchedule(inst, scheduleAssignments);
                            showNotification(
                              `Schedule exported for ${inst.name}.`,
                            );
                          }}
                          title="Export this instructor's schedule"
                        >
                          Export
                        </button>
                        <button
                          className="btn btn-danger"
                          onClick={() => setDeleteTarget(inst)}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && isAdmin && (
        <InstructorModal
          existing={editInstructor}
          onClose={() => setShowModal(false)}
          onSave={async (inst) => {
            const saved = editInstructor
              ? await updateInstructor(editInstructor.id, inst)
              : await addInstructor(inst);

            if (!saved) return;

            showNotification(
              editInstructor
                ? `${inst.name} updated!`
                : "Instructor added successfully!",
            );
            setShowModal(false);
          }}
        />
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        title="?? Delete Instructor"
        message={`Are you sure you want to delete ${deleteTarget?.name}? This cannot be undone.`}
        confirmLabel="?? Yes, Delete"
        danger
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
