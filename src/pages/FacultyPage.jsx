import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { useNotification } from "../context/NotificationContext";
import ConfirmModal from "../components/common/ConfirmModal";
import { InstructorModal } from "../components/modals/InstructorModal";

function exportInstructorSchedule(instructor, scheduleAssignments) {
  const myCourses = scheduleAssignments.filter(
    (a) =>
      a.instructor?.trim().toLowerCase() ===
      instructor.name.trim().toLowerCase(),
  );

  if (myCourses.length === 0) {
    alert(`${instructor.name} has no assigned courses in the schedule yet.`);
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
    "Subject Code,Subject Title,Section,LEC (hrs),LAB (hrs),Days/Time,Room,Total Students",
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
  const { scheduleAssignments } = useData();
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

    const { courses: _courses, ...instructorRow } = instructor;
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

    const { courses: _courses, ...instructorRow } = instructor;
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
              <th>Assigned Courses</th>
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
                    {Array.isArray(inst.courses) && inst.courses.length > 0 ? (
                      inst.courses.join(", ")
                    ) : (
                      <span style={{ color: "var(--text3)" }}>None</span>
                    )}
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
                              `Schedule exported for ${inst.name} ?`,
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
