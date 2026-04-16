import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNotification } from "../context/NotificationContext";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { buildDatabaseErrorMessage } from "../utils/errorUtils";
import { SubjectModal } from "../components/modals/SubjectModal";
import ConfirmModal from "../components/common/ConfirmModal";

const CURRENT_ACADEMIC_YEAR =
  import.meta.env.VITE_ACTIVE_ACADEMIC_YEAR ?? "2025-2026";
const CURRENT_SEMESTER = import.meta.env.VITE_ACTIVE_SEMESTER ?? "2nd";
const PAGE_SIZE = 15;

export default function SubjectsPage() {
  const { showNotification } = useNotification();
  const { isAdmin } = useAuth();
  const { isBootstrapping, isGenerationInProgress } = useData();

  const notifyDbError = useCallback(
    (error, operation, entity = "subject") => {
      const { userMessage } = buildDatabaseErrorMessage(error, {
        operation,
        entity,
      });
      showNotification(`⚠ ${userMessage}`);
    },
    [showNotification],
  );

  const [subjects, setSubjects] = useState([]);
  const [sectionsBySubjectId, setSectionsBySubjectId] = useState({});
  const [instructors, setInstructors] = useState([]);
  const [instructorIdsBySubjectId, setInstructorIdsBySubjectId] = useState({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editSubject, setEditSubject] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Search & pagination
  const [search, setSearch] = useState("");
  const [programFilter, setProgramFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [page, setPage] = useState(1);

  // ============================================================
  // FETCH
  // ============================================================
  const fetchSubjects = useCallback(async () => {
    try {
      const [
        { data: subjectRows, error: subjectError },
        { data: sectionRows, error: sectionError },
        { data: instructorRows, error: instructorError },
        { data: instructorSubjectRows, error: instructorSubjectError },
      ] = await Promise.all([
        supabase
          .from("subjects")
          .select("id, code, title, program, year, room_type, duration")
          .order("code"),
        supabase
          .from("subject_sections")
          .select(
            "id, subject_id, section, enrolled, status, academic_year, semester",
          )
          .eq("academic_year", CURRENT_ACADEMIC_YEAR)
          .eq("semester", CURRENT_SEMESTER),
        supabase.from("instructors").select("id, name").order("name"),
        supabase
          .from("instructor_subject_sections")
          .select("instructor_id, section_id")
          .eq("academic_year", CURRENT_ACADEMIC_YEAR)
          .eq("semester", CURRENT_SEMESTER),
      ]);

      if (subjectError) {
        console.error(subjectError);
        showNotification("⚠ Unable to load subject catalog.");
        return;
      }

      if (sectionError) {
        console.warn("Section load failed", sectionError);
        showNotification(
          `⚠ Subject sections could not be loaded for ${CURRENT_ACADEMIC_YEAR} ${CURRENT_SEMESTER}. Showing subject catalog only.`,
        );
      }

      if (instructorError) {
        console.warn("Instructor load failed", instructorError);
        showNotification("⚠ Instructor list could not be fully loaded.");
      }

      if (instructorSubjectError) {
        console.warn(
          "Instructor-subject-section load failed",
          instructorSubjectError,
        );
      }

      const sectionMap = (sectionRows ?? []).reduce((acc, row) => {
        const subjectId = String(row.subject_id ?? "").trim();
        if (!subjectId) return acc;
        if (!acc[subjectId]) acc[subjectId] = [];
        acc[subjectId].push(row);
        return acc;
      }, {});

      const sectionSubjectIdBySectionId = new Map(
        (sectionRows ?? []).map((row) => [
          String(row.id ?? "").trim(),
          String(row.subject_id ?? "").trim(),
        ]),
      );

      const instructorIdSetBySubjectId = new Map();
      (instructorSubjectRows ?? []).forEach((row) => {
        const instructorId = String(row.instructor_id ?? "").trim();
        const sectionId = String(row.section_id ?? "").trim();
        if (!instructorId || !sectionId) return;

        const subjectId = sectionSubjectIdBySectionId.get(sectionId);
        if (!subjectId) return;

        const ids = instructorIdSetBySubjectId.get(subjectId) ?? new Set();
        ids.add(instructorId);
        instructorIdSetBySubjectId.set(subjectId, ids);
      });

      const instructorIdsMap = {};
      instructorIdSetBySubjectId.forEach((ids, subjectId) => {
        instructorIdsMap[subjectId] = Array.from(ids);
      });

      setSubjects(subjectRows ?? []);
      setSectionsBySubjectId(sectionError ? {} : sectionMap);
      setInstructors(instructorRows ?? []);
      setInstructorIdsBySubjectId(
        instructorSubjectError ? {} : instructorIdsMap,
      );
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  const subjectCatalogRows = useMemo(() => {
    return subjects.map((subject) => {
      const subjectId = String(subject.id ?? "").trim();
      const sections = sectionsBySubjectId[subjectId] ?? [];
      const instructorIds = instructorIdsBySubjectId[subjectId] ?? [];

      return {
        ...subject,
        sections,
        instructorIds,
      };
    });
  }, [subjects, sectionsBySubjectId, instructorIdsBySubjectId]);

  // ============================================================
  // SHARED RPC HELPER
  // ============================================================
  async function callManageSubject(
    operation,
    subjectPayload = {},
    existingSubjectId = null,
  ) {
    if (!isAdmin) {
      showNotification("Admin access required for this action.");
      return false;
    }

    const { error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      notifyDbError(refreshError, "refresh", "session");
      return false;
    }

    const normalizedSections = (subjectPayload?.sections ?? [])
      .map((s) => ({
        section: String(s?.section ?? "")
          .trim()
          .toUpperCase(),
        enrolled: Math.max(1, Number(s?.enrolled ?? 1)),
        status: s?.status === "Assigned" ? "Assigned" : "Not Assigned",
      }))
      .filter((s) => s.section);

    // Client-side duplicate section check
    if (operation !== "DELETE") {
      const seenSections = new Set();
      for (const row of normalizedSections) {
        if (seenSections.has(row.section)) {
          showNotification(`⚠ Duplicate section: ${row.section}`);
          return false;
        }
        seenSections.add(row.section);
      }
    }

    // NOTE: p_instructor_ids is no longer supported by manage_subject RPC
    // Instructor assignment requires time_start/time_end which are provided only in schedule assignment workflow
    // The RPC now handles subject CRUD only (code, title, sections, etc)
    const { data, error } = await supabase.rpc("manage_subject", {
      p_operation: operation,
      p_subject_id: existingSubjectId ?? null,
      p_code: subjectPayload?.code ?? null,
      p_title: subjectPayload?.title ?? null,
      p_program: subjectPayload?.program ?? null,
      p_year: subjectPayload?.year ?? null,
      p_room_type: subjectPayload?.room_type ?? null,
      p_duration: subjectPayload?.duration ?? 1.5,
      p_sections: normalizedSections,
      p_instructor_ids: [], // Empty: instructors assigned only via schedule workflow
      p_academic_year: CURRENT_ACADEMIC_YEAR,
      p_semester: CURRENT_SEMESTER,
    });

    // Supabase-level error (network, auth, RLS)
    if (error) {
      notifyDbError(error, operation.toLowerCase());

      return false;
    }

    // RPC-level validation error: { success: false, error: "..." }
    if (data?.success === false) {
      showNotification(`⚠ ${data.error}`);
      return false;
    }

    await fetchSubjects();
    return true;
  }

  // ============================================================
  // HANDLERS
  // ============================================================
  async function handleSave(subjectPayload) {
    const operation = editSubject ? "UPDATE" : "INSERT";
    const ok = await callManageSubject(
      operation,
      subjectPayload,
      editSubject?.id ?? null,
    );

    if (ok) {
      showNotification(editSubject ? "Subject updated." : "Subject added.");
      setShowModal(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;

    const sectionCount = sectionsBySubjectId[deleteTarget.id]?.length ?? 0;
    const ok = await callManageSubject("DELETE", {}, deleteTarget.id);

    if (ok) {
      showNotification(
        `Subject ${deleteTarget.code} deleted. ${sectionCount} section(s) removed.`,
      );
      setDeleteTarget(null);
    }
  }

  // ============================================================
  // RENDER
  // ============================================================
  if (loading || isBootstrapping || isGenerationInProgress) {
    return <div className="page-container">Loading subjects...</div>;
  }

  // --- Filtering & Pagination ---
  const uniquePrograms = [
    ...new Set(subjectCatalogRows.map((s) => s.program).filter(Boolean)),
  ].sort();
  const uniqueYears = [
    ...new Set(subjectCatalogRows.map((s) => s.year).filter(Boolean)),
  ].sort();

  const filtered = subjectCatalogRows.filter((s) => {
    const q = search.trim().toLowerCase();
    const sectionTokens = (s.sections ?? []).map((sectionRow) =>
      String(sectionRow.section ?? "").toLowerCase(),
    );
    const matchSearch =
      !q ||
      s.code.toLowerCase().includes(q) ||
      s.title.toLowerCase().includes(q) ||
      sectionTokens.some((sectionCode) => sectionCode.includes(q));
    const matchProgram = !programFilter || s.program === programFilter;
    const matchYear = !yearFilter || s.year === yearFilter;
    return matchSearch && matchProgram && matchYear;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  const deleteTargetSectionCount = deleteTarget?.sections?.length ?? 0;

  return (
    <div className="page-container">
      <div className="section-header">
        <div>
          <div className="section-title">Subject Catalog</div>
          <div className="section-subtitle">AY 2025–2026</div>
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
            placeholder="Search code or title…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            style={{ width: 220 }}
          />
          <select
            className="search-input"
            style={{ width: 130 }}
            value={programFilter || "All Programs"}
            onChange={(e) => {
              setProgramFilter(
                e.target.value === "All Programs" ? "" : e.target.value,
              );
              setPage(1);
            }}
          >
            <option>All Programs</option>
            {uniquePrograms.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <select
            className="search-input"
            style={{ width: 120 }}
            value={yearFilter || "All Years"}
            onChange={(e) => {
              setYearFilter(
                e.target.value === "All Years" ? "" : e.target.value,
              );
              setPage(1);
            }}
          >
            <option>All Years</option>
            {uniqueYears.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          {isAdmin && (
            <button
              className="btn btn-primary"
              onClick={() => {
                setEditSubject(null);
                setShowModal(true);
              }}
            >
              + Add Subject
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <table className="subject-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Title</th>
              <th>Program</th>
              <th>Year</th>
              <th>Room Type</th>
              <th>Sections</th>
              <th>Instructors</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {subjectCatalogRows.length === 0 ? (
              <tr>
                <td colSpan="8" className="empty-table">
                  There are no subjects yet. Click{" "}
                  <strong>"Add Subject"</strong> to add one.
                </td>
              </tr>
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan="8" className="empty-table">
                  No subjects match your search.
                </td>
              </tr>
            ) : (
              paginated.map((subjectRow) => (
                <tr key={subjectRow.id}>
                  <td>{subjectRow.code}</td>
                  <td>{subjectRow.title}</td>
                  <td>{subjectRow.program}</td>
                  <td>{subjectRow.year}</td>
                  <td>{subjectRow.room_type}</td>
                  <td>
                    {subjectRow.sections.length > 0
                      ? subjectRow.sections
                          .map(
                            (sectionRow) =>
                              `${sectionRow.section} (${sectionRow.enrolled})`,
                          )
                          .join(", ")
                      : "0"}
                  </td>
                  <td>{subjectRow.instructorIds.length}</td>
                  <td className="actions">
                    {isAdmin && (
                      <>
                        <button
                          className="btn btn-secondary"
                          onClick={() => {
                            setEditSubject(subjectRow);
                            setShowModal(true);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-danger"
                          onClick={() => setDeleteTarget(subjectRow)}
                        >
                          Delete
                        </button>
                      </>
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
              {filtered.length} subjects
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
        <SubjectModal
          subjects={subjectCatalogRows}
          existing={editSubject}
          existingSections={editSubject?.sections ?? []}
          instructors={instructors}
          existingInstructorIds={editSubject?.instructorIds ?? []}
          currentAcademicYear={CURRENT_ACADEMIC_YEAR}
          currentSemester={CURRENT_SEMESTER}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
        />
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        title="🗑 Delete Subject"
        message={`Are you sure you want to delete ${deleteTarget?.code}? This will also remove ${deleteTargetSectionCount} section(s) for AY ${CURRENT_ACADEMIC_YEAR} ${CURRENT_SEMESTER} and cannot be undone.`}
        confirmLabel="🗑 Yes, Delete"
        danger
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
