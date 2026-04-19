import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
} from "react";
import { supabase } from "../lib/supabaseClient";
import { normalizeRoomType } from "../data/constants";
import { normalizePostgresError } from "../utils/errorUtils";

const DEFAULT_SECTION = "A";
const ACTIVE_ACADEMIC_YEAR =
  import.meta.env.VITE_ACTIVE_ACADEMIC_YEAR ?? "2025-2026";
const ACTIVE_SEMESTER = import.meta.env.VITE_ACTIVE_SEMESTER ?? "2nd";

function buildSectionIdentity(subjectCode, section, academicYear, semester) {
  return [subjectCode, section, academicYear, semester]
    .map((value) => String(value ?? "").trim())
    .join("::");
}

function getInstructorLoadKey(record) {
  const instructorId = String(
    record?.instructor_id ?? record?.instructorId ?? record?.id ?? "",
  ).trim();
  if (instructorId) return `id:${instructorId.toLowerCase()}`;

  const instructorName = String(
    record?.instructor ?? record?.instructor_name ?? record?.name ?? "",
  )
    .trim()
    .toLowerCase();
  return instructorName ? `name:${instructorName}` : "";
}

function cloneSubjects(subjects) {
  return subjects.map((s) => ({ ...s }));
}

function cloneSubjectSections(subjectSections) {
  return subjectSections.map((s) => ({ ...s }));
}

function cloneRooms(rooms) {
  return rooms.map((room) => ({ ...room }));
}

function cloneInstructors(instructors) {
  return instructors.map((instructor) => ({ ...instructor }));
}

function normalizeInstructorSubjectsFromRows(rows, sections) {
  const sectionById = new Map(
    (Array.isArray(sections) ? sections : []).map((section) => [
      String(
        section?.sectionId ?? section?.id ?? section?.section_id ?? "",
      ).trim(),
      section,
    ]),
  );

  return (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const instructorId = String(
        row?.instructor_id ?? row?.instructorId ?? "",
      ).trim();
      const sectionId = String(row?.section_id ?? row?.sectionId ?? "").trim();
      if (!instructorId || !sectionId) return null;

      const section = sectionById.get(sectionId);
      const subjectId = String(
        section?.subjectId ?? row?.subject_id ?? "",
      ).trim();
      if (!subjectId) return null;

      return {
        instructorId,
        instructor_id: instructorId,
        subjectId,
        subject_id: subjectId,
        sectionId,
        section_id: sectionId,
        academicYear:
          row?.academic_year ?? row?.academicYear ?? ACTIVE_ACADEMIC_YEAR,
        semester: row?.semester ?? ACTIVE_SEMESTER,
      };
    })
    .filter(Boolean);
}

function normalizeSubjectFromRow(row) {
  return {
    code: row.subjectCode ?? row.code ?? "",
    title: row.title ?? "",
    program: row.program ?? "",
    year: row.year ?? "",
    roomType: row.roomType ?? row.room_type ?? "Lecture",
  };
}

function normalizeSectionFromRow(row) {
  const subjectCode = row.subjectCode ?? row.code ?? "";
  const subjectId = String(row.subject_id ?? row.subjectId ?? "").trim();
  const section =
    (row.section ?? DEFAULT_SECTION).toString().trim() || DEFAULT_SECTION;
  const academicYear = row.academicYear ?? row.academic_year ?? "";
  const semester = row.semester ?? "";
  const sectionIdentity =
    row.sectionIdentity ??
    row.section_identity ??
    buildSectionIdentity(subjectCode, section, academicYear, semester);
  const sectionId = String(row.section_id ?? "").trim() || sectionIdentity;

  return {
    sectionId,
    sectionIdentity,
    subjectId,
    subjectCode,
    section,
    academicYear,
    semester,
    enrolled: Number(row.enrolled ?? 0),
    status: row.status ?? "Pending",
    instructor: row.instructor ?? "",
    room: row.room ?? "",
    time: row.time ?? "",
    duration: Number(row.duration ?? 1.5),
    pattern: row.pattern ?? "",
    roomType: row.roomType ?? row.room_type,
  };
}

function normalizeScheduleAssignment(row) {
  const subjectCode = row.subjectCode ?? row.code ?? "";
  const section =
    (row.section ?? DEFAULT_SECTION).toString().trim() || DEFAULT_SECTION;
  const academicYear = row.academicYear ?? row.academic_year ?? "";
  const semester = row.semester ?? "";
  const sectionIdentity =
    row.sectionIdentity ??
    row.section_identity ??
    buildSectionIdentity(subjectCode, section, academicYear, semester);
  const sectionId = String(row.section_id ?? "").trim() || sectionIdentity;

  return {
    ...row,
    code: subjectCode,
    subjectCode,
    section,
    sectionId,
    sectionIdentity,
    academicYear,
    semester,
    enrolled: Number(row.enrolled ?? 0),
    status: row.status ?? "Pending",
    instructor: row.instructor ?? "",
    room: row.room ?? "",
    time: row.time ?? "",
    duration: Number(row.duration ?? 1.5),
    pattern: row.pattern ?? "",
    roomType: row.roomType ?? row.room_type,
    assignmentId: String(row.assignmentId ?? row.assignment_id ?? "").trim(),
    assignment_id: String(row.assignment_id ?? "").trim(),
    section_id: String(row.section_id ?? "").trim(),
  };
}

function normalizeScheduleAssignments(rows) {
  const uniqueRows = new Map();

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const normalized = normalizeScheduleAssignment(row);
    const key =
      String(
        normalized.assignment_id ?? normalized.assignmentId ?? "",
      ).trim() ||
      String(normalized.section_id ?? "").trim() ||
      normalized.sectionIdentity;
    if (!key) return;
    uniqueRows.set(key, normalized);
  });

  return Array.from(uniqueRows.values());
}

function normalizeAssignmentFromDbRow(row, lookup) {
  const subject = lookup.subjectById.get(String(row.subject_id ?? ""));
  const section = lookup.sectionById.get(String(row.section_id ?? ""));
  const room = lookup.roomById.get(String(row.room_id ?? ""));
  const instructor = lookup.instructorById.get(String(row.instructor_id ?? ""));

  // Enhanced fallback chain for subjectCode to prevent "UNKNOWN" display:
  // 1. DB columns: subject_code, course_code, code
  // 2. Section lookup: always available if section_id exists
  // 3. Subject lookup: via subject_id reference
  // 4. Last resort: empty string (indicates data loss)
  const subjectCodeValue =
    row.subject_code ??
    row.course_code ??
    row.code ??
    section?.subjectCode ??
    subject?.code ??
    "";

  return normalizeScheduleAssignment({
    assignment_id: row.id,
    assignmentId: row.id,
    section_id: row.section_id,
    sectionId: row.section_id,
    subjectCode: subjectCodeValue,
    section: row.section ?? section?.section ?? DEFAULT_SECTION,
    academic_year:
      row.academic_year ?? section?.academicYear ?? ACTIVE_ACADEMIC_YEAR,
    semester: row.semester ?? section?.semester ?? ACTIVE_SEMESTER,
    enrolled: row.enrolled ?? section?.enrolled ?? 0,
    status: row.status ?? section?.status ?? "Pending",
    instructor:
      row.instructor_name ?? instructor?.name ?? section?.instructor ?? "",
    room: row.room_number ?? room?.number ?? section?.room ?? "",
    time: row.time_display ?? section?.time ?? "",
    time_display: row.time_display ?? section?.time ?? "", // ← add
    time_start: row.time_start ?? null, // ← add
    time_end: row.time_end ?? null, // ← add
    duration:
      Number(row.duration ?? section?.duration ?? subject?.duration ?? 1.5) ||
      1.5,
    pattern: row.pattern ?? section?.pattern ?? "",
    room_type:
      row.room_type ?? section?.roomType ?? subject?.roomType ?? room?.type,
    title: row.course_title ?? row.subject_title ?? subject?.title ?? "",
    program: row.program ?? subject?.program ?? "",
    year: row.year ?? subject?.year ?? "",
    instructor_id: row.instructor_id,
    room_id: row.room_id,
    subject_id: row.subject_id,
  });
}

function buildNormalizedFromCourseRows(rows) {
  const subjectMap = new Map();
  const sectionMap = new Map();

  rows.forEach((row) => {
    const subject = normalizeSubjectFromRow(row);
    if (!subject.code) return;

    if (!subjectMap.has(subject.code)) {
      subjectMap.set(subject.code, subject);
    }

    const section = normalizeSectionFromRow(row);
    if (!section.sectionId) return;
    if (!section.subjectCode) {
      section.subjectCode = subject.code;
    }
    sectionMap.set(section.sectionId, section);
  });

  return {
    subjects: Array.from(subjectMap.values()),
    subjectSections: Array.from(sectionMap.values()),
  };
}

/**
 * Builds instructor loads from two sources:
 * 1. scheduleAssignments with status "Assigned" (scheduled with hours)
 * 2. instructorSubjects (unscheduled assignments from import)
 *
 * Deduplicates by section_id to avoid double-counting the same section.
 * Counts unique subjects by subject_id.
 * Uses duration from scheduleAssignments; defaults to 0 for unscheduled entries.
 *
 * @param {Array} scheduleAssignments - Schedule assignments with status and duration
 * @param {Array} instructorSubjects - Instructor-subject-section assignments from import
 * @param {Array} subjectSections - Subject sections for subject_id lookup
 * @returns {Map} Map of instructor keys to load metrics
 */
function buildInstructorLoadsFromBothSources(
  scheduleAssignments,
  instructorSubjects,
  subjectSections,
) {
  // Build section lookup index for instructorSubjects processing
  const _sectionById = new Map(
    (Array.isArray(subjectSections) ? subjectSections : []).map((section) => [
      String(section?.sectionId ?? section?.id ?? section?.section_id ?? "")
        .trim()
        .toLowerCase(),
      section,
    ]),
  );

  // Track all processed sections to deduplicate across both sources
  const processedSectionKeys = new Set();
  const loadMap = new Map();

  // ── Phase 1: Process scheduled assignments (status="Assigned") ────
  (Array.isArray(scheduleAssignments) ? scheduleAssignments : []).forEach(
    (assignment) => {
      if (assignment.status !== "Assigned") return;

      const instructorKey = getInstructorLoadKey(assignment);
      if (!instructorKey) return;

      const sectionKey =
        String(assignment.section_id ?? "").trim() ||
        String(
          assignment.assignmentId ?? assignment.assignment_id ?? "",
        ).trim() ||
        assignment.sectionIdentity;
      if (!sectionKey) return;

      // Avoid re-processing same section
      if (processedSectionKeys.has(sectionKey)) return;
      processedSectionKeys.add(sectionKey);

      const current = loadMap.get(instructorKey) ?? {
        subjectIds: new Set(),
        sectionKeys: new Set(),
        lectureHours: 0,
        labHours: 0,
      };

      current.sectionKeys.add(sectionKey);

      // Track subject by ID for unique counting
      const subjectId = String(assignment.subject_id ?? "").trim();
      if (subjectId) {
        current.subjectIds.add(subjectId);
      } else {
        // Fallback to subject code if ID not available
        const subjectCode = String(
          assignment.code ?? assignment.subjectCode ?? "",
        )
          .trim()
          .toUpperCase();
        if (subjectCode) {
          current.subjectIds.add(subjectCode);
        }
      }

      // Calculate hours by room type
      const duration = Number(assignment.duration ?? 0) || 0;
      const roomType = normalizeRoomType(
        assignment.roomType ?? assignment.room_type,
      );
      const isLab = roomType === "Computer Lab";
      if (isLab) current.labHours += duration;
      else current.lectureHours += duration;

      loadMap.set(instructorKey, current);
    },
  );

  // ── Phase 2: Process unscheduled instructor-subject assignments ────
  (Array.isArray(instructorSubjects) ? instructorSubjects : []).forEach(
    (row) => {
      const instructorKey = getInstructorLoadKey(row);
      if (!instructorKey) return;

      const sectionId = String(row.section_id ?? row.sectionId ?? "")
        .trim()
        .toLowerCase();
      if (!sectionId) return;

      // Skip if already processed from scheduleAssignments (avoid double-count)
      if (processedSectionKeys.has(sectionId)) return;
      processedSectionKeys.add(sectionId);

      const current = loadMap.get(instructorKey) ?? {
        subjectIds: new Set(),
        sectionKeys: new Set(),
        lectureHours: 0,
        labHours: 0,
      };

      current.sectionKeys.add(sectionId);

      // Track subject ID from instructorSubjects
      const subjectId = String(row.subject_id ?? row.subjectId ?? "")
        .trim()
        .toLowerCase();
      if (subjectId) {
        current.subjectIds.add(subjectId);
      }

      // Note: No hours added for unscheduled assignments (defaults to 0)
      // Hours will be added when auto-schedule runs or manual assignment occurs

      loadMap.set(instructorKey, current);
    },
  );

  // ── Phase 3: Normalize to final load structure ────
  const loads = new Map();
  loadMap.forEach((load, key) => {
    loads.set(key, {
      subjectCount: load.subjectIds.size,
      sectionCount: load.sectionKeys.size,
      lectureHours: load.lectureHours,
      labHours: load.labHours,
      totalHours: load.lectureHours + load.labHours,
    });
  });

  return loads;
}

const DataContext = createContext();

export function DataProvider({ children }) {
  const [subjects, setSubjects] = useState([]);
  const [subjectSections, setSubjectSections] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [instructorSubjects, setInstructorSubjects] = useState([]);
  const [scheduleAssignments, setScheduleAssignments] = useState([]);
  const [scheduleAssignmentsSyncing, setScheduleAssignmentsSyncing] =
    useState(false);
  const [scheduleAssignmentsError, setScheduleAssignmentsError] =
    useState(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isGenerationInProgress, setIsGenerationInProgress] = useState(false);

  const bootstrapFromSupabase = useCallback(async () => {
    setIsBootstrapping(true);
    try {
      const [
        roomsResult,
        subjectsResult,
        sectionsResult,
        instructorsResult,
        assignmentsResult,
        instructorSubjectsResult,
      ] = await Promise.all([
        supabase.from("rooms").select("*").order("number"),
        supabase
          .from("subjects")
          .select("id, code, title, program, year, room_type, duration"),
        supabase
          .from("subject_sections")
          .select(
            "id, subject_id, section, enrolled, status, academic_year, semester",
          )
          .eq("academic_year", ACTIVE_ACADEMIC_YEAR)
          .eq("semester", ACTIVE_SEMESTER),
        supabase.from("instructors").select("*").order("name"),
        supabase
          .from("schedule_assignments")
          .select("*")
          .eq("academic_year", ACTIVE_ACADEMIC_YEAR)
          .eq("semester", ACTIVE_SEMESTER),
        supabase
          .from("instructor_subject_sections")
          .select("instructor_id, section_id, academic_year, semester")
          .eq("academic_year", ACTIVE_ACADEMIC_YEAR)
          .eq("semester", ACTIVE_SEMESTER),
      ]);

      const criticalError =
        roomsResult.error ||
        subjectsResult.error ||
        sectionsResult.error ||
        instructorsResult.error ||
        assignmentsResult.error;

      if (criticalError) {
        console.error(
          "[DataContext] Failed to load data from Supabase:",
          criticalError,
        );
        setSubjects([]);
        setSubjectSections([]);
        setRooms([]);
        setInstructors([]);
        setInstructorSubjects([]);
        setScheduleAssignments([]);
        return;
      }

      const roomRows = cloneRooms(roomsResult.data ?? []);
      const instructorRows = cloneInstructors(instructorsResult.data ?? []);
      const normalizedSubjects = (subjectsResult.data ?? []).map((row) =>
        normalizeSubjectFromRow(row),
      );

      const subjectById = new Map(
        (subjectsResult.data ?? []).map((row) => [String(row.id), row]),
      );

      const normalizedSections = (sectionsResult.data ?? [])
        .map((row) => {
          const subject = subjectById.get(String(row.subject_id));
          if (!subject) return null;

          return normalizeSectionFromRow({
            section_id: row.id,
            subject_id: row.subject_id,
            subjectCode: subject.code,
            section: row.section,
            academic_year: row.academic_year,
            semester: row.semester,
            enrolled: row.enrolled,
            status: row.status === "Not Assigned" ? "Pending" : row.status,
            duration: Number(subject.duration ?? 1.5),
            room_type: subject.room_type,
          });
        })
        .filter(Boolean);

      const sectionById = new Map(
        normalizedSections.map((section) => [
          String(section.sectionId),
          section,
        ]),
      );
      const roomById = new Map(roomRows.map((room) => [String(room.id), room]));
      const instructorById = new Map(
        instructorRows.map((instructor) => [String(instructor.id), instructor]),
      );

      const normalizedAssignments = assignmentsResult.error
        ? []
        : normalizeScheduleAssignments(
            (assignmentsResult.data ?? []).map((row) =>
              normalizeAssignmentFromDbRow(row, {
                subjectById,
                sectionById,
                roomById,
                instructorById,
              }),
            ),
          );

      const normalizedInstructorSubjects = instructorSubjectsResult.error
        ? []
        : normalizeInstructorSubjectsFromRows(
            instructorSubjectsResult.data ?? [],
            normalizedSections,
          );

      setRooms(roomRows);
      setSubjects(normalizedSubjects);
      setSubjectSections(normalizedSections);
      setInstructors(instructorRows);
      setInstructorSubjects(normalizedInstructorSubjects);
      setScheduleAssignments(normalizedAssignments);
    } finally {
      setIsBootstrapping(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      bootstrapFromSupabase();
    }, 0);

    return () => clearTimeout(timer);
  }, [bootstrapFromSupabase]);

  const instructorLoads = useMemo(() => {
    return buildInstructorLoadsFromBothSources(
      scheduleAssignments,
      instructorSubjects,
      subjectSections,
    );
  }, [scheduleAssignments, instructorSubjects, subjectSections]);

  const getInstructorLoad = useCallback(
    (instructor) => {
      const idKey = getInstructorLoadKey(instructor);
      const nameKey = getInstructorLoadKey({ name: instructor?.name });
      return (
        instructorLoads.get(idKey) ??
        instructorLoads.get(nameKey) ?? {
          subjectCount: 0,
          sectionCount: 0,
          lectureHours: 0,
          labHours: 0,
          totalHours: 0,
        }
      );
    },
    [instructorLoads],
  );

  const assignments = useMemo(
    () => scheduleAssignments.filter((c) => c.status === "Assigned"),
    [scheduleAssignments],
  );

  const conflicts = useMemo(
    () => scheduleAssignments.filter((c) => c.status === "Conflict"),
    [scheduleAssignments],
  );

  const availableRooms = useMemo(
    () => rooms.filter((room) => room.status !== "Maintenance"),
    [rooms],
  );

  const availableInstructors = useMemo(
    () =>
      instructors.filter(
        (instructor) =>
          String(instructor?.status ?? "")
            .trim()
            .toLowerCase() !== "inactive",
      ),
    [instructors],
  );

  const assignedSectionKeys = useMemo(() => {
    const keys = new Set();

    scheduleAssignments.forEach((assignment) => {
      if (assignment.status !== "Assigned") return;

      const explicitSectionId = String(
        assignment.section_id ?? assignment.sectionId ?? "",
      ).trim();
      if (explicitSectionId) {
        keys.add(explicitSectionId);
      }

      const identity = String(assignment.sectionIdentity ?? "").trim();
      if (identity) {
        keys.add(identity);
      }
    });

    return keys;
  }, [scheduleAssignments]);

  const availableSections = useMemo(
    () =>
      subjectSections.filter((section) => {
        const sectionId = String(section.sectionId ?? "").trim();
        const sectionIdentity = String(section.sectionIdentity ?? "").trim();

        if (sectionId && assignedSectionKeys.has(sectionId)) return false;
        if (sectionIdentity && assignedSectionKeys.has(sectionIdentity))
          return false;

        const status = String(section.status ?? "")
          .trim()
          .toLowerCase();
        return !status || status === "pending" || status === "not assigned";
      }),
    [subjectSections, assignedSectionKeys],
  );

  const availableSubjects = useMemo(() => {
    const availableCodes = new Set(
      availableSections
        .map((section) => String(section.subjectCode ?? "").trim())
        .filter(Boolean),
    );

    return subjects.filter((subject) => availableCodes.has(subject.code));
  }, [subjects, availableSections]);

  const addSubject = useCallback((subject) => {
    const nextSubject = normalizeSubjectFromRow(subject);
    if (!nextSubject.code) return;
    setSubjects((prev) => {
      const exists = prev.some((s) => s.code === nextSubject.code);
      if (exists) {
        return prev.map((s) =>
          s.code === nextSubject.code ? { ...s, ...nextSubject } : s,
        );
      }
      return [...prev, nextSubject];
    });
  }, []);

  const updateSubjects = useCallback((newSubjects) => {
    setSubjects(cloneSubjects(newSubjects ?? []));
  }, []);

  const addSubjectSection = useCallback((sectionRow) => {
    const normalized = normalizeSectionFromRow(sectionRow);
    if (!normalized.subjectCode) return;
    setSubjectSections((prev) => [...prev, normalized]);
  }, []);

  const upsertSubjectSection = useCallback((sectionRow) => {
    const normalized = normalizeSectionFromRow(sectionRow);
    if (!normalized.subjectCode) return;

    setSubjectSections((prev) => {
      const index = prev.findIndex((s) => s.sectionId === normalized.sectionId);
      if (index < 0) return [...prev, normalized];
      const next = [...prev];
      next[index] = { ...next[index], ...normalized };
      return next;
    });
  }, []);

  const updateSubjectSections = useCallback((newSubjectSections) => {
    setSubjectSections(cloneSubjectSections(newSubjectSections ?? []));
  }, []);

  const updateSubjectSectionsFromCourseRows = useCallback((newCourseRows) => {
    const normalized = buildNormalizedFromCourseRows(newCourseRows ?? []);
    setSubjects(normalized.subjects);
    setSubjectSections(normalized.subjectSections);
  }, []);

  const addRoom = useCallback((room) => {
    setRooms((prev) => [...prev, room]);
  }, []);

  const deleteRoom = useCallback((index) => {
    setRooms((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateRooms = useCallback((newRooms) => {
    setRooms(cloneRooms(newRooms ?? []));
  }, []);

  const addInstructor = useCallback((instructor) => {
    setInstructors((prev) => [...prev, instructor]);
  }, []);

  const updateInstructors = useCallback((newInstructors) => {
    setInstructors(cloneInstructors(newInstructors ?? []));
  }, []);

  const updateInstructorSubjects = useCallback(async () => {
    const { data, error } = await supabase
      .from("instructor_subject_sections")
      .select("instructor_id, section_id, academic_year, semester")
      .eq("academic_year", ACTIVE_ACADEMIC_YEAR)
      .eq("semester", ACTIVE_SEMESTER);

    if (error) {
      console.warn("Unable to refresh instructor_subject_sections", error);
      return;
    }

    setInstructorSubjects(
      normalizeInstructorSubjectsFromRows(data ?? [], subjectSections),
    );
  }, [subjectSections]);

  const persistScheduleAssignments = useCallback(
    async (normalizedAssignments) => {
      try {
        // Filter to only include "Assigned" status assignments
        const assignedOnly = (
          Array.isArray(normalizedAssignments) ? normalizedAssignments : []
        ).filter((a) => a.status === "Assigned");

        if (assignedOnly.length === 0) {
          return { success: true };
        }

        // Map normalized fields to database columns
        // IMPORTANT: Include denormalized fields for display persistence (section, program, year, enrolled, room_number, room_type, instructor_name)
        const rowsToUpsert = assignedOnly.map((assignment) => {
          // Priority chain: explicit code/subjectCode > subject_code > section lookup > empty string
          const subjectCodeValue =
            assignment.code ||
            assignment.subjectCode ||
            assignment.subject_code ||
            assignment.section_code ||
            "";

          return {
            section_id: assignment.section_id || assignment.sectionId || "",
            subject_id: assignment.subject_id || assignment.subjectId || "",
            room_id: assignment.room_id || assignment.roomId || "",
            instructor_id:
              assignment.instructor_id || assignment.instructorId || "",
            subject_code: subjectCodeValue,
            subject_title:
              assignment.course_title ||
              assignment.title ||
              assignment.subject_title ||
              "",
            // Denormalized columns for display persistence
            section: assignment.section || "",
            program: assignment.program || "",
            year: assignment.year || "",
            enrolled: assignment.enrolled || 0,
            room_number: assignment.room_number || assignment.room || "",
            room_type: assignment.room_type || assignment.roomType || "",
            instructor_name:
              assignment.instructor_name || assignment.instructor || "",
            status: assignment.status || "Assigned",
            pattern: assignment.pattern || "",
            time_display: assignment.time_display || assignment.time || "",
            time_start: assignment.time_start || null,
            time_end: assignment.time_end || null,
            duration: assignment.duration || 1.5,
            academic_year:
              assignment.academic_year ||
              assignment.academicYear ||
              ACTIVE_ACADEMIC_YEAR,
            semester: assignment.semester || ACTIVE_SEMESTER,
          };
        });

        // Perform upsert with unique constraint on (section_id, room_type, academic_year, semester)
        const { data: _upsertData, error } = await supabase
          .from("schedule_assignments")
          .upsert(rowsToUpsert, {
            onConflict: "section_id,room_type,academic_year,semester",
          })
          .select();

        if (error) {
          const normalized = normalizePostgresError(
            error,
            "Failed to persist schedule assignments.",
          );
          console.error(
            `[DataContext] Persistence failed for ${rowsToUpsert.length} assignments:`,
            normalized,
          );
          return { success: false, error: normalized };
        }

        console.log(
          `[DataContext] Successfully persisted ${rowsToUpsert.length} schedule assignments.`,
        );
        return { success: true };
      } catch (err) {
        const normalized = normalizePostgresError(
          err,
          "Failed to persist schedule assignments.",
        );
        console.error(
          "[DataContext] Unexpected error during persistence:",
          normalized,
        );
        return { success: false, error: normalized };
      }
    },
    [],
  );

  const updateScheduleAssignments = useCallback(
    async (newAssignments, skipPersist = false) => {
      const previousAssignments = scheduleAssignments;
      const normalized = normalizeScheduleAssignments(newAssignments);

      // ─── Validate all assignments reference valid subjects before DB write ────
      const validateAssignmentSubjects = (assignments) => {
        const invalidAssignments = [];

        for (const assignment of assignments) {
          // Only validate "Assigned" status assignments that need to persist
          if (String(assignment.status ?? "").trim() !== "Assigned") {
            continue;
          }

          const subjectId = String(assignment.subject_id ?? "").trim();
          const subjectCode = String(
            assignment.subject_code ??
              assignment.code ??
              assignment.subjectCode ??
              "",
          ).trim();

          // Check if subject is in current subjects data
          const subjectExists = subjects.some(
            (s) =>
              String(s.id ?? "").trim() === subjectId ||
              String(s.code ?? "")
                .trim()
                .toUpperCase() === subjectCode.trim().toUpperCase(),
          );

          if (!subjectExists && subjectId) {
            invalidAssignments.push({
              assignmentKey: `${assignment.section_id || ""}-${assignment.subject_code || assignment.code || assignment.course_code || ""}`,
              subjectId,
              subjectCode,
              reason: `Subject '${subjectCode || subjectId}' not found in database. Database may have been modified after schedule generation.`,
            });
          }
        }

        return {
          valid: invalidAssignments.length === 0,
          invalidCount: invalidAssignments.length,
          firstError:
            invalidAssignments.length > 0 ? invalidAssignments[0] : null,
          invalidAssignments,
        };
      };

      // Perform pre-flight validation
      const subjectValidation = validateAssignmentSubjects(normalized);
      if (!subjectValidation.valid) {
        console.error(
          "[DataContext] Subject validation failed before DB write:",
          subjectValidation,
        );
        const errorMsg = `Cannot save schedule: ${subjectValidation.invalidCount} assignment${
          subjectValidation.invalidCount !== 1 ? "s" : ""
        } reference missing subjects. First error: ${subjectValidation.firstError?.reason}. Please re-generate or manually resolve.`;

        setScheduleAssignmentsError({
          code: "INVALID_SUBJECT_REFS",
          message: errorMsg,
          details: JSON.stringify(subjectValidation.invalidAssignments),
        });
        return Promise.reject({
          code: "INVALID_SUBJECT_REFS",
          message: errorMsg,
        });
      }

      setScheduleAssignmentsSyncing(true);
      setScheduleAssignmentsError(null);

      // Optimistically update local state
      setScheduleAssignments(normalized);

      if (skipPersist) {
        setScheduleAssignmentsSyncing(false);
        return Promise.resolve();
      }

      try {
        const result = await persistScheduleAssignments(normalized);

        if (result.success) {
          setScheduleAssignmentsSyncing(false);
          return Promise.resolve();
        } else {
          // Rollback state on persistence failure
          setScheduleAssignments(previousAssignments);
          setScheduleAssignmentsError(result.error);
          setScheduleAssignmentsSyncing(false);
          return Promise.reject(result.error);
        }
      } catch (err) {
        // Rollback on unexpected error
        setScheduleAssignments(previousAssignments);
        setScheduleAssignmentsError({
          code: null,
          message: "Unexpected error during persistence.",
          details: String(err?.message ?? err),
        });
        setScheduleAssignmentsSyncing(false);
        return Promise.reject(err);
      }
    },
    [scheduleAssignments, persistScheduleAssignments, subjects],
  );

  // Clear schedule assignments from database (for before auto-generation)
  const clearScheduleAssignments = useCallback(async () => {
    setScheduleAssignmentsSyncing(true);
    setScheduleAssignmentsError(null);

    try {
      // Call RPC function to atomically delete schedule_assignments and conflicts from database
      const { data: _resetData, error } = await supabase.rpc(
        "reset_schedule_for_term",
        {
          p_academic_year: ACTIVE_ACADEMIC_YEAR,
          p_semester: ACTIVE_SEMESTER,
        },
      );

      if (error) {
        const normalized = normalizePostgresError(
          error,
          "Failed to clear existing schedule assignments.",
        );
        console.error("[DataContext] Error clearing schedules:", normalized);
        setScheduleAssignmentsError(normalized);
        setScheduleAssignmentsSyncing(false);
        return { success: false, error: normalized };
      }

      // Update local state to empty array
      setScheduleAssignments([]);
      setScheduleAssignmentsSyncing(false);
      console.log("[DataContext] Successfully cleared schedule assignments.");
      return { success: true };
    } catch (err) {
      const normalized = normalizePostgresError(
        err,
        "Unexpected error clearing schedule assignments.",
      );
      console.error("[DataContext] Unexpected error during clear:", normalized);
      setScheduleAssignmentsError(normalized);
      setScheduleAssignmentsSyncing(false);
      return { success: false, error: normalized };
    }
  }, []);

  // Clear all rooms from database (admin-only)
  const clearRooms = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("clear_all_rooms");

      if (error) {
        const normalized = normalizePostgresError(
          error,
          "Failed to clear rooms.",
        );
        console.error("[DataContext] Error clearing rooms:", normalized);
        return { success: false, error: normalized };
      }

      // Update local state to empty array
      setRooms([]);
      console.log("[DataContext] Successfully cleared all rooms.", data);
      return { success: true, data };
    } catch (err) {
      const normalized = normalizePostgresError(
        err,
        "Unexpected error clearing rooms.",
      );
      console.error(
        "[DataContext] Unexpected error during clear rooms:",
        normalized,
      );
      return { success: false, error: normalized };
    }
  }, []);

  // Clear all instructors from database (admin-only)
  const clearInstructors = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("clear_all_instructors");

      if (error) {
        const normalized = normalizePostgresError(
          error,
          "Failed to clear instructors.",
        );
        console.error("[DataContext] Error clearing instructors:", normalized);
        return { success: false, error: normalized };
      }

      // Update local state to empty array
      setInstructors([]);
      console.log("[DataContext] Successfully cleared all instructors.", data);
      return { success: true, data };
    } catch (err) {
      const normalized = normalizePostgresError(
        err,
        "Unexpected error clearing instructors.",
      );
      console.error(
        "[DataContext] Unexpected error during clear instructors:",
        normalized,
      );
      return { success: false, error: normalized };
    }
  }, []);

  // Clear all subjects from database (admin-only)
  const clearSubjects = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("clear_all_subjects");

      if (error) {
        const normalized = normalizePostgresError(
          error,
          "Failed to clear subjects.",
        );
        console.error("[DataContext] Error clearing subjects:", normalized);
        return { success: false, error: normalized };
      }

      // Update local state to empty arrays (both subjects and sections)
      setSubjects([]);
      setSubjectSections([]);
      console.log("[DataContext] Successfully cleared all subjects.", data);
      return { success: true, data };
    } catch (err) {
      const normalized = normalizePostgresError(
        err,
        "Unexpected error clearing subjects.",
      );
      console.error(
        "[DataContext] Unexpected error during clear subjects:",
        normalized,
      );
      return { success: false, error: normalized };
    }
  }, []);

  // Reset back to empty state, then refresh from the database.
  const resetAllData = useCallback(async () => {
    // Synchronously clear ALL state variables before any async operations.
    setSubjects([]);
    setSubjectSections([]);
    setRooms([]);
    setInstructors([]);
    setInstructorSubjects([]);
    setScheduleAssignments([]);
    setScheduleAssignmentsSyncing(false);
    setScheduleAssignmentsError(null);
    setIsGenerationInProgress(false);

    try {
      // Call RPC function to atomically delete schedule_assignments and conflicts from database.
      const { data, error } = await supabase.rpc("reset_schedule_for_term", {
        p_academic_year: ACTIVE_ACADEMIC_YEAR,
        p_semester: ACTIVE_SEMESTER,
      });

      if (error) {
        console.error(
          "Reset schedule database cleanup encountered an issue:",
          error,
        );
        // Continue anyway: local state is already cleared, proceed with bootstrap
      } else {
        console.log("Schedule reset result:", data);
      }
    } catch (err) {
      console.error("Unexpected error during schedule reset:", err);
      // Continue anyway: local state is already cleared, proceed with bootstrap
    }

    // Refresh all data from the database.
    bootstrapFromSupabase();
  }, [bootstrapFromSupabase]);

  const value = useMemo(
    () => ({
      subjects,
      subjectSections,
      rooms,
      instructors,
      instructorSubjects,
      scheduleAssignments,
      availableSubjects,
      availableSections,
      availableRooms,
      availableInstructors,
      instructorLoads,
      getInstructorLoad,
      assignments,
      conflicts,
      isBootstrapping,
      isGenerationInProgress,
      setIsGenerationInProgress,
      scheduleAssignmentsSyncing,
      scheduleAssignmentsError,
      addSubject,
      updateSubjects,
      addSubjectSection,
      upsertSubjectSection,
      updateSubjectSections,
      updateSubjectSectionsFromCourseRows,
      addRoom,
      deleteRoom,
      updateRooms,
      addInstructor,
      updateInstructors,
      updateInstructorSubjects,
      updateScheduleAssignments,
      clearScheduleAssignments,
      clearRooms,
      clearInstructors,
      clearSubjects,
      resetAllData,
    }),
    [
      subjects,
      subjectSections,
      rooms,
      instructors,
      instructorSubjects,
      scheduleAssignments,
      availableSubjects,
      availableSections,
      availableRooms,
      availableInstructors,
      instructorLoads,
      getInstructorLoad,
      assignments,
      conflicts,
      isBootstrapping,
      isGenerationInProgress,
      scheduleAssignmentsSyncing,
      scheduleAssignmentsError,
      addSubject,
      updateSubjects,
      addSubjectSection,
      upsertSubjectSection,
      updateSubjectSections,
      updateSubjectSectionsFromCourseRows,
      addRoom,
      deleteRoom,
      updateRooms,
      addInstructor,
      updateInstructors,
      updateInstructorSubjects,
      updateScheduleAssignments,
      clearScheduleAssignments,
      clearRooms,
      clearInstructors,
      clearSubjects,
      resetAllData,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
