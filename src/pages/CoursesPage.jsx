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
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editSubject, setEditSubject] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchSubjects = useCallback(async () => {
    try {
      const [
        { data: subjectRows, error: subjectError },
        { data: sectionRows, error: sectionError },
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

      if (sectionError) {
        console.warn(
          "Section metadata unavailable for catalog page",
          sectionError,
        );
        showNotification(
          `⚠ Subject sections could not be loaded for ${CURRENT_ACADEMIC_YEAR} ${CURRENT_SEMESTER}. Showing subject catalog only.`,
        );
      }

      setSubjects(subjectRows ?? []);
      setSectionsBySubjectId(sectionError ? {} : sectionMap);
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

  async function addSubject(subject) {
    if (!isAdmin) {
      showNotification("Admin access required for this action.");
      return false;
    }

    const refreshed = await refreshAuthSessionForWrite();
    if (!refreshed) {
      return false;
    }

    const subjectRow = {
      code: subject.code,
      title: subject.title,
      program: subject.program,
      year: subject.year,
      room_type: subject.room_type,
      duration: subject.duration ?? 1.5,
    };

    const { data, error } = await supabase
      .from("subjects")
      .insert([subjectRow])
      .select();

    if (error) {
      if (isRlsError(error)) {
        showNotification(
          "⚠ Insert denied by RLS. Please verify subjects INSERT policy for admin users.",
        );
      }
      showNotification(`⚠ ${formatDbError(error, "Unable to add subject")}`);
      return false;
    }

    setSubjects((current) => [...current, ...(data ?? [])]);
    setSectionsBySubjectId((current) => {
      const created = data?.[0];

      if (!created || current[created.id]) {
        return current;
      }

      return { ...current, [created.id]: [] };
    });

    await fetchSubjects();

    return true;
  }

  async function updateSubject(id, subject) {
    if (!isAdmin) {
      showNotification("Admin access required for this action.");
      return false;
    }

    const refreshed = await refreshAuthSessionForWrite();
    if (!refreshed) {
      return false;
    }

    const subjectRow = {
      title: subject.title,
      program: subject.program,
      year: subject.year,
      room_type: subject.room_type,
      duration: subject.duration ?? 1.5,
    };

    const { data, error } = await supabase
      .from("subjects")
      .update(subjectRow)
      .eq("id", id)
      .select();

    if (error) {
      if (isRlsError(error)) {
        showNotification(
          "⚠ Update denied by RLS. Please verify subjects UPDATE policy for admin users.",
        );
      }
      showNotification(`⚠ ${formatDbError(error, "Unable to update subject")}`);
      return false;
    }

    setSubjects((current) =>
      current.map((item) => (item.id === id ? data[0] : item)),
    );

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
        <table className="course-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Title</th>
              <th>Program</th>
              <th>Year</th>
              <th>Room Type</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {subjects.length === 0 ? (
              <tr>
                <td colSpan="6" className="empty-table">
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
          onClose={() => setShowModal(false)}
          onSave={async (subject) => {
            let ok = false;

            if (editSubject) {
              ok = await updateSubject(editSubject.id, subject);
              if (ok) {
                showNotification("Subject updated");
              }
            } else {
              ok = await addSubject(subject);
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
