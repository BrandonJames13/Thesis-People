import { coursesOverlap, formatTime } from "./timeUtils";
import { normalizeRoomType, patternDaysMap } from "../data/constants";

const DEFAULT_SECTION = "A";

function normalizeIdentityPart(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export function getAssignmentSubjectCode(row) {
  return String(row?.code ?? row?.subjectCode ?? row?.subject_code ?? "")
    .trim()
    .toUpperCase();
}

export function getAssignmentSection(row) {
  const section = String(row?.section ?? "").trim();
  return section || DEFAULT_SECTION;
}

export function getAssignmentSectionId(row) {
  const explicitIdentity = String(
    row?.sectionIdentity ?? row?.section_identity ?? "",
  ).trim();
  if (explicitIdentity) return explicitIdentity;

  const explicit = String(row?.section_id ?? row?.sectionId ?? "").trim();
  if (explicit) return explicit;

  const code = getAssignmentSubjectCode(row);
  const section = getAssignmentSection(row);
  const academicYear = String(
    row?.academicYear ?? row?.academic_year ?? "",
  ).trim();
  const semester = String(row?.semester ?? "").trim();
  if (!code && !section && !academicYear && !semester) return "";
  return `${code}::${section}::${academicYear}::${semester}`;
}

export function getAssignmentIdentityKey(row) {
  const assignmentId = String(
    row?.assignmentId ?? row?.assignment_id ?? "",
  ).trim();
  if (assignmentId) return `ASSIGNMENT:${normalizeIdentityPart(assignmentId)}`;

  const sectionId = getAssignmentSectionId(row);
  if (sectionId) return `SECTION:${normalizeIdentityPart(sectionId)}`;

  const code = normalizeIdentityPart(
    row?.code ?? row?.subjectCode ?? row?.subject_code,
  );
  const section = normalizeIdentityPart(row?.section ?? DEFAULT_SECTION);
  const academicYear = normalizeIdentityPart(
    row?.academicYear ?? row?.academic_year,
  );
  const semester = normalizeIdentityPart(row?.semester);

  return `COMPOUND:${code}|${section}|${academicYear}|${semester}`;
}

export function formatAssignmentLabel(row) {
  const code = getAssignmentSubjectCode(row) || "UNKNOWN";
  const section = getAssignmentSection(row);
  return `${code}-${section}`;
}

function parseTimeTextToMinutes(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;

  const match = text.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const ampm = String(match[3]).toUpperCase();

  if (ampm === "PM" && hour !== 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;

  return hour * 60 + minute;
}

function parse24TextToMinutes(value) {
  const text = String(value ?? "").trim();
  if (!text.includes(":")) return null;

  const [hourRaw, minuteRaw] = text.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;

  return hour * 60 + minute;
}

function minutesTo24Text(totalMinutes) {
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function extractStartTime24(row, fallback = "") {
  const raw = String(row?.time ?? "").trim();
  if (!raw) return fallback;

  const fromTimeText = parseTimeTextToMinutes(raw);
  if (fromTimeText != null) {
    return minutesTo24Text(fromTimeText);
  }

  const from24Text = parse24TextToMinutes(raw);
  if (from24Text != null) {
    return minutesTo24Text(from24Text);
  }

  return fallback;
}

function getPatternForRow(row, fallback = "MWF") {
  const pattern = String(row?.pattern ?? "")
    .trim()
    .toUpperCase();
  if (pattern && patternDaysMap[pattern]) return pattern;
  return fallback;
}

function buildCandidateStarts({
  duration,
  startTime,
  endTime,
  preferredStart,
  stepMinutes = 30,
}) {
  const durationMinutes = Math.max(1, Math.round((Number(duration) || 0) * 60));
  const startMinutes = parse24TextToMinutes(startTime);
  const endMinutes = parse24TextToMinutes(endTime);
  if (
    startMinutes == null ||
    endMinutes == null ||
    startMinutes >= endMinutes
  ) {
    return [];
  }

  const starts = [];
  for (
    let cursor = startMinutes;
    cursor + durationMinutes <= endMinutes;
    cursor += stepMinutes
  ) {
    starts.push(cursor);
  }

  if (preferredStart) {
    const preferredMinutes = parse24TextToMinutes(preferredStart);
    if (
      preferredMinutes != null &&
      preferredMinutes + durationMinutes <= endMinutes &&
      preferredMinutes >= startMinutes
    ) {
      return [
        preferredMinutes,
        ...starts.filter((slot) => slot !== preferredMinutes),
      ];
    }
  }

  return starts;
}

function hasCoverageConflict(
  existingAssignments,
  testAssignment,
  assignmentKeyToIgnore,
) {
  const testKey = getAssignmentIdentityKey(testAssignment);

  return existingAssignments.some((assignment) => {
    const existingKey = getAssignmentIdentityKey(assignment);
    if (existingKey === testKey) return false;
    if (assignmentKeyToIgnore && existingKey === assignmentKeyToIgnore)
      return false;

    const sameRoom =
      assignment.room &&
      testAssignment.room &&
      assignment.room === testAssignment.room;
    const sameInstructor =
      assignment.instructor &&
      testAssignment.instructor &&
      assignment.instructor.trim().toLowerCase() ===
        testAssignment.instructor.trim().toLowerCase();

    if (!sameRoom && !sameInstructor) return false;
    return coursesOverlap(assignment, testAssignment);
  });
}

function buildEligibleRooms(roomPool, assignment) {
  const neededType = normalizeRoomType(assignment.roomType);
  return roomPool.filter((room) => {
    if (room.status === "Maintenance") return false;
    if ((room.capacity ?? 0) < (assignment.enrolled ?? 0)) return false;
    return normalizeRoomType(room.type) === neededType;
  });
}

function findOpenPlacementForAssignment({
  assignment,
  roomPool,
  existingAssignments,
  startTime,
  endTime,
  preferredStart,
  preferredRoom,
}) {
  const duration = Number(assignment.duration ?? 1.5) || 1.5;
  const pattern = getPatternForRow(assignment, "MWF");
  const candidateStarts = buildCandidateStarts({
    duration,
    startTime,
    endTime,
    preferredStart,
  });

  if (candidateStarts.length === 0) return null;

  const eligibleRooms = buildEligibleRooms(roomPool, assignment);
  if (eligibleRooms.length === 0) return null;

  const orderedRooms = [...eligibleRooms].sort((a, b) => {
    if (preferredRoom) {
      if (a.number === preferredRoom && b.number !== preferredRoom) return -1;
      if (b.number === preferredRoom && a.number !== preferredRoom) return 1;
    }

    // Prefer tighter capacity fit to avoid room coverage waste.
    const aWaste = Math.max(0, (a.capacity ?? 0) - (assignment.enrolled ?? 0));
    const bWaste = Math.max(0, (b.capacity ?? 0) - (assignment.enrolled ?? 0));
    return aWaste - bWaste;
  });

  const selfKey = getAssignmentIdentityKey(assignment);

  for (const slotMinutes of candidateStarts) {
    const slot = minutesTo24Text(slotMinutes);
    for (const room of orderedRooms) {
      const testAssignment = {
        ...assignment,
        pattern,
        room: room.number,
        duration,
        time: `${pattern} ${formatTime(slot)}`,
      };

      const conflict = hasCoverageConflict(
        existingAssignments,
        testAssignment,
        selfKey,
      );
      if (!conflict) {
        return testAssignment;
      }
    }
  }

  return null;
}

function mergeWithExistingAssignments(
  existingAssignments,
  generatedAssignments,
) {
  const mergedByKey = new Map();

  existingAssignments.forEach((assignment) => {
    mergedByKey.set(getAssignmentIdentityKey(assignment), { ...assignment });
  });

  generatedAssignments.forEach((assignment) => {
    mergedByKey.set(getAssignmentIdentityKey(assignment), { ...assignment });
  });

  return Array.from(mergedByKey.values());
}

// Load saved soft constraint weights from localStorage
function getSoftWeights() {
  const defaults = {
    timePreference: 30,
    roomType: 25,
    compactness: 25,
    balance: 20,
  };

  try {
    const raw = localStorage.getItem("rss_soft_weights");
    if (raw) return JSON.parse(raw);
  } catch {
    return defaults;
  }

  return defaults;
}

// Score a candidate assignment using soft constraint weights
function scoreSoftConstraints(
  course,
  room,
  slotTime,
  existingAssignments,
  weights,
) {
  let score = 0;

  // Room type matching (weight: roomType)
  const wantLab = normalizeRoomType(course.roomType) === "Computer Lab";
  const isLab = normalizeRoomType(room.type) === "Computer Lab";
  if (wantLab === isLab) score += weights.roomType;

  // Capacity balance — prefer rooms closest to enrollment (weight: balance)
  if (course.enrolled > 0 && room.capacity >= course.enrolled) {
    const waste = room.capacity - course.enrolled;
    const wasteRatio = waste / room.capacity;
    score += weights.balance * (1 - wasteRatio);
  }

  // Compactness — prefer morning slots (weight: compactness)
  const [slotH] = slotTime.split(":").map(Number);
  if (slotH >= 7 && slotH <= 12) score += weights.compactness;
  else if (slotH <= 15) score += weights.compactness * 0.5;

  return score;
}

export function runAutoSchedule({
  sectionRows,
  rooms,
  instructors,
  scheduleAssignments,
  startTime,
  endTime,
  pattern,
  activeDays,
}) {
  if (activeDays.length === 0)
    return { error: "Please select at least one active day." };

  const weights = getSoftWeights();

  const newRooms = rooms.map((r) => ({ ...r }));
  const baseSections = sectionRows.map((row) => ({ ...row }));
  const existingAssignments = (
    Array.isArray(scheduleAssignments) ? scheduleAssignments : []
  ).map((assignment) => ({ ...assignment }));
  const generatedAssignments = [];

  const startMinutes = parse24TextToMinutes(startTime);
  const endMinutes = parse24TextToMinutes(endTime);
  if (
    startMinutes == null ||
    endMinutes == null ||
    startMinutes >= endMinutes
  ) {
    return {
      error: "Please set a valid scheduling window.",
    };
  }

  // Work from clean assignment rows instead of mutating source course rows in-place.
  const pending = baseSections.map((c) => ({
    ...c,
    status: "Pending",
    room: "",
    time: "",
    pattern: "",
    instructor: c.instructor || "",
  }));

  // Reset room statuses before recomputing occupancy.
  newRooms.forEach((r) => {
    if (r.status !== "Maintenance") r.status = "Available";
  });

  if (pending.length === 0) {
    return {
      rooms: newRooms,
      scheduleAssignments: [],
      assigned: 0,
      message: "No subject sections to schedule. Please add sections first.",
    };
  }

  let assigned = 0;

  pending.forEach((course) => {
    const courseDuration = Number(course.duration ?? 1.5) || 1.5;
    const durationMinutes = Math.round(courseDuration * 60);
    if (durationMinutes <= 0) {
      return;
    }

    const preferredStart = extractStartTime24(course, "");
    const coursePattern = getPatternForRow(course, pattern);
    const patternDays = patternDaysMap[coursePattern] ?? [];
    const allDaysActive = patternDays.every((day) => activeDays.includes(day));
    const resolvedPattern = allDaysActive ? coursePattern : pattern;

    const starts = buildCandidateStarts({
      duration: courseDuration,
      startTime,
      endTime,
      preferredStart,
    });

    if (starts.length === 0) {
      return;
    }

    const eligibleRooms = buildEligibleRooms(newRooms, course);
    if (eligibleRooms.length === 0) {
      return;
    }

    const orderedRooms = [...eligibleRooms].sort((a, b) => {
      const aWaste = Math.max(0, (a.capacity ?? 0) - (course.enrolled ?? 0));
      const bWaste = Math.max(0, (b.capacity ?? 0) - (course.enrolled ?? 0));
      return aWaste - bWaste;
    });

    // Find the best room + slot combination using soft constraint scoring
    let bestRoom = null;
    let bestSlot = null;
    let bestScore = -1;

    for (const slotMinutes of starts) {
      const slot = minutesTo24Text(slotMinutes);
      const candidateTime = `${resolvedPattern} ${formatTime(slot)}`;
      const testCourse = {
        ...course,
        time: candidateTime,
        duration: courseDuration,
        pattern: resolvedPattern,
      };

      for (const room of orderedRooms) {
        if (slotMinutes + durationMinutes > endMinutes) continue;

        // Hard constraint: no double booking in this room at this slot
        const occupiedAssignments = [
          ...existingAssignments,
          ...generatedAssignments,
        ];
        const testWithRoom = { ...testCourse, room: room.number };
        if (hasCoverageConflict(occupiedAssignments, testWithRoom)) continue;

        // Score using soft constraints
        const score = scoreSoftConstraints(
          course,
          room,
          slot,
          occupiedAssignments,
          weights,
        );

        const preferredSlotMinutes = preferredStart
          ? parse24TextToMinutes(preferredStart)
          : null;
        const isPreferredSlot =
          preferredSlotMinutes != null && preferredSlotMinutes === slotMinutes;
        const preferenceBonus = isPreferredSlot ? 1000 : 0;

        if (score + preferenceBonus > bestScore) {
          bestScore = score + preferenceBonus;
          bestRoom = room;
          bestSlot = slot;
        }
      }
    }

    if (bestRoom && bestSlot) {
      // Assign instructor: prefer instructors who already teach this course code,
      // or find a free instructor with matching availability
      let assignedInstructor = course.instructor || "";
      if (!assignedInstructor && instructors.length > 0) {
        const candidateTime = `${resolvedPattern} ${formatTime(bestSlot)}`;
        const testCourse = {
          ...course,
          time: candidateTime,
          duration: courseDuration,
          pattern: resolvedPattern,
          room: bestRoom.number,
        };
        const freeInstructor = instructors.find((inst) => {
          // Check instructor not already scheduled at this time
          return !hasCoverageConflict(
            [...existingAssignments, ...generatedAssignments],
            { ...testCourse, instructor: inst.name },
          );
        });
        if (freeInstructor) assignedInstructor = freeInstructor.name;
      }

      const assignment = {
        ...course,
        room: bestRoom.number,
        time: `${resolvedPattern} ${formatTime(bestSlot)}`,
        duration: courseDuration,
        pattern: resolvedPattern,
        instructor: assignedInstructor,
        status: "Assigned",
      };

      // Mark room as Occupied
      bestRoom.status = "Occupied";

      generatedAssignments.push(assignment);
      assigned++;
    }
  });

  const finalAssignments = mergeWithExistingAssignments(
    existingAssignments,
    generatedAssignments,
  );

  finalAssignments.forEach((assignment) => {
    const room = newRooms.find((item) => item.number === assignment.room);
    if (room && room.status !== "Maintenance") {
      room.status = "Occupied";
    }
  });

  return {
    rooms: newRooms,
    scheduleAssignments: finalAssignments,
    assigned,
    message:
      `Auto-generated ${assigned} assignment${assigned !== 1 ? "s" : ""} ` +
      `using section-level durations and current DB availability.`,
  };
}

function getConflictingAssignments(assignments, targetAssignment, targetKey) {
  return assignments.filter((assignment) => {
    const currentKey = getAssignmentIdentityKey(assignment);
    if (currentKey === targetKey) return false;

    const sameRoom =
      assignment.room && assignment.room === targetAssignment.room;
    const sameInstructor =
      assignment.instructor &&
      targetAssignment.instructor &&
      assignment.instructor.trim().toLowerCase() ===
        targetAssignment.instructor.trim().toLowerCase();

    if (!sameRoom && !sameInstructor) return false;
    return coursesOverlap(assignment, targetAssignment);
  });
}

export function applyManualAssignments({
  entries,
  sectionRowsByIdentity,
  scheduleAssignments,
  rooms,
  startTime = "07:00",
  endTime = "21:00",
}) {
  const queue = Array.isArray(entries) ? entries : [];
  if (queue.length === 0) {
    return {
      error: "Please fill in at least one assignment.",
    };
  }

  const nextAssignments = (
    Array.isArray(scheduleAssignments) ? scheduleAssignments : []
  ).map((assignment) => ({ ...assignment }));
  const moved = [];

  for (const entry of queue) {
    const sectionRow = sectionRowsByIdentity.get(entry.assignmentKey);
    if (!sectionRow) continue;

    const assignmentKey = getAssignmentIdentityKey(sectionRow);
    const desired = {
      ...sectionRow,
      sectionId: getAssignmentSectionId(sectionRow),
      room: entry.roomName,
      instructor: entry.instructor || sectionRow.instructor || "",
      duration: Number(entry.duration ?? sectionRow.duration ?? 1.5) || 1.5,
      pattern: getPatternForRow({ pattern: entry.pattern }, "MWF"),
      time: `${getPatternForRow({ pattern: entry.pattern }, "MWF")} ${formatTime(entry.startTime)}`,
      status: "Assigned",
    };

    const desiredStartMinutes = parse24TextToMinutes(entry.startTime);
    const desiredEndMinutes =
      desiredStartMinutes == null
        ? null
        : desiredStartMinutes + Math.round(desired.duration * 60);
    const allowedStartMinutes = parse24TextToMinutes(startTime);
    const allowedEndMinutes = parse24TextToMinutes(endTime);

    if (
      desiredStartMinutes == null ||
      desiredEndMinutes == null ||
      allowedStartMinutes == null ||
      allowedEndMinutes == null ||
      desiredStartMinutes < allowedStartMinutes ||
      desiredEndMinutes > allowedEndMinutes
    ) {
      return {
        error: `${formatAssignmentLabel(desired)} is outside the allowed scheduling window (${startTime} to ${endTime}).`,
      };
    }

    const targetIndex = nextAssignments.findIndex(
      (assignment) => getAssignmentIdentityKey(assignment) === assignmentKey,
    );
    if (targetIndex >= 0) {
      nextAssignments[targetIndex] = { ...desired };
    } else {
      nextAssignments.push({ ...desired });
    }

    const conflicts = getConflictingAssignments(
      nextAssignments,
      desired,
      assignmentKey,
    );

    for (const conflict of conflicts) {
      const conflictKey = getAssignmentIdentityKey(conflict);
      const conflictIndex = nextAssignments.findIndex(
        (assignment) => getAssignmentIdentityKey(assignment) === conflictKey,
      );
      if (conflictIndex < 0) continue;

      const contextAssignments = nextAssignments.filter(
        (_, index) => index !== conflictIndex,
      );
      const relocated = findOpenPlacementForAssignment({
        assignment: conflict,
        roomPool: rooms,
        existingAssignments: contextAssignments,
        startTime,
        endTime,
        preferredStart: extractStartTime24(conflict, ""),
        preferredRoom: conflict.room,
      });

      if (!relocated) {
        return {
          error: `Unable to relocate conflicting assignment ${formatAssignmentLabel(conflict)} within ${startTime} to ${endTime}.`,
        };
      }

      moved.push({
        label: formatAssignmentLabel(conflict),
        fromRoom: conflict.room,
        fromTime: conflict.time,
        toRoom: relocated.room,
        toTime: relocated.time,
      });

      nextAssignments[conflictIndex] = {
        ...conflict,
        ...relocated,
        status: "Assigned",
      };
    }
  }

  return {
    scheduleAssignments: nextAssignments,
    moved,
  };
}

export function checkManualConflict({
  assignmentTarget,
  roomName,
  startTime,
  duration,
  pattern,
  scheduleAssignments,
}) {
  if (!assignmentTarget || !roomName || !startTime) {
    return {
      ok: false,
      type: "error",
      text: "⚠ Please fill in Subject/Section, Room, and Start Time first.",
    };
  }

  const assignmentKey = getAssignmentIdentityKey(assignmentTarget);
  const assignmentLabel = formatAssignmentLabel(assignmentTarget);
  const testCourse = {
    ...assignmentTarget,
    time: `${pattern} ${formatTime(startTime)}`,
    duration,
    pattern,
    room: roomName,
  };
  const conflicting = scheduleAssignments.filter(
    (a) =>
      a.room === roomName &&
      getAssignmentIdentityKey(a) !== assignmentKey &&
      coursesOverlap(a, testCourse),
  );
  if (conflicting.length > 0) {
    return {
      ok: false,
      type: "error",
      text:
        "⚠ Room conflict with: " +
        conflicting.map((a) => formatAssignmentLabel(a)).join(", "),
    };
  }
  const [h, m] = startTime.split(":").map(Number);
  const total = h * 60 + m + Math.round(duration * 60);
  const eh = Math.floor(total / 60);
  const em = total % 60;
  const endLabel = `${eh > 12 ? eh - 12 : eh === 0 ? 12 : eh}:${String(em).padStart(2, "0")} ${eh >= 12 ? "PM" : "AM"}`;
  return {
    ok: true,
    type: "success",
    text: `✓ No conflicts for ${assignmentLabel} · ${pattern} ${formatTime(startTime)}–${endLabel} in ${roomName}`,
  };
}
