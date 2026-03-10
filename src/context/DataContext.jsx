import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from "react";
import { initialCourses } from "../data/initialCourses";
import { initialRooms } from "../data/initialRooms";

const DataContext = createContext();

export function DataProvider({ children }) {
  const [courses, setCourses] = useState(() =>
    initialCourses.map((c) => ({ ...c })),
  );
  const [rooms, setRooms] = useState(() => initialRooms.map((r) => ({ ...r })));
  const [instructors, setInstructors] = useState([]);
  const [scheduleAssignments, setScheduleAssignments] = useState([]);

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
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
