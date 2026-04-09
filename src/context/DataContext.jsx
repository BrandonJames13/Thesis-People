import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
} from "react";
import {
  initialSubjects,
  initialSubjectSections,
} from "../data/initialSubjects";
import { initialRooms } from "../data/initialRooms";

const STORAGE_KEY = "rss_data_v1";
const DEFAULT_SECTION = "A";

function buildSectionId(subjectCode, section) {
  return `${subjectCode}::${section}`;
}

function cloneSubjects(subjects) {
  return subjects.map((s) => ({ ...s }));
}

function cloneSubjectSections(subjectSections) {
  return subjectSections.map((s) => ({ ...s }));
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
  const section =
    (row.section ?? DEFAULT_SECTION).toString().trim() || DEFAULT_SECTION;
  const sectionId = row.sectionId ?? buildSectionId(subjectCode, section);

  return {
    sectionId,
    subjectCode,
    section,
    academicYear: row.academicYear ?? row.academic_year ?? "",
    semester: row.semester ?? "",
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

function denormalizeSectionRow(section, subjectByCode) {
  const subject = subjectByCode.get(section.subjectCode) ?? null;

  return {
    code: section.subjectCode,
    section: section.section ?? DEFAULT_SECTION,
    sectionId:
      section.sectionId ??
      buildSectionId(section.subjectCode, section.section ?? DEFAULT_SECTION),
    title: subject?.title ?? "",
    program: subject?.program ?? "",
    year: subject?.year ?? "",
    roomType: section.roomType ?? subject?.roomType ?? "Lecture",
    academicYear: section.academicYear ?? "",
    semester: section.semester ?? "",
    enrolled: Number(section.enrolled ?? 0),
    status: section.status ?? "Pending",
    instructor: section.instructor ?? "",
    room: section.room ?? "",
    time: section.time ?? "",
    duration: Number(section.duration ?? 1.5),
    pattern: section.pattern ?? "",
  };
}

function migrateStoredData(data) {
  if (!data) return null;

  if (Array.isArray(data.subjects) && Array.isArray(data.subjectSections)) {
    return {
      subjects: cloneSubjects(data.subjects),
      subjectSections: cloneSubjectSections(data.subjectSections),
      rooms: Array.isArray(data.rooms)
        ? data.rooms.map((r) => ({ ...r }))
        : null,
      instructors: Array.isArray(data.instructors)
        ? data.instructors.map((i) => ({ ...i }))
        : null,
      scheduleAssignments: Array.isArray(data.scheduleAssignments)
        ? data.scheduleAssignments.map((s) => ({ ...s }))
        : null,
    };
  }

  if (Array.isArray(data.courses)) {
    const normalized = buildNormalizedFromCourseRows(data.courses);
    return {
      subjects: normalized.subjects,
      subjectSections: normalized.subjectSections,
      rooms: Array.isArray(data.rooms)
        ? data.rooms.map((r) => ({ ...r }))
        : null,
      instructors: Array.isArray(data.instructors)
        ? data.instructors.map((i) => ({ ...i }))
        : null,
      scheduleAssignments: Array.isArray(data.scheduleAssignments)
        ? data.scheduleAssignments.map((s) => ({ ...s }))
        : null,
    };
  }

  return null;
}

const DEFAULT_NORMALIZED = {
  subjects: cloneSubjects(initialSubjects),
  subjectSections: cloneSubjectSections(initialSubjectSections),
};

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveToStorage(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    return;
  }
}

const DataContext = createContext();

export function DataProvider({ children }) {
  const saved = loadFromStorage();
  const migrated = migrateStoredData(saved);

  const [subjects, setSubjects] = useState(
    () => migrated?.subjects ?? cloneSubjects(DEFAULT_NORMALIZED.subjects),
  );
  const [subjectSections, setSubjectSections] = useState(
    () =>
      migrated?.subjectSections ??
      cloneSubjectSections(DEFAULT_NORMALIZED.subjectSections),
  );
  const [rooms, setRooms] = useState(
    () => migrated?.rooms ?? initialRooms.map((r) => ({ ...r })),
  );
  const [instructors, setInstructors] = useState(
    () => migrated?.instructors ?? [],
  );
  const [scheduleAssignments, setScheduleAssignments] = useState(
    () => migrated?.scheduleAssignments ?? [],
  );

  const subjectByCode = useMemo(() => {
    const map = new Map();
    subjects.forEach((subject) => {
      map.set(subject.code, subject);
    });
    return map;
  }, [subjects]);

  // Transitional adapter: keep legacy rows available for existing UI consumers.
  const courses = useMemo(
    () =>
      subjectSections.map((section) =>
        denormalizeSectionRow(section, subjectByCode),
      ),
    [subjectSections, subjectByCode],
  );

  // Auto-save whenever any data changes
  useEffect(() => {
    saveToStorage({
      subjects,
      subjectSections,
      rooms,
      instructors,
      scheduleAssignments,
    });
  }, [subjects, subjectSections, rooms, instructors, scheduleAssignments]);

  const assignments = useMemo(
    () => scheduleAssignments.filter((c) => c.status === "Assigned"),
    [scheduleAssignments],
  );

  const conflicts = useMemo(
    () => scheduleAssignments.filter((c) => c.status === "Conflict"),
    [scheduleAssignments],
  );

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
    setRooms(newRooms);
  }, []);

  const addInstructor = useCallback((instructor) => {
    setInstructors((prev) => [...prev, instructor]);
  }, []);

  const updateInstructors = useCallback((newInstructors) => {
    setInstructors(newInstructors);
  }, []);

  const updateScheduleAssignments = useCallback((newAssignments) => {
    setScheduleAssignments(newAssignments);
  }, []);

  // Reset everything back to defaults and clear storage
  const resetAllData = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      return;
    }
    setSubjects(cloneSubjects(DEFAULT_NORMALIZED.subjects));
    setSubjectSections(
      cloneSubjectSections(DEFAULT_NORMALIZED.subjectSections),
    );
    setRooms(initialRooms.map((r) => ({ ...r })));
    setInstructors([]);
    setScheduleAssignments([]);
  }, []);

  const value = useMemo(
    () => ({
      subjects,
      subjectSections,
      courses,
      rooms,
      instructors,
      scheduleAssignments,
      assignments,
      conflicts,
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
      updateScheduleAssignments,
      resetAllData,
    }),
    [
      subjects,
      subjectSections,
      courses,
      rooms,
      instructors,
      scheduleAssignments,
      assignments,
      conflicts,
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
      updateScheduleAssignments,
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
