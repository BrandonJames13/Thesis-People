import { getAssignmentSubjectCode } from "./scheduleUtils";

function normalizeConflictType(type) {
  if (type === "DOUBLE_BOOKING" || type === "INSTRUCTOR_CONFLICT") {
    return type;
  }
  return "SOFT_WARNING";
}

function buildAssignmentSnapshot(detail, fallbackText) {
  if (detail && typeof detail === "object") {
    return JSON.stringify({
      room: detail.room ?? "",
      time: detail.time ?? "",
    });
  }
  return String(fallbackText ?? "").trim() || null;
}

export function mapReallocationEntryToConflictLog(entry) {
  if (!entry) return null;

  const courseCode = String(
    entry.courseCode ?? getAssignmentSubjectCode(entry),
  ).trim();

  // If course code resolution failed, capture the raw identifier for debugging
  const resolvedCourseCode =
    courseCode ||
    String(
      entry.code ?? entry.subjectCode ?? entry.subject_code ?? "UNRESOLVED",
    ).trim();

  return {
    assignment_id: String(entry.assignmentId ?? "").trim() || null,
    course_code: resolvedCourseCode,
    conflict_type: normalizeConflictType(entry.type),
    type_label: String(entry.typeLabel ?? "").trim() || null,
    from_assignment: buildAssignmentSnapshot(entry.fromDetail, entry.from),
    to_assignment: buildAssignmentSnapshot(entry.toDetail, entry.to),
    resolved: true,
    resolved_at:
      String(entry.resolvedAt ?? "").trim() || new Date().toISOString(),
  };
}

export function mapReallocationEntriesToConflictLog(entries) {
  return (Array.isArray(entries) ? entries : [])
    .map((entry) => mapReallocationEntryToConflictLog(entry))
    .filter(Boolean);
}
