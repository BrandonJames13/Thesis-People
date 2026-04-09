import { coursesOverlap, formatTime } from "./timeUtils";

const DEFAULT_SECTION = "A";

function normalizeIdentityPart(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export function getAssignmentSubjectCode(row) {
  return String(row?.code ?? row?.subjectCode ?? row?.subject_code ?? "")
    .trim()
    .toUpperCase();
}

export function getAssignmentSection(row) {
  const section = String(row?.section ?? "").trim();
  return section || DEFAULT_SECTION;
}

export function getAssignmentSectionId(row) {
  const explicit = String(row?.sectionId ?? row?.section_id ?? "").trim();
  if (explicit) return explicit;

  const code = getAssignmentSubjectCode(row);
  const section = getAssignmentSection(row);
  if (!code) return "";
  return `${code}::${section}`;
}

export function getAssignmentIdentityKey(row) {
  const assignmentId = String(
    row?.assignmentId ?? row?.assignment_id ?? "",
  ).trim();
  if (assignmentId) return `ASSIGNMENT:${normalizeIdentityPart(assignmentId)}`;

  const sectionId = getAssignmentSectionId(row);
  if (sectionId) return `SECTION:${normalizeIdentityPart(sectionId)}`;

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
  const code = getAssignmentSubjectCode(row) || "UNKNOWN";
  const section = getAssignmentSection(row);
  return `${code}-${section}`;
}

// Load saved soft constraint weights from localStorage
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

// Score a candidate assignment using soft constraint weights
function scoreSoftConstraints(
  course,
  room,
  slotTime,
  existingAssignments,
  weights,
) {
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
  sectionRows,
  rooms,
  instructors,
  duration,
  startTime,
  endTime,
  pattern,
  activeDays,
}) {
  if (duration <= 0) return { error: "Please enter a valid duration." };
  if (activeDays.length === 0)
    return { error: "Please select at least one active day." };

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
    return {
      error: "No valid time slots in that range for the selected duration.",
    };
  }

  const newRooms = rooms.map((r) => ({ ...r }));
  const baseSections = sectionRows.map((row) => ({ ...row }));
  const newAssignments = [];

  // Work from clean assignment rows instead of mutating source course rows in-place.
  const pending = baseSections.map((c) => ({
    ...c,
    status: "Pending",
    room: "",
    time: "",
    pattern: "",
    instructor: c.instructor || "",
  }));

  // Reset room statuses
  newRooms.forEach((r) => {
    if (r.status !== "Maintenance") r.status = "Available";
  });

  if (pending.length === 0) {
    return {
      rooms: newRooms,
      scheduleAssignments: [],
      assigned: 0,
      message: "No subject sections to schedule. Please add sections first.",
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
        const hasRoomConflict = newAssignments.some(
          (a) => a.room === room.number && coursesOverlap(a, testCourse),
        );
        if (hasRoomConflict) continue;

        // Hard constraint: instructor cannot teach two courses at the same time
        const instructorName = course.instructor;
        if (instructorName) {
          const hasInstructorConflict = newAssignments.some(
            (a) =>
              a.instructor &&
              a.instructor.trim().toLowerCase() ===
                instructorName.trim().toLowerCase() &&
              coursesOverlap(a, testCourse),
          );
          if (hasInstructorConflict) continue;
        }

        // Score using soft constraints
        const score = scoreSoftConstraints(
          course,
          room,
          slot,
          newAssignments,
          weights,
        );
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
        const testCourse = {
          ...course,
          time: candidateTime,
          duration,
          pattern,
        };
        const freeInstructor = instructors.find((inst) => {
          // Check instructor not already scheduled at this time
          return !newAssignments.some(
            (a) =>
              a.instructor &&
              a.instructor.trim().toLowerCase() ===
                inst.name.trim().toLowerCase() &&
              coursesOverlap(a, testCourse),
          );
        });
        if (freeInstructor) assignedInstructor = freeInstructor.name;
      }

      const assignment = {
        ...course,
        room: bestRoom.number,
        time: `${pattern} ${formatTime(bestSlot)}`,
        duration,
        pattern,
        instructor: assignedInstructor,
        status: "Assigned",
      };

      // Mark room as Occupied
      bestRoom.status = "Occupied";

      newAssignments.push(assignment);
      assigned++;
    }
  });

  const finalAssignments = newAssignments.map((a) => ({ ...a }));

  return {
    rooms: newRooms,
    scheduleAssignments: finalAssignments,
    assigned,
    message: `Auto-generated ${assigned} assignment${assigned !== 1 ? "s" : ""}!`,
  };
}

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
  const testCourse = {
    ...assignmentTarget,
    time: `${pattern} ${formatTime(startTime)}`,
    duration,
    pattern,
    room: roomName,
  };
  const conflicting = scheduleAssignments.filter(
    (a) =>
      a.room === roomName &&
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
