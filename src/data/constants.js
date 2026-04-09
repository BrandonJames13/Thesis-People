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

export const ROOM_TYPE_LABELS = ["Lecture", "Computer Lab"];

export const ROOM_TYPE_ALIASES = {
  lecture: "Lecture",
  lec: "Lecture",
  "computer lab": "Computer Lab",
  "computer laboratory": "Computer Lab",
  lab: "Computer Lab",
};

export const ROOM_CAPACITY_LIMITS = {
  Lecture: {
    max: 55,
  },
  "Computer Lab": {
    max: 45,
  },
};

export function normalizeRoomType(value, fallback = DEFAULT_ROOM_TYPE) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  if (!normalized) return fallback;
  return ROOM_TYPE_ALIASES[normalized] ?? fallback;
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
