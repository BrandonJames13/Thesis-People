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
import {
  formatAssignmentLabel,
  getAssignmentIdentityKey,
  getAssignmentSectionId,
  getAssignmentSubjectCode,
} from "../utils/scheduleUtils";
import { normalizeRoomType } from "../data/constants";
import { mapReallocationEntriesToConflictLog } from "../utils/conflictLogUtils";

const ConflictContext = createContext();

function normalizeIdentityPart(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function getAssignmentId(row) {
  return String(row?.assignmentId ?? row?.assignment_id ?? "").trim();
}

function getAssignmentIdentifiers(row) {
  const assignmentId = getAssignmentId(row);
  const sectionId = String(getAssignmentSectionId(row) ?? "").trim();
  const identityKey = getAssignmentIdentityKey(row);

  const entityKey = assignmentId
    ? `ASSIGNMENT:${normalizeIdentityPart(assignmentId)}`
    : sectionId
      ? `SECTION:${normalizeIdentityPart(sectionId)}`
      : identityKey;

  return {
    assignmentId,
    sectionId,
    identityKey,
    entityKey,
  };
}

function getTargetIdentifiers(conflict) {
  return {
    assignmentId: String(conflict?.affectedAssignmentId ?? "").trim(),
    sectionId: String(conflict?.affectedSectionId ?? "").trim(),
    identityKey: String(conflict?.affectedAssignmentKey ?? "").trim(),
  };
}

function mergeIdentifiers(base, override) {
  return {
    assignmentId: override.assignmentId || base.assignmentId,
    sectionId: override.sectionId || base.sectionId,
    identityKey: override.identityKey || base.identityKey,
  };
}

function isSameAssignment(row, target) {
  const rowIds = getAssignmentIdentifiers(row);

  if (target.assignmentId && rowIds.assignmentId) {
    return (
      normalizeIdentityPart(rowIds.assignmentId) ===
      normalizeIdentityPart(target.assignmentId)
    );
  }

  if (target.sectionId && rowIds.sectionId) {
    return (
      normalizeIdentityPart(rowIds.sectionId) ===
      normalizeIdentityPart(target.sectionId)
    );
  }

  return rowIds.identityKey === target.identityKey;
}

function getSectionRef(row) {
  return getAssignmentSectionId(row) || getAssignmentIdentityKey(row);
}

function getSectionDisplay(row) {
  return `${formatAssignmentLabel(row)} [${getSectionRef(row)}]`;
}

export function ConflictProvider({ children }) {
  const { scheduleAssignments, updateScheduleAssignments, rooms } = useData();
  const [reallocationLog, setReallocationLog] = useState([]);
  const [dismissedSoftConflicts, setDismissedSoftConflicts] = useState(
    new Set(),
  );

  // Create a room index for O(1) lookup instead of O(n) find
  const roomsByNumber = useMemo(() => {
    const map = new Map();
    rooms.forEach((room) => map.set(room.number, room));
    return map;
  }, [rooms]);

  const detectConflicts = useCallback(() => {
    const hard = [];
    const soft = [];
    const seen = new Set();

    for (let i = 0; i < scheduleAssignments.length; i++) {
      for (let j = i + 1; j < scheduleAssignments.length; j++) {
        const a = scheduleAssignments[i];
        const b = scheduleAssignments[j];
        if (!coursesOverlap(a, b)) continue;
        const aIds = getAssignmentIdentifiers(a);
        const bIds = getAssignmentIdentifiers(b);
        const pairKey = [aIds.entityKey, bIds.entityKey].sort().join("|");
        const aLabel = formatAssignmentLabel(a);
        const bLabel = formatAssignmentLabel(b);

        if (a.room && b.room && a.room === b.room) {
          const id = `DOUBLE_BOOK|${pairKey}`;
          if (!seen.has(id)) {
            seen.add(id);
            const days = sharedDays(a, b);
            const ta = parseCourseTime(a);
            const slot = `${days[0]}-${String(Math.floor(ta.startMin / 60)).padStart(2, "0")}${String(ta.startMin % 60).padStart(2, "0")}`;
            const aSection = getSectionDisplay(a);
            const bSection = getSectionDisplay(b);
            hard.push({
              id,
              type: "DOUBLE_BOOKING",
              severity: "HARD",
              courses: [a, b],
              primaryAssignmentKey: aIds.identityKey,
              affectedAssignmentKey: bIds.identityKey,
              primaryAssignmentId: aIds.assignmentId,
              affectedAssignmentId: bIds.assignmentId,
              primarySectionId: aIds.sectionId,
              affectedSectionId: bIds.sectionId,
              room: a.room,
              days,
              title: `Double Booking — ${a.room} · ${days.join("/")} ${formatTimeFromMin(ta.startMin)} · ${aLabel} vs ${bLabel}`,
              desc: `<strong>${aSection}</strong> (${a.title}${a.instructor ? " · " + a.instructor : ""}${a.enrolled ? " · " + a.enrolled + " enrolled" : ""}) and <strong>${bSection}</strong> (${b.title}${b.instructor ? " · " + b.instructor : ""}${b.enrolled ? " · " + b.enrolled + " enrolled" : ""}) are both assigned to ${a.room} at the same time.`,
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
            const aSection = getSectionDisplay(a);
            const bSection = getSectionDisplay(b);
            hard.push({
              id,
              type: "INSTRUCTOR_CONFLICT",
              severity: "HARD",
              courses: [a, b],
              primaryAssignmentKey: aIds.identityKey,
              affectedAssignmentKey: bIds.identityKey,
              primaryAssignmentId: aIds.assignmentId,
              affectedAssignmentId: bIds.assignmentId,
              primarySectionId: aIds.sectionId,
              affectedSectionId: bIds.sectionId,
              days,
              title: `Instructor Conflict — ${a.instructor} · ${days.join("/")} ${formatTimeFromMin(ta.startMin)} · ${aLabel} vs ${bLabel}`,
              desc: `Instructor <strong>${a.instructor}</strong> is simultaneously scheduled for <strong>${aSection}</strong> (${a.room}) and <strong>${bSection}</strong> (${b.room}) on ${days.join("/")} at ${formatTimeFromMin(ta.startMin)}.`,
              meta: `TYPE: INSTRUCTOR_CONFLICT · SEVERITY: HARD · INSTRUCTOR: ${a.instructor.replace(/[^a-zA-Z]/g, "_").toUpperCase()} · SLOT: ${slot}`,
            });
          }
        }
      }

      const course = scheduleAssignments[i];
      const room = roomsByNumber.get(course.room);
      if (room && course.enrolled > 0) {
        const courseIds = getAssignmentIdentifiers(course);
        const utilization = course.enrolled / room.capacity;
        if (utilization < 0.6) {
          const id = `UNDERUTIL|${courseIds.entityKey}`;
          if (!dismissedSoftConflicts.has(id)) {
            const pct = Math.round(utilization * 100);
            const betterRoom = Array.from(roomsByNumber.values()).find(
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
              assignmentKey: courseIds.identityKey,
              assignmentId: courseIds.assignmentId,
              sectionId: courseIds.sectionId,
              title: `Room Underutilization — ${formatAssignmentLabel(course)} in ${course.room} (${room.capacity} seats)`,
              desc: `<strong>${getSectionDisplay(course)}</strong> (${course.title} · ${course.enrolled} enrolled) is in ${course.room} (capacity ${room.capacity}) at ${pct}% utilization.${betterRoom ? ` ${betterRoom.number} (${betterRoom.capacity} seats) would be more appropriate.` : ""}`,
              meta: `TYPE: ROOM_UNDERUTILIZATION · SEVERITY: SOFT · WEIGHT: 25% · UTILIZATION: ${pct}%`,
              betterRoom: betterRoom || null,
            });
          }
        }
      }
    }

    return { hard, soft };
  }, [scheduleAssignments, roomsByNumber, dismissedSoftConflicts]);

  // Memoize conflict detection results to prevent redundant O(n²) computation
  const { hard: hardConflicts, soft: softConflicts } = useMemo(
    () => detectConflicts(),
    [detectConflicts],
  );

  const hardConflictCount = hardConflicts.length;
  const softConflictCount = softConflicts.length;

  // Explicitly refresh conflict detection (called after manual actions)
  const refreshConflicts = useCallback(() => {
    return detectConflicts();
  }, [detectConflicts]);

  const resolveConflict = useCallback(
    (conflictId) => {
      const cf = hardConflicts.find((c) => c.id === conflictId);
      if (!cf) return "Conflict already resolved.";

      const targetIds = mergeIdentifiers(
        getAssignmentIdentifiers(cf.courses?.[1]),
        getTargetIdentifiers(cf),
      );
      const courseToMove = scheduleAssignments.find((assignment) =>
        isSameAssignment(assignment, targetIds),
      );
      if (!courseToMove) return "Conflict row no longer exists.";

      const neededType = normalizeRoomType(courseToMove.roomType);
      const newAssignments = scheduleAssignments.map((s) => ({ ...s }));
      const target = newAssignments.find((s) => isSameAssignment(s, targetIds));
      if (!target) return null;

      const targetIdentifiers = getAssignmentIdentifiers(target);

      const freeRoom = Array.from(roomsByNumber.values()).find(
        (r) =>
          r.number !== courseToMove.room &&
          r.type === neededType &&
          r.status !== "Maintenance" &&
          r.capacity >= (courseToMove.enrolled || 0) &&
          !newAssignments.some(
            (s) =>
              !isSameAssignment(s, targetIdentifiers) &&
              s.room === r.number &&
              coursesOverlap(s, target),
          ),
      );

      let message;
      if (freeRoom) {
        const oldRoom = target.room;
        target.room = freeRoom.number;
        const targetLabel = formatAssignmentLabel(target);
        const sectionRef = getSectionRef(target);
        setReallocationLog((prev) => [
          ...prev,
          {
            code: `${targetLabel} [${sectionRef}]`,
            courseCode: getAssignmentSubjectCode(target),
            sectionLabel: targetLabel,
            assignmentId: targetIdentifiers.assignmentId,
            assignmentKey: targetIdentifiers.identityKey,
            sectionId: targetIdentifiers.sectionId || sectionRef,
            from: `${oldRoom} · ${target.time}`,
            to: `${freeRoom.number} · ${target.time}`,
            fromDetail: {
              room: oldRoom,
              time: target.time,
            },
            toDetail: {
              room: freeRoom.number,
              time: target.time,
            },
            type: cf.type,
            typeLabel:
              cf.type === "DOUBLE_BOOKING" ? "Double Book" : "Instructor",
            resolvedAt: new Date().toISOString(),
          },
        ]);
        message = `${targetLabel} reallocated to ${freeRoom.number} ✓`;
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
              !isSameAssignment(s, targetIdentifiers) &&
              (s.room === target.room ||
                (s.instructor && s.instructor === target.instructor)) &&
              coursesOverlap(s, testCourse),
          );
          if (!hasConflict) {
            const oldTime = target.time;
            target.time = testCourse.time;
            const targetLabel = formatAssignmentLabel(target);
            const sectionRef = getSectionRef(target);
            setReallocationLog((prev) => [
              ...prev,
              {
                code: `${targetLabel} [${sectionRef}]`,
                courseCode: getAssignmentSubjectCode(target),
                sectionLabel: targetLabel,
                assignmentId: targetIdentifiers.assignmentId,
                assignmentKey: targetIdentifiers.identityKey,
                sectionId: targetIdentifiers.sectionId || sectionRef,
                from: `${target.room} · ${oldTime}`,
                to: `${target.room} · ${target.time}`,
                fromDetail: {
                  room: target.room,
                  time: oldTime,
                },
                toDetail: {
                  room: target.room,
                  time: target.time,
                },
                type: cf.type,
                typeLabel:
                  cf.type === "DOUBLE_BOOKING" ? "Double Book" : "Instructor",
                resolvedAt: new Date().toISOString(),
              },
            ]);
            message = `${targetLabel} rescheduled to ${target.time} ✓`;
            moved = true;
            break;
          }
        }
        if (!moved) message = "Could not auto-resolve — try Manual Override.";
      }

      updateScheduleAssignments(newAssignments);
      return message;
    },
    [
      hardConflicts,
      scheduleAssignments,
      roomsByNumber,
      updateScheduleAssignments,
    ],
  );

  const autoResolveAll = useCallback(() => {
    if (scheduleAssignments.length === 0) {
      return "No schedule generated yet. Please generate a schedule first.";
    }
    if (hardConflicts.length === 0) {
      return "No hard conflicts to resolve!";
    }
    let attempts = 0;
    let currentHard = hardConflicts;
    while (currentHard.length > 0 && attempts < 20) {
      resolveConflict(currentHard[0].id);
      currentHard = refreshConflicts().hard;
      attempts++;
    }
    return null;
  }, [scheduleAssignments, hardConflicts, resolveConflict, refreshConflicts]);

  const suggestBetterRoom = useCallback(
    (conflictId) => {
      const cf = softConflicts.find((c) => c.id === conflictId);
      if (!cf?.betterRoom) return null;

      const newAssignments = scheduleAssignments.map((s) => ({ ...s }));
      const targetIds = mergeIdentifiers(
        getAssignmentIdentifiers(cf.courses?.[0]),
        {
          assignmentId: String(cf.assignmentId ?? "").trim(),
          sectionId: String(cf.sectionId ?? "").trim(),
          identityKey: String(
            cf.assignmentKey ?? getAssignmentIdentityKey(cf.courses?.[0]),
          ).trim(),
        },
      );
      const target = newAssignments.find((s) => isSameAssignment(s, targetIds));
      if (!target) return null;

      const targetIdentifiers = getAssignmentIdentifiers(target);

      const oldRoom = target.room;
      target.room = cf.betterRoom.number;

      const targetLabel = formatAssignmentLabel(target);

      setReallocationLog((prev) => [
        ...prev,
        {
          code: `${targetLabel} [${getSectionRef(target)}]`,
          courseCode: getAssignmentSubjectCode(target),
          sectionLabel: targetLabel,
          assignmentId: targetIdentifiers.assignmentId,
          assignmentKey: targetIdentifiers.identityKey,
          sectionId: targetIdentifiers.sectionId || getSectionRef(target),
          from: `${oldRoom} · ${target.time}`,
          to: `${cf.betterRoom.number} · ${target.time}`,
          fromDetail: {
            room: oldRoom,
            time: target.time,
          },
          toDetail: {
            room: cf.betterRoom.number,
            time: target.time,
          },
          type: "ROOM_UNDERUTILIZATION",
          typeLabel: "Underutil",
          resolvedAt: new Date().toISOString(),
        },
      ]);

      updateScheduleAssignments(newAssignments);
      return `${targetLabel} moved to ${cf.betterRoom.number} ✓`;
    },
    [softConflicts, scheduleAssignments, updateScheduleAssignments],
  );

  const dismissSoftConflict = useCallback((conflictId) => {
    setDismissedSoftConflicts((prev) => new Set([...prev, conflictId]));
  }, []);

  const buildConflictLogPayloads = useCallback(() => {
    return mapReallocationEntriesToConflictLog(reallocationLog);
  }, [reallocationLog]);

  const value = useMemo(
    () => ({
      // Cached conflict results - use these instead of calling detectConflicts()
      hardConflicts,
      softConflicts,
      hardConflictCount,
      softConflictCount,

      // Explicit refresh function for manual refresh
      refreshConflicts,

      // Action functions
      resolveConflict,
      autoResolveAll,
      suggestBetterRoom,
      dismissSoftConflict,

      // Legacy - kept for compatibility but deprecated
      detectConflicts,

      // Reallocation tracking
      reallocationLog,
      buildConflictLogPayloads,
      dismissedSoftConflicts,
    }),
    [
      hardConflicts,
      softConflicts,
      hardConflictCount,
      softConflictCount,
      refreshConflicts,
      resolveConflict,
      autoResolveAll,
      suggestBetterRoom,
      dismissSoftConflict,
      detectConflicts,
      reallocationLog,
      buildConflictLogPayloads,
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
