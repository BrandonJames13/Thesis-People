import {
  coursesOverlap,
  formatTime,
  getStartTimeText,
  parseTimeTextToMinutes,
} from "./timeUtils";
import { normalizeRoomType, patternDaysMap } from "../data/constants";

const DEFAULT_SECTION = "A";
const VALID_ASSIGNMENT_STATUSES = new Set(["Pending", "Assigned", "Conflict"]);

// ─── TSU Scheduling Rules ─────────────────────────────────────────────────────

const NIGHT_START_MIN = 18 * 60; // 6:00 PM = 1080 min
const DAY_END_MIN = 18 * 60;     // 6:00 PM = 1080 min

// ─── TSU Time Window Constants ────────────────────────────────────────────────
// FIX: Enforce the three distinct scheduling windows
const MORNING_START_MIN = 7 * 60;       // 7:00 AM  = 420 min
const MORNING_END_MIN = 11 * 60;      // 11:00 AM = 660 min  (classes must END by 11:00)
const AFTERNOON_START_MIN = 13 * 60;     // 1:00 PM  = 780 min
const AFTERNOON_END_MIN = 18 * 60;      // 6:00 PM  = 1080 min
const NIGHT_END_MIN = 21 * 60;      // 9:00 PM  = 1260 min

// ─── TSU Lunch Break Rule ─────────────────────────────────────────────────────
// No class may overlap the 12:00 PM – 1:00 PM lunch break
const LUNCH_START_MIN = 12 * 60; // 12:00 PM = 720 min
const LUNCH_END_MIN = 13 * 60; // 1:00 PM  = 780 min

// ─── TSU Day-Order for Lec/Lab gap enforcement ────────────────────────────────
// FIX: Used to compute minimum 1-day gap between Lecture and Laboratory
const DAY_ORDER = ["MON", "TUE", "WED", "THU", "FRI", "SAT"];

/**
 * FIX: Returns true if the class slot overlaps the 12:00–13:00 lunch break.
 * Previously only checked if the START fell in the window; now also blocks
 * classes that start before noon but run into the lunch period.
 */
function overlapsLunchBreak(slotStartMinutes, durationMinutes) {
  const slotEndMinutes = slotStartMinutes + durationMinutes;
  // Overlap when: class starts before lunch ends AND class ends after lunch starts
  return slotStartMinutes < LUNCH_END_MIN && slotEndMinutes > LUNCH_START_MIN;
}

/**
 * Legacy alias kept for any callers that used the old name.
 * @deprecated Use overlapsLunchBreak(start, duration) instead.
 */
function startsInLunchBreak(slotStartMinutes) {
  return slotStartMinutes >= LUNCH_START_MIN && slotStartMinutes < LUNCH_END_MIN;
}

const SPECIAL_ROOM_SUBJECT_KEYWORDS = [
  "ojt",
  "practicum",
  "fts",
  "thesis",
  "capstone",
  "cp 1",
  "cp 2",
  "cp1",
  "cp2",
];

const SPECIAL_ROOM_TYPES = new Set(["AVR", "Accreditation Room", "CISCO"]);
const CISCO_ROOM_TYPE = "CISCO";

/**
 * Returns true if the section label contains "EVE" (e.g. "BSCS-3C (EVE)").
 */
export function isEveSection(section) {
  return String(section ?? "")
    .toUpperCase()
    .includes("EVE");
}

function isCiscoSubject(subjectCode) {
  return String(subjectCode ?? "")
    .toUpperCase()
    .includes("CCNA");
}

function isSpecialRoomSubject(subjectCode, subjectTitle) {
  const combined = `${subjectCode} ${subjectTitle}`.toLowerCase();
  return SPECIAL_ROOM_SUBJECT_KEYWORDS.some((kw) => combined.includes(kw));
}

/**
 * Returns true if the given room is eligible for the subject based on TSU rules:
 * - CISCO room → only CCNA subjects
 * - AVR / Accreditation Room → only OJT, thesis, capstone, FTS subjects (never Computer Lab)
 * - Computer Lab → only Lab/Computer Lab subjects
 * - Lecture rooms → Lecture subjects (+ AVR/Accred if subject qualifies)
 */
function isRoomEligibleForSubject(
  room,
  requiredRoomType,
  subjectCode,
  subjectTitle,
) {
  const roomType = normalizeRoomType(room.type);
  const required = normalizeRoomType(requiredRoomType);
  const isCisco = isCiscoSubject(subjectCode);
  const isSpecial = isSpecialRoomSubject(subjectCode, subjectTitle);

  // CISCO room → only CCNA subjects
  if (roomType === CISCO_ROOM_TYPE) return isCisco;
  // CCNA subjects → only CISCO room
  if (isCisco) return roomType === CISCO_ROOM_TYPE;

  // TSU Rule: OJT/special subjects → AVR or Accreditation Room preferred,
  // Lecture rooms allowed as fallback. Computer Lab is strictly forbidden.
  if (isSpecial) {
    if (roomType === "Computer Lab") return false;
    if (roomType === "Lecture") return true;
    if (SPECIAL_ROOM_TYPES.has(roomType)) return true;
    return false;
  }

  // AVR / Accreditation Room → only special subjects (already handled above)
  if (SPECIAL_ROOM_TYPES.has(roomType)) return false;

  // Computer Lab subjects → only Computer Lab rooms
  if (required === "Computer Lab") {
    return roomType === "Computer Lab";
  }

  // Lecture subjects → Lecture rooms only
  if (required === "Lecture") {
    return roomType === "Lecture";
  }

  return roomType === required;
}

/**
 * Returns true if the time slot is allowed given EVE/night class rules:
 * - EVE sections MUST start at 6PM or later (or use Saturday)
 * - Regular sections must end by 6PM
 * - Slots that extend into night hours require allow_night_class
 */
function isTimeSlotAllowed(
  slotMinutes,
  durationMinutes,
  isEve,
  allowNightClass,
) {
  const endMin = slotMinutes + durationMinutes;

  if (isEve) {
    // EVE sections: must start at 6PM+ on weekdays, or any time on Saturday
    // Saturday slots are handled separately via pattern filtering
    return slotMinutes >= NIGHT_START_MIN;
  }

  // Regular sections: must end by 6PM
  if (endMin > DAY_END_MIN) return false;

  // If slot starts at or after 6PM, instructor must allow night class
  if (slotMinutes >= NIGHT_START_MIN && !allowNightClass) return false;

  return true;
}

/**
 * Checks if assigning a candidate pattern would exceed the 2-days-per-week limit.
 * Merges unique days from the candidate pattern with already-assigned patterns
 * for a section and verifies total unique days <= maxDaysPerWeek.
 *
 * @param {string} sectionId - Section identifier (e.g., "CS101::A::2025-2026::1")
 * @param {string} candidatePattern - Pattern to check (e.g., "MON,FRI")
 * @param {Set<string>} alreadyAssignedPatterns - Patterns already assigned to this section
 * @param {number} maxDaysPerWeek - Maximum days allowed per week (default 2)
 * @returns {boolean} true if compatible, false if would exceed limit
 */
function isPatternCompatibleWithWeeklyLimit(
  sectionId,
  candidatePattern,
  alreadyAssignedPatterns,
  maxDaysPerWeek = 2,
) {
  const candidateDays = patternDaysMap[candidatePattern] ?? [];
  const mergedDays = new Set(candidateDays);

  for (const assignedPattern of alreadyAssignedPatterns) {
    const assignedDays = patternDaysMap[assignedPattern] ?? [];
    assignedDays.forEach((day) => mergedDays.add(day));
  }

  return mergedDays.size <= maxDaysPerWeek;
}

/**
 * Returns ordered candidate patterns for a section based on duration and EVE status.
 * Filters to only patterns whose days are all in activeDaysSet.
 * EVE sections: prefer single-day night + Saturday patterns.
 * Regular sections: exclude Saturday entirely.
 */
function getPatternsForSection(duration, isEve, activeDaysSet) {
  const dur = Number(duration ?? 1.5);
  let candidates;
  const classType = isEve ? "EVE" : "Regular";

  if (isEve) {
    // Evening classes: prioritize flexibility with multiple day options
    // Includes two-day patterns for classes that need flexibility without exceeding 2-days-per-week
    if (dur <= 1.5)
      // 1.5-hour classes: prefer two-day patterns (TTH, WF) then two-day combinations (MON,FRI, MON,SAT, WED,FRI),
      // then single days. Evening slots benefit from spread-out schedules to avoid overcrowding.
      candidates = [
        "TTH",
        "WF",
        "MON,FRI",
        "MON,SAT",
        "WED,FRI",
        "MON",
        "TUE",
        "WED",
        "THU",
        "FRI",
        "SAT",
      ];
    else if (dur === 2)
      // 2-hour classes: single days only (no two-day patterns to respect scheduling constraints)
      candidates = ["MON", "TUE", "WED", "THU", "FRI", "SAT"];
    else
      // 3+ hour classes: prioritize Saturday (extended block) then weekdays
      candidates = ["SAT", "MON", "TUE", "WED", "THU", "FRI"];
  } else {
    // Regular (daytime) classes: strict 2-times-per-week constraint
    // All patterns respect the 2-day-per-week maximum meeting days
    if (dur <= 1.5)
      // 1.5-hour classes: Two-day patterns first (TTH, WF, MON,FRI, WED,FRI, MON,SAT),
      // then single days. Prioritizes class meetings at manageable intervals for students.
      candidates = [
        "TTH",
        "WF",
        "MON,FRI",
        "WED,FRI",
        "MON,SAT",
        "MON",
        "TUE",
        "WED",
        "THU",
        "FRI",
      ];
    else if (dur === 2)
      // 2-hour classes: single days only (no two-day patterns to respect 2-day limit)
      candidates = ["MON", "TUE", "WED", "THU", "FRI"];
    else
      // 3+ hour classes: single days only (long blocks on individual days)
      candidates = ["MON", "TUE", "WED", "THU", "FRI"];
  }

  // Filter candidates: only return patterns that exist in patternDaysMap and
  // have all their required days available in the section's active days set.
  // This ensures backward compatibility with legacy data while validating new patterns.
  const validPatterns = candidates.filter((p) => {
    const days = patternDaysMap[p] ?? [];
    return days.length > 0 && days.every((d) => activeDaysSet.has(d));
  });
  console.debug(
    `  [getPatternsForSection] Type:${classType} | Duration:${dur}h | Candidates:${candidates.length} → Valid:${validPatterns.length} | Active patterns: [${validPatterns.join(", ")}]`,
  );
  if (validPatterns.length === 0) {
    console.warn(
      `  [getPatternsForSection] WARNING: No valid patterns for ${classType} class (${dur}h)! Candidates were: [${candidates.join(", ")}]`,
    );
  }
  return validPatterns;
}

// ─── Identity helpers ────────────────────────────────────────────────────────

function normalizeIdentityPart(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export function getAssignmentSubjectCode(row) {
  // Enhanced lookup paths: code → subjectCode → subject_code → subject.code → subject_id → subject_title
  let result = String(
    row?.code ??
    row?.subjectCode ??
    row?.subject_code ??
    row?.subject?.code ??
    row?.subject_id ??
    "",
  )
    .trim()
    .toUpperCase();

  // Fallback: if subject_title exists but no code found, use first 5 chars of title
  if (!result && row?.subject_title) {
    result = String(row.subject_title).trim().substring(0, 5).toUpperCase();
  }

  return result;
}

export function getAssignmentSection(row) {
  const section = String(row?.section ?? "").trim();
  return section || DEFAULT_SECTION;
}

export function getAssignmentSectionId(row) {
  const explicit = getNormalizedSectionId(row);
  if (explicit) return explicit;
  const explicitIdentity = String(
    row?.sectionIdentity ?? row?.section_identity ?? "",
  ).trim();
  if (explicitIdentity) return explicitIdentity;
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
  const sectionId = getNormalizedSectionId(row);
  if (sectionId) return `SECTION:${normalizeIdentityPart(sectionId)}`;
  const sectionIdentity = String(
    row?.sectionIdentity ?? row?.section_identity ?? "",
  ).trim();
  if (sectionIdentity)
    return `IDENTITY:${normalizeIdentityPart(sectionIdentity)}`;
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
  let code = getAssignmentSubjectCode(row);
  // Fallback chain if subject code is missing:
  // 1. Try section_id (UUID format)
  // 2. Try sectionId
  // 3. Use "UNKNOWN" as last resort
  if (!code) {
    code = row?.section_id || row?.sectionId || "UNKNOWN";
    // Truncate UUID to last 8 chars for readability
    if (code !== "UNKNOWN" && code.length > 8) {
      code = code.slice(-8);
    }
  }
  const section = getAssignmentSection(row);
  return `${code}-${section}`;
}

// ─── Schema mapping helpers ───────────────────────────────────────────────────

export function getNormalizedSectionId(row) {
  const sectionId = String(row?.sectionId ?? row?.section_id ?? "").trim();
  if (!sectionId) return "";
  return sectionId.replace(/__(LEC|LAB)$/, "");
}

export function resolveRoomByNumber(roomNumber, roomPool) {
  if (!roomNumber) return null;
  const normalized = String(roomNumber).trim();
  return (
    roomPool.find((r) => String(r?.number ?? "").trim() === normalized) || null
  );
}

export function formatTimeDisplay(startTime24, durationHours) {
  const startMinutes = parse24TextToMinutes(startTime24);
  if (startMinutes == null) return "";

  const endMinutes = startMinutes + Math.round(durationHours * 60);
  const startFormatted = formatTime(startTime24);
  const endFormatted = formatTime(minutesTo24Text(endMinutes));

  return `${startFormatted} – ${endFormatted}`;
}

export function parseTimeToSQL(time24String) {
  const minutes = parse24TextToMinutes(time24String);
  if (minutes == null) return "00:00:00";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:00`;
}

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
  const normalizedStatus = normalizeAssignmentStatus(status);
  const normalizedAcademicYear = getAssignmentAcademicYear({
    academic_year: academicYear,
    academicYear,
    ...sectionRow,
  });
  const normalizedSemester = getAssignmentSemester({
    semester,
    ...sectionRow,
  });
  const endMinutes =
    parse24TextToMinutes(startTime24) + Math.round(duration * 60);
  const endTime24 = minutesTo24Text(endMinutes);

  return {
    section_id: baseSectionId || sectionRow.sectionId,
    subject_id: sectionRow.subjectId,
    room_id: room?.id || null,
    instructor_id: instructorId || null,
    subject_code: getAssignmentSubjectCode(sectionRow),
    subject_title: sectionRow.title,
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
    status: normalizedStatus,
    academic_year: normalizedAcademicYear,
    semester: normalizedSemester,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function normalizeAssignmentStatus(value, fallback = "Pending") {
  const text = String(value ?? "").trim();
  if (!text) return fallback;
  const lower = text.toLowerCase();
  if (lower === "assigned") return "Assigned";
  if (lower === "conflict") return "Conflict";
  if (lower === "pending" || lower === "not assigned") return "Pending";
  return VALID_ASSIGNMENT_STATUSES.has(text) ? text : fallback;
}

function getAssignmentAcademicYear(row) {
  return String(row?.academic_year ?? row?.academicYear ?? "").trim();
}

function getAssignmentSemester(row) {
  return String(row?.semester ?? "").trim();
}

function getAssignmentRoom(row) {
  return String(row?.room ?? row?.room_number ?? "").trim();
}

function getAssignmentInstructorName(row) {
  return String(row?.instructor ?? row?.instructor_name ?? "").trim();
}

function getAssignmentInstructorId(row) {
  return String(row?.instructorId ?? row?.instructor_id ?? "").trim();
}

function buildSectionTermKey(row) {
  // FIX (Bug 1 — core cause of skipped sections):
  // Use the RAW sectionId (which may include __LEC or __LAB) so that
  // Lecture and Laboratory siblings get DISTINCT term keys. Previously,
  // getNormalizedSectionId() stripped the suffix, causing both siblings
  // to share a key — the second sibling was always blocked by the first.
  const rawSectionId = String(row?.sectionId ?? row?.section_id ?? "").trim();
  const sectionId = rawSectionId || getNormalizedSectionId(row);
  const academicYear = getAssignmentAcademicYear(row);
  const semester = getAssignmentSemester(row);
  if (!sectionId || !academicYear || !semester) return "";
  return `${sectionId}::${academicYear}::${semester}`;
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
  const withoutPattern = raw.replace(/^[A-Z/]+\s+/i, "");
  const startToken = getStartTimeText(withoutPattern);
  const fromTimeText = parseTimeTextToMinutes(startToken);
  if (fromTimeText != null) return minutesTo24Text(fromTimeText);
  const from24Text = parse24TextToMinutes(startToken);
  if (from24Text != null) return minutesTo24Text(from24Text);
  return fallback;
}

// ─── Pattern helpers ──────────────────────────────────────────────────────────

const PATTERN_FALLBACK_ORDER = [
  "MON,FRI",
  "MON,SAT",
  "WED,FRI",
  "TTH",
  "MW",
  "TF",
  "WF",
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
];

function getPatternForRow(row, fallback = "MON,FRI") {
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

/**
 * Updated: uses isRoomEligibleForSubject to enforce TSU room-type rules.
 */
function buildEligibleRooms(roomPool, assignment) {
  const neededType = normalizeRoomType(assignment.roomType);
  const subjectCode = getAssignmentSubjectCode(assignment);
  const subjectTitle = String(
    assignment.title ?? assignment.course_title ?? "",
  ).trim();

  return roomPool.filter((room) => {
    if (room.status === "Maintenance") return false;
    if ((room.capacity ?? 0) < (assignment.enrolled ?? 0)) return false;
    return isRoomEligibleForSubject(
      room,
      neededType,
      subjectCode,
      subjectTitle,
    );
  });
}

function buildSubjectIdToEligibleInstructors(instructorSubjects) {
  const map = new Map();
  (Array.isArray(instructorSubjects) ? instructorSubjects : []).forEach(
    (row) => {
      const subjectId = String(row?.subjectId ?? row?.subject_id ?? "").trim();
      const instructorId = String(
        row?.instructorId ?? row?.instructor_id ?? "",
      ).trim();
      if (!subjectId || !instructorId) return;
      const ids = map.get(subjectId) ?? new Set();
      ids.add(instructorId);
      map.set(subjectId, ids);
    },
  );
  return map;
}

function buildInstructorPoolMap(instructors) {
  const map = new Map();
  (Array.isArray(instructors) ? instructors : []).forEach((row) => {
    const id = String(row?.id ?? row?.instructor_id ?? "").trim();
    if (!id) return;
    const isInactive =
      String(row?.status ?? "")
        .trim()
        .toLowerCase() === "inactive";
    if (isInactive) return;
    map.set(id, {
      id,
      name: String(row?.name ?? row?.instructor_name ?? "").trim(),
      allow_night_class: row?.allow_night_class === true,
      // FIX (Bug 3 — Max Units): store the instructor's unit cap so the
      // placement chooser can reject over-loaded instructors.
      max_units: Number(row?.max_units ?? row?.maxUnits ?? 99) || 99,
    });
  });
  return map;
}

function buildInstructorLoadCount(assignments) {
  const load = new Map();
  (Array.isArray(assignments) ? assignments : []).forEach((row) => {
    if (normalizeAssignmentStatus(row?.status) !== "Assigned") return;
    const id = getAssignmentInstructorId(row);
    if (!id) return;
    load.set(id, (load.get(id) ?? 0) + 1);
  });
  return load;
}

function chooseInstructorForPlacementOptimized({
  courseSubjectId,
  placementBase,
  occupiedPool,
  occupancyIndexes,
  pattern,
  slotMinutes,
  durationMinutes,
  assignmentKeyToIgnore,
  eligibleInstructorIdsBySubjectId,
  instructorPoolById,
  instructorLoadCount,
  isEve,
}) {
  const eligibleIds = eligibleInstructorIdsBySubjectId.get(courseSubjectId);
  if (!eligibleIds || eligibleIds.size === 0) return null;

  const sortedCandidates = Array.from(eligibleIds)
    .filter((id) => instructorPoolById.has(id))
    .map((id) => ({ id, load: instructorLoadCount.get(id) ?? 0 }))
    .sort((a, b) => {
      if (a.load !== b.load) return a.load - b.load;
      return a.id.localeCompare(b.id);
    });

  for (const candidate of sortedCandidates) {
    const instructor = instructorPoolById.get(candidate.id);

    // FIX (Bug 3 — Max Units): reject instructors who have reached their unit cap
    const currentLoad = instructorLoadCount.get(candidate.id) ?? 0;
    if (currentLoad >= (instructor.max_units ?? 99)) continue;

    // FIX (Bug 5 — Night class flag): check the CANDIDATE instructor's flag,
    // not an outer-scope imported instructor variable.
    const endMin = slotMinutes + durationMinutes;
    const isNightSlot = slotMinutes >= NIGHT_START_MIN || endMin > DAY_END_MIN;
    if (isNightSlot && !instructor.allow_night_class && !isEve) continue;
    if (isEve && slotMinutes >= NIGHT_START_MIN && !instructor.allow_night_class)
      continue;

    const testAssignmentSectionTermKey = buildSectionTermKey(placementBase);
    const testAssignmentIdentityKey = getAssignmentIdentityKey(placementBase);
    const testRoom = placementBase.room ?? "";

    if (
      !hasIndexedCoverageConflictOptimized(
        occupiedPool,
        occupancyIndexes,
        testAssignmentSectionTermKey,
        testAssignmentIdentityKey,
        testRoom,
        candidate.id,
        pattern,
        slotMinutes,
        durationMinutes,
        assignmentKeyToIgnore,
        patternDaysMap,
      )
    ) {
      return {
        instructorId: candidate.id,
        instructorName: instructor?.name ?? "",
      };
    }
  }

  return null;
}

function chooseInstructorForPlacement({
  course,
  placementBase,
  occupiedPool,
  occupancyIndexes,
  pattern,
  assignmentKeyToIgnore,
  eligibleInstructorIdsBySubjectId,
  instructorPoolById,
  instructorLoadCount,
}) {
  const subjectId = String(course?.subjectId ?? "").trim();
  if (!subjectId) return null;
  const eligibleIds = eligibleInstructorIdsBySubjectId.get(subjectId);
  if (!eligibleIds || eligibleIds.size === 0) return null;

  const sortedCandidates = Array.from(eligibleIds)
    .filter((id) => instructorPoolById.has(id))
    .map((id) => ({ id, load: instructorLoadCount.get(id) ?? 0 }))
    .sort((a, b) => {
      if (a.load !== b.load) return a.load - b.load;
      return a.id.localeCompare(b.id);
    });

  for (const candidate of sortedCandidates) {
    const instructor = instructorPoolById.get(candidate.id);
    const testAssignment = {
      ...placementBase,
      instructorId: candidate.id,
      instructor_id: candidate.id,
      instructor: instructor?.name ?? "",
      instructor_name: instructor?.name ?? "",
    };
    if (
      !hasIndexedCoverageConflict(
        occupiedPool,
        occupancyIndexes,
        testAssignment,
        pattern,
        assignmentKeyToIgnore,
      )
    ) {
      return {
        instructorId: candidate.id,
        instructorName: instructor?.name ?? "",
      };
    }
  }

  return null;
}

// ─── Conflict detection ───────────────────────────────────────────────────────

function hasCoverageConflict(
  existingAssignments,
  testAssignment,
  assignmentKeyToIgnore,
) {
  const testKey = getAssignmentIdentityKey(testAssignment);
  const testSectionTermKey = buildSectionTermKey(testAssignment);
  return existingAssignments.some((assignment) => {
    const existingKey = getAssignmentIdentityKey(assignment);
    if (existingKey === testKey) return false;
    if (assignmentKeyToIgnore && existingKey === assignmentKeyToIgnore)
      return false;
    const existingSectionTermKey = buildSectionTermKey(assignment);
    if (
      testSectionTermKey &&
      existingSectionTermKey &&
      testSectionTermKey === existingSectionTermKey
    ) {
      return true;
    }
    const existingRoom = getAssignmentRoom(assignment);
    const testRoom = getAssignmentRoom(testAssignment);
    const sameRoom = existingRoom && testRoom && existingRoom === testRoom;
    const existingInstructorId = getAssignmentInstructorId(assignment);
    const testInstructorId = getAssignmentInstructorId(testAssignment);
    const existingInstructorName = getAssignmentInstructorName(assignment);
    const testInstructorName = getAssignmentInstructorName(testAssignment);
    const sameInstructor =
      (existingInstructorId &&
        testInstructorId &&
        existingInstructorId === testInstructorId) ||
      (existingInstructorName &&
        testInstructorName &&
        existingInstructorName.toLowerCase() ===
        testInstructorName.toLowerCase());
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
    // FIX (Bug 2 — Lunch block & Bug 6 — cross-lunch):
    // Block any slot whose time span overlaps the 12:00–13:00 lunch break,
    // not just slots that START inside it.
    if (overlapsLunchBreak(cursor, durationMinutes)) continue;

    // FIX (Bug 2 — Time Windows):
    // Reject slots that fall outside the declared session window.
    // Morning sessions must end by 11:00 AM; afternoon by 6:00 PM.
    const slotEnd = cursor + durationMinutes;
    if (startMinutes < LUNCH_START_MIN && slotEnd > MORNING_END_MIN) continue;  // morning cap
    if (startMinutes >= AFTERNOON_START_MIN && slotEnd > AFTERNOON_END_MIN) continue; // afternoon cap

    starts.push(cursor);
  }

  if (preferredStart) {
    const preferredMinutes = parse24TextToMinutes(preferredStart);
    if (
      preferredMinutes != null &&
      preferredMinutes + durationMinutes <= endMinutes &&
      preferredMinutes >= startMinutes &&
      !overlapsLunchBreak(preferredMinutes, durationMinutes)
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
  const pattern = getPatternForRow(assignment, "MON,FRI");
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

function normalizeForConflictChecks(row, fallbackPattern = "MON,FRI") {
  const startTime24 = extractStartTime24(row, "");
  const pattern = getPatternForRow(row, fallbackPattern);
  return {
    ...row,
    code: getAssignmentSubjectCode(row),
    section: getAssignmentSection(row),
    sectionId: getAssignmentSectionId(row),
    academicYear: getAssignmentAcademicYear(row),
    semester: getAssignmentSemester(row),
    room: getAssignmentRoom(row),
    instructor: getAssignmentInstructorName(row),
    instructorId: getAssignmentInstructorId(row),
    time:
      String(row?.time ?? "").trim() ||
      (startTime24 ? `${pattern} ${formatTime(startTime24)}` : ""),
    duration: Number(row?.duration ?? 1.5) || 1.5,
    pattern,
    subjectId: String(row?.subjectId ?? row?.subject_id ?? "").trim(),
  };
}

function dedupeBySectionTerm(assignments) {
  const byKey = new Map();
  const statusRank = { Assigned: 3, Conflict: 2, Pending: 1 };

  (Array.isArray(assignments) ? assignments : []).forEach((assignment) => {
    const uniqueKey =
      buildSectionTermKey(assignment) || getAssignmentIdentityKey(assignment);
    if (!uniqueKey) return;

    const next = {
      ...assignment,
      status: normalizeAssignmentStatus(assignment?.status),
    };
    const existing = byKey.get(uniqueKey);
    if (!existing) {
      byKey.set(uniqueKey, next);
      return;
    }

    const existingRank =
      statusRank[normalizeAssignmentStatus(existing.status)] ?? 0;
    const nextRank = statusRank[normalizeAssignmentStatus(next.status)] ?? 0;

    if (nextRank > existingRank) {
      byKey.set(uniqueKey, next);
      return;
    }

    if (nextRank === existingRank) {
      const existingFilled =
        Number(Boolean(existing.room_id)) +
        Number(Boolean(existing.instructor_id));
      const nextFilled =
        Number(Boolean(next.room_id)) + Number(Boolean(next.instructor_id));
      if (nextFilled >= existingFilled) {
        byKey.set(uniqueKey, next);
      }
    }
  });

  return Array.from(byKey.values());
}

function hasIndexedCoverageConflictOptimized(
  occupiedPool,
  occupancyIndexes,
  testAssignmentSectionTermKey,
  testAssignmentIdentityKey,
  testRoom,
  testInstructorId,
  pattern,
  slotMinutes,
  durationMinutes,
  assignmentKeyToIgnore,
  patternDaysMap,
) {
  const { roomIndex, instructorIndex } = occupancyIndexes;

  if (testAssignmentSectionTermKey) {
    const hasConflictingSectionTerm = occupiedPool.some((assignment) => {
      const existingKey = getAssignmentIdentityKey(assignment);
      if (existingKey === testAssignmentIdentityKey) return false;
      if (assignmentKeyToIgnore && existingKey === assignmentKeyToIgnore)
        return false;
      const existingSectionTermKey = buildSectionTermKey(assignment);
      return (
        existingSectionTermKey &&
        testAssignmentSectionTermKey &&
        testAssignmentSectionTermKey === existingSectionTermKey
      );
    });
    if (hasConflictingSectionTerm) return true;
  }

  if (testRoom) {
    const patternDays = patternDaysMap[pattern] ?? [];
    if (slotMinutes != null && patternDays.length > 0) {
      for (const day of patternDays) {
        if (
          hasRoomConflictAtSlot(
            roomIndex,
            day,
            slotMinutes,
            durationMinutes,
            testRoom,
          )
        ) {
          return true;
        }
      }
    }
  }

  if (testInstructorId) {
    const patternDays = patternDaysMap[pattern] ?? [];
    if (slotMinutes != null && patternDays.length > 0) {
      for (const day of patternDays) {
        if (
          hasInstructorConflictAtSlot(
            instructorIndex,
            day,
            slotMinutes,
            durationMinutes,
            testInstructorId,
          )
        ) {
          return true;
        }
      }
    }
  }

  return false;
}

function hasIndexedCoverageConflict(
  occupiedPool,
  occupancyIndexes,
  testAssignment,
  pattern,
  assignmentKeyToIgnore,
) {
  const { roomIndex, instructorIndex } = occupancyIndexes;
  const testKey = getAssignmentIdentityKey(testAssignment);
  const testSectionTermKey = buildSectionTermKey(testAssignment);

  if (testSectionTermKey) {
    const hasConflictingSectionTerm = occupiedPool.some((assignment) => {
      const existingKey = getAssignmentIdentityKey(assignment);
      if (existingKey === testKey) return false;
      if (assignmentKeyToIgnore && existingKey === assignmentKeyToIgnore)
        return false;
      const existingSectionTermKey = buildSectionTermKey(assignment);
      return (
        existingSectionTermKey &&
        testSectionTermKey &&
        testSectionTermKey === existingSectionTermKey
      );
    });
    if (hasConflictingSectionTerm) return true;
  }

  const testRoom = getAssignmentRoom(testAssignment);
  if (testRoom) {
    const patternDays = patternDaysMap[pattern] ?? [];
    const startTime = extractStartTime24(testAssignment, "");
    const startMinutes = startTime ? parse24TextToMinutes(startTime) : null;
    if (startMinutes != null && patternDays.length > 0) {
      const duration = Number(testAssignment.duration ?? 1.5) || 1.5;
      const durationMinutes = Math.round(duration * 60);
      for (const day of patternDays) {
        if (
          hasRoomConflictAtSlot(
            roomIndex,
            day,
            startMinutes,
            durationMinutes,
            testRoom,
          )
        ) {
          return true;
        }
      }
    }
  }

  const testInstructorId = getAssignmentInstructorId(testAssignment);
  if (testInstructorId) {
    const patternDays = patternDaysMap[pattern] ?? [];
    const startTime = extractStartTime24(testAssignment, "");
    const startMinutes = startTime ? parse24TextToMinutes(startTime) : null;
    if (startMinutes != null && patternDays.length > 0) {
      const duration = Number(testAssignment.duration ?? 1.5) || 1.5;
      const durationMinutes = Math.round(duration * 60);
      for (const day of patternDays) {
        if (
          hasInstructorConflictAtSlot(
            instructorIndex,
            day,
            startMinutes,
            durationMinutes,
            testInstructorId,
          )
        ) {
          return true;
        }
      }
    }
  }

  return false;
}

// ─── Occupancy indexing ───────────────────────────────────────────────────────

function buildOccupancyIndex(assignments) {
  const roomIndex = new Map();
  const instructorIndex = new Map();

  assignments.forEach((assignment) => {
    if (normalizeAssignmentStatus(assignment?.status) !== "Assigned") return;

    const pattern = getPatternForRow(assignment, "");
    if (!pattern) return;

    const patternDays = patternDaysMap[pattern] ?? [];
    const startTime = extractStartTime24(assignment, "");
    const startMinutes = startTime ? parse24TextToMinutes(startTime) : null;
    if (startMinutes == null) return;

    const duration = Number(assignment.duration ?? 1.5) || 1.5;
    const durationMinutes = Math.round(duration * 60);
    const endMinutes = startMinutes + durationMinutes;

    const roomNumber = getAssignmentRoom(assignment);
    if (roomNumber) {
      patternDays.forEach((day) => {
        for (let slot = startMinutes; slot < endMinutes; slot += 30) {
          const key = `${day}_${slot}`;
          if (!roomIndex.has(key)) roomIndex.set(key, new Set());
          roomIndex.get(key).add(roomNumber);
        }
      });
    }

    const instructorId = getAssignmentInstructorId(assignment);
    if (instructorId) {
      patternDays.forEach((day) => {
        for (let slot = startMinutes; slot < endMinutes; slot += 30) {
          const key = `${day}_${slot}_${instructorId}`;
          instructorIndex.set(key, true);
        }
      });
    }
  });

  return { roomIndex, instructorIndex };
}

function hasRoomConflictAtSlot(
  roomOccupancyIndex,
  day,
  slotMinutes,
  durationMinutes,
  roomNumber,
) {
  for (
    let slot = slotMinutes;
    slot < slotMinutes + durationMinutes;
    slot += 30
  ) {
    const key = `${day}_${slot}`;
    const roomsAtSlot = roomOccupancyIndex.get(key);
    if (roomsAtSlot && roomsAtSlot.has(roomNumber)) return true;
  }
  return false;
}

function hasInstructorConflictAtSlot(
  instructorOccupancyIndex,
  day,
  slotMinutes,
  durationMinutes,
  instructorId,
) {
  for (
    let slot = slotMinutes;
    slot < slotMinutes + durationMinutes;
    slot += 30
  ) {
    const key = `${day}_${slot}_${instructorId}`;
    if (instructorOccupancyIndex.has(key)) return true;
  }
  return false;
}

function updateOccupancyIndex(indexes, assignment, pattern) {
  if (normalizeAssignmentStatus(assignment?.status) !== "Assigned") return;

  const { roomIndex, instructorIndex } = indexes;
  const patternDays = patternDaysMap[pattern] ?? [];
  if (patternDays.length === 0) return;

  const startTime = extractStartTime24(assignment, "");
  const startMinutes = startTime ? parse24TextToMinutes(startTime) : null;
  if (startMinutes == null) return;

  const duration = Number(assignment.duration ?? 1.5) || 1.5;
  const durationMinutes = Math.round(duration * 60);

  const roomNumber = getAssignmentRoom(assignment);
  if (roomNumber) {
    patternDays.forEach((day) => {
      for (
        let slot = startMinutes;
        slot < startMinutes + durationMinutes;
        slot += 30
      ) {
        const key = `${day}_${slot}`;
        if (!roomIndex.has(key)) roomIndex.set(key, new Set());
        roomIndex.get(key).add(roomNumber);
      }
    });
  }

  const instructorId = getAssignmentInstructorId(assignment);
  if (instructorId) {
    patternDays.forEach((day) => {
      for (
        let slot = startMinutes;
        slot < startMinutes + durationMinutes;
        slot += 30
      ) {
        const key = `${day}_${slot}_${instructorId}`;
        instructorIndex.set(key, true);
      }
    });
  }
}

// ─── Pattern cache ────────────────────────────────────────────────────────────

function buildPatternCache(activeDaysSet) {
  const cache = new Map();
  const activePatterns = [];
  const inactivePatterns = [];
  PATTERN_FALLBACK_ORDER.forEach((pattern) => {
    const days = patternDaysMap[pattern] ?? [];
    const isActive = days.length > 0 && days.every((d) => activeDaysSet.has(d));
    cache.set(pattern, { days, isActive });
    if (isActive) {
      activePatterns.push(pattern);
    } else {
      inactivePatterns.push(`${pattern}(days:[${days.join(",")}])`);
    }
  });
  console.log(
    `[buildPatternCache] activeDaysSet: [${Array.from(activeDaysSet).join(", ")}] | ${activePatterns.length} active patterns | ${inactivePatterns.length} inactive`,
  );
  console.debug(
    `  [buildPatternCache] Active patterns: [${activePatterns.join(", ")}]`,
  );
  if (inactivePatterns.length > 0) {
    console.debug(
      `  [buildPatternCache] Inactive patterns (filtered out): [${inactivePatterns.join(", ")}]`,
    );
  }
  return cache;
}

// ─── Room Categorization for Special Subjects ─────────────────────────────────

/**
 * Categorizes eligible rooms by type and subject for prioritized room assignment.
 *
 * Special subjects (OJT, Thesis, FTS, Capstone, etc.) are prioritized into AVR and
 * Accreditation Rooms first. Non-special subjects use regular rooms (Lecture, Computer Lab)
 * first, with special rooms as fallback. Within each category, rooms are sorted by
 * capacity waste (minimal difference between room capacity and enrolled count).
 *
 * Room assignment priority for special subjects:
 * 1. Accreditation Room (primary special room)
 * 2. AVR (secondary special room)
 * 3. Regular rooms (Lecture, Computer Lab) - fallback if special rooms full
 *
 * Room assignment priority for non-special subjects:
 * 1. Regular rooms (Lecture, Computer Lab)
 * 2. Accreditation Room and AVR (fallback if regular rooms full)
 *
 * @param {Array} eligibleRooms - Pre-filtered rooms eligible for the subject
 * @param {string} subjectCode - Subject code (e.g., "CS101")
 * @param {string} subjectTitle - Subject title (e.g., "OJT in Software Development")
 * @param {number} enrolled - Enrolled student count
 * @returns {Array} Rooms ordered by category priority and capacity waste
 */
function categorizeRoomsBySubject(
  eligibleRooms,
  subjectCode,
  subjectTitle,
  enrolled,
) {
  if (!Array.isArray(eligibleRooms) || eligibleRooms.length === 0) {
    return eligibleRooms;
  }

  const isSpecial = isSpecialRoomSubject(subjectCode, subjectTitle);

  // Separate rooms into special (AVR, Accreditation Room) and regular (others)
  const specialRooms = eligibleRooms.filter((room) =>
    SPECIAL_ROOM_TYPES.has(normalizeRoomType(room.type)),
  );
  const regularRooms = eligibleRooms.filter(
    (room) => !SPECIAL_ROOM_TYPES.has(normalizeRoomType(room.type)),
  );

  // Sort each category by capacity waste (least waste first)
  const sortByWaste = (roomA, roomB) => {
    const aWaste = Math.max(0, (roomA.capacity ?? 0) - enrolled);
    const bWaste = Math.max(0, (roomB.capacity ?? 0) - enrolled);
    return aWaste - bWaste;
  };

  specialRooms.sort(sortByWaste);
  regularRooms.sort(sortByWaste);

  // For special subjects, prioritize special rooms first (Accreditation Room before AVR)
  if (isSpecial) {
    // Prioritize Accreditation Room before AVR within special rooms
    const accreditationRooms = specialRooms.filter(
      (room) => normalizeRoomType(room.type) === "Accreditation Room",
    );
    const avrRooms = specialRooms.filter(
      (room) => normalizeRoomType(room.type) === "AVR",
    );
    // TSU Rule: OJT/special subjects must NEVER be placed in Computer Lab rooms
    const nonLabRegularRooms = regularRooms.filter(
      (room) => normalizeRoomType(room.type) !== "Computer Lab",
    );
    return [...accreditationRooms, ...avrRooms, ...nonLabRegularRooms];
  }

  // For non-special subjects, regular rooms first, special rooms as fallback
  return [...regularRooms, ...specialRooms];
}

/**
 * Updated: accepts activeDaysSet as last parameter for TSU pattern filtering.
 */
function buildSectionPrecompute(
  row,
  courseSubjectId,
  courseDuration,
  pattern,
  importedStart,
  importedPattern,
  fallbackSubject,
  roomPool,
  patternCache,
  activeDaysSet,
) {
  const durationMinutes = Math.round(courseDuration * 60);
  const sectionId = getAssignmentSectionId(row);
  const normalizedSectionId = getNormalizedSectionId(row);
  const sectionTermKey = buildSectionTermKey(row);
  const identityKey = getAssignmentIdentityKey(row);

  const eligibleRooms = buildEligibleRooms(roomPool, row);
  // Categorize rooms by subject type: special subjects get special rooms first (Accreditation Room, AVR).
  // Non-special subjects use regular rooms first with special rooms as fallback.
  const orderedRooms = categorizeRoomsBySubject(
    eligibleRooms,
    getAssignmentSubjectCode(row),
    String(row?.title ?? row?.course_title ?? "").trim(),
    row.enrolled ?? 0,
  );

  // ── TSU Rule: determine EVE status first — needed for session window selection
  const sectionLabel = String(row?.section ?? "").trim();
  const isEve = isEveSection(sectionLabel);

  // ── FIX (Bug 2 — Time Windows): Determine which session window(s) to use.
  // Morning  : 7:00 AM – 11:00 AM  (non-EVE, imported start before noon)
  // Afternoon: 1:00 PM –  6:00 PM  (non-EVE, imported start after noon)
  // Night    : 6:00 PM –  9:00 PM  (EVE sections only)
  // When no imported start is available for a regular section, we generate
  // slots for BOTH the morning AND afternoon windows so the algorithm can
  // find a free slot in either session.
  let sessionWindows;
  if (isEve) {
    sessionWindows = [{ startTime: "18:00", endTime: "21:00" }];
  } else if (importedStart) {
    const importedMins = parse24TextToMinutes(importedStart);
    if (importedMins != null && importedMins < LUNCH_START_MIN) {
      sessionWindows = [{ startTime: "07:00", endTime: "11:00" }];
    } else {
      sessionWindows = [{ startTime: "13:00", endTime: "18:00" }];
    }
  } else {
    // No imported start — try morning first, then afternoon
    sessionWindows = [
      { startTime: "07:00", endTime: "11:00" },
      { startTime: "13:00", endTime: "18:00" },
    ];
  }

  const candidateSlots = sessionWindows.flatMap(({ startTime: wStart, endTime: wEnd }) =>
    buildCandidateStarts({
      duration: courseDuration,
      startTime: wStart,
      endTime: wEnd,
      preferredStart: importedStart || undefined,
    }).map((slotMinutes) => ({
      slotMinutes,
      formattedSlot: minutesTo24Text(slotMinutes),
    }))
  );

  // ── TSU Rule: use getPatternsForSection instead of raw fallback order ────────
  const tsuPatterns = getPatternsForSection(
    courseDuration,
    isEve,
    activeDaysSet,
  );

  // If we have an imported pattern, try it first, then fall back to TSU patterns
  const patternsToTry = importedPattern
    ? [importedPattern, ...tsuPatterns.filter((p) => p !== importedPattern)]
    : tsuPatterns;

  const validPatterns = patternsToTry.filter(
    (p) => patternCache.get(p)?.isActive,
  );

  console.debug(
    `[buildSectionPrecompute] Section: ${sectionId} | ${getAssignmentSubjectCode(row)}::${sectionLabel} | Duration: ${courseDuration}h | RoomType: ${row.roomType}`,
  );
  console.debug(
    `  → Rooms: eligible=${eligibleRooms.length} ordered=${orderedRooms.length} | Slots: ${candidateSlots.length} | TSU patterns: ${tsuPatterns.length} | Valid patterns: ${validPatterns.length}`,
  );
  if (validPatterns.length === 0) {
    console.warn(
      `  → WARNING: No valid patterns after filtering! patternsToTry: [${patternsToTry.join(", ")}]`,
    );
  } else {
    console.debug(`  → Valid patterns to try: [${validPatterns.join(", ")}]`);
  }

  return {
    sectionId,
    normalizedSectionId,
    sectionTermKey,
    identityKey,
    durationMinutes,
    courseDuration,
    importedStartMinutes: importedStart ? parse24TextToMinutes(importedStart) : null,
    importedStart,
    importedPattern,
    orderedRooms,
    eligibleRooms,
    candidateSlots,
    validPatterns,
    patternsToTry,
    patternCache,
    isEve,
  };
}

// ─── Subject Validation Helper ────────────────────────────────────────────────

/**
 * Validates and looks up a subject by its normalized code.
 * Returns both the lookup result and validation status.
 *
 * @param {string} code - The subject code (should already be trimmed/uppercased)
 * @param {Map} subjectByCode - Map of normalized codes to subject objects
 * @returns {{found: boolean, subject: object|null, code: string}}
 */
function validateAndLookupSubject(code, subjectByCode) {
  const normalizedCode = String(code ?? "")
    .trim()
    .toUpperCase();

  const subject = subjectByCode.get(normalizedCode) ?? null;
  const found = subject !== null && normalizedCode.length > 0;

  return {
    found,
    subject,
    code: normalizedCode,
  };
}

/**
 * Builds an enhanced subject lookup index with multiple mapping strategies.
 * Creates maps by code AND by id for more flexible subject resolution.
 *
 * @param {Array} subjects - Array of subject objects
 * @returns {object} Object with subjectByCode and subjectById maps
 */
function buildSubjectLookupIndex(subjects) {
  const subjectByCode = new Map();
  const subjectById = new Map();

  (Array.isArray(subjects) ? subjects : []).forEach((subject) => {
    if (subject?.code) {
      const normalizedCode = String(subject.code).trim().toUpperCase();
      subjectByCode.set(normalizedCode, subject);
    }

    if (subject?.id) {
      const normalizedId = String(subject.id).trim().toUpperCase();
      subjectById.set(normalizedId, subject);
    }
  });

  return { subjectByCode, subjectById };
}

/**
 * Tracks subject resolution failures during scheduling for debugging.
 * Captures unresolved identifiers and raw assignment properties.
 */
class SubjectResolutionCache {
  constructor() {
    this.failures = new Map(); // key: unresolved identifier, value: { count, examples }
    this.failuresByRawValue = new Map(); // key: raw value from assignment, value: details
  }

  recordFailure(identifier, rawValue, assignment) {
    // Track by normalized identifier
    if (!this.failures.has(identifier)) {
      this.failures.set(identifier, { count: 0, examples: [] });
    }
    const failure = this.failures.get(identifier);
    failure.count += 1;
    if (failure.examples.length < 2) {
      failure.examples.push({
        rawValue,
        sectionId: assignment?.sectionId,
        row: `${assignment?.code}::${assignment?.section}`,
      });
    }

    // Track by raw value for detailed debugging
    if (!this.failuresByRawValue.has(rawValue)) {
      this.failuresByRawValue.set(rawValue, { count: 0, sources: [] });
    }
    const rawFailure = this.failuresByRawValue.get(rawValue);
    rawFailure.count += 1;
    if (rawFailure.sources.length < 1) {
      rawFailure.sources.push(assignment?.sectionId || "unknown");
    }
  }

  getReport() {
    if (this.failures.size === 0) {
      return null;
    }

    const summary = [];
    this.failures.forEach((failure, identifier) => {
      summary.push({
        identifier,
        count: failure.count,
        examples: failure.examples,
      });
    });

    return {
      totalFailures: Array.from(this.failures.values()).reduce(
        (sum, f) => sum + f.count,
        0,
      ),
      uniqueIdentifiers: this.failures.size,
      failures: summary,
    };
  }
}

/**
 * Generates a human-readable report of subject resolution failures.
 * Called after scheduling to provide debugging insights.
 *
 * @param {SubjectResolutionCache} cache - The resolution cache with failure data
 * @param {number} conflictCount - Total conflicts generated
 * @returns {void} Logs report to console
 */
function generateSubjectResolutionReport(cache, conflictCount) {
  const report = cache.getReport();
  if (!report) {
    console.log(
      "[scheduleUtils] [OK] Subject resolution: All subjects resolved successfully.",
    );
    return;
  }

  console.warn("[scheduleUtils] [WARN] Subject Resolution Report:");
  console.warn(
    "  Total Unresolved: " +
    report.totalFailures +
    " assignments | Unique Identifiers: " +
    report.uniqueIdentifiers,
  );

  report.failures.forEach(({ identifier, count, examples }) => {
    console.warn(
      "  [X] '" +
      identifier +
      "' (" +
      count +
      " occurrence" +
      (count > 1 ? "s" : "") +
      ")",
    );
    if (examples.length > 0) {
      examples.forEach((ex) => {
        console.warn(
          "    |-- Section: " +
          (ex.sectionId ?? "unknown") +
          " | " +
          ex.row +
          " | Raw: '" +
          ex.rawValue +
          "'",
        );
      });
    }
  });

  console.warn(
    "Total conflicts created from unresolved subjects: " + conflictCount,
  );
}

/**
 * Validates that an assignment references valid subjects, rooms, and instructors.
 * Used to detect UNKNOWN subject codes and invalid foreign key references before persistence.
 *
 * @param {object} assignment - The assignment object to validate
 * @param {Map} subjectByCode - Map of subject codes to subject objects
 * @param {Array} rooms - Array of available rooms
 * @param {Array} instructors - Array of available instructors
 * @returns {{isValid: boolean, validationError?: string}}
 */
function validateAssignmentReferences(
  assignment,
  subjectByCode,
  rooms,
  instructors,
) {
  if (!assignment) {
    return {
      isValid: false,
      validationError: "Assignment is null or undefined",
    };
  }

  // Check subject validity
  const subjectCode = String(
    assignment.subject_code ?? assignment.course_code ?? "",
  ).trim();
  const subjectId = String(assignment.subject_id ?? "").trim();

  if (!subjectCode && !subjectId) {
    return {
      isValid: false,
      validationError: "Assignment missing subject code and subject_id",
    };
  }

  // Check for UNKNOWN subject codes
  if (subjectCode.toUpperCase().startsWith("UNKNOWN")) {
    return {
      isValid: false,
      validationError: `Subject code '${subjectCode}' could not be mapped. Possible causes: subject was deleted from database, CSV import failed, or data changed after sections were loaded.`,
    };
  }

  // Check if subject exists in database
  if (subjectCode) {
    const normalizedCode = subjectCode.trim().toUpperCase();
    if (!subjectByCode.has(normalizedCode)) {
      return {
        isValid: false,
        validationError: `Subject '${subjectCode}' not found in database. Database may have been modified after schedule generation.`,
      };
    }
  }

  // Check room validity
  const roomNumber = String(
    assignment.room_number ?? assignment.room ?? "",
  ).trim();
  const roomId = String(assignment.room_id ?? "").trim();

  if (!roomNumber && !roomId) {
    return {
      isValid: false,
      validationError: "Assignment missing room number and room_id",
    };
  }

  if (
    roomNumber &&
    !rooms.find((r) => String(r.number).trim() === roomNumber)
  ) {
    return {
      isValid: false,
      validationError: `Room '${roomNumber}' not found in database. Room may have been deleted.`,
    };
  }

  // Check instructor validity
  const instructorId = String(assignment.instructor_id ?? "").trim();
  const instructorName = String(
    assignment.instructor_name ?? assignment.instructor ?? "",
  ).trim();

  if (!instructorId && !instructorName) {
    return {
      isValid: false,
      validationError: "Assignment missing instructor_id and instructor name",
    };
  }

  if (
    instructorId &&
    !instructors.find((i) => String(i.id ?? "").trim() === instructorId)
  ) {
    return {
      isValid: false,
      validationError: `Instructor ID '${instructorId}' not found in database. Instructor may have been deleted.`,
    };
  }

  return { isValid: true };
}

// ─── ★ Auto-Schedule ──────────────────────────────────────────────────────────

export function runAutoSchedule({
  sectionRows,
  subjects = [],
  rooms,
  instructors = [],
  instructorSubjects = [],
  scheduleAssignments,
  startTime,
  endTime,
  pattern,
  activeDays,
}) {
  if (activeDays.length === 0)
    return { error: "Please select at least one active day." };

  const weights = getSoftWeights();
  const newRooms = (Array.isArray(rooms) ? rooms : []).map((r) => ({ ...r }));

  // ── Build enhanced subject lookup index ────────────────────────────────────
  const { subjectByCode, subjectById } = buildSubjectLookupIndex(subjects);

  // ── Initialize subject resolution failure tracking ────────────────────────
  const resolutionCache = new SubjectResolutionCache();

  const instructorPoolById = buildInstructorPoolMap(instructors);
  const eligibleInstructorIdsBySubjectId =
    buildSubjectIdToEligibleInstructors(instructorSubjects);
  const existingAssignments = (
    Array.isArray(scheduleAssignments) ? scheduleAssignments : []
  ).map((a) => normalizeForConflictChecks(a, pattern));
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

  console.log(
    `[runAutoSchedule] Entry point: ${sectionRows.length} sectionRows | activeDays: [${activeDays.join(", ")}] | timeWindow: ${startTime}-${endTime} | pattern: ${pattern}`,
  );
  sectionRows.forEach((row) => {
    console.debug(
      `  [runAutoSchedule] Input section: ${row.sectionId} | ${row.code}::${row.section} | Duration: ${row.duration}h | RoomType: ${row.roomType}`,
    );
  });

  if (sectionRows.length === 0) {
    console.error(
      "[runAutoSchedule] ERROR: sectionRows is empty! Cannot schedule any sections.",
    );
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

  const occupancyIndexes = buildOccupancyIndex(existingAssignments);
  const occupiedPool = [...existingAssignments];
  const instructorLoadCount = buildInstructorLoadCount(existingAssignments);

  const activeDaysSet = new Set(activeDays);
  const patternCache = buildPatternCache(activeDaysSet);

  let assigned = 0;
  let conflictCount = 0;

  // ── Track pattern assignments per section to enforce 2-days-per-week limit ────
  const assignedPatternsPerSection = new Map();

  sectionRows.forEach((row) => {
    const course = normalizeForConflictChecks(row, pattern);
    const courseSubjectCode = getAssignmentSubjectCode(course);

    // ── Validate subject lookup with defensive checking ───────────────────────
    const subjectLookup = validateAndLookupSubject(
      courseSubjectCode,
      subjectByCode,
    );
    const fallbackSubject = subjectLookup.subject;

    // If subject code exists but was not found in database, mark as conflict
    if (courseSubjectCode && !subjectLookup.found) {
      // Capture raw identifier for debugging
      const rawIdentifier =
        course?.code ?? course?.subjectCode ?? course?.subject_code ?? "???";

      resolutionCache.recordFailure(courseSubjectCode, rawIdentifier, course);

      console.warn(
        `[scheduleUtils] Subject resolution failed: '${courseSubjectCode}' (raw: '${rawIdentifier}') for section ${course.sectionId}`,
      );

      generatedAssignments.push({
        ...course,
        room: "",
        time: "",
        duration: 1.5,
        pattern: pattern,
        instructor: "",
        instructorId: "",
        instructor_id: "",
        status: "Conflict",
        conflictReason: `Subject not found: '${courseSubjectCode}' (raw identifier: '${rawIdentifier}')`,
      });
      conflictCount++;
      return;
    }

    // Safe extraction of subject ID with fallbacks
    const courseSubjectId = String(
      course.subjectId ??
      fallbackSubject?.id ??
      fallbackSubject?.subject_id ??
      "",
    ).trim();
    course.subjectId = courseSubjectId;

    // Safe extraction of duration with optional chaining
    const courseDuration =
      Number(course.duration ?? fallbackSubject?.duration ?? 1.5) || 1.5;
    const durationMinutes = Math.round(courseDuration * 60);
    if (durationMinutes <= 0) return;
    const assignmentKey = getAssignmentIdentityKey(course);

    const importedStart = extractStartTime24(course, "");
    const importedPattern = getPatternForRow(course, "");
    const importedInstructor = getAssignmentInstructorName(course);
    const importedInstructorId = getAssignmentInstructorId(course);

    // ── PRECOMPUTE — now passes activeDaysSet for TSU pattern filtering ────────
    const sectionPrecompute = buildSectionPrecompute(
      row,
      courseSubjectId,
      courseDuration,
      pattern,
      importedStart,
      importedPattern,
      fallbackSubject,
      newRooms,
      patternCache,
      activeDaysSet,
    );

    const { isEve } = sectionPrecompute;

    if (sectionPrecompute.orderedRooms.length === 0) {
      generatedAssignments.push({
        ...course,
        room: "",
        time: importedStart
          ? `${importedPattern || pattern} ${formatTime(importedStart)}`
          : "",
        duration: courseDuration,
        pattern: importedPattern || pattern,
        instructor: importedInstructor,
        instructorId: importedInstructorId,
        instructor_id: importedInstructorId,
        status: "Conflict",
        conflictReason: "No eligible room (type/capacity) for this section.",
      });
      conflictCount++;
      return;
    }

    const eligibleInstructorIds =
      eligibleInstructorIdsBySubjectId.get(courseSubjectId);
    if (!eligibleInstructorIds || eligibleInstructorIds.size === 0) {
      generatedAssignments.push({
        ...course,
        room: "",
        instructor: "",
        instructorId: "",
        instructor_id: "",
        time: importedStart
          ? `${importedPattern || pattern} ${formatTime(importedStart)}`
          : "",
        duration: courseDuration,
        pattern: importedPattern || pattern,
        status: "Conflict",
        conflictReason:
          "No eligible instructor mapped for this section subject.",
      });
      conflictCount++;
      return;
    }

    let bestResult = null;
    let patternUsed = null;
    let slotUsed = null;
    let instructorUsed = null;

    outerSearch: for (const tryPattern of sectionPrecompute.validPatterns) {
      const patternDays =
        sectionPrecompute.patternCache.get(tryPattern)?.days ?? [];
      if (patternDays.length === 0) continue;

      // ── TSU Rule: block Saturday for non-EVE sections ──────────────────────
      if (!isEve && patternDays.includes("SAT")) continue;

      // ── TSU Rule: Lec/Lab split — ensure Lec and Lab land on DIFFERENT days
      // with at least a 1-day gap (e.g. Lec Monday → Lab must be Wednesday+).
      const rawSectionId = String(course?.sectionId ?? "");
      const splitMatch = rawSectionId.match(/^(.+)__(LEC|LAB)$/);
      if (splitMatch) {
        const baseSectionId = splitMatch[1];
        const siblingTag = splitMatch[2] === "LEC" ? "LAB" : "LEC";
        const siblingId = `${baseSectionId}__${siblingTag}`;
        const siblingPatterns = assignedPatternsPerSection.get(siblingId) ?? new Set();
        const siblingDays = new Set();
        siblingPatterns.forEach((p) => {
          (patternDaysMap[p] ?? []).forEach((d) => siblingDays.add(d));
        });

        // FIX (Bug 4 — Lec/Lab 1-day gap):
        // Require a minimum gap of 2 positions in DAY_ORDER between any
        // candidate day and any sibling day (gap of 1 = adjacent = not allowed).
        const hasAdequateGap = patternDays.every((cDay) => {
          const cIdx = DAY_ORDER.indexOf(cDay);
          for (const sDay of siblingDays) {
            const sIdx = DAY_ORDER.indexOf(sDay);
            if (Math.abs(cIdx - sIdx) < 2) return false; // too close
          }
          return true;
        });
        if (!hasAdequateGap) continue;
      }

      // ── TSU Rule: enforce 2-times-per-week constraint ────────────────────────
      const sectionId =
        sectionPrecompute.sectionId || getAssignmentSectionId(course);
      const assignedForSection =
        assignedPatternsPerSection.get(sectionId) || new Set();
      if (
        !isPatternCompatibleWithWeeklyLimit(
          sectionId,
          tryPattern,
          assignedForSection,
        )
      )
        continue;

      for (const {
        slotMinutes,
        formattedSlot,
      } of sectionPrecompute.candidateSlots) {
        if (slotMinutes + durationMinutes > endMinutes) continue;

        // ── FIX (Bug 5 — Night class flag): The allow_night_class flag must
        // be evaluated per-candidate in chooseInstructorForPlacementOptimized
        // (already done there). Here we only skip the slot early if the section
        // itself violates the time window (handled by isTimeSlotAllowed with
        // a permissive flag — individual instructor filtering happens below).
        if (!isTimeSlotAllowed(slotMinutes, durationMinutes, isEve, true)) continue;

        const candidateTime = `${tryPattern} ${formatTime(formattedSlot)}`;

        for (const room of sectionPrecompute.orderedRooms) {
          const placementBase = {
            ...course,
            time: candidateTime,
            duration: courseDuration,
            pattern: tryPattern,
            room: room.number,
            sectionId: sectionPrecompute.sectionId,
            section_id: sectionPrecompute.normalizedSectionId,
            academicYear: getAssignmentAcademicYear(course),
            semester: getAssignmentSemester(course),
            subjectId: courseSubjectId,
            subject_id: courseSubjectId,
          };

          let selectedInstructor = null;

          if (
            importedInstructorId &&
            eligibleInstructorIds.has(importedInstructorId) &&
            instructorPoolById.has(importedInstructorId)
          ) {
            const importedInst = instructorPoolById.get(importedInstructorId);

            // ── TSU Rule: check night class eligibility for imported instructor
            const endMin = slotMinutes + durationMinutes;
            const isNightSlot =
              slotMinutes >= NIGHT_START_MIN || endMin > DAY_END_MIN;
            const instAllowsNight = importedInst?.allow_night_class === true;

            const nightViolation = isNightSlot && !instAllowsNight && !isEve;

            if (
              !nightViolation &&
              !hasIndexedCoverageConflictOptimized(
                occupiedPool,
                occupancyIndexes,
                sectionPrecompute.sectionTermKey,
                sectionPrecompute.identityKey,
                room.number,
                importedInstructorId,
                tryPattern,
                slotMinutes,
                durationMinutes,
                assignmentKey,
                patternDaysMap,
              )
            ) {
              selectedInstructor = {
                instructorId: importedInstructorId,
                instructorName:
                  importedInstructor ||
                  instructorPoolById.get(importedInstructorId)?.name ||
                  "",
              };
            }
          }

          if (!selectedInstructor) {
            selectedInstructor = chooseInstructorForPlacementOptimized({
              courseSubjectId,
              placementBase,
              occupiedPool,
              occupancyIndexes,
              pattern: tryPattern,
              slotMinutes,
              durationMinutes,
              assignmentKeyToIgnore: assignmentKey,
              eligibleInstructorIdsBySubjectId,
              instructorPoolById,
              instructorLoadCount,
              isEve,
            });
          }

          if (selectedInstructor) {
            const score = scoreSoftConstraints(
              course,
              room,
              formattedSlot,
              weights,
            );
            if (bestResult === null || score > bestResult.score) {
              bestResult = { room, score };
              patternUsed = tryPattern;
              slotUsed = formattedSlot;
              instructorUsed = selectedInstructor;
              if (
                tryPattern === importedPattern &&
                slotMinutes === sectionPrecompute.importedStartMinutes
              ) {
                break outerSearch;
              }
            }
          }
        }
      }
    }

    if (bestResult) {
      const finalAssignment = {
        ...course,
        room: bestResult.room.number,
        time: `${patternUsed} ${formatTime(slotUsed)}`,
        duration: courseDuration,
        pattern: patternUsed,
        instructor: instructorUsed?.instructorName || "",
        instructor_name: instructorUsed?.instructorName || "",
        instructorId: instructorUsed?.instructorId || "",
        instructor_id: instructorUsed?.instructorId || "",
        status: "Assigned",
        patternAdjusted:
          importedPattern && patternUsed !== importedPattern
            ? `Pattern changed from ${importedPattern} to ${patternUsed} to resolve conflict`
            : undefined,
      };
      generatedAssignments.push(finalAssignment);

      occupiedPool.push(finalAssignment);
      updateOccupancyIndex(occupancyIndexes, finalAssignment, patternUsed);
      const instructorId = instructorUsed?.instructorId;
      if (instructorId) {
        instructorLoadCount.set(
          instructorId,
          (instructorLoadCount.get(instructorId) ?? 0) + 1,
        );
      }

      // ── Record pattern assignment for 2-days-per-week constraint tracking ────
      const sectionIdForTracking =
        sectionPrecompute.sectionId || getAssignmentSectionId(course);
      if (!assignedPatternsPerSection.has(sectionIdForTracking)) {
        assignedPatternsPerSection.set(sectionIdForTracking, new Set());
      }
      assignedPatternsPerSection.get(sectionIdForTracking).add(patternUsed);

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
        instructorId: importedInstructorId,
        instructor_id: importedInstructorId,
        status: "Conflict",
        conflictReason:
          "No available room and instructor combination for any pattern/time combination.",
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

  const sectionRowMap = new Map(
    sectionRows.map((row) => [getAssignmentIdentityKey(row), row]),
  );
  const sectionTermMap = new Map(
    sectionRows.map((row) => [buildSectionTermKey(row), row]),
  );

  const normalizedFinalAssignments = finalAssignments.map((assignment) => {
    if (
      assignment.section_id &&
      typeof assignment.section_id === "string" &&
      assignment.section_id.length > 0 &&
      !assignment.section_id.includes("|")
    ) {
      return {
        ...assignment,
        status: normalizeAssignmentStatus(assignment.status),
        academic_year:
          getAssignmentAcademicYear(assignment) || assignment.academic_year,
        semester: getAssignmentSemester(assignment) || assignment.semester,
      };
    }

    const associatedSectionRow =
      sectionRowMap.get(getAssignmentIdentityKey(assignment)) ||
      sectionTermMap.get(buildSectionTermKey(assignment));

    if (!associatedSectionRow) {
      const startTime24 = extractStartTime24(assignment, "");
      const duration = Number(assignment.duration ?? 1.5) || 1.5;
      const endMinutes =
        (parse24TextToMinutes(startTime24) || 0) + Math.round(duration * 60);
      return {
        ...assignment,
        section_id: getNormalizedSectionId(assignment),
        subject_id: String(
          assignment.subjectId ?? assignment.subject_id ?? "",
        ).trim(),
        room_id:
          resolveRoomByNumber(getAssignmentRoom(assignment), newRooms)?.id ||
          null,
        instructor_id: getAssignmentInstructorId(assignment),
        subject_code: getAssignmentSubjectCode(assignment),
        room_number: getAssignmentRoom(assignment),
        instructor_name: getAssignmentInstructorName(assignment),
        pattern: getPatternForRow(assignment, pattern),
        time_display: String(
          assignment.time ?? assignment.time_display ?? "",
        ).trim(),
        time_start: parseTimeToSQL(startTime24),
        time_end: parseTimeToSQL(minutesTo24Text(endMinutes)),
        duration,
        status: normalizeAssignmentStatus(assignment.status),
        academic_year: getAssignmentAcademicYear(assignment),
        semester: getAssignmentSemester(assignment),
        updated_at: new Date().toISOString(),
      };
    }

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

  const validatedAssignments = normalizedFinalAssignments.map((assignment) => {
    const normalizedStatus = normalizeAssignmentStatus(assignment.status);
    const sectionId = String(assignment.section_id ?? "").trim();
    const subjectId = String(assignment.subject_id ?? "").trim();
    const roomId = String(assignment.room_id ?? "").trim();
    const instructorId = String(assignment.instructor_id ?? "").trim();
    const academicYear = getAssignmentAcademicYear(assignment);
    const semester = getAssignmentSemester(assignment);

    if (normalizedStatus === "Assigned") {
      const missing = [];
      if (!sectionId) missing.push("section_id");
      if (!subjectId) missing.push("subject_id");
      if (!roomId) missing.push("room_id");
      if (!instructorId) missing.push("instructor_id");
      if (!academicYear) missing.push("academic_year");
      if (!semester) missing.push("semester");

      if (missing.length > 0) {
        return {
          ...assignment,
          status: "Conflict",
          conflictReason:
            assignment.conflictReason ||
            `Missing required DB fields for assigned row: ${missing.join(", ")}`,
          updated_at: new Date().toISOString(),
        };
      }
    }

    return {
      ...assignment,
      status: normalizedStatus,
      academic_year: academicYear,
      semester,
    };
  });

  const dedupedAssignments = dedupeBySectionTerm(validatedAssignments);

  // ─── Validate assignments for unknown subjects and invalid references ──────
  const validatedAndConvertedAssignments = dedupedAssignments.map(
    (assignment) => {
      if (normalizeAssignmentStatus(assignment.status) !== "Assigned") {
        return assignment; // Skip validation for non-assigned status
      }

      const validation = validateAssignmentReferences(
        assignment,
        subjectByCode,
        newRooms,
        instructors || [],
      );

      if (!validation.isValid) {
        return {
          ...assignment,
          status: "Conflict",
          conflictReason:
            assignment.conflictReason || validation.validationError,
          updated_at: new Date().toISOString(),
        };
      }

      return assignment;
    },
  );

  // Count newly converted conflicts for accurate reporting
  const newlyConvertedConflicts = validatedAndConvertedAssignments.filter(
    (assignment) =>
      normalizeAssignmentStatus(assignment.status) === "Conflict" &&
      dedupedAssignments.find(
        (orig) =>
          getAssignmentIdentityKey(orig) ===
          getAssignmentIdentityKey(assignment) &&
          normalizeAssignmentStatus(orig.status) === "Assigned",
      ),
  ).length;

  // Update conflict count to include newly converted assignments
  const updatedConflictCount = conflictCount + newlyConvertedConflicts;

  newRooms.forEach((r) => {
    if (r.status !== "Maintenance") r.status = "Available";
  });
  validatedAndConvertedAssignments.forEach((assignment) => {
    if (normalizeAssignmentStatus(assignment.status) !== "Assigned") return;
    const roomNumber = getAssignmentRoom(assignment);
    if (!roomNumber) return;
    const room = newRooms.find((r) => String(r.number).trim() === roomNumber);
    if (room && room.status !== "Maintenance") room.status = "Occupied";
  });

  const patternAdjustedCount = generatedAssignments.filter(
    (a) => a.patternAdjusted,
  ).length;
  let message = `Auto-generated ${assigned} assignment${assigned !== 1 ? "s" : ""} using imported section data with room and instructor matching.`;
  if (patternAdjustedCount > 0)
    message += ` ${patternAdjustedCount} section${patternAdjustedCount !== 1 ? "s" : ""} had meeting pattern adjusted to avoid conflicts.`;
  if (updatedConflictCount > 0)
    message += ` ${updatedConflictCount} section${updatedConflictCount !== 1 ? "s" : ""} flagged as conflicts — no valid room/instructor placement found or invalid subject/room/instructor references detected.`;

  const duplicateTrimmed =
    validatedAssignments.length - dedupedAssignments.length;
  if (duplicateTrimmed > 0) {
    message += ` ${duplicateTrimmed} duplicate section-term row${duplicateTrimmed !== 1 ? "s were" : " was"} collapsed to satisfy section/term uniqueness.`;
  }

  // ── Generate subject resolution report for debugging ──────────────────────
  generateSubjectResolutionReport(resolutionCache, updatedConflictCount);

  return {
    rooms: newRooms,
    scheduleAssignments: validatedAndConvertedAssignments,
    assigned,
    conflicts: updatedConflictCount,
    message,
  };
}

// ─── Conflict helpers ─────────────────────────────────────────────────────────

function getConflictingAssignments(assignments, targetAssignment, targetKey) {
  return assignments.filter((assignment) => {
    const currentKey = getAssignmentIdentityKey(assignment);
    if (currentKey === targetKey) return false;
    const currentSectionTermKey = buildSectionTermKey(assignment);
    const targetSectionTermKey = buildSectionTermKey(targetAssignment);
    if (
      currentSectionTermKey &&
      targetSectionTermKey &&
      currentSectionTermKey === targetSectionTermKey
    ) {
      return true;
    }
    const currentRoom = getAssignmentRoom(assignment);
    const targetRoom = getAssignmentRoom(targetAssignment);
    const sameRoom = currentRoom && targetRoom && currentRoom === targetRoom;
    const currentInstructorId = getAssignmentInstructorId(assignment);
    const targetInstructorId = getAssignmentInstructorId(targetAssignment);
    const currentInstructorName = getAssignmentInstructorName(assignment);
    const targetInstructorName = getAssignmentInstructorName(targetAssignment);
    const sameInstructor =
      (currentInstructorId &&
        targetInstructorId &&
        currentInstructorId === targetInstructorId) ||
      (currentInstructorName &&
        targetInstructorName &&
        currentInstructorName.toLowerCase() ===
        targetInstructorName.toLowerCase());
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
    const resolvedPattern = getPatternForRow(
      { pattern: entry.pattern },
      "MON,FRI",
    );

    const desired = {
      ...sectionRow,
      sectionId: getAssignmentSectionId(sectionRow),
      room: entry.roomName,
      instructor: entry.instructor || sectionRow.instructor || "",
      instructorId: entry.instructorId,
      duration: Number(entry.duration ?? sectionRow.duration ?? 1.5) || 1.5,
      pattern: resolvedPattern,
      time: `${resolvedPattern} ${formatTime(entry.startTime)}`,
      status: normalizeAssignmentStatus("Assigned"),
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
      const originalPattern = getPatternForRow(conflict, "MON,FRI");
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

  const normalizedAssignments = nextAssignments.map((assignment) => {
    if (
      assignment.section_id &&
      typeof assignment.section_id === "string" &&
      assignment.section_id.length > 0 &&
      !assignment.section_id.includes("|")
    ) {
      return assignment;
    }

    let associatedSectionRow = null;
    for (const sectionRow of sectionRowsByIdentity.values()) {
      if (
        getAssignmentIdentityKey(sectionRow) ===
        getAssignmentIdentityKey(assignment)
      ) {
        associatedSectionRow = sectionRow;
        break;
      }
    }

    if (!associatedSectionRow) {
      return {
        ...assignment,
        section_id: getNormalizedSectionId(assignment),
        subject_id: String(
          assignment.subjectId ?? assignment.subject_id ?? "",
        ).trim(),
        room_id: resolveRoomByNumber(assignment.room, rooms)?.id || null,
        instructor_id: getAssignmentInstructorId(assignment),
        subject_code: getAssignmentSubjectCode(assignment),
        room_number: assignment.room,
        instructor_name: getAssignmentInstructorName(assignment),
        pattern: getPatternForRow(assignment, "MON,FRI"),
        time_display: `${assignment.pattern} ${formatTime(extractStartTime24(assignment, ""))}`,
        time_start: parseTimeToSQL(extractStartTime24(assignment, "")),
        time_end: parseTimeToSQL(
          minutesTo24Text(
            (parse24TextToMinutes(extractStartTime24(assignment, "")) || 0) +
            Math.round((assignment.duration || 1.5) * 60),
          ),
        ),
        duration: Number(assignment.duration ?? 1.5) || 1.5,
        status: normalizeAssignmentStatus(assignment.status),
        academic_year: getAssignmentAcademicYear(assignment),
        semester: getAssignmentSemester(assignment),
        updated_at: new Date().toISOString(),
      };
    }

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

  return {
    scheduleAssignments: dedupeBySectionTerm(normalizedAssignments),
    moved,
  };
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

  // TSU Rule: OJT/special subjects must not be placed in Computer Lab rooms
  const subjectCode = assignmentTarget?.code ?? "";
  const subjectTitle = assignmentTarget?.title ?? "";
  if (isSpecialRoomSubject(subjectCode, subjectTitle)) {
    // We need the room type — check if the roomName matches a Computer Lab pattern
    // The caller doesn't pass room objects, so we check via the assignmentTarget roomType
    const requiredType = normalizeRoomType(assignmentTarget?.roomType ?? "");
    if (requiredType === "Computer Lab") {

      return {
        ok: false,
        type: "error",
        text: `⚠ OJT/special subjects cannot be scheduled in Computer Lab rooms. Use AVR or Accreditation Room instead.`,
      };
    }
  }

  const testCourse = {
    ...assignmentTarget,
    time: `${pattern} ${formatTime(startTime)}`,
    duration,
    pattern,
    room: roomName,
  };
  const conflicting = scheduleAssignments.filter(
    (a) =>
      getAssignmentRoom(a) === roomName &&
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