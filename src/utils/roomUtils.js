import {
  isValidRoomNumber,
  ROOM_TYPE_LABELS,
  ROOM_STATUSES,
  getRoomCapacityLimit,
  detectSpecialRoomType,
  normalizeRoomType,
} from "../data/constants";

const WING_CODES = {
  L: "L",
  C: "C",
  R: "R",
};

const WING_WORD_ALIASES = {
  LEFT: "L",
  CENTER: "C",
  CENTRE: "C",
  RIGHT: "R",
};

const ZONE_DIGIT_TO_WING = {
  0: "L",
  1: "C",
  2: "R",
};

export function normalizeWingCode(value) {
  const raw = String(value ?? "")
    .trim()
    .toUpperCase();
  if (!raw) return "";
  if (WING_CODES[raw]) return WING_CODES[raw];
  if (WING_WORD_ALIASES[raw]) return WING_WORD_ALIASES[raw];
  return "";
}

function extractWingFromRoomPrefix(roomNumber) {
  const compact = String(roomNumber ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");

  const prefixedMatch = compact.match(/([LCR])\d{3}$/);
  if (prefixedMatch) {
    return prefixedMatch[1];
  }

  return "";
}

function extractWingFromZoneDigit(roomNumber) {
  const compact = String(roomNumber ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  const digitsMatch = compact.match(/(\d{3})$/);

  if (!digitsMatch) return "";

  const digits = digitsMatch[1];
  return ZONE_DIGIT_TO_WING[digits[1]] ?? "";
}

export function inferWingFromRoomNumber(roomNumber) {
  const fromPrefix = extractWingFromRoomPrefix(roomNumber);
  if (fromPrefix) return fromPrefix;

  const fromZoneDigit = extractWingFromZoneDigit(roomNumber);
  if (fromZoneDigit) return fromZoneDigit;

  return "";
}

export function getWingFromRoomInput(roomNumber, providedWing) {
  const normalizedProvided = normalizeWingCode(providedWing);
  const inferred = inferWingFromRoomNumber(roomNumber);

  return {
    providedWing: normalizedProvided,
    inferredWing: inferred,
    resolvedWing: normalizedProvided || inferred || null,
  };
}

/**
 * Validates a room payload against all schema constraints.
 * Returns an error message string if validation fails, null if valid.
 *
 * @param {Object} payload - The room data object
 * @param {string} payload.number - Room number (e.g., "L101")
 * @param {string} payload.type - Room type (must be in ROOM_TYPE_LABELS)
 * @param {number} payload.capacity - Room capacity
 * @param {string} payload.status - Room status
 * @param {string|null} payload.wing - Wing code (nullable)
 * @returns {string|null} Error message if invalid, null if valid
 */
export function validateRoomPayload(payload) {
  if (!payload) return "Invalid payload: payload is required.";

  const { number, type, capacity, status, wing } = payload;

  // Validate number
  if (!number || typeof number !== "string") {
    return "Room number is required.";
  }
  if (!isValidRoomNumber(number)) {
    return `Room number must match pattern [LCR]### (e.g., L101, C202) or be a descriptive name (e.g., Accreditation, AVR, CISCO).`;
  }

  // Validate type
  if (!type || typeof type !== "string") {
    return "Room type is required.";
  }
  if (!ROOM_TYPE_LABELS.includes(type)) {
    return `Room type must be one of: ${ROOM_TYPE_LABELS.join(", ")}. Got: "${type}"`;
  }

  // Validate capacity
  if (capacity === undefined || capacity === null) {
    return "Capacity is required.";
  }
  const parsedCapacity = Number(capacity);
  if (!Number.isFinite(parsedCapacity)) {
    return "Capacity must be a valid number.";
  }
  if (parsedCapacity <= 0) {
    return "Capacity must be greater than 0.";
  }
  const { max } = getRoomCapacityLimit(type);
  if (parsedCapacity > max) {
    return `${type} capacity cannot exceed ${max}. Got: ${parsedCapacity}`;
  }

  // Validate status
  if (!status || typeof status !== "string") {
    return "Status is required.";
  }
  if (!ROOM_STATUSES.includes(status)) {
    return `Status must be one of: ${ROOM_STATUSES.join(", ")}. Got: "${status}"`;
  }

  // Validate wing (nullable, but if provided must be valid)
  if (wing !== null && wing !== undefined && wing !== "") {
    const wingStr = String(wing);
    if (!["L", "C", "R"].includes(wingStr)) {
      return `Wing must be one of: L, C, R (or null). Got: "${wingStr}"`;
    }
  }

  return null; // Valid
}

/**
 * Extracts and returns the room type detected from a room name.
 * Uses keyword matching to identify special room types (AVR, Accreditation Room, CISCO).
 * Returns the canonical room type or null if no special type detected.
 *
 * @param {string} roomName - The room name to analyze (e.g., "AVR-Lab", "Accreditation Room", "CISCO-001")
 * @returns {string|null} The detected room type ("AVR", "Accreditation Room", "CISCO") or null if not detected
 * @example
 * extractRoomTypeFromName("AVR-Lab") // → "AVR"
 * extractRoomTypeFromName("Accreditation") // → "Accreditation Room"
 * extractRoomTypeFromName("CISCO-001") // → "CISCO"
 * extractRoomTypeFromName("L101") // → null
 */
export function extractRoomTypeFromName(roomName) {
  return detectSpecialRoomType(roomName);
}

/**
 * Detects if there's a conflict between user's selected type and the type auto-detected from room name.
 * Returns detailed conflict information.
 *
 * @param {string} roomName - The room name to check
 * @param {string} selectedType - The type the user selected
 * @returns {Object} Object with properties:
 *   - conflictFound {boolean} - Whether a conflict exists
 *   - detectedType {string|null} - The type detected from room name (or null if none)
 * @example
 * shouldWarnRoomTypeConflict("AVR-Lab", "Lecture")
 * // → { conflictFound: true, detectedType: "AVR" }
 *
 * shouldWarnRoomTypeConflict("AVR-Lab", "AVR")
 * // → { conflictFound: false, detectedType: "AVR" }
 *
 * shouldWarnRoomTypeConflict("L101", "Lecture")
 * // → { conflictFound: false, detectedType: null }
 */
export function shouldWarnRoomTypeConflict(roomName, selectedType) {
  const detectedType = extractRoomTypeFromName(roomName);
  const normalizedSelected = normalizeRoomType(selectedType, "");

  // No conflict if no special type detected
  if (!detectedType) {
    return { conflictFound: false, detectedType: null };
  }

  // No conflict if user selected matches detected type
  if (detectedType === normalizedSelected) {
    return { conflictFound: false, detectedType };
  }

  // Conflict found: detected type doesn't match user's selection
  return { conflictFound: true, detectedType };
}
