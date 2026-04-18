import { getWingFromRoomInput } from "./roomUtils";
import {
  normalizeRoomType,
  sanitizeRoomCapacity,
  getDefaultRoomCapacity,
  isValidRoomNumber,
  ROOM_TYPE_LABELS,
  normalizeDepartment,
  normalizeProgram,
  normalizeSemester,
  DEPARTMENT_CODES,
  PROGRAM_CODES,
} from "../data/constants";
import { getStartTimeText, parseTimeTextToMinutes } from "./timeUtils";
import { parseTimeToSQL } from "./scheduleUtils";

const VALID_PROGRAM_HINT = PROGRAM_CODES.join(", ");

export const CSV_TYPES = {
  FULL_LIST: "full-list",
  ROOMS: "rooms",
  INSTRUCTORS: "instructors",
  SUBJECTS: "subjects",
  SCHEDULE: "schedule",
};

const DEFAULT_INSTRUCTOR = {
  department: null,
  availability: "TBD",
  status: "Active",
  employment_status: [],
  max_units: null,
  allow_night_class: false,
};

const VALID_EMPLOYMENT_STATUSES = new Set([
  "lecturer",
  "permanent",
  "attached",
  "temporary",
]);

const DEFAULT_ASSIGNMENT_STATUS = "Pending";
const DEFAULT_SECTION_STATUS_DB = "Not Assigned";
const NIGHT_CLASS_START_HOUR = 18;

export const CSV_FORMATS = {
  [CSV_TYPES.FULL_LIST]: {
    label: "Full List",
    description:
      "Schedule assignments with subject, room, time, duration, instructor, department, and status fields.",
    templatePath: "/csv/full-list.csv",
    templateLabel: "Full List Template",
    filename: "TSU_CCS_Subjects_Full_List_AY2025-2026.csv",
    headers: [
      "Section ID",
      "Subject Code",
      "Subject Title",
      "Section",
      "Academic Year",
      "Semester",
      "Program",
      "Year",
      "Enrolled",
      "Type Required",
      "Room",
      "Pattern",
      "Time",
      "Duration (hrs)",
      "Instructor",
      "Department",
      "Status",
      "Employment Status",
      "Max Units",
      "Allow Night Class",
    ],
    // rowKey: (row) => {
    //   const sectionId = String(row?.section_id ?? row?.sectionId ?? "").trim();
    //   if (sectionId) return `id:${sectionId.toLowerCase()}`;
    //   return buildSectionIdentityKey(row, { includeProgramYear: true });
    // },

    // * In CSV_FORMATS[CSV_TYPES.FULL_LIST]:
    rowKey: (row) => buildSectionIdentityKey(row, { includeProgramYear: true }),
  },
  [CSV_TYPES.ROOMS]: {
    label: "Rooms",
    description: "Room inventory records.",
    templatePath: "/csv/rooms-list.csv",
    templateLabel: "Rooms Template",
    filename: "TSU_CCS_Rooms_List_AY2025-2026.csv",
    headers: ["Room Number", "Room Type", "Capacity", "Status"],
    rowKey: (row) => normalizeHeader(row?.number),
  },
  [CSV_TYPES.INSTRUCTORS]: {
    label: "Instructors",
    description: "Instructor records and availability settings.",
    templatePath: "/csv/instructors-list.csv",
    templateLabel: "Instructors Template",
    filename: "TSU_CCS_Instructors_List_AY2025-2026.csv",
    headers: [
      "Name",
      "Department",
      "Availability",
      "Status",
      "Employment Status",
      "Max Units",
      "Allow Night Class",
    ],
    rowKey: (row) => normalizeInstructorName(row?.name),
  },
  [CSV_TYPES.SUBJECTS]: {
    label: "Subject Sections",
    description: "Subject section records with academic year and semester.",
    templatePath: "/csv/subjects-list.csv",
    templateLabel: "Subject Sections Template",
    filename: "TSU_CCS_Subject_Sections_List_AY2025-2026.csv",
    headers: [
      "Subject Code",
      "Subject Title",
      "Section",
      "Academic Year",
      "Semester",
      "Program",
      "Year",
      "Enrolled",
      "Type Required",
      "Duration (hrs)",
      "Instructor",
      "Status",
    ],
    rowKey: (row) =>
      [
        row?.code,
        row?.program,
        row?.year,
        row?.section,
        row?.academicYear,
        row?.semester,
      ]
        .map((value) => normalizeHeader(value))
        .join("|"),
  },
  [CSV_TYPES.SCHEDULE]: {
    label: "Schedule Assignments",
    description:
      "Schedule assignment records with section, room, instructor, and time details.",
    templatePath: "/csv/schedule-sample.csv",
    templateLabel: "Schedule Template",
    filename: "TSU_CCS_Schedule_Assignments_AY2025-2026.csv",
    headers: [
      "Course Code",
      "Section",
      "Academic Year",
      "Semester",
      "Room",
      "Pattern",
      "Time",
      "Instructor",
      "Status",
    ],
    rowKey: (row) =>
      [row?.code, row?.section, row?.academicYear, row?.semester, row?.room]
        .map((value) => normalizeHeader(value))
        .join("|"),
  },
};

export const CSV_TYPE_OPTIONS = Object.entries(CSV_FORMATS).map(
  ([value, config]) => ({
    value,
    label: config.label,
    description: config.description,
    templatePath: config.templatePath,
    templateLabel: config.templateLabel,
  }),
);

function normalizeHeader(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function normalizeInstructorName(name) {
  return String(name ?? "")
    .trim()
    .toLowerCase();
}

function normalizeSectionIdentity(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function addImportWarning(warnings, message) {
  if (!Array.isArray(warnings)) return;
  warnings.push(message);
}

const ROOM_TYPE_PLACEHOLDERS = new Set(
  ROOM_TYPE_LABELS.map((label) => label.toUpperCase()),
);

function isRoomTypePlaceholderValue(value) {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase();

  if (!normalized) return false;
  if (ROOM_TYPE_PLACEHOLDERS.has(normalized)) return true;

  const slashTokens = normalized
    .split("/")
    .map((token) => token.trim())
    .filter(Boolean);

  return (
    slashTokens.length > 1 &&
    slashTokens.every((token) => ROOM_TYPE_PLACEHOLDERS.has(token))
  );
}

function normalizeAssignmentStatus(
  value,
  fallback = DEFAULT_ASSIGNMENT_STATUS,
) {
  const normalized = normalizeHeader(value);
  if (!normalized) return fallback;
  if (normalized === "assigned") return "Assigned";
  if (normalized === "conflict") return "Conflict";
  if (normalized === "pending" || normalized === "unresolved") return "Pending";
  return fallback;
}

export function normalizeSectionStatusForDb(value) {
  const normalized = normalizeHeader(value);
  if (!normalized) return DEFAULT_SECTION_STATUS_DB;
  if (normalized === "assigned") return "Assigned";
  if (
    normalized === "pending" ||
    normalized === "unresolved" ||
    normalized === "not assigned" ||
    normalized === "not_assigned"
  ) {
    return "Not Assigned";
  }
  return DEFAULT_SECTION_STATUS_DB;
}

export function buildSectionIdentityKey(row, options = {}) {
  const { includeProgramYear = false } = options;
  const parts = includeProgramYear
    ? [
        row?.code,
        row?.program,
        row?.year,
        row?.section,
        row?.academicYear,
        row?.semester,
      ]
    : [row?.code, row?.section, row?.academicYear, row?.semester];

  return parts.map((value) => normalizeHeader(value)).join("|");
}

/**
 * Build a unique identity key for a subject based on code, program, and year.
 * Handles null/undefined values gracefully by converting them to empty strings.
 * Logs warnings when fields fall back to empty string.
 * @param {Object} row - Row object with code, program, year fields
 * @returns {string} Key in format "code|program|year" (all lowercase, trimmed)
 */
export function buildSubjectIdentityKey(row) {
  if (!row) return "||";

  const { code = null, program = null, year = null } = row;

  // Normalize each field and track if it's using a fallback
  const normalizedCode = normalizeValue(code);
  const normalizedProgram = normalizeValue(program);
  const normalizedYear = normalizeValue(year);

  // Log warnings for fields that fell back to empty string
  if (code == null || code === "") {
    console.warn(
      "[buildSubjectIdentityKey] Code field is null/undefined/empty. Key will have empty code segment.",
      { code, program, year },
    );
  }
  if (program == null || program === "") {
    console.warn(
      "[buildSubjectIdentityKey] Program field is null/undefined/empty. Key will have empty program segment.",
      { code, program, year },
    );
  }
  if (year == null || year === "") {
    console.warn(
      "[buildSubjectIdentityKey] Year field is null/undefined/empty. Key will have empty year segment.",
      { code, program, year },
    );
  }

  const key = [normalizedCode, normalizedProgram, normalizedYear].join("|");
  return key;
}

/**
 * Helper function to normalize a value: convert null/undefined to empty string,
 * trim whitespace, and convert to lowercase.
 * @param {*} value - Value to normalize
 * @returns {string} Normalized value
 */
function normalizeValue(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

/**
 * Validate a subject identity key to ensure it has the correct format.
 * Returns an object with validation status and detailed error messages.
 * @param {string} key - The key to validate (should be in "code|program|year" format)
 * @returns {Object} { isValid: boolean, errors: string[] }
 */
export function validateSubjectIdentityKey(key) {
  const errors = [];

  // Check if key is a string
  if (typeof key !== "string") {
    errors.push("Key must be a string");
    return { isValid: false, errors };
  }

  // Check for correct number of pipe separators
  const segments = key.split("|");
  if (segments.length !== 3) {
    errors.push(
      `Key must have exactly 2 pipe separators (found ${segments.length - 1}). Expected format: "code|program|year"`,
    );
  }

  // Check that code (first segment) is not empty
  if (segments.length >= 1 && (!segments[0] || segments[0].trim() === "")) {
    errors.push("Code (first segment) cannot be empty");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Generate helpful suggestions for debugging a failed subject lookup.
 * Analyzes the provided row against available keys to suggest what might be wrong.
 * @param {Object} row - The row that failed to match (with code, program, year)
 * @param {Map|Array} availableKeys - Map or Array of available keys in the database
 * @returns {string[]} Array of suggestion strings
 */
export function generateSubjectLookupSuggestions(row, availableKeys) {
  const suggestions = [];

  if (!row) {
    suggestions.push(
      "Row data is missing or null. Check that the CSV row was parsed correctly.",
    );
    return suggestions;
  }

  // Convert Map to array of keys if needed
  const keysArray =
    availableKeys instanceof Map
      ? Array.from(availableKeys.keys())
      : Array.isArray(availableKeys)
        ? availableKeys
        : [];

  if (keysArray.length === 0) {
    suggestions.push(
      "No subjects found in the database. Verify that subjects have been imported.",
    );
    return suggestions;
  }

  const { code = null, program = null, year = null } = row;
  const normalizedCode = normalizeValue(code);
  const normalizedProgram = normalizeValue(program);
  const normalizedYear = normalizeValue(year);

  // Try to find patterns in available keys that match parts of the search key
  const codeMatches = keysArray.filter((k) =>
    k.startsWith(normalizedCode + "|"),
  );

  // Auto-detect likely issues
  if (normalizedCode && codeMatches.length === 0) {
    suggestions.push(
      `Code "${code}" not found in any subject. Check if the code is spelled correctly.`,
    );
  } else if (normalizedCode && codeMatches.length > 0) {
    // Code exists but combination doesn't match
    const programsForCode = codeMatches
      .map((k) => k.split("|")[1])
      .filter((p, i, arr) => arr.indexOf(p) === i && p !== "");

    if (normalizedProgram && !programsForCode.includes(normalizedProgram)) {
      if (programsForCode.length > 0) {
        suggestions.push(
          `Code "${code}" found but program "${program}" does not match. ` +
            `Available programs for this code: ${programsForCode.join(", ")}. ` +
            `Verify the program value in your CSV.`,
        );
      } else {
        suggestions.push(
          `Code "${code}" found but no subjects have a program specified for this code. ` +
            `Check if the program value "${program}" is correct.`,
        );
      }
    } else if (!normalizedProgram) {
      suggestions.push(
        `Code "${code}" found but program is empty. Available programs for this code: ${programsForCode.length > 0 ? programsForCode.join(", ") : "(none specified)"}. ` +
          `The CSV may be missing the program value.`,
      );
    }
  } else if (!normalizedCode) {
    suggestions.push(
      "Code field is empty or missing. Check that the subject code is present in the CSV.",
    );
  }

  if (normalizedCode && normalizedProgram) {
    const yearMatches = keysArray.filter((k) => {
      const parts = k.split("|");
      return parts[0] === normalizedCode && parts[1] === normalizedProgram;
    });

    if (yearMatches.length === 0 && normalizedYear) {
      suggestions.push(
        `No subjects found for code "${code}" with program "${program}". ` +
          `Check if this code/program combination exists in the database.`,
      );
    } else if (yearMatches.length > 0 && normalizedYear) {
      const yearsForCodeProgram = yearMatches
        .map((k) => k.split("|")[2])
        .filter((y, i, arr) => arr.indexOf(y) === i && y !== "");

      if (normalizedYear && !yearsForCodeProgram.includes(normalizedYear)) {
        suggestions.push(
          `Year "${year}" not found for code "${code}" with program "${program}". ` +
            `Available years: ${yearsForCodeProgram.length > 0 ? yearsForCodeProgram.join(", ") : "(none specified)"}. ` +
            `Verify the year value in your CSV.`,
        );
      }
    }
  }

  // Fallback generic suggestions
  if (suggestions.length === 0) {
    suggestions.push(
      "Subject not found in the database. Verify that: (1) Code, program, and year values exist in the database; (2) The values are spelled correctly and match existing subjects; (3) There are no extra spaces or case differences in the CSV values.",
    );
  }

  return suggestions;
}

/**
 * Parse a time range string (e.g., "07:00 AM - 08:30 AM") into start/end times.
 * Returns { timeStart: "HH:MM:SS", timeEnd: "HH:MM:SS" } in SQL format, or null if parsing fails.
 * @param {string} timeRangeString - Time range like "07:00 AM - 08:30 AM" or "7:00 AM – 8:30 AM"
 * @returns {Object|null} { timeStart, timeEnd } in SQL time format, or null
 */
export function parseTimeRange(timeRangeString) {
  const text = String(timeRangeString ?? "").trim();
  if (!text) return null;

  // Split on dash or en-dash
  const parts = text.split(/\s*[-–]\s*/).filter(Boolean);
  if (parts.length !== 2) return null;

  const startMinutes = parseTimeTextToMinutes(parts[0].trim());
  const endMinutes = parseTimeTextToMinutes(parts[1].trim());

  if (startMinutes == null || endMinutes == null) return null;

  const timeStart = parseTimeToSQL(minutesToTime24(startMinutes));
  const timeEnd = parseTimeToSQL(minutesToTime24(endMinutes));

  return { timeStart, timeEnd };
}

/**
 * Convert minutes since midnight to 24-hour time format (HH:MM).
 * @param {number} totalMinutes - Minutes since midnight
 * @returns {string} Time in HH:MM format
 */
function minutesToTime24(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toCsvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function parseCsvText(csvText) {
  const text = String(csvText ?? "").replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell.trim());
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    rows.push(row);
  }

  return rows.filter((r) => r.some((c) => String(c).trim() !== ""));
}

function assertHeaderMatch(actualHeaders, expectedHeaders) {
  const normalizedActual = actualHeaders.map(normalizeHeader);
  const normalizedExpected = expectedHeaders.map(normalizeHeader);

  if (normalizedActual.length !== normalizedExpected.length) return false;

  return normalizedExpected.every((header, index) => {
    return normalizedActual[index] === header;
  });
}

function assertFullListHeaderMatch(actualHeaders) {
  const normalizedActual = actualHeaders.map(normalizeHeader);
  const baseHeaders = [
    "section id",
    "subject code",
    "subject title",
    "section",
    "academic year",
    "semester",
    "program",
    "year",
    "enrolled",
    "type required",
    "room",
    "pattern",
    "time",
    "duration (hrs)",
    "instructor",
  ];

  const baseMatches = baseHeaders.every(
    (header, index) => normalizedActual[index] === header,
  );
  if (!baseMatches) return false;

  if (normalizedActual.length === baseHeaders.length + 5) {
    return (
      normalizedActual[15] === "department" &&
      normalizedActual[16] === "status" &&
      normalizedActual[17] === "employment status" &&
      normalizedActual[18] === "max units" &&
      normalizedActual[19] === "allow night class"
    );
  }

  if (normalizedActual.length === baseHeaders.length + 4) {
    return (
      normalizedActual[15] === "status" &&
      normalizedActual[16] === "employment status" &&
      normalizedActual[17] === "max units" &&
      normalizedActual[18] === "allow night class"
    );
  }

  return false;
}

function assertRoomHeaderMatch(actualHeaders) {
  const normalizedActual = actualHeaders.map(normalizeHeader);
  const baseHeaders = CSV_FORMATS[CSV_TYPES.ROOMS].headers.map(normalizeHeader);

  const hasBaseHeaders = baseHeaders.every((header, index) => {
    return normalizedActual[index] === header;
  });

  if (!hasBaseHeaders) return false;

  if (normalizedActual.length === baseHeaders.length) return true;
  if (normalizedActual.length !== baseHeaders.length + 1) return false;

  return ["wing", "room wing"].includes(normalizedActual[baseHeaders.length]);
}

function parseEmploymentStatusCell(
  rawValue,
  rowNumber,
  warnings,
  contextLabel = "Instructors",
) {
  const cell = String(rawValue ?? "").trim();
  if (!cell) {
    return { value: null, provided: false };
  }

  const tokens = cell
    .split(",")
    .map((token) => normalizeHeader(token))
    .filter(Boolean);

  const valid = [];
  const invalid = [];

  tokens.forEach((token) => {
    if (VALID_EMPLOYMENT_STATUSES.has(token)) {
      if (!valid.includes(token)) {
        valid.push(token);
      }
      return;
    }
    invalid.push(token);
  });

  if (invalid.length > 0) {
    addImportWarning(
      warnings,
      `${contextLabel} row ${rowNumber}: ignored invalid employment status value(s): ${invalid.join(", ")}.`,
    );
  }

  return { value: valid, provided: true };
}

function parseMaxUnitsCell(
  rawValue,
  rowNumber,
  warnings,
  contextLabel = "Instructors",
) {
  const cell = String(rawValue ?? "").trim();
  if (!cell) {
    return { value: null, provided: false };
  }

  const parsed = Number(cell);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    addImportWarning(
      warnings,
      `${contextLabel} row ${rowNumber}: invalid max units "${cell}"; storing null.`,
    );
    return { value: null, provided: true };
  }

  return { value: parsed, provided: true };
}

function parseAllowNightClassCell(
  rawValue,
  rowNumber,
  warnings,
  contextLabel = "Instructors",
) {
  const cell = String(rawValue ?? "").trim();
  if (!cell) {
    return { value: false, provided: false };
  }

  const normalized = normalizeHeader(cell);
  const truthy = new Set(["true", "yes", "y", "1", "on"]);
  const falsy = new Set(["false", "no", "n", "0", "off"]);

  if (truthy.has(normalized)) {
    return { value: true, provided: true };
  }

  if (falsy.has(normalized)) {
    return { value: false, provided: true };
  }

  addImportWarning(
    warnings,
    `${contextLabel} row ${rowNumber}: invalid allow night class value "${cell}"; defaulted to false.`,
  );
  return { value: false, provided: true };
}

export function isNightClassFromTime(timeDisplay) {
  const value = String(timeDisplay ?? "").trim();
  if (!value) return false;

  const startToken = getStartTimeText(value);
  if (!startToken) return false;

  const totalMinutes = parseTimeTextToMinutes(startToken);
  if (totalMinutes == null) return false;
  return totalMinutes >= NIGHT_CLASS_START_HOUR * 60;
}

function resolveInstructorHeaderIndexes(actualHeaders) {
  const normalizedActual = actualHeaders.map(normalizeHeader);

  // Required base columns remain fixed for compatibility.
  if (normalizedActual[0] !== "name" || normalizedActual[1] !== "department") {
    return null;
  }

  // Extended template: Name, Department, Availability, Status, Employment Status, Max Units, Allow Night Class
  if (
    normalizedActual.length >= 7 &&
    normalizedActual[2] === "availability" &&
    normalizedActual[3] === "status" &&
    normalizedActual[4] === "employment status" &&
    normalizedActual[5] === "max units" &&
    normalizedActual[6] === "allow night class"
  ) {
    return {
      availabilityIndex: 2,
      statusIndex: 3,
      employmentStatusIndex: 4,
      maxUnitsIndex: 5,
      allowNightClassIndex: 6,
      availabilityColumnMissing: false,
    };
  }

  // Standard template: Name, Department, Availability, Status
  if (
    normalizedActual.length >= 4 &&
    normalizedActual[2] === "availability" &&
    normalizedActual[3] === "status"
  ) {
    return {
      availabilityIndex: 2,
      statusIndex: 3,
      employmentStatusIndex: -1,
      maxUnitsIndex: -1,
      allowNightClassIndex: -1,
      availabilityColumnMissing: false,
    };
  }

  // Optional availability column support: Name, Department, Status
  if (normalizedActual.length >= 3 && normalizedActual[2] === "status") {
    return {
      availabilityIndex: -1,
      statusIndex: 2,
      employmentStatusIndex: -1,
      maxUnitsIndex: -1,
      allowNightClassIndex: -1,
      availabilityColumnMissing: true,
    };
  }

  // Accept an explicitly blank availability header before Status.
  if (
    normalizedActual.length >= 4 &&
    !normalizedActual[2] &&
    normalizedActual[3] === "status"
  ) {
    return {
      availabilityIndex: -1,
      statusIndex: 3,
      employmentStatusIndex: -1,
      maxUnitsIndex: -1,
      allowNightClassIndex: -1,
      availabilityColumnMissing: true,
    };
  }

  return null;
}

function assertInstructorHeaderMatch(actualHeaders) {
  return !!resolveInstructorHeaderIndexes(actualHeaders);
}

function assertScheduleHeaderMatch(actualHeaders) {
  const normalizedActual = actualHeaders.map(normalizeHeader);
  const expectedHeaders =
    CSV_FORMATS[CSV_TYPES.SCHEDULE].headers.map(normalizeHeader);

  if (normalizedActual.length !== expectedHeaders.length) return false;

  return expectedHeaders.every((header, index) => {
    return normalizedActual[index] === header;
  });
}

function getTypeConfig(type) {
  const config = CSV_FORMATS[type];
  if (!config) {
    throw new Error(
      `Unsupported CSV type. Choose one of: ${Object.values(CSV_TYPES).join(", ")}.`,
    );
  }
  return config;
}

function parseFullListRows(rows, warnings = []) {
  return rows
    .map((r, index) => {
      const rowNumber = index + 2;
      const rawRoomType = String(r[9] ?? "").trim();
      const roomType = normalizeRoomType(r[9]);
      const rawRoom = String(r[10] ?? "").trim();
      const room = rawRoom.toUpperCase();
      const section_id = String(r[0] ?? "").trim();
      const code = String(r[1] ?? "")
        .trim()
        .toUpperCase();
      const section = String(r[3] ?? "").trim();
      const academicYear = String(r[4] ?? "").trim();
      const rawSemester = String(r[5] ?? "").trim();
      const semester = normalizeSemester(rawSemester);
      const rawProgram = String(r[6] ?? "").trim();
      const program = normalizeProgram(rawProgram);
      const year = String(r[7] ?? "").trim();
      const hasDepartmentColumn = (r?.length ?? 0) >= 20;
      const rawDepartment = hasDepartmentColumn
        ? String(r[15] ?? "").trim()
        : "";
      const department = hasDepartmentColumn
        ? normalizeDepartment(rawDepartment)
        : null;
      const statusRaw = String(r[hasDepartmentColumn ? 16 : 15] ?? "").trim();
      const instructor = String(r[14] ?? "")
        .trim()
        .replace(/^—$/, "");

      // Parse time range if provided (e.g., "07:00 AM - 08:30 AM")
      const timeString = String(r[12] ?? "").trim();
      const parsedTime = timeString ? parseTimeRange(timeString) : null;

      const employmentStatusParsed = parseEmploymentStatusCell(
        String(r[hasDepartmentColumn ? 17 : 16] ?? ""),
        rowNumber,
        warnings,
        "Full list",
      );
      const maxUnitsParsed = parseMaxUnitsCell(
        String(r[hasDepartmentColumn ? 18 : 17] ?? ""),
        rowNumber,
        warnings,
        "Full list",
      );
      const allowNightClassParsed = parseAllowNightClassCell(
        String(r[hasDepartmentColumn ? 19 : 18] ?? ""),
        rowNumber,
        warnings,
        "Full list",
      );

      if (!semester) {
        throw new Error(
          `Full list row ${rowNumber}: invalid semester "${rawSemester}". Use 1st, 2nd, or Summer.`,
        );
      }

      if (!program) {
        throw new Error(
          `Full list row ${rowNumber}: invalid program "${rawProgram}". Use one of: ${VALID_PROGRAM_HINT}.`,
        );
      }

      if (!statusRaw) {
        addImportWarning(
          warnings,
          `Full list row ${rowNumber}: blank status; defaulted to "Pending".`,
        );
      }

      if (hasDepartmentColumn && rawDepartment && !department) {
        addImportWarning(
          warnings,
          `Full list row ${rowNumber}: invalid department "${rawDepartment}". Use one of: ${DEPARTMENT_CODES.join(", ")}.`,
        );
      }

      if (rawRoomType.toLowerCase() === "lec") {
        addImportWarning(
          warnings,
          `Full list row ${rowNumber}: normalized room type "Lec" to "Lecture".`,
        );
      }

      const isRoomTypePlaceholder = isRoomTypePlaceholderValue(room);

      if (room && !isValidRoomNumber(room) && !isRoomTypePlaceholder) {
        addImportWarning(
          warnings,
          `Full list row ${rowNumber}: room number "${room}" does not match expected format [LCR]###. Please verify.`,
        );
      }

      return {
        section_id,
        sectionId: section_id,
        code,
        title: String(r[2] ?? "").trim(),
        section,
        academicYear,
        semester,
        program,
        year,
        enrolled: toNumber(r[8], 0),
        roomType,
        room: room || null,
        pattern: String(r[11] ?? "").trim(),
        time: timeString,
        time_start: parsedTime?.timeStart || null,
        time_end: parsedTime?.timeEnd || null,
        duration: toNumber(r[13], 0),
        instructor,
        department,
        status: statusRaw,
        employment_status: employmentStatusParsed.value,
        max_units: maxUnitsParsed.value,
        allow_night_class: allowNightClassParsed.value,
        employment_status_provided: employmentStatusParsed.provided,
        max_units_provided: maxUnitsParsed.provided,
        allow_night_class_provided: allowNightClassParsed.provided,
        dedupeKey:
          section_id ||
          buildSectionIdentityKey(
            { code, program, year, section, academicYear, semester },
            { includeProgramYear: true },
          ),
        sectionIdentityKey: buildSectionIdentityKey(
          { code, program, year, section, academicYear, semester },
          { includeProgramYear: true },
        ),
      };
    })
    .filter((course) => course.code);
}

/**
 * Parse instructor/faculty CSV rows into normalized contact objects.
 * @param {Array<Array<string>>} rows - CSV data rows (excluding header)
 * @param {Array<string>} warnings - Warnings array to populate
 * @param {Object} options - { availabilityIndex, statusIndex, availabilityColumnMissing }
 * @returns {Array<Object>} Instructor objects with: name, department (or null), availability (or null), status (or null)
 */
function parseFacultyRows(rows, warnings = [], options = {}) {
  const availabilityIndex =
    Number.isInteger(options?.availabilityIndex) &&
    options.availabilityIndex >= 0
      ? options.availabilityIndex
      : -1;
  const statusIndex = Number.isInteger(options?.statusIndex)
    ? options.statusIndex
    : 3;
  const employmentStatusIndex = Number.isInteger(options?.employmentStatusIndex)
    ? options.employmentStatusIndex
    : -1;
  const maxUnitsIndex = Number.isInteger(options?.maxUnitsIndex)
    ? options.maxUnitsIndex
    : -1;
  const allowNightClassIndex = Number.isInteger(options?.allowNightClassIndex)
    ? options.allowNightClassIndex
    : -1;

  if (options?.availabilityColumnMissing) {
    addImportWarning(
      warnings,
      "Instructors CSV: availability column missing; importing availability as null.",
    );
  }

  return rows
    .map((r, index) => {
      const rowNumber = index + 2;
      const rawDepartment = String(r[1] ?? "").trim();
      const department = normalizeDepartment(rawDepartment) || null;
      const rawAvailability =
        availabilityIndex >= 0
          ? String(r[availabilityIndex] ?? "").trim()
          : null;
      const availability = rawAvailability || null;
      const rawStatus = String(r[statusIndex] ?? "").trim();
      const status = rawStatus || null;
      const employmentStatusParsed =
        employmentStatusIndex >= 0
          ? parseEmploymentStatusCell(
              String(r[employmentStatusIndex] ?? ""),
              rowNumber,
              warnings,
            )
          : { value: null, provided: false };
      const maxUnitsParsed =
        maxUnitsIndex >= 0
          ? parseMaxUnitsCell(
              String(r[maxUnitsIndex] ?? ""),
              rowNumber,
              warnings,
            )
          : { value: null, provided: false };
      const allowNightClassParsed =
        allowNightClassIndex >= 0
          ? parseAllowNightClassCell(
              String(r[allowNightClassIndex] ?? ""),
              rowNumber,
              warnings,
            )
          : { value: false, provided: false };

      if (rawDepartment && !department) {
        addImportWarning(
          warnings,
          `Instructors row ${rowNumber}: unrecognized department "${rawDepartment}"; storing null.`,
        );
      }

      if (!rawDepartment) {
        addImportWarning(
          warnings,
          `Instructors row ${rowNumber}: blank department; storing null.`,
        );
      }

      if (!rawAvailability && availabilityIndex >= 0) {
        addImportWarning(
          warnings,
          `Instructors row ${rowNumber}: blank availability; storing null.`,
        );
      }

      if (!rawStatus) {
        addImportWarning(
          warnings,
          `Instructors row ${rowNumber}: blank status; storing null.`,
        );
      }

      return {
        name: String(r[0] ?? "").trim(),
        department,
        availability,
        status,
        employment_status: employmentStatusParsed.value,
        max_units: maxUnitsParsed.value,
        allow_night_class: allowNightClassParsed.value,
        employment_status_provided: employmentStatusParsed.provided,
        max_units_provided: maxUnitsParsed.provided,
        allow_night_class_provided: allowNightClassParsed.provided,
      };
    })
    .filter((inst) => inst.name);
}

function parseRoomRows(rows, warnings = []) {
  return rows
    .map((r, index) => {
      const rowNumber = index + 2;
      const rawNumber = String(r[0] ?? "").trim();
      const number = rawNumber.toUpperCase();
      const rawType = String(r[1] ?? "").trim();
      const type = normalizeRoomType(r[1]);
      const wingData = getWingFromRoomInput(number, r[4]);
      const rawCapacity = String(r[2] ?? "").trim();
      const computedCapacity = rawCapacity
        ? sanitizeRoomCapacity(type, rawCapacity)
        : getDefaultRoomCapacity(type);

      if (!number) {
        addImportWarning(
          warnings,
          `Rooms row ${rowNumber}: blank room number; skipped.`,
        );
      }

      if (!isValidRoomNumber(number) && !isRoomTypePlaceholderValue(number)) {
        addImportWarning(
          warnings,
          `Rooms row ${rowNumber}: room number "${number}" does not match expected format [LCR]###. Please verify.`,
        );
      }

      if (!rawCapacity) {
        addImportWarning(
          warnings,
          `Rooms row ${rowNumber}: blank capacity; defaulted to ${computedCapacity}.`,
        );
      }

      if (!String(r[3] ?? "").trim()) {
        addImportWarning(
          warnings,
          `Rooms row ${rowNumber}: blank status; defaulted to "Available".`,
        );
      }

      if (rawType.toLowerCase() === "lec") {
        addImportWarning(
          warnings,
          `Rooms row ${rowNumber}: normalized room type "Lec" to "Lecture".`,
        );
      }

      return {
        number,
        type,
        capacity: computedCapacity,
        status: String(r[3] ?? "").trim() || "Available",
        wing: wingData.resolvedWing,
        dedupeKey: normalizeHeader(number),
      };
    })
    .filter((room) => room.number);
}

function parseSubjectRows(rows, warnings = []) {
  return rows
    .map((r, index) => {
      const rowNumber = index + 2;
      const rawRoomType = String(r[8] ?? "").trim();
      const roomType = normalizeRoomType(r[8]);
      const code = String(r[0] ?? "")
        .trim()
        .toUpperCase();
      const section = String(r[2] ?? "").trim();
      const academicYear = String(r[3] ?? "").trim();
      const rawSemester = String(r[4] ?? "").trim();
      const semester = normalizeSemester(rawSemester);
      const rawProgram = String(r[5] ?? "").trim();
      const program = normalizeProgram(rawProgram);
      const year = String(r[6] ?? "").trim();
      const statusRaw = String(r[11] ?? "").trim();
      const instructor = String(r[10] ?? "").trim();

      // Parse time range if provided (e.g., "07:00 AM - 08:30 AM")
      const timeString = String(r[9] ?? "").trim();
      const parsedTime = timeString ? parseTimeRange(timeString) : null;

      if (!semester) {
        throw new Error(
          `Subject sections row ${rowNumber}: invalid semester "${rawSemester}". Use 1st, 2nd, or Summer.`,
        );
      }

      if (!program) {
        throw new Error(
          `Subject sections row ${rowNumber}: invalid program "${rawProgram}". Use one of: ${VALID_PROGRAM_HINT}.`,
        );
      }

      if (!statusRaw) {
        addImportWarning(
          warnings,
          `Subject sections row ${rowNumber}: blank status; defaulted to "Not Assigned".`,
        );
      }

      if (rawRoomType.toLowerCase() === "lec") {
        addImportWarning(
          warnings,
          `Subject sections row ${rowNumber}: normalized room type "Lec" to "Lecture".`,
        );
      }

      return {
        code,
        title: String(r[1] ?? "").trim(),
        section,
        academicYear,
        semester,
        program,
        year,
        enrolled: toNumber(r[7], 0),
        roomType,
        duration: toNumber(r[9], 1.5),
        instructor,
        status: statusRaw || "Assigned",
        room: "",
        time: timeString,
        time_start: parsedTime?.timeStart || null,
        time_end: parsedTime?.timeEnd || null,
        pattern: "",
        dedupeKey: buildSectionIdentityKey(
          { code, program, year, section, academicYear, semester },
          { includeProgramYear: true },
        ),
        sectionIdentityKey: buildSectionIdentityKey(
          { code, program, year, section, academicYear, semester },
          { includeProgramYear: true },
        ),
        subjectIdentityKey: buildSubjectIdentityKey({ code, program, year }),
      };
    })
    .filter((course) => course.code);
}

/**
 * Parse schedule assignment CSV rows into normalized assignment objects.
 * @param {Array<Array<string>>} rows - CSV data rows (excluding header)
 * @param {Array<string>} warnings - Warnings array to populate
 * @returns {Array<Object>} Schedule assignment objects ready for DB insert:
 *   { code, section, academicYear, semester, room, pattern, time, instructor, status, dedupeKey }
 */
function parseScheduleRows(rows, warnings = []) {
  return rows
    .map((r, index) => {
      const rowNumber = index + 2;
      const code = String(r[0] ?? "")
        .trim()
        .toUpperCase();
      const section = String(r[1] ?? "").trim();
      const academicYear = String(r[2] ?? "").trim();
      const rawSemester = String(r[3] ?? "").trim();
      const semester = normalizeSemester(rawSemester);
      const room =
        String(r[4] ?? "")
          .trim()
          .toUpperCase() || null;
      const pattern = String(r[5] ?? "").trim();
      const time = String(r[6] ?? "").trim();
      const instructor = String(r[7] ?? "").trim();
      const statusRaw = String(r[8] ?? "").trim();

      if (!semester) {
        throw new Error(
          `Schedule row ${rowNumber}: invalid semester "${rawSemester}". Use 1st, 2nd, or Summer.`,
        );
      }

      if (!statusRaw) {
        addImportWarning(
          warnings,
          `Schedule row ${rowNumber}: blank status; defaulted to "Pending".`,
        );
      }

      if (room && !isValidRoomNumber(room)) {
        addImportWarning(
          warnings,
          `Schedule row ${rowNumber}: room number "${room}" does not match expected format [LCR]###. Please verify.`,
        );
      }

      // Parse time range into start/end times
      const parsedTime = time ? parseTimeRange(time) : null;

      return {
        code,
        section,
        academicYear,
        semester,
        room,
        pattern,
        time,
        time_start: parsedTime?.timeStart || null,
        time_end: parsedTime?.timeEnd || null,
        instructor,
        status: statusRaw,
        dedupeKey: [code, section, academicYear, semester, room]
          .map((value) => normalizeHeader(value))
          .join("|"),
      };
    })
    .filter((assignment) => assignment.code);
}

function dedupeByIdentity(records, keyFn) {
  const seen = new Set();
  const deduped = [];

  (records ?? []).forEach((record) => {
    const key = normalizeSectionIdentity(keyFn(record));
    if (!key || seen.has(key)) return;
    seen.add(key);
    deduped.push(record);
  });

  return deduped;
}

export function parseImportCsv(csvText, type) {
  const config = type ? getTypeConfig(type) : null;
  const rows = parseCsvText(csvText);
  if (rows.length < 2) {
    throw new Error("CSV must include a header row and at least one record.");
  }

  const headers = rows[0];
  const dataRows = rows.slice(1);

  const typesToCheck = config ? [type] : Object.values(CSV_TYPES);
  const selectedType = typesToCheck.find((candidate) => {
    if (candidate === CSV_TYPES.FULL_LIST) {
      return assertFullListHeaderMatch(headers);
    }
    if (candidate === CSV_TYPES.ROOMS) {
      return assertRoomHeaderMatch(headers);
    }
    if (candidate === CSV_TYPES.INSTRUCTORS) {
      return assertInstructorHeaderMatch(headers);
    }
    if (candidate === CSV_TYPES.SCHEDULE) {
      return assertScheduleHeaderMatch(headers);
    }
    return assertHeaderMatch(headers, getTypeConfig(candidate).headers);
  });

  if (!selectedType) {
    throw new Error(
      "Unsupported CSV format. Use the matching template for the selected type from public/csv.",
    );
  }

  if (config && selectedType !== type) {
    throw new Error(
      `Invalid ${config.label.toLowerCase()} CSV header. Use the matching template from public/csv.`,
    );
  }

  const warnings = [];

  if (selectedType === CSV_TYPES.FULL_LIST) {
    const rows = dedupeByIdentity(
      parseFullListRows(dataRows, warnings),
      config?.rowKey ?? getTypeConfig(selectedType).rowKey,
    );

    /**
     * FULL_LIST payload: Complete schedule assignments with embedded subject, room, and instructor data.
     * Maps to schedule_assignments table with normalized values:
     * - course_code, section: from CSV
     * - academic_year, semester, program, year: validated against constraint enums
     * - room_number, room_type: room identifier and normalized type
     * - instructor_name: instructor identifier (references instructors table by name)
     * - pattern, time_display: schedule details
     * - status: normalized via normalizeAssignmentStatus (default: "Pending")
     * Note: section_id, subject_id, room_id, instructor_id are resolved during import workflow
     */

    // Build instructorSections array for instructor_subject_sections table
    const instructorSections = rows
      .filter((row) => row.instructor && (row.time_start || row.time_end))
      .map((row) => ({
        subject_ref: {
          code: row.code,
          program: row.program,
          year: row.year,
        },
        section: row.section,
        instructor: String(row.instructor ?? "").trim(),
        time_start: row.time_start || null,
        time_end: row.time_end || null,
        academic_year: row.academicYear,
        semester: row.semester,
      }));

    return {
      type: selectedType,
      rows,
      warnings,
      dbRows: {
        scheduleAssignments: rows.map((row) => ({
          section_id:
            String(row.section_id ?? row.sectionId ?? "").trim() || null,
          subject_code: row.code,
          subject_title: row.title,
          section: row.section,
          academic_year: row.academicYear,
          semester: row.semester,
          program: row.program,
          year: row.year,
          enrolled: Number(row.enrolled ?? 0),
          room_number: row.room,
          room_type: normalizeRoomType(row.roomType),
          instructor_name: row.instructor,
          pattern: row.pattern,
          time_display: row.time,
          duration: Number(row.duration ?? 0),
          status: row.status
            ? normalizeAssignmentStatus(row.status)
            : "Assigned",
        })),
        instructorSections,
      },
      upsert: {
        table: "schedule_assignments",
        conflictTarget: ["section_id", "academic_year", "semester"],
      },
      rowCount: rows.length,
    };
  }

  if (selectedType === CSV_TYPES.ROOMS) {
    const rooms = dedupeByIdentity(
      parseRoomRows(dataRows, warnings),
      getTypeConfig(selectedType).rowKey,
    );

    /**
     * ROOMS payload: Room inventory records for rooms table.
     * dbRows: room objects with schema-compatible fields:
     * - number: unique room identifier (e.g., "L101", "C205")
     * - type: normalized room type via normalizeRoomType
     * - capacity: sanitized numeric value with type-based limits
     * - status: room status ("Available", "Occupied", "Maintenance") defaulting to "Available" if blank
     * - wing: optional wing/building identifier extracted from room context
     */
    return {
      type: selectedType,
      rooms,
      warnings,
      dbRows: rooms.map((room) => ({
        number: room.number,
        type: normalizeRoomType(room.type),
        capacity: sanitizeRoomCapacity(room.type, room.capacity),
        status: room.status || "Available",
        wing: room.wing || null,
      })),
      upsert: {
        table: "rooms",
        conflictTarget: ["number"],
      },
      rowCount: rooms.length,
    };
  }

  if (selectedType === CSV_TYPES.INSTRUCTORS) {
    const instructorHeaderConfig = resolveInstructorHeaderIndexes(headers);
    if (!instructorHeaderConfig) {
      throw new Error(
        "Invalid instructors CSV header. Use Name, Department, Availability, Status, Employment Status, Max Units, Allow Night Class (or legacy Name, Department, Availability, Status).",
      );
    }

    const instructors = dedupeByIdentity(
      parseFacultyRows(dataRows, warnings, instructorHeaderConfig),
      getTypeConfig(selectedType).rowKey,
    );

    /**
     * INSTRUCTORS payload: Schema-compatible DB write format.
     * dbRows: instructor objects with explicit NULL for blank fields (name, department, availability, status)
     * dbRowsWithDefaults: Same as dbRows BUT used ONLY on constraint error recovery (fallback retry path)
     * - availability: null (from CSV) → tries NULL first; on failure → "TBD"
     * - status: null (from CSV) → tries NULL first; on failure → "Active"
     * - department: always null if not recognized
     */
    return {
      type: selectedType,
      instructors,
      warnings,
      dbRows: instructors.map((inst) => ({
        name: inst.name,
        department: inst.department,
        availability: inst.availability,
        status: inst.status,
        employment_status: inst.employment_status ?? [],
        max_units: inst.max_units,
        allow_night_class: inst.allow_night_class ?? false,
        employment_status_provided: !!inst.employment_status_provided,
        max_units_provided: !!inst.max_units_provided,
        allow_night_class_provided: !!inst.allow_night_class_provided,
        dedupe_key: normalizeInstructorName(inst.name),
      })),
      dbRowsWithDefaults: instructors.map((inst) => ({
        name: inst.name,
        department: inst.department,
        availability: inst.availability ?? DEFAULT_INSTRUCTOR.availability,
        status: inst.status ?? DEFAULT_INSTRUCTOR.status,
        employment_status:
          inst.employment_status ?? DEFAULT_INSTRUCTOR.employment_status,
        max_units: inst.max_units ?? DEFAULT_INSTRUCTOR.max_units,
        allow_night_class:
          inst.allow_night_class ?? DEFAULT_INSTRUCTOR.allow_night_class,
        employment_status_provided: !!inst.employment_status_provided,
        max_units_provided: !!inst.max_units_provided,
        allow_night_class_provided: !!inst.allow_night_class_provided,
        dedupe_key: normalizeInstructorName(inst.name),
      })),
      upsert: {
        table: "instructors",
        conflictTarget: ["name"],
      },
      rowCount: instructors.length,
    };
  }

  if (selectedType === CSV_TYPES.SUBJECTS) {
    const subjects = dedupeByIdentity(
      parseSubjectRows(dataRows, warnings),
      getTypeConfig(selectedType).rowKey,
    );
    const dbSubjects = dedupeByIdentity(
      subjects.map((row) => ({
        code: row.code,
        title: row.title,
        program: row.program,
        year: row.year,
        room_type: normalizeRoomType(row.roomType),
        duration: Number(row.duration ?? 1.5),
        dedupe_key: buildSubjectIdentityKey(row),
      })),
      (row) => row.dedupe_key,
    );

    const dbSections = subjects.map((row) => ({
      subject_ref: {
        code: row.code,
        program: row.program,
        year: row.year,
      },
      section: row.section,
      enrolled: Number(row.enrolled ?? 0),
      status: normalizeSectionStatusForDb(row.status),
      academic_year: row.academicYear,
      semester: row.semester,
      instructor: String(row.instructor ?? "").trim(),
      dedupe_key: buildSectionIdentityKey(row, { includeProgramYear: true }),
    }));

    /**
     * SUBJECTS payload: Subject and subject_sections combined for atomic upsert.
     * dbRows.subjects: subject records for subjects table:
     *   - code, title: subject identifier and name
     *   - program, year: subject classification (validated against enums)
     *   - room_type: normalized via normalizeRoomType
     *   - duration: hours per session (default: 1.5)
     * dbRows.subject_sections: section records for subject_sections table:
     *   - subject_ref: { code, program, year } for foreign key resolution
     *   - section: section identifier
     *   - enrolled: number of students (must be > 0)
     *   - status: "Assigned" or "Not Assigned" (normalized)
     *   - academic_year, semester: enrollment period
     * dbRows.instructorSections: instructor-subject-section relationships for instructor_subject_sections table:
     *   - subject_ref: { code, program, year } for subject resolution
     *   - section: section identifier for section_id resolution
     *   - instructor: instructor name
     *   - time_start, time_end: parsed from CSV time field
     *   - academic_year, semester: enrollment period
     */
    return {
      type: selectedType,
      subjects,
      warnings,
      dbRows: {
        subjects: dbSubjects,
        subject_sections: dbSections,
        instructorSections: subjects
          .filter((row) => {
            const instructor = String(row.instructor ?? "").trim();
            const timeStart = row.time_start;
            return instructor || timeStart;
          })
          .map((row) => ({
            subject_ref: {
              code: row.code,
              program: row.program,
              year: row.year,
            },
            section: row.section,
            instructor: String(row.instructor ?? "").trim(),
            time_start: row.time_start || null,
            time_end: row.time_end || null,
            academic_year: row.academicYear,
            semester: row.semester,
          })),
      },
      upsert: {
        subjects: {
          table: "subjects",
          conflictTarget: ["code", "program"],
        },
        subject_sections: {
          table: "subject_sections",
          conflictTarget: [
            "subject_id",
            "section",
            "academic_year",
            "semester",
          ],
        },
      },
      rowCount: subjects.length,
    };
  }

  if (selectedType === CSV_TYPES.SCHEDULE) {
    const schedules = dedupeByIdentity(
      parseScheduleRows(dataRows, warnings),
      getTypeConfig(selectedType).rowKey,
    );

    /**
     * SCHEDULE payload: Schema-compatible DB write format for schedule_assignments.
     * dbRows: schedule assignment objects mapped to schedule_assignments table schema
     * - course_code: from CSV course code
     * - section: from CSV section
     * - academic_year, semester: from CSV
     * - room_number: from CSV room (or null)
     * - instructor_name: from CSV instructor
     * - pattern, time_display: from CSV
     * - status: normalized via normalizeAssignmentStatus (default: "Pending")
     * Note: section_id, subject_id, room_id, instructor_id are resolved during import workflow
     */
    return {
      type: selectedType,
      schedules,
      warnings,
      dbRows: schedules.map((row) => ({
        subject_code: row.code,
        section: row.section,
        academic_year: row.academicYear,
        semester: row.semester,
        room_number: row.room,
        instructor_name: row.instructor,
        pattern: row.pattern,
        time_display: row.time,
        status: normalizeAssignmentStatus(row.status),
        night_class: isNightClassFromTime(row.time),
      })),
      upsert: {
        table: "schedule_assignments",
        conflictTarget: ["section_id", "academic_year", "semester"],
      },
      rowCount: schedules.length,
    };
  }

  throw new Error(`Unsupported CSV type: ${selectedType}`);
}

function ensureInstructorObject(value) {
  if (typeof value === "string") {
    return {
      ...DEFAULT_INSTRUCTOR,
      name: value.trim(),
    };
  }

  return {
    ...DEFAULT_INSTRUCTOR,
    ...value,
    name: String(value?.name ?? "").trim(),
  };
}

export function mergeUniqueInstructors(
  existingInstructors,
  importedInstructors = [],
  instructorNames = [],
) {
  const merged = dedupeByIdentity(
    [
      ...(existingInstructors ?? []).map(ensureInstructorObject),
      ...(importedInstructors ?? []).map(ensureInstructorObject),
      ...(instructorNames ?? []).map((name) => ensureInstructorObject(name)),
    ],
    (value) => normalizeInstructorName(value?.name),
  );

  const existingCount = (existingInstructors ?? []).length;
  return {
    instructors: merged,
    addedCount: Math.max(0, merged.length - existingCount),
  };
}

function serializeFullListRow(row) {
  const employmentStatus = Array.isArray(row.employment_status)
    ? row.employment_status.join(",")
    : "";
  const allowNightClass = row.allow_night_class ? "true" : "false";

  return [
    row.section_id ?? row.sectionId ?? "",
    row.code ?? "",
    row.title ?? "",
    row.section ?? "",
    row.academicYear ?? "",
    row.semester ?? "",
    row.program ?? "",
    row.year ?? "",
    row.enrolled ?? "",
    row.roomType ?? "",
    row.room ?? "",
    row.pattern ?? "",
    row.time ?? "",
    row.duration ?? "",
    row.instructor ?? "",
    row.department ?? DEFAULT_INSTRUCTOR.department ?? "",
    row.status ?? "Pending",
    employmentStatus,
    row.max_units ?? "",
    allowNightClass,
  ];
}

function serializeScheduleRow(row) {
  return [
    row.code ?? row.course_code ?? "",
    row.section ?? "",
    row.academicYear ?? row.academic_year ?? "",
    row.semester ?? "",
    row.room ?? row.room_number ?? "",
    row.pattern ?? "",
    row.time ?? row.time_display ?? "",
    row.instructor ?? row.instructor_name ?? "",
    row.status ?? "Pending",
  ];
}

function serializeRoomRow(row) {
  return [
    row.number ?? "",
    row.type ?? "",
    row.capacity ?? "",
    row.status ?? "Available",
  ];
}

function serializeInstructorRow(row) {
  const employmentStatus = Array.isArray(row.employment_status)
    ? row.employment_status.join(",")
    : "";
  const allowNightClass = row.allow_night_class ? "true" : "false";

  return [
    row.name ?? "",
    row.department ?? DEFAULT_INSTRUCTOR.department,
    row.availability ?? DEFAULT_INSTRUCTOR.availability,
    row.status ?? DEFAULT_INSTRUCTOR.status,
    employmentStatus,
    row.max_units ?? "",
    allowNightClass,
  ];
}

function serializeSubjectRow(row) {
  return [
    row.code ?? "",
    row.title ?? "",
    row.section ?? "",
    row.academicYear ?? "",
    row.semester ?? "",
    row.program ?? "",
    row.year ?? "",
    row.enrolled ?? "",
    row.roomType ?? "",
    row.duration ?? "",
    row.instructor ?? "",
    row.status ?? "Pending",
  ];
}

function serializeRecords(type, data) {
  if (type === CSV_TYPES.FULL_LIST)
    return (data ?? []).map(serializeFullListRow);
  if (type === CSV_TYPES.ROOMS) return (data ?? []).map(serializeRoomRow);
  if (type === CSV_TYPES.INSTRUCTORS)
    return (data ?? []).map(serializeInstructorRow);
  if (type === CSV_TYPES.SUBJECTS) return (data ?? []).map(serializeSubjectRow);
  if (type === CSV_TYPES.SCHEDULE)
    return (data ?? []).map(serializeScheduleRow);
  throw new Error(`Unsupported CSV type: ${type}`);
}

export function exportCsv(type, data = []) {
  const config = getTypeConfig(type);
  if (!Array.isArray(data) || data.length === 0) {
    return false;
  }

  const rows = serializeRecords(type, data);
  const csvContent = [config.headers, ...rows]
    .map((row) => row.map(toCsvCell).join(","))
    .join("\n");

  const blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = config.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return true;
}

export function downloadCsvTemplate(type) {
  const config = getTypeConfig(type);
  const a = document.createElement("a");
  a.href = config.templatePath;
  a.download = config.templatePath.split("/").pop() || config.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  return true;
}

export function summarizeImportedRows(payload) {
  if (!payload) return "No file selected";
  return `${payload.rowCount ?? 0} ${getTypeConfig(payload.type).label.toLowerCase()} row(s)`;
}

export function dedupeImportedRecords(type, records = []) {
  const config = getTypeConfig(type);
  return dedupeByIdentity(records, config.rowKey);
}

export function getCsvTypeConfig(type) {
  return getTypeConfig(type);
}

export function getCsvTypeOptions() {
  return CSV_TYPE_OPTIONS;
}

export function exportToExcel(scheduleAssignments) {
  return exportCsv(CSV_TYPES.FULL_LIST, scheduleAssignments);
}
