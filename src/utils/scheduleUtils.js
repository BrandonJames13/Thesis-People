import { coursesOverlap, formatTime, parseCourseTime } from "./timeUtils";
import { patternDaysMap } from "../data/constants";

// Load saved soft constraint weights from localStorage
function getSoftWeights() {
  try {
    const raw = localStorage.getItem("rss_soft_weights");
    if (raw) return JSON.parse(raw);
  } catch { }
  return { timePreference: 30, roomType: 25, compactness: 25, balance: 20 };
}

// Score a candidate assignment using soft constraint weights
function scoreSoftConstraints(course, room, slotTime, existingAssignments, weights) {
  let score = 0;

  // Room type matching (weight: roomType)
  const wantLab = course.roomType === "Lab";
  const isLab = room.type === "Computer Lab";
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
  courses,
  rooms,
  instructors,
  scheduleAssignments,
  duration,
  startTime,
  endTime,
  pattern,
  activeDays,
}) {
  if (duration <= 0) return { error: "Please enter a valid duration." };
  if (activeDays.length === 0) return { error: "Please select at least one active day." };

  const weights = getSoftWeights();
  const stepMins = Math.round(duration * 60);

  // Build all time slots
  const slots = [];
  let [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const endMins = eh * 60 + em;
  while (sh * 60 + sm + stepMins <= endMins) {
    slots.push(`${String(sh).padStart(2, "0")}:${String(sm).padStart(2, "0")}`);
    const next = sh * 60 + sm + stepMins;
    sh = Math.floor(next / 60);
    sm = next % 60;
  }
  if (slots.length === 0) {
    return { error: "No valid time slots in that range for the selected duration." };
  }

  const newRooms = rooms.map((r) => ({ ...r }));
  const newCourses = courses.map((c) => ({ ...c }));
  const newAssignments = [...scheduleAssignments.map((a) => ({ ...a }))];

  // Build a map of which instructor teaches which courses already
  const instructorLoad = {};
  instructors.forEach((inst) => {
    instructorLoad[inst.name.trim().toLowerCase()] = inst;
  });

  const pending = newCourses.filter((c) => c.status === "Pending");
  if (pending.length === 0) {
    return {
      courses: newCourses,
      rooms: newRooms,
      scheduleAssignments: newCourses
        .filter((c) => c.status === "Assigned" || c.status === "Conflict")
        .map((c) => ({ ...c })),
      assigned: 0,
      message: "Schedule generated — all assigned courses loaded!",
    };
  }

  let assigned = 0;

  pending.forEach((course) => {
    // Find the best room + slot combination using soft constraint scoring
    let bestRoom = null;
    let bestSlot = null;
    let bestScore = -1;

    for (const slot of slots) {
      const candidateTime = `${pattern} ${formatTime(slot)}`;
      const testCourse = { ...course, time: candidateTime, duration, pattern };

      for (const room of newRooms) {
        if (room.status === "Maintenance") continue;
        if (room.capacity < (course.enrolled || 0)) continue;

        // Hard constraint: no double booking in this room at this slot
        const hasConflict = newAssignments.some(
          (a) => a.room === room.number && coursesOverlap(a, testCourse)
        );
        if (hasConflict) continue;

        // Score using soft constraints
        const score = scoreSoftConstraints(course, room, slot, newAssignments, weights);
        if (score > bestScore) {
          bestScore = score;
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
        const candidateTime = `${pattern} ${formatTime(bestSlot)}`;
        const testCourse = { ...course, time: candidateTime, duration, pattern };
        const freeInstructor = instructors.find((inst) => {
          // Check instructor not already scheduled at this time
          return !newAssignments.some(
            (a) =>
              a.instructor &&
              a.instructor.trim().toLowerCase() === inst.name.trim().toLowerCase() &&
              coursesOverlap(a, testCourse)
          );
        });
        if (freeInstructor) assignedInstructor = freeInstructor.name;
      }

      Object.assign(course, {
        room: bestRoom.number,
        time: `${pattern} ${formatTime(bestSlot)}`,
        duration,
        pattern,
        instructor: assignedInstructor,
        status: "Assigned",
      });

      newAssignments.push({ ...course });
      assigned++;
    }
  });

  const finalAssignments = newCourses
    .filter((c) => c.status === "Assigned" || c.status === "Conflict")
    .map((c) => ({ ...c }));

  return {
    courses: newCourses,
    rooms: newRooms,
    scheduleAssignments: finalAssignments,
    assigned,
    message: `Auto-generated ${assigned} assignment${assigned !== 1 ? "s" : ""}!`,
  };
}

export function checkManualConflict({
  courseCode,
  roomName,
  startTime,
  duration,
  pattern,
  scheduleAssignments,
}) {
  if (!courseCode || !roomName || !startTime) {
    return { ok: false, type: "error", text: "⚠ Please fill in Course, Room, and Start Time first." };
  }
  const testCourse = {
    time: `${pattern} ${formatTime(startTime)}`,
    duration,
    pattern,
    room: roomName,
  };
  const conflicting = scheduleAssignments.filter(
    (a) => a.room === roomName && coursesOverlap(a, testCourse)
  );
  if (conflicting.length > 0) {
    return {
      ok: false,
      type: "error",
      text: "⚠ Room conflict with: " + conflicting.map((a) => a.code).join(", "),
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
    text: `✓ No conflicts · ${pattern} ${formatTime(startTime)}–${endLabel} in ${roomName}`,
  };
}