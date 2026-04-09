import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
} from "react";
import { initialCourses } from "../data/initialCourses";
import { initialRooms } from "../data/initialRooms";

const STORAGE_KEY = "rss_data_v1";

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

  const [courses, setCourses] = useState(
    () => saved?.courses ?? initialCourses.map((c) => ({ ...c })),
  );
  const [rooms, setRooms] = useState(
    () => saved?.rooms ?? initialRooms.map((r) => ({ ...r })),
  );
  const [instructors, setInstructors] = useState(
    () => saved?.instructors ?? [],
  );
  const [scheduleAssignments, setScheduleAssignments] = useState(
    () => saved?.scheduleAssignments ?? [],
  );

  // Auto-save whenever any data changes
  useEffect(() => {
    saveToStorage({ courses, rooms, instructors, scheduleAssignments });
  }, [courses, rooms, instructors, scheduleAssignments]);

  const assignments = useMemo(
    () => courses.filter((c) => c.status === "Assigned"),
    [courses],
  );

  const conflicts = useMemo(
    () => courses.filter((c) => c.status === "Conflict"),
    [courses],
  );

  const addCourse = useCallback((course) => {
    setCourses((prev) => [...prev, course]);
  }, []);

  const updateCourses = useCallback((newCourses) => {
    setCourses(newCourses);
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

  const syncInstructorCourses = useCallback((newScheduleAssignments) => {
    setInstructors((prev) =>
      prev.map((inst) => ({
        ...inst,
        courses: newScheduleAssignments
          .filter(
            (s) =>
              s.instructor &&
              s.instructor.trim().toLowerCase() ===
                inst.name.trim().toLowerCase(),
          )
          .map((s) => s.code),
      })),
    );
  }, []);

  // Reset everything back to defaults and clear storage
  const resetAllData = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      return;
    }
    setCourses(initialCourses.map((c) => ({ ...c })));
    setRooms(initialRooms.map((r) => ({ ...r })));
    setInstructors([]);
    setScheduleAssignments([]);
  }, []);

  const value = useMemo(
    () => ({
      courses,
      setCourses,
      rooms,
      instructors,
      scheduleAssignments,
      assignments,
      conflicts,
      addCourse,
      updateCourses,
      addRoom,
      deleteRoom,
      updateRooms,
      addInstructor,
      updateInstructors,
      updateScheduleAssignments,
      syncInstructorCourses,
      resetAllData,
    }),
    [
      courses,
      rooms,
      instructors,
      scheduleAssignments,
      assignments,
      conflicts,
      addCourse,
      updateCourses,
      addRoom,
      deleteRoom,
      updateRooms,
      addInstructor,
      updateInstructors,
      updateScheduleAssignments,
      syncInstructorCourses,
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
