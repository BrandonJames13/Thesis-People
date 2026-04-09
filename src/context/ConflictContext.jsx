import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from "react";
import { useData } from "./DataContext";
import {
  parseCourseTime,
  coursesOverlap,
  sharedDays,
  formatTimeFromMin,
  formatTime,
} from "../utils/timeUtils";

const ConflictContext = createContext();

export function ConflictProvider({ children }) {
  const {
    scheduleAssignments,
    updateScheduleAssignments,
    rooms,
    courses,
    updateSubjectSectionsFromCourseRows,
  } = useData();
  const [reallocationLog, setReallocationLog] = useState([]);
  const [dismissedSoftConflicts, setDismissedSoftConflicts] = useState(
    new Set(),
  );

  const detectConflicts = useCallback(() => {
    const hard = [];
    const soft = [];
    const seen = new Set();

    for (let i = 0; i < scheduleAssignments.length; i++) {
      for (let j = i + 1; j < scheduleAssignments.length; j++) {
        const a = scheduleAssignments[i];
        const b = scheduleAssignments[j];
        if (!coursesOverlap(a, b)) continue;
        const pairKey = [a.code, b.code].sort().join("|");

        if (a.room && b.room && a.room === b.room) {
          const id = `DOUBLE_BOOK|${pairKey}`;
          if (!seen.has(id)) {
            seen.add(id);
            const days = sharedDays(a, b);
            const ta = parseCourseTime(a);
            const slot = `${days[0]}-${String(Math.floor(ta.startMin / 60)).padStart(2, "0")}${String(ta.startMin % 60).padStart(2, "0")}`;
            hard.push({
              id,
              type: "DOUBLE_BOOKING",
              severity: "HARD",
              courses: [a, b],
              room: a.room,
              days,
              title: `Double Booking — ${a.room} · ${days.join("/")} ${formatTimeFromMin(ta.startMin)}`,
              desc: `<strong>${a.code}</strong> (${a.title}${a.instructor ? " · " + a.instructor : ""}${a.enrolled ? " · " + a.enrolled + " enrolled" : ""}) and <strong>${b.code}</strong> (${b.title}${b.instructor ? " · " + b.instructor : ""}${b.enrolled ? " · " + b.enrolled + " enrolled" : ""}) are both assigned to ${a.room} at the same time.`,
              meta: `TYPE: DOUBLE_BOOKING · SEVERITY: HARD · ROOM: ${a.room} · SLOT: ${slot}`,
            });
          }
        }

        if (
          a.instructor &&
          b.instructor &&
          a.instructor.trim().toLowerCase() ===
            b.instructor.trim().toLowerCase() &&
          a.room !== b.room
        ) {
          const id = `INSTRUCTOR|${pairKey}`;
          if (!seen.has(id)) {
            seen.add(id);
            const days = sharedDays(a, b);
            const ta = parseCourseTime(a);
            const slot = `${days[0]}-${String(Math.floor(ta.startMin / 60)).padStart(2, "0")}${String(ta.startMin % 60).padStart(2, "0")}`;
            hard.push({
              id,
              type: "INSTRUCTOR_CONFLICT",
              severity: "HARD",
              courses: [a, b],
              days,
              title: `Instructor Conflict — ${a.instructor} · ${days.join("/")} ${formatTimeFromMin(ta.startMin)}`,
              desc: `Instructor <strong>${a.instructor}</strong> is simultaneously scheduled for <strong>${a.code}</strong> (${a.room}) and <strong>${b.code}</strong> (${b.room}) on ${days.join("/")} at ${formatTimeFromMin(ta.startMin)}.`,
              meta: `TYPE: INSTRUCTOR_CONFLICT · SEVERITY: HARD · INSTRUCTOR: ${a.instructor.replace(/[^a-zA-Z]/g, "_").toUpperCase()} · SLOT: ${slot}`,
            });
          }
        }
      }

      const course = scheduleAssignments[i];
      const room = rooms.find((r) => r.number === course.room);
      if (room && course.enrolled > 0) {
        const utilization = course.enrolled / room.capacity;
        if (utilization < 0.6) {
          const id = `UNDERUTIL|${course.code}`;
          if (!dismissedSoftConflicts.has(id)) {
            const pct = Math.round(utilization * 100);
            const betterRoom = rooms.find(
              (r) =>
                r.number !== room.number &&
                r.type === room.type &&
                r.capacity >= course.enrolled &&
                r.capacity < room.capacity &&
                r.status !== "Maintenance",
            );
            soft.push({
              id,
              type: "ROOM_UNDERUTILIZATION",
              severity: "SOFT",
              courses: [course],
              title: `Room Underutilization — ${course.code} in ${course.room} (${room.capacity} seats)`,
              desc: `<strong>${course.code}</strong> (${course.title} · ${course.enrolled} enrolled) is in ${course.room} (capacity ${room.capacity}) at ${pct}% utilization.${betterRoom ? ` ${betterRoom.number} (${betterRoom.capacity} seats) would be more appropriate.` : ""}`,
              meta: `TYPE: ROOM_UNDERUTILIZATION · SEVERITY: SOFT · WEIGHT: 25% · UTILIZATION: ${pct}%`,
              betterRoom: betterRoom || null,
            });
          }
        }
      }
    }

    return { hard, soft };
  }, [scheduleAssignments, rooms, dismissedSoftConflicts]);

  const resolveConflict = useCallback(
    (conflictId) => {
      const { hard } = detectConflicts();
      const cf = hard.find((c) => c.id === conflictId);
      if (!cf) return "Conflict already resolved.";

      const courseToMove = cf.courses[1];
      const neededType =
        courseToMove.roomType === "Lab" ? "Computer Lab" : "Lecture";
      const newAssignments = scheduleAssignments.map((s) => ({ ...s }));
      const target = newAssignments.find((s) => s.code === courseToMove.code);
      if (!target) return null;

      const freeRoom = rooms.find(
        (r) =>
          r.number !== courseToMove.room &&
          r.type === neededType &&
          r.status !== "Maintenance" &&
          r.capacity >= (courseToMove.enrolled || 0) &&
          !newAssignments.some(
            (s) =>
              s.code !== courseToMove.code &&
              s.room === r.number &&
              coursesOverlap(s, courseToMove),
          ),
      );

      let message;
      if (freeRoom) {
        const oldRoom = target.room;
        target.room = freeRoom.number;
        setReallocationLog((prev) => [
          ...prev,
          {
            code: target.code,
            from: `${oldRoom} · ${target.time}`,
            to: `${freeRoom.number} · ${target.time}`,
            type: cf.type,
            typeLabel:
              cf.type === "DOUBLE_BOOKING" ? "Double Book" : "Instructor",
          },
        ]);
        message = `${target.code} reallocated to ${freeRoom.number} ✓`;
      } else {
        const slots = [
          "08:00",
          "09:00",
          "10:00",
          "11:00",
          "13:00",
          "14:00",
          "15:00",
          "16:00",
        ];
        let moved = false;
        for (const slot of slots) {
          const testCourse = {
            ...target,
            time: `${target.pattern} ${formatTime(slot)}`,
          };
          const hasConflict = newAssignments.some(
            (s) =>
              s.code !== target.code &&
              (s.room === target.room ||
                (s.instructor && s.instructor === target.instructor)) &&
              coursesOverlap(s, testCourse),
          );
          if (!hasConflict) {
            const oldTime = target.time;
            target.time = testCourse.time;
            setReallocationLog((prev) => [
              ...prev,
              {
                code: target.code,
                from: `${target.room} · ${oldTime}`,
                to: `${target.room} · ${target.time}`,
                type: cf.type,
                typeLabel:
                  cf.type === "DOUBLE_BOOKING" ? "Double Book" : "Instructor",
              },
            ]);
            message = `${target.code} rescheduled to ${target.time} ✓`;
            moved = true;
            break;
          }
        }
        if (!moved) message = "Could not auto-resolve — try Manual Override.";
      }

      // Update courses to reflect room/time changes
      const newCourses = courses.map((c) => {
        const updated = newAssignments.find((s) => s.code === c.code);
        return updated ? { ...c, room: updated.room, time: updated.time } : c;
      });

      updateScheduleAssignments(newAssignments);
      updateSubjectSectionsFromCourseRows(newCourses);
      return message;
    },
    [
      detectConflicts,
      scheduleAssignments,
      rooms,
      courses,
      updateScheduleAssignments,
      updateSubjectSectionsFromCourseRows,
    ],
  );

  const autoResolveAll = useCallback(() => {
    if (scheduleAssignments.length === 0) {
      return "No schedule generated yet. Please generate a schedule first.";
    }
    const { hard } = detectConflicts();
    if (hard.length === 0) {
      return "No hard conflicts to resolve!";
    }
    let attempts = 0;
    let currentHard = hard;
    while (currentHard.length > 0 && attempts < 20) {
      resolveConflict(currentHard[0].id);
      currentHard = detectConflicts().hard;
      attempts++;
    }
    return null;
  }, [scheduleAssignments, detectConflicts, resolveConflict]);

  const suggestBetterRoom = useCallback(
    (conflictId) => {
      const { soft } = detectConflicts();
      const cf = soft.find((c) => c.id === conflictId);
      if (!cf?.betterRoom) return null;

      const newAssignments = scheduleAssignments.map((s) => ({ ...s }));
      const target = newAssignments.find((s) => s.code === cf.courses[0].code);
      if (!target) return null;

      const oldRoom = target.room;
      target.room = cf.betterRoom.number;
      const newCourses = courses.map((c) =>
        c.code === target.code ? { ...c, room: cf.betterRoom.number } : c,
      );

      setReallocationLog((prev) => [
        ...prev,
        {
          code: target.code,
          from: `${oldRoom} · ${target.time}`,
          to: `${cf.betterRoom.number} · ${target.time}`,
          type: "ROOM_UNDERUTILIZATION",
          typeLabel: "Underutil",
        },
      ]);

      updateScheduleAssignments(newAssignments);
      updateSubjectSectionsFromCourseRows(newCourses);
      return `${target.code} moved to ${cf.betterRoom.number} ✓`;
    },
    [
      detectConflicts,
      scheduleAssignments,
      courses,
      updateScheduleAssignments,
      updateSubjectSectionsFromCourseRows,
    ],
  );

  const dismissSoftConflict = useCallback((conflictId) => {
    setDismissedSoftConflicts((prev) => new Set([...prev, conflictId]));
  }, []);

  const value = useMemo(
    () => ({
      detectConflicts,
      resolveConflict,
      autoResolveAll,
      suggestBetterRoom,
      dismissSoftConflict,
      reallocationLog,
      dismissedSoftConflicts,
    }),
    [
      detectConflicts,
      resolveConflict,
      autoResolveAll,
      suggestBetterRoom,
      dismissSoftConflict,
      reallocationLog,
      dismissedSoftConflicts,
    ],
  );

  return (
    <ConflictContext.Provider value={value}>
      {children}
    </ConflictContext.Provider>
  );
}

export function useConflicts() {
  const ctx = useContext(ConflictContext);
  if (!ctx)
    throw new Error("useConflicts must be used within ConflictProvider");
  return ctx;
}
