export const patternDaysMap = {
  MWF: ["MON", "WED", "FRI"],
  TTH: ["TUE", "THU"],
  MW: ["MON", "WED"],
  TF: ["TUE", "FRI"],
  SAT: ["SAT"],
  DAILY: ["MON", "TUE", "WED", "THU", "FRI", "SAT"],
  MON: ["MON"],
  TUE: ["TUE"],
  WED: ["WED"],
  THU: ["THU"],
  FRI: ["FRI"],
};

export const TIME_SLOTS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

export const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT"];

export const COLOR_MAP = {
  MWF: "blue",
  TTH: "green",
  MW: "purple",
  TF: "purple",
  SAT: "orange",
  DAILY: "blue",
  MON: "blue",
  TUE: "green",
  WED: "blue",
  THU: "green",
  FRI: "blue",
};

export const DEFAULT_ROOM_TYPE = "Lecture";

export const PROGRAM_CODES = [
  "CS",
  "IT",
  "IS",
  "FREE",
  "BSCS",
  "BSIS",
  "FREE1",
  "FREE2",
  "FREE3",
  "FREE4",
  "FREE5",
  "FREE6",
  "FREE7",
  "FREE8",
  "NA",
  "TSM",
  "WMA",
];

export const SEMESTER_CODES = ["1st", "2nd", "Summer"];

export const SEMESTER_ALIASES = {
  "1st": "1st",
  "1st semester": "1st",
  first: "1st",
  "first semester": "1st",
  "2nd": "2nd",
  "2nd semester": "2nd",
  second: "2nd",
  "second semester": "2nd",
  summer: "Summer",
  "summer semester": "Summer",
};

export const PROGRAM_ALIASES = {
  cs: "CS",
  bscs: "BSCS",
  "computer science": "CS",
  it: "IT",
  bsit: "IT",
  "information technology": "IT",
  is: "IS",
  bsis: "BSIS",
  "information systems": "IS",
  free: "FREE",
  free1: "FREE1",
  "free 1": "FREE1",
  free2: "FREE2",
  "free 2": "FREE2",
  free3: "FREE3",
  "free 3": "FREE3",
  free4: "FREE4",
  "free 4": "FREE4",
  free5: "FREE5",
  "free 5": "FREE5",
  free6: "FREE6",
  "free 6": "FREE6",
  free7: "FREE7",
  "free 7": "FREE7",
  free8: "FREE8",
  "free 8": "FREE8",
  na: "NA",
  "n/a": "NA",
  tsm: "TSM",
  wma: "WMA",
  "bscs program": "BSCS",
  "bsis program": "BSIS",
};

export const DEPARTMENT_CODES = ["CS", "IT", "IS"];

export const DEPARTMENT_ALIASES = {
  cs: "CS",
  "computer science": "CS",
  "computer studies": "CS",
  "comp sci": "CS",
  it: "IT",
  "information technology": "IT",
  is: "IS",
  "information systems": "IS",
};

export const ROOM_TYPE_LABELS = [
  "Lecture",
  "Computer Lab",
  "Accreditation Room",
  "AVR",
  "CISCO",
];

export const ROOM_TYPE_ALIASES = {
  lecture: "Lecture",
  lec: "Lecture",
  "computer lab": "Computer Lab",
  "computer laboratory": "Computer Lab",
  lab: "Computer Lab",
  "accreditation room": "Accreditation Room",
  accreditation: "Accreditation Room",
  "accred room": "Accreditation Room",
  avr: "AVR",
  "audio visual room": "AVR",
  "audio-visual room": "AVR",
  cisco: "CISCO",
};

export const ROOM_CAPACITY_LIMITS = {
  Lecture: {
    max: 55,
  },
  "Computer Lab": {
    max: 45,
  },
  "Accreditation Room": {
    max: 55,
  },
  AVR: {
    max: 45,
  },
  CISCO: {
    max: 45,
  },
};

// Allows standard format [LCR]### OR alphanumeric names (letters, numbers, spaces, hyphens) up to 50 chars
// Uses negative lookahead to prevent malformed attempts like L1, L10, C20, or R1
// (must be exactly [LCR]### or an unrelated name)
export const ROOM_NUMBER_PATTERN =
  /^([LCR]\d{3}|(?![LCR]\d{1,2}(?!\d))[A-Za-z0-9\s-]{1,50})$/;

export const ROOM_STATUSES = ["Available", "Occupied", "Maintenance"];

export function normalizeRoomType(value, fallback = DEFAULT_ROOM_TYPE) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  if (!normalized) return fallback;
  return ROOM_TYPE_ALIASES[normalized] ?? fallback;
}

export function normalizeDepartment(value, fallback = null) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return fallback;

  const normalizedLower = normalized.toLowerCase();
  if (DEPARTMENT_ALIASES[normalizedLower]) {
    return DEPARTMENT_ALIASES[normalizedLower];
  }

  const normalizedUpper = normalized.toUpperCase();
  if (DEPARTMENT_CODES.includes(normalizedUpper)) {
    return normalizedUpper;
  }

  return fallback;
}

export function normalizeProgram(value, fallback = null) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return fallback;

  const normalizedLower = normalized.toLowerCase();
  if (PROGRAM_ALIASES[normalizedLower]) {
    return PROGRAM_ALIASES[normalizedLower];
  }

  const normalizedUpper = normalized.toUpperCase();
  if (PROGRAM_CODES.includes(normalizedUpper)) {
    return normalizedUpper;
  }

  return fallback;
}

export function normalizeSemester(value, fallback = null) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return fallback;

  const normalizedLower = normalized.toLowerCase();
  if (SEMESTER_ALIASES[normalizedLower]) {
    return SEMESTER_ALIASES[normalizedLower];
  }

  if (SEMESTER_CODES.includes(normalized)) {
    return normalized;
  }

  return fallback;
}

export function getRoomCapacityLimit(roomType) {
  const normalizedType = normalizeRoomType(roomType);
  return (
    ROOM_CAPACITY_LIMITS[normalizedType] ??
    ROOM_CAPACITY_LIMITS[DEFAULT_ROOM_TYPE]
  );
}

export function getDefaultRoomCapacity(roomType) {
  return getRoomCapacityLimit(roomType).max;
}

export function isRoomCapacityValid(roomType, capacity) {
  const parsed = Number(capacity);
  const { max } = getRoomCapacityLimit(roomType);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= max;
}

export function sanitizeRoomCapacity(roomType, capacity) {
  const parsed = Number(capacity);
  const { max } = getRoomCapacityLimit(roomType);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return getDefaultRoomCapacity(roomType);
  }

  return Math.min(Math.floor(parsed), max);
}

export function isValidRoomNumber(number) {
  const trimmed = String(number ?? "")
    .trim()
    .toUpperCase();
  return ROOM_NUMBER_PATTERN.test(trimmed);
}
