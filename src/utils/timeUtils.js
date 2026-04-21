import { patternDaysMap } from "../data/constants";

/**
 * Normalize a pattern string for patternDaysMap lookup.
 * Handles raw CSV values like "TTh" → "TTH", "Fri" → "FRI", "Mon,Sat" → "MON,SAT".
 * Returns the normalized key if found in patternDaysMap, otherwise returns the
 * original value (so callers still get an empty array via the `|| []` fallback).
 */
function normalizePattern(pattern) {
  const raw = String(pattern ?? "").trim();
  if (!raw) return raw;
  const upper = raw.toUpperCase();
  if (patternDaysMap[upper]) return upper;
  return raw;
}

export function parseTimeTextToMinutes(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;

  const match = text.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const ampm = String(match[3] ?? "").toUpperCase();

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (minute < 0 || minute > 59) return null;

  if (ampm) {
    if (hour < 1 || hour > 12) return null;
    if (ampm === "PM" && hour !== 12) hour += 12;
    if (ampm === "AM" && hour === 12) hour = 0;
  } else if (hour < 0 || hour > 23) {
    return null;
  }

  return hour * 60 + minute;
}

export function getStartTimeText(timeValue) {
  const text = String(timeValue ?? "").trim();
  if (!text) return "";
  return text.split(/\s*[-–]\s*/)[0]?.trim() ?? "";
}

export function parseCourseTime(course) {
  if (!course.time) return null;
  const startMin = parseTimeTextToMinutes(getStartTimeText(course.time));
  if (startMin == null) return null;
  return {
    startMin,
    endMin: startMin + Math.round((course.duration || 1.5) * 60),
  };
}

export function coursesOverlap(a, b) {
  const ta = parseCourseTime(a);
  const tb = parseCourseTime(b);
  if (!ta || !tb) return false;
  if (ta.endMin <= tb.startMin || tb.endMin <= ta.startMin) return false;
  // FIX: normalize pattern before lookup so raw CSV values like "TTh" / "Fri"
  // resolve correctly instead of returning an empty array and silently skipping
  // the day-overlap check (which caused the scheduler to double-book).
  const daysA = patternDaysMap[normalizePattern(a.pattern)] || [];
  const daysB = patternDaysMap[normalizePattern(b.pattern)] || [];
  return daysA.some((d) => daysB.includes(d));
}

export function sharedDays(a, b) {
  // FIX: same normalization applied for consistency.
  const daysA = patternDaysMap[normalizePattern(a.pattern)] || [];
  const daysB = patternDaysMap[normalizePattern(b.pattern)] || [];
  return daysA.filter((d) => daysB.includes(d));
}

export function formatTimeFromMin(totalMin) {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function formatTime(t24) {
  const [h, m] = t24.split(":").map(Number);
  return `${h > 12 ? h - 12 : h === 0 ? 12 : h}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

export function getEndTime(start24, durationHours) {
  const [h, m] = start24.split(":").map(Number);
  const total = h * 60 + m + Math.round(durationHours * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}