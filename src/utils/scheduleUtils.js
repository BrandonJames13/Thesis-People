import { coursesOverlap, formatTime } from "./timeUtils";
import { normalizeRoomType, patternDaysMap } from "../data/constants";

const DEFAULT_SECTION = "A";

// ─── Identity helpers ────────────────────────────────────────────────────────

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

// ─── Schema mapping helpers ───────────────────────────────────────────────────

/**
 * Extracts the normalized (base) section_id by stripping Lec/Lab suffixes.
 * Used to resolve the actual database section_id from UI section identities.
 */
export function getNormalizedSectionId(row) {
  const sectionId = String(row?.sectionId ?? row?.section_id ?? "").trim();
  if (!sectionId) return ""; 
  // Strip __LEC or __LAB suffixes used for split components
  return sectionId.replace(/__(LEC|LAB)$/, "");
}

/**
 * Resolves a room number/name to a room ID by looking up in the room pool.
 * Returns the room object if found, or null.
 */
export function resolveRoomByNumber(roomNumber, roomPool) {
  if (!roomNumber) return null;
  const normalized = String(roomNumber).trim();
  return roomPool.find(r => String(r?.number ?? "").trim() === normalized) || null;
}

/**
 * Formats a time range for display in 12-hour format.
 * Example: "7:00 AM – 8:30 AM"
 */
export function formatTimeDisplay(startTime24, durationHours) {
  const startMinutes = parse24TextToMinutes(startTime24);
  if (startMinutes == null) return "";
  
  const endMinutes = startMinutes + Math.round(durationHours * 60);
  const startFormatted = formatTime(startTime24);
  const endFormatted = formatTime(minutesTo24Text(endMinutes));
  
  return `${startFormatted} – ${endFormatted}`;
}

/**
 * Converts 24-hour time string to SQL TIME format (HH:MM:SS).
 */
export function parseTimeToSQL(time24String) {
  const minutes = parse24TextToMinutes(time24String);
  if (minutes == null) return "00:00:00";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:00`;
}

/**
 * Builds a normalized assignment object with proper FK columns and display columns.
 * Ensures the schema matches schedule_assignments table structure.
 */
export function buildNormalizedAssignment({
  sectionRow,
  roomNumber,
  rooms,
  instructorId,
  instructorName,
  pattern,
  startTime24,
  duration,
  status = "Assigned",
  academicYear,
  semester,
}) {
  const room = resolveRoomByNumber(roomNumber, rooms);
  const baseSectionId = getNormalizedSectionId(sectionRow);
  const endMinutes = parse24TextToMinutes(startTime24) + Math.round(duration * 60);
  const endTime24 = minutesTo24Text(endMinutes);

  return {
    // FK columns (map to schedule_assignments table)
    section_id: baseSectionId || sectionRow.sectionId,
    subject_id: sectionRow.subjectId,
    room_id: room?.id || null,
    instructor_id: instructorId || null,

    // Display columns
    course_code: getAssignmentSubjectCode(sectionRow),
    course_title: sectionRow.title,
    section: sectionRow.section,
    program: sectionRow.program,
    year: sectionRow.year,
    enrolled: sectionRow.enrolled || 0,
    room_number: roomNumber,
    room_type: sectionRow.roomType || "Lecture",
    instructor_name: instructorName,
    pattern,
    time_display: formatTimeDisplay(startTime24, duration),
    time_start: parseTimeToSQL(startTime24),
    time_end: parseTimeToSQL(endTime24),
    duration: Number(duration) || 1.5,
    status,
    academic_year: academicYear,
    semester,

    // Audit fields (populated by backend on insert)
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// ─── Time parsing ─────────────────────────────────────────────────────────────

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
  // Strip leading "PATTERN " prefix like "TTH 8:00 AM"
  const withoutPattern = raw.replace(/^[A-Z/]+\s+/i, "");
  const fromTimeText = parseTimeTextToMinutes(withoutPattern);
  if (fromTimeText != null) return minutesTo24Text(fromTimeText);
  const from24Text = parse24TextToMinutes(withoutPattern);
  if (from24Text != null) return minutesTo24Text(from24Text);
  return fallback;
}

// ─── Pattern helpers ──────────────────────────────────────────────────────────

const PATTERN_FALLBACK_ORDER = [
  "MWF",
  "TTH",
  "MW",
  "TF",
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
  "DAILY",
];

function getPatternForRow(row, fallback = "MWF") {
  const pattern = String(row?.pattern ?? "")
    .trim()
    .toUpperCase();
  if (pattern && patternDaysMap[pattern]) return pattern;
  return fallback;
}

function alternativePatterns(original) {
  return PATTERN_FALLBACK_ORDER.filter((p) => p !== original);
}

// ─── Room helpers ─────────────────────────────────────────────────────────────

function buildEligibleRooms(roomPool, assignment) {
  const neededType = normalizeRoomType(assignment.roomType);
  return roomPool.filter((room) => {
    if (room.status === "Maintenance") return false;
    if ((room.capacity ?? 0) < (assignment.enrolled ?? 0)) return false;
    return normalizeRoomType(room.type) === neededType;
  });
}

// ─── Conflict detection ───────────────────────────────────────────────────────

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

// ─── Slot building ────────────────────────────────────────────────────────────

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
  if (startMinutes == null || endMinutes == null || startMinutes >= endMinutes)
    return [];
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

// ─── Soft constraint scoring ──────────────────────────────────────────────────

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

function scoreSoftConstraints(course, room, slotTime, weights) {
  let score = 0;
  const wantLab = normalizeRoomType(course.roomType) === "Computer Lab";
  const isLab = normalizeRoomType(room.type) === "Computer Lab";
  if (wantLab === isLab) score += weights.roomType;
  if (course.enrolled > 0 && room.capacity >= course.enrolled) {
    const waste = room.capacity - course.enrolled;
    const wasteRatio = waste / room.capacity;
    score += weights.balance * (1 - wasteRatio);
  }
  const [slotH] = slotTime.split(":").map(Number);
  if (slotH >= 7 && slotH <= 12) score += weights.compactness;
  else if (slotH <= 15) score += weights.compactness * 0.5;
  return score;
}

// ─── Find open placement ──────────────────────────────────────────────────────

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
      if (!hasCoverageConflict(existingAssignments, testAssignment, selfKey)) {
        return testAssignment;
      }
    }
  }
  return null;
}

// ─── Merge helpers ────────────────────────────────────────────────────────────

function mergeWithExistingAssignments(
  existingAssignments,
  generatedAssignments,
) {
  const mergedByKey = new Map();
  existingAssignments.forEach((a) =>
    mergedByKey.set(getAssignmentIdentityKey(a), { ...a }),
  );
  generatedAssignments.forEach((a) =>
    mergedByKey.set(getAssignmentIdentityKey(a), { ...a }),
  );
  return Array.from(mergedByKey.values());
}

// ─── ★ UPDATED Auto-Schedule ──────────────────────────────────────────────────
//
//  New behaviour:
//  1. Each section carries imported time, pattern, and instructor.
//  2. Algorithm only needs to find an available room.
//  3. If room conflicts at the imported pattern, try alternative patterns
//     at the same start time before doing a full time-window scan.
//  4. If pattern was changed, patternAdjusted note is attached.
//  5. Sections with no valid placement are marked "Conflict".

export function runAutoSchedule({
  sectionRows,
  rooms,
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
  const existingAssignments = (
    Array.isArray(scheduleAssignments) ? scheduleAssignments : []
  ).map((a) => ({ ...a }));
  const generatedAssignments = [];

  const startMinutes = parse24TextToMinutes(startTime);
  const endMinutes = parse24TextToMinutes(endTime);
  if (
    startMinutes == null ||
    endMinutes == null ||
    startMinutes >= endMinutes
  ) {
    return { error: "Please set a valid scheduling window." };
  }

  if (sectionRows.length === 0) {
    return {
      rooms: newRooms,
      scheduleAssignments: [],
      assigned: 0,
      message: "No subject sections to schedule. Please add sections first.",
    };
  }

  newRooms.forEach((r) => {
    if (r.status !== "Maintenance") r.status = "Available";
  });

  let assigned = 0;
  let conflictCount = 0;

  sectionRows.forEach((course) => {
    const courseDuration = Number(course.duration ?? 1.5) || 1.5;
    const durationMinutes = Math.round(courseDuration * 60);
    if (durationMinutes <= 0) return;

    // Resolve imported fields
    const importedStart = extractStartTime24(course, "");
    const importedPattern = getPatternForRow(course, "");
    const importedInstructor = String(course.instructor ?? "").trim();

    // Patterns to try: imported first, then alternatives, then fallback
    const patternsToTry = importedPattern
      ? [importedPattern, ...alternativePatterns(importedPattern)]
      : [pattern, ...alternativePatterns(pattern)];

    // Time slots: imported start first, then full window
    const importedStartMinutes = importedStart
      ? parse24TextToMinutes(importedStart)
      : null;
    const fallbackStarts = buildCandidateStarts({
      duration: courseDuration,
      startTime,
      endTime,
      preferredStart: importedStart || undefined,
    });
    const timeSlotsToTry =
      importedStartMinutes != null
        ? [
            importedStartMinutes,
            ...fallbackStarts.filter((s) => s !== importedStartMinutes),
          ]
        : fallbackStarts;

    if (timeSlotsToTry.length === 0) return;

    const eligibleRooms = buildEligibleRooms(newRooms, course);
    if (eligibleRooms.length === 0) {
      generatedAssignments.push({
        ...course,
        room: "",
        time: importedStart
          ? `${importedPattern || pattern} ${formatTime(importedStart)}`
          : "",
        duration: courseDuration,
        pattern: importedPattern || pattern,
        instructor: importedInstructor,
        status: "Conflict",
        conflictReason: "No eligible room (type/capacity) for this section.",
      });
      conflictCount++;
      return;
    }

    const orderedRooms = [...eligibleRooms].sort((a, b) => {
      const aWaste = Math.max(0, (a.capacity ?? 0) - (course.enrolled ?? 0));
      const bWaste = Math.max(0, (b.capacity ?? 0) - (course.enrolled ?? 0));
      return aWaste - bWaste;
    });

    const occupiedPool = [...existingAssignments, ...generatedAssignments];

    let bestResult = null;
    let patternUsed = null;
    let slotUsed = null;

    outerSearch: for (const tryPattern of patternsToTry) {
      const patternDays = patternDaysMap[tryPattern] ?? [];
      if (patternDays.length === 0) continue;
      if (!patternDays.every((d) => activeDays.includes(d))) continue;

      for (const slotMinutes of timeSlotsToTry) {
        if (slotMinutes + durationMinutes > endMinutes) continue;
        const slot = minutesTo24Text(slotMinutes);
        const candidateTime = `${tryPattern} ${formatTime(slot)}`;

        for (const room of orderedRooms) {
          const testAssignment = {
            ...course,
            time: candidateTime,
            duration: courseDuration,
            pattern: tryPattern,
            room: room.number,
            instructor: importedInstructor,
          };
          if (!hasCoverageConflict(occupiedPool, testAssignment)) {
            const score = scoreSoftConstraints(course, room, slot, weights);
            if (bestResult === null || score > bestResult.score) {
              bestResult = { room, score };
              patternUsed = tryPattern;
              slotUsed = slot;
              // Perfect match (imported slot + imported pattern) — stop searching
              if (
                tryPattern === importedPattern &&
                slotMinutes === importedStartMinutes
              ) {
                break outerSearch;
              }
            }
          }
        }
      }
    }

    if (bestResult) {
      generatedAssignments.push({
        ...course,
        room: bestResult.room.number,
        time: `${patternUsed} ${formatTime(slotUsed)}`,
        duration: courseDuration,
        pattern: patternUsed,
        instructor: importedInstructor,
        status: "Assigned",
        patternAdjusted:
          importedPattern && patternUsed !== importedPattern
            ? `Pattern changed from ${importedPattern} to ${patternUsed} to resolve conflict`
            : undefined,
      });
      bestResult.room.status = "Occupied";
      assigned++;
    } else {
      generatedAssignments.push({
        ...course,
        room: "",
        time: importedStart
          ? `${importedPattern || pattern} ${formatTime(importedStart)}`
          : "",
        duration: courseDuration,
        pattern: importedPattern || pattern,
        instructor: importedInstructor,
        status: "Conflict",
        conflictReason: "No available room for any pattern/time combination.",
      });
      conflictCount++;
    }
  });

  const finalAssignments = mergeWithExistingAssignments(
    existingAssignments,
    generatedAssignments,
  );
  finalAssignments.forEach((a) => {
    if (a.status !== "Assigned") return;
    const room = newRooms.find((r) => r.number === a.room);
    if (room && room.status !== "Maintenance") room.status = "Occupied";
  });

  // Build a map of section rows by identity key for normalization
  const sectionRowMap = new Map(
    sectionRows.map((row) => [getAssignmentIdentityKey(row), row])
  );

  // Transform assignments to normalized schema with FK/display columns
  const normalizedFinalAssignments = finalAssignments.map((assignment) => {
    // Check if already normalized
    if (assignment.section_id && typeof assignment.section_id === "string" && 
        assignment.section_id.length > 0 && 
        !assignment.section_id.includes("|")) {
      return assignment;
    }

    const associatedSectionRow = sectionRowMap.get(getAssignmentIdentityKey(assignment));

    if (!associatedSectionRow) {
      // Fallback for existing assignments or those without matching section row
      return {
        ...assignment,
        section_id: getNormalizedSectionId(assignment),
        subject_id: assignment.subjectId,
        room_id: resolveRoomByNumber(assignment.room, newRooms)?.id || null,
        instructor_id: assignment.instructorId,
        course_code: getAssignmentSubjectCode(assignment),
        room_number: assignment.room,
        instructor_name: assignment.instructor,
        time_display: assignment.time || '',
        time_start: parseTimeToSQL(extractStartTime24(assignment, "")),
        time_end: assignment.room ? parseTimeToSQL(minutesTo24Text(
          (parse24TextToMinutes(extractStartTime24(assignment, "")) || 0) + 
          Math.round((assignment.duration || 1.5) * 60)
        )) : "00:00:00",
        academic_year: assignment.academicYear,
        semester: assignment.semester,
      };
    }

    // Build normalized assignment using helper
    return buildNormalizedAssignment({
      sectionRow: associatedSectionRow,
      roomNumber: assignment.room,
      rooms: newRooms,
      instructorId: assignment.instructorId,
      instructorName: assignment.instructor,
      pattern: assignment.pattern,
      startTime24: extractStartTime24(assignment, ""),
      duration: assignment.duration,
      status: assignment.status,
      academicYear: associatedSectionRow.academicYear,
      semester: associatedSectionRow.semester,
    });
  });

  const patternAdjustedCount = generatedAssignments.filter(
    (a) => a.patternAdjusted,
  ).length;
  let message = `Auto-generated ${assigned} assignment${assigned !== 1 ? "s" : ""} using imported time & day data (room-only assignment).`;
  if (patternAdjustedCount > 0)
    message += ` ${patternAdjustedCount} section${patternAdjustedCount !== 1 ? "s" : ""} had meeting pattern adjusted to avoid conflicts.`;
  if (conflictCount > 0)
    message += ` ${conflictCount} section${conflictCount !== 1 ? "s" : ""} flagged as conflicts — no available room found.`;

  return {
    rooms: newRooms,
    scheduleAssignments: normalizedFinalAssignments,
    assigned,
    conflicts: conflictCount,
    message,
  };
}

// ─── Conflict helpers ─────────────────────────────────────────────────────────

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

// ─── Manual assignment ────────────────────────────────────────────────────────

export function applyManualAssignments({
  entries,
  sectionRowsByIdentity,
  scheduleAssignments,
  rooms,
  startTime = "07:00",
  endTime = "21:00",
}) {
  const queue = Array.isArray(entries) ? entries : [];
  if (queue.length === 0)
    return { error: "Please fill in at least one assignment." };

  const nextAssignments = (
    Array.isArray(scheduleAssignments) ? scheduleAssignments : []
  ).map((a) => ({ ...a }));
  const moved = [];

  for (const entry of queue) {
    const sectionRow = sectionRowsByIdentity.get(entry.assignmentKey);
    if (!sectionRow) continue;

    const assignmentKey = getAssignmentIdentityKey(sectionRow);
    const resolvedPattern = getPatternForRow({ pattern: entry.pattern }, "MWF");
    
    // Build desired assignment with old schema for conflict detection
    const desired = {
      ...sectionRow,
      sectionId: getAssignmentSectionId(sectionRow),
      room: entry.roomName,
      instructor: entry.instructor || sectionRow.instructor || "",
      instructorId: entry.instructorId,
      duration: Number(entry.duration ?? sectionRow.duration ?? 1.5) || 1.5,
      pattern: resolvedPattern,
      time: `${resolvedPattern} ${formatTime(entry.startTime)}`,
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
      !desiredStartMinutes ||
      !desiredEndMinutes ||
      !allowedStartMinutes ||
      !allowedEndMinutes ||
      desiredStartMinutes < allowedStartMinutes ||
      desiredEndMinutes > allowedEndMinutes
    ) {
      return {
        error: `${formatAssignmentLabel(desired)} is outside the allowed scheduling window (${startTime} to ${endTime}).`,
      };
    }

    const targetIndex = nextAssignments.findIndex(
      (a) => getAssignmentIdentityKey(a) === assignmentKey,
    );
    if (targetIndex >= 0) nextAssignments[targetIndex] = { ...desired };
    else nextAssignments.push({ ...desired });

    const conflicts = getConflictingAssignments(
      nextAssignments,
      desired,
      assignmentKey,
    );

    for (const conflict of conflicts) {
      const conflictKey = getAssignmentIdentityKey(conflict);
      const conflictIndex = nextAssignments.findIndex(
        (a) => getAssignmentIdentityKey(a) === conflictKey,
      );
      if (conflictIndex < 0) continue;

      const contextAssignments = nextAssignments.filter(
        (_, i) => i !== conflictIndex,
      );
      const originalPattern = getPatternForRow(conflict, "MWF");
      const patternsToTry = [
        originalPattern,
        ...alternativePatterns(originalPattern),
      ];
      let relocated = null;

      for (const tryPattern of patternsToTry) {
        if ((patternDaysMap[tryPattern] ?? []).length === 0) continue;
        relocated = findOpenPlacementForAssignment({
          assignment: { ...conflict, pattern: tryPattern },
          roomPool: rooms,
          existingAssignments: contextAssignments,
          startTime,
          endTime,
          preferredStart: extractStartTime24(conflict, ""),
          preferredRoom: conflict.room,
        });
        if (relocated) break;
      }

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

  // Transform assignments to normalized schema with FK/display columns
  const normalizedAssignments = nextAssignments.map((assignment) => {
    // Check if it's already normalized (has section_id as FK)
    if (assignment.section_id && typeof assignment.section_id === "string" && 
        assignment.section_id.length > 0 && 
        !assignment.section_id.includes("|")) {
      // Already normalized, return as-is
      return assignment;
    }

    // Find the original section row for this assignment
    let associatedSectionRow = null;
    for (const sectionRow of sectionRowsByIdentity.values()) {
      if (getAssignmentIdentityKey(sectionRow) === getAssignmentIdentityKey(assignment)) {
        associatedSectionRow = sectionRow;
        break;
      }
    }

    if (!associatedSectionRow) {
      // Fallback: return assignment with minimal FK info
      return {
        ...assignment,
        section_id: getNormalizedSectionId(assignment),
        subject_id: assignment.subjectId,
        room_id: resolveRoomByNumber(assignment.room, rooms)?.id || null,
        instructor_id: assignment.instructorId,
        course_code: getAssignmentSubjectCode(assignment),
        room_number: assignment.room,
        instructor_name: assignment.instructor,
        time_display: `${assignment.pattern} ${formatTime(extractStartTime24(assignment, ""))}`,
        time_start: parseTimeToSQL(extractStartTime24(assignment, "")),
        time_end: parseTimeToSQL(minutesTo24Text(
          (parse24TextToMinutes(extractStartTime24(assignment, "")) || 0) + 
          Math.round((assignment.duration || 1.5) * 60)
        )),
        academic_year: assignment.academicYear,
        semester: assignment.semester,
      };
    }

    // Build normalized assignment using helper
    return buildNormalizedAssignment({
      sectionRow: associatedSectionRow,
      roomNumber: assignment.room,
      rooms,
      instructorId: assignment.instructorId,
      instructorName: assignment.instructor,
      pattern: assignment.pattern,
      startTime24: extractStartTime24(assignment, ""),
      duration: assignment.duration,
      status: assignment.status,
      academicYear: associatedSectionRow.academicYear,
      semester: associatedSectionRow.semester,
    });
  });

  return { scheduleAssignments: normalizedAssignments, moved };
}

// ─── Manual conflict check ────────────────────────────────────────────────────

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
