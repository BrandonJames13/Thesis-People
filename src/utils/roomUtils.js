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
