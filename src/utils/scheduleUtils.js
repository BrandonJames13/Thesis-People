import { coursesOverlap, formatTime } from "./timeUtils";

export function runAutoSchedule({
  courses,
  rooms,
  duration,
  startTime,
  endTime,
  pattern,
  activeDays,
}) {
  if (duration <= 0) {
    return { error: "Please enter a valid duration." };
  }
  if (activeDays.length === 0) {
    return { error: "Please select at least one active day." };
  }

  const stepMins = Math.round(duration * 60);
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
    return {
      error: "No valid time slots in that range for the selected duration.",
    };
  }

  const newRooms = rooms.map((r) => ({ ...r }));
  const newCourses = courses.map((c) => ({ ...c }));

  // Reset room statuses
  newRooms.forEach((r) => {
    const isUsed = newCourses.some(
      (s) =>
        (s.status === "Assigned" || s.status === "Conflict") &&
        s.room === r.number,
    );
    if (!isUsed && r.status === "Occupied") r.status = "Available";
  });

  const pending = newCourses.filter((c) => c.status === "Pending");
  if (pending.length === 0) {
    const scheduleAssignments = newCourses
      .filter((c) => c.status === "Assigned" || c.status === "Conflict")
      .map((c) => ({ ...c }));
    return {
      courses: newCourses,
      rooms: newRooms,
      scheduleAssignments,
      assigned: 0,
      message: "Schedule generated — all assigned courses loaded!",
    };
  }

  let slotIdx = 0;
  let assigned = 0;
  pending.forEach((course) => {
    const avail = newRooms.find(
      (r) =>
        r.status === "Available" &&
        (course.roomType === "Lab"
          ? r.type === "Computer Lab"
          : r.type === "Lecture"),
    );
    if (avail && slotIdx < slots.length) {
      Object.assign(course, {
        room: avail.number,
        time: `${pattern} ${formatTime(slots[slotIdx % slots.length])}`,
        duration,
        pattern,
        status: "Assigned",
      });
      avail.status = "Occupied";
      slotIdx++;
      assigned++;
    }
  });

  const scheduleAssignments = newCourses
    .filter((c) => c.status === "Assigned" || c.status === "Conflict")
    .map((c) => ({ ...c }));

  return {
    courses: newCourses,
    rooms: newRooms,
    scheduleAssignments,
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
    return {
      ok: false,
      message: "⚠ Please fill in Course, Room, and Start Time first.",
    };
  }
  const testCourse = {
    time: `${pattern} ${formatTime(startTime)}`,
    duration,
    pattern,
    room: roomName,
  };
  const conflicting = scheduleAssignments.filter(
    (a) => a.room === roomName && coursesOverlap(a, testCourse),
  );
  if (conflicting.length > 0) {
    return {
      ok: false,
      message:
        "⚠ Room conflict with: " + conflicting.map((a) => a.code).join(", "),
    };
  }
  const endTime = (() => {
    const [h, m] = startTime.split(":").map(Number);
    const total = h * 60 + m + Math.round(duration * 60);
    const eh = Math.floor(total / 60);
    const em = total % 60;
    return `${eh > 12 ? eh - 12 : eh === 0 ? 12 : eh}:${String(em).padStart(2, "0")} ${eh >= 12 ? "PM" : "AM"}`;
  })();
  return {
    ok: true,
    message: `✓ No conflicts · ${pattern} ${formatTime(startTime)}–${endTime} in ${roomName}`,
  };
}
