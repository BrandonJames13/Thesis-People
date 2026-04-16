import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { useNotification } from "../context/NotificationContext";
import { buildDatabaseErrorMessage } from "../utils/errorUtils";
import ConfirmModal from "../components/common/ConfirmModal";
import { InstructorModal } from "../components/modals/InstructorModal";

const PAGE_SIZE = 10;

function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

// Update buildInstructorPayload to include new fields
function buildInstructorPayload(instructor) {
  const status = String(instructor?.status ?? "").trim();
  return {
    name: String(instructor?.name ?? "").trim(),
    department: instructor?.department || null,
    availability: String(instructor?.availability ?? "").trim() || null,
    status: status || null,
    employment_status: instructor?.employment_status ?? [],
    max_units: instructor?.max_units ?? null,
    allow_night_class: instructor?.allow_night_class ?? false,
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
  const assignedSections = scheduleAssignments.filter(
    (a) =>
      a.status === "Assigned" && getAssignmentInstructorMatch(a, instructor),
  );

  if (assignedSections.length === 0) {
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
  assignedSections.forEach((assignment) => {
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
  const {
    scheduleAssignments,
    getInstructorLoad,
    isBootstrapping,
    isGenerationInProgress,
  } = useData();
  const { showNotification } = useNotification();

  const notifyDbError = useCallback(
    (error, operation, entity = "instructor") => {
      const { userMessage } = buildDatabaseErrorMessage(error, {
        operation,
        entity,
      });
      showNotification(`⚠ ${userMessage}`);
    },
    [showNotification],
  );

  const [instructors, setInstructors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editInstructor, setEditInstructor] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Search & pagination
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  const fetchInstructors = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("instructors")
        .select("*")
        .order("name");

      if (error) {
        console.error(error);
        notifyDbError(error, "load", "instructors");
        return;
      }

      setInstructors(data ?? []);
    } finally {
      setLoading(false);
    }
  }, [notifyDbError]);

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
      notifyDbError(error, "create");
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
      notifyDbError(error, "update");
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
      notifyDbError(error, "delete");
      return;
    }

    setInstructors((current) =>
      current.filter((item) => item.id !== deleteTarget.id),
    );
    showNotification(`${deleteTarget.name} removed.`);
    setDeleteTarget(null);
  }

  // --- Filtering ---
  const filtered = instructors.filter((inst) => {
    const q = search.trim().toLowerCase();
    const matchSearch =
      !q ||
      inst.name.toLowerCase().includes(q) ||
      (inst.department ?? "").toLowerCase().includes(q);
    const matchDept = !deptFilter || inst.department === deptFilter;
    const matchStatus =
      !statusFilter ||
      String(inst.status ?? "").toLowerCase() === statusFilter.toLowerCase();
    return matchSearch && matchDept && matchStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  const handleSearch = (val) => {
    setSearch(val);
    setPage(1);
  };
  const handleDeptFilter = (val) => {
    setDeptFilter(val);
    setPage(1);
  };
  const handleStatusFilter = (val) => {
    setStatusFilter(val);
    setPage(1);
  };

  if (loading || isBootstrapping || isGenerationInProgress) {
    return <div className="page-container">Loading instructors...</div>;
  }

  return (
    <div className="page-container">
      <div className="section-header">
        <div>
          <div className="section-title">Faculty Management</div>
          <div className="section-subtitle">
            Teaching load &amp; availability tracking
          </div>
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <input
            className="search-input"
            type="text"
            placeholder="Search by name or dept…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            style={{ width: 220 }}
          />
          <select
            className="search-input"
            style={{ width: 130 }}
            value={deptFilter || "All Depts"}
            onChange={(e) =>
              handleDeptFilter(
                e.target.value === "All Depts" ? "" : e.target.value,
              )
            }
          >
            <option>All Depts</option>
            <option value="CS">CS</option>
            <option value="IT">IT</option>
            <option value="IS">IS</option>
          </select>
          <select
            className="search-input"
            style={{ width: 130 }}
            value={statusFilter || "All Status"}
            onChange={(e) =>
              handleStatusFilter(
                e.target.value === "All Status" ? "" : e.target.value,
              )
            }
          >
            <option>All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
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
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Instructor</th>
              <th>Employment</th>
              <th>Scheduled Load</th>
              <th>Max Units</th>
              <th>Department</th>
              <th>Availability</th>
              <th>Night Class</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={9} className="empty-table">
                  No instructors yet. Click <strong>"Add Instructor"</strong>
                  to add one.
                </td>
              </tr>
            ) : (
              paginated.map((inst) => (
                <tr key={inst.id}>
                  <td>
                    <strong>{inst.name}</strong>
                  </td>

                  {/* Employment Status — render as pills */}
                  <td>
                    {(inst.employment_status ?? []).length > 0 ? (
                      <div
                        style={{ display: "flex", gap: 4, flexWrap: "wrap" }}
                      >
                        {inst.employment_status.map((es) => (
                          <span
                            key={es}
                            className="pill pill-blue"
                            style={{ fontSize: 10 }}
                          >
                            {es}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ color: "var(--text3)", fontSize: 12 }}>
                        —
                      </span>
                    )}
                  </td>

                  {/* Scheduled Load — sourced entirely from getInstructorLoad */}
                  <td className="monospace" style={{ fontSize: 12 }}>
                    {(() => {
                      const counts = getInstructorLoad(inst);
                      if (counts.sectionCount === 0) {
                        return (
                          <span style={{ color: "var(--text3)" }}>
                            No scheduled sections
                          </span>
                        );
                      }
                      return `${counts.subjectCount} subject${counts.subjectCount === 1 ? "" : "s"} / ${counts.sectionCount} section${counts.sectionCount === 1 ? "" : "s"} (${counts.totalHours.toFixed(1)} hrs/wk)`;
                    })()}
                  </td>

                  <td>{inst.max_units ?? "—"}</td>
                  <td>{inst.department || "TBD"}</td>
                  <td style={{ fontSize: 12 }}>{inst.availability || "TBD"}</td>
                  <td>
                    {(() => {
                      if (inst.allow_night_class === true) return "Yes";
                      if (inst.allow_night_class === false) return "No";
                      const value = String(inst.allow_night_class ?? "").trim();
                      return value || "—";
                    })()}
                  </td>
                  <td>
                    {(() => {
                      const statusLabel = String(inst.status ?? "").trim();
                      const pillTone =
                        statusLabel.toLowerCase() === "active"
                          ? "green"
                          : statusLabel
                            ? "red"
                            : "orange";
                      return (
                        <span className={`pill pill-${pillTone}`}>
                          {statusLabel || "Unspecified"}
                        </span>
                      );
                    })()}
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 16px",
              borderTop: "1px solid var(--border)",
            }}
          >
            <span style={{ fontSize: 12, color: "var(--text3)" }}>
              Showing {(safePage - 1) * PAGE_SIZE + 1}–
              {Math.min(safePage * PAGE_SIZE, filtered.length)} of{" "}
              {filtered.length} instructors
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                className="btn btn-secondary"
                style={{ padding: "4px 10px", fontSize: 12 }}
                onClick={() => setPage(1)}
                disabled={safePage === 1}
              >
                «
              </button>
              <button
                className="btn btn-secondary"
                style={{ padding: "4px 10px", fontSize: 12 }}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
              >
                ‹
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(
                  (p) =>
                    p === 1 || p === totalPages || Math.abs(p - safePage) <= 1,
                )
                .reduce((acc, p, i, arr) => {
                  if (i > 0 && p - arr[i - 1] > 1) acc.push("...");
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  p === "..." ? (
                    <span
                      key={`ellipsis-${i}`}
                      style={{
                        padding: "4px 6px",
                        fontSize: 12,
                        color: "var(--text3)",
                      }}
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      className={
                        p === safePage ? "btn btn-primary" : "btn btn-secondary"
                      }
                      style={{
                        padding: "4px 10px",
                        fontSize: 12,
                        minWidth: 32,
                      }}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </button>
                  ),
                )}
              <button
                className="btn btn-secondary"
                style={{ padding: "4px 10px", fontSize: 12 }}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
              >
                ›
              </button>
              <button
                className="btn btn-secondary"
                style={{ padding: "4px 10px", fontSize: 12 }}
                onClick={() => setPage(totalPages)}
                disabled={safePage === totalPages}
              >
                »
              </button>
            </div>
          </div>
        )}
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
        title="🗑 Delete Instructor"
        message={`Are you sure you want to delete ${deleteTarget?.name}? This cannot be undone.`}
        confirmLabel="🗑 Yes, Delete"
        danger
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}