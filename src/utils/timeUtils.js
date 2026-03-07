import { patternDaysMap } from "../data/constants";

export function parseCourseTime(course) {
  if (!course.time) return null;
  const match = course.time.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return null;
  let h = parseInt(match[1]);
  const ampm = match[3].toUpperCase();
  if (ampm === "PM" && h !== 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  const startMin = h * 60 + parseInt(match[2]);
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
  const daysA = patternDaysMap[a.pattern] || [];
  const daysB = patternDaysMap[b.pattern] || [];
  return daysA.some((d) => daysB.includes(d));
}

export function sharedDays(a, b) {
  const daysA = patternDaysMap[a.pattern] || [];
  const daysB = patternDaysMap[b.pattern] || [];
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
