import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNotification } from "../context/NotificationContext";
import { useAuth } from "../context/AuthContext";
import { CourseModal } from "../components/modals/courseModal";
import ConfirmModal from "../components/common/ConfirmModal";

const CURRENT_ACADEMIC_YEAR = "2025-2026";
const CURRENT_SEMESTER = "2nd";

function formatDbError(error, fallback = "Database request failed") {
  if (!error) {
    return fallback;
  }

  const parts = [error.message, error.details, error.hint].filter(Boolean);
  return parts.join(" | ") || fallback;
}

function isRlsError(error) {
  const message =
    `${error?.message ?? ""} ${error?.details ?? ""}`.toLowerCase();
  return message.includes("row-level security");
}

export default function CoursesPage() {
  const { showNotification } = useNotification();
  const { isAdmin } = useAuth();

  const [subjects, setSubjects] = useState([]);
  const [sectionsBySubjectId, setSectionsBySubjectId] = useState({});
  const [instructors, setInstructors] = useState([]);
  const [instructorIdsBySubjectId, setInstructorIdsBySubjectId] = useState({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editSubject, setEditSubject] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

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
          .from("instructor_subjects")
          .select("subject_id, instructor_id"),
      ]);

      if (subjectError) {
        console.error(subjectError);
        showNotification(
          `⚠ ${formatDbError(subjectError, "Unable to load subject catalog")}`,
        );
        return;
      }

      const sectionMap = (sectionRows ?? []).reduce((acc, sectionRow) => {
        if (!acc[sectionRow.subject_id]) {
          acc[sectionRow.subject_id] = [];
        }

        acc[sectionRow.subject_id].push(sectionRow);
        return acc;
      }, {});

      const instructorMap = (instructorSubjectRows ?? []).reduce((acc, row) => {
        const subjectId = String(row.subject_id ?? "").trim();
        const instructorId = String(row.instructor_id ?? "").trim();
        if (!subjectId || !instructorId) return acc;
        if (!acc[subjectId]) {
          acc[subjectId] = [];
        }

        if (!acc[subjectId].includes(instructorId)) {
          acc[subjectId].push(instructorId);
        }

        return acc;
      }, {});

      if (sectionError) {
        console.warn(
          "Section metadata unavailable for catalog page",
          sectionError,
        );
        showNotification(
          `⚠ Subject sections could not be loaded for ${CURRENT_ACADEMIC_YEAR} ${CURRENT_SEMESTER}. Showing subject catalog only.`,
        );
      }

      if (instructorError || instructorSubjectError) {
        console.warn("Instructor assignment metadata unavailable", {
          instructorError,
          instructorSubjectError,
        });
        showNotification(
          "⚠ Instructor assignments could not be fully loaded. Subject editing is still available.",
        );
      }

      setSubjects(subjectRows ?? []);
      setSectionsBySubjectId(sectionError ? {} : sectionMap);
      setInstructors(instructorRows ?? []);
      setInstructorIdsBySubjectId(
        instructorError || instructorSubjectError ? {} : instructorMap,
      );
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  async function refreshAuthSessionForWrite() {
    const { error } = await supabase.auth.refreshSession();

    if (error) {
      showNotification(
        `⚠ Could not refresh auth session before write: ${error.message}`,
      );
      return false;
    }

    return true;
  }

  function normalizeSectionDraft(section) {
    const sectionName = String(section?.section ?? "")
      .trim()
      .toUpperCase();

    return {
      id: String(section?.id ?? "").trim() || null,
      section: sectionName,
      enrolled: Number(section?.enrolled ?? 0),
      status: section?.status === "Assigned" ? "Assigned" : "Not Assigned",
      academic_year: CURRENT_ACADEMIC_YEAR,
      semester: CURRENT_SEMESTER,
    };
  }

  async function saveSubjectComposite(
    subjectPayload,
    existingSubjectId = null,
  ) {
    if (!isAdmin) {
      showNotification("Admin access required for this action.");
      return false;
    }

    const refreshed = await refreshAuthSessionForWrite();
    if (!refreshed) {
      return false;
    }

    const rawSections = Array.isArray(subjectPayload?.sections)
      ? subjectPayload.sections
      : [];
    const desiredInstructorIds = Array.from(
      new Set(
        (subjectPayload?.instructorIds ?? [])
          .map((id) => String(id ?? "").trim())
          .filter(Boolean),
      ),
    );

    const normalizedSections = rawSections
      .map(normalizeSectionDraft)
      .filter((row) => row.section);

    if (normalizedSections.length === 0) {
      showNotification(
        "⚠ Add at least one section before saving this subject.",
      );
      return false;
    }

    const seenSectionKeys = new Set();
    for (const row of normalizedSections) {
      const key = `${row.section}|${row.academic_year}|${row.semester}`;
      if (seenSectionKeys.has(key)) {
        showNotification(
          `⚠ Duplicate section entry ${row.section} for ${row.academic_year} ${row.semester}.`,
        );
        return false;
      }
      seenSectionKeys.add(key);
    }

    const subjectRow = {
      code: subjectPayload.code,
      title: subjectPayload.title,
      program: subjectPayload.program,
      year: subjectPayload.year,
      room_type: subjectPayload.room_type,
      duration: subjectPayload.duration ?? 1.5,
    };

    const subjectWrite = existingSubjectId
      ? await supabase
          .from("subjects")
          .update(subjectRow)
          .eq("id", existingSubjectId)
          .select()
      : await supabase.from("subjects").insert([subjectRow]).select();

    const { data, error } = subjectWrite;

    if (error) {
      if (isRlsError(error)) {
        showNotification(
          existingSubjectId
            ? "⚠ Update denied by RLS. Please verify subjects UPDATE policy for admin users."
            : "⚠ Insert denied by RLS. Please verify subjects INSERT policy for admin users.",
        );
      }
      showNotification(
        `⚠ ${formatDbError(
          error,
          existingSubjectId
            ? "Unable to update subject"
            : "Unable to add subject",
        )}`,
      );
      return false;
    }

    const targetSubject = data?.[0];
    const targetSubjectId = String(
      targetSubject?.id ?? existingSubjectId ?? "",
    );
    if (!targetSubjectId) {
      showNotification(
        "⚠ Subject write succeeded but no subject id was returned.",
      );
      return false;
    }

    const existingSections = sectionsBySubjectId[targetSubjectId] ?? [];
    const existingSectionIds = new Set(
      existingSections
        .map((row) => String(row.id ?? "").trim())
        .filter(Boolean),
    );

    const sectionUpsertRows = normalizedSections.map((row) => {
      const existingMatch = existingSections.find((item) => {
        const existingId = String(item.id ?? "").trim();
        if (row.id && existingId && row.id === existingId) {
          return true;
        }

        return (
          String(item.section ?? "")
            .trim()
            .toUpperCase() === row.section &&
          String(item.academic_year ?? item.academicYear ?? "").trim() ===
            row.academic_year &&
          String(item.semester ?? "").trim() === row.semester
        );
      });

      const existingId = String(existingMatch?.id ?? "").trim();
      if (existingId) {
        existingSectionIds.delete(existingId);
      }

      return {
        ...(existingId ? { id: existingId } : {}),
        subject_id: targetSubjectId,
        section: row.section,
        enrolled: Math.max(1, Number(row.enrolled ?? 1)),
        status: row.status,
        academic_year: row.academic_year,
        semester: row.semester,
      };
    });

    const { error: sectionUpsertError } = await supabase
      .from("subject_sections")
      .upsert(sectionUpsertRows, {
        onConflict: "subject_id,section,academic_year,semester",
      });

    if (sectionUpsertError) {
      showNotification(
        `⚠ ${formatDbError(sectionUpsertError, "Unable to save subject sections")}`,
      );
      return false;
    }

    const staleSectionIds = Array.from(existingSectionIds);
    if (staleSectionIds.length > 0) {
      const { error: deleteSectionError } = await supabase
        .from("subject_sections")
        .delete()
        .in("id", staleSectionIds);

      if (deleteSectionError) {
        showNotification(
          `⚠ ${formatDbError(deleteSectionError, "Unable to remove deleted sections")}`,
        );
        return false;
      }
    }

    const currentInstructorIds = new Set(
      (instructorIdsBySubjectId[targetSubjectId] ?? [])
        .map((id) => String(id ?? "").trim())
        .filter(Boolean),
    );
    const desiredInstructorIdSet = new Set(desiredInstructorIds);

    const linksToInsert = desiredInstructorIds
      .filter((id) => !currentInstructorIds.has(id))
      .map((id) => ({
        subject_id: targetSubjectId,
        instructor_id: id,
      }));

    const linksToDelete = Array.from(currentInstructorIds).filter(
      (id) => !desiredInstructorIdSet.has(id),
    );

    if (linksToInsert.length > 0) {
      const { error: insertInstructorError } = await supabase
        .from("instructor_subjects")
        .insert(linksToInsert);

      if (insertInstructorError) {
        showNotification(
          `⚠ ${formatDbError(
            insertInstructorError,
            "Unable to add instructor assignments",
          )}`,
        );
        return false;
      }
    }

    if (linksToDelete.length > 0) {
      const { error: deleteInstructorError } = await supabase
        .from("instructor_subjects")
        .delete()
        .eq("subject_id", targetSubjectId)
        .in("instructor_id", linksToDelete);

      if (deleteInstructorError) {
        showNotification(
          `⚠ ${formatDbError(
            deleteInstructorError,
            "Unable to remove instructor assignments",
          )}`,
        );
        return false;
      }
    }

    await fetchSubjects();

    return true;
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;

    if (!isAdmin) {
      showNotification("Admin access required for this action.");
      return;
    }

    const refreshed = await refreshAuthSessionForWrite();
    if (!refreshed) {
      return;
    }

    const { error } = await supabase
      .from("subjects")
      .delete()
      .eq("id", deleteTarget.id);

    if (error) {
      if (isRlsError(error)) {
        showNotification(
          "⚠ Delete denied by RLS. Please verify subjects DELETE policy for admin users.",
        );
      }
      showNotification(`⚠ ${formatDbError(error, "Unable to delete subject")}`);
      return;
    }

    const sectionCount = sectionsBySubjectId[deleteTarget.id]?.length ?? 0;

    setSubjects((current) =>
      current.filter((item) => item.id !== deleteTarget.id),
    );
    setSectionsBySubjectId((current) => {
      const next = { ...current };
      delete next[deleteTarget.id];
      return next;
    });
    showNotification(
      `Subject ${deleteTarget.code} deleted. ${sectionCount} related section(s) removed.`,
    );
    setDeleteTarget(null);
    await fetchSubjects();
  }

  if (loading) {
    return <div className="page-container">Loading subjects...</div>;
  }

  const deleteTargetSectionCount = deleteTarget
    ? (sectionsBySubjectId[deleteTarget.id]?.length ?? 0)
    : 0;

  return (
    <div className="page-container">
      <div className="section-header">
        <div>
          <div className="section-title">Subject Catalog</div>
          <div className="section-subtitle">AY 2025-2026</div>
        </div>

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
            {subjects.length === 0 ? (
              <tr>
                <td colSpan="8" className="empty-table">
                  There are no subjects yet. Click{" "}
                  <strong>"Add Subject"</strong> to add one.
                </td>
              </tr>
            ) : (
              subjects.map((subject) => (
                <tr key={subject.id}>
                  <td>{subject.code}</td>
                  <td>{subject.title}</td>
                  <td>{subject.program}</td>
                  <td>{subject.year}</td>
                  <td>{subject.room_type}</td>
                  <td>{sectionsBySubjectId[subject.id]?.length ?? 0}</td>
                  <td>{instructorIdsBySubjectId[subject.id]?.length ?? 0}</td>
                  <td className="actions">
                    {isAdmin && (
                      <>
                        <button
                          className="btn btn-secondary"
                          onClick={() => {
                            setEditSubject(subject);
                            setShowModal(true);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-danger"
                          onClick={() => setDeleteTarget(subject)}
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
      </div>

      {showModal && isAdmin && (
        <CourseModal
          subjects={subjects}
          existing={editSubject}
          existingSections={
            editSubject ? (sectionsBySubjectId[editSubject.id] ?? []) : []
          }
          instructors={instructors}
          existingInstructorIds={
            editSubject ? (instructorIdsBySubjectId[editSubject.id] ?? []) : []
          }
          currentAcademicYear={CURRENT_ACADEMIC_YEAR}
          currentSemester={CURRENT_SEMESTER}
          onClose={() => setShowModal(false)}
          onSave={async (subjectPayload) => {
            let ok = false;

            if (editSubject) {
              ok = await saveSubjectComposite(subjectPayload, editSubject.id);
              if (ok) {
                showNotification("Subject updated");
              }
            } else {
              ok = await saveSubjectComposite(subjectPayload);
              if (ok) {
                showNotification("Subject added");
              }
            }

            if (ok) {
              setShowModal(false);
            }
          }}
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
