export const SCHEDULE_HEADERS = [
  "Course Code",
  "Course Title",
  "Program",
  "Year",
  "Enrolled",
  "Room",
  "Type Required",
  "Pattern",
  "Time",
  "Duration (hrs)",
  "Instructor",
  "Status",
];

const FACULTY_HEADERS = ["Name", "Department", "Availability", "Status"];
const ROOM_HEADERS = ["Number", "Type", "Capacity", "Status"];
const SUBJECT_HEADERS = [
  "Course Code",
  "Course Title",
  "Program",
  "Year",
  "Enrolled",
  "Type Required",
  "Duration (hrs)",
  "Instructor",
];

const DEFAULT_INSTRUCTOR = {
  department: "TBD",
  availability: "TBD",
  courses: [],
  status: "Active",
};

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

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

function parseScheduleRows(rows) {
  return rows.map((r) => {
    return {
      code: String(r[0] ?? "")
        .trim()
        .toUpperCase(),
      title: String(r[1] ?? "").trim(),
      program: String(r[2] ?? "")
        .trim()
        .toUpperCase(),
      year: String(r[3] ?? "").trim(),
      enrolled: toNumber(r[4], 0),
      room: String(r[5] ?? "").trim(),
      roomType: String(r[6] ?? "").trim(),
      pattern: String(r[7] ?? "").trim(),
      time: String(r[8] ?? "").trim(),
      duration: toNumber(r[9], 0),
      instructor: String(r[10] ?? "")
        .trim()
        .replace(/^—$/, ""),
      status: String(r[11] ?? "").trim() || "Pending",
    };
  });
}

function parseFacultyRows(rows) {
  return rows
    .map((r) => ({
      name: String(r[0] ?? "").trim(),
      department: String(r[1] ?? "").trim() || DEFAULT_INSTRUCTOR.department,
      availability:
        String(r[2] ?? "").trim() || DEFAULT_INSTRUCTOR.availability,
      status: String(r[3] ?? "").trim() || DEFAULT_INSTRUCTOR.status,
      courses: [],
    }))
    .filter((inst) => inst.name);
}

function parseRoomRows(rows) {
  return rows
    .map((r) => ({
      number: String(r[0] ?? "").trim(),
      type: String(r[1] ?? "").trim(),
      capacity: toNumber(r[2], 0),
      status: String(r[3] ?? "").trim() || "Available",
    }))
    .filter((room) => room.number);
}

function parseSubjectRows(rows) {
  return rows
    .map((r) => ({
      code: String(r[0] ?? "")
        .trim()
        .toUpperCase(),
      title: String(r[1] ?? "").trim(),
      program: String(r[2] ?? "")
        .trim()
        .toUpperCase(),
      year: String(r[3] ?? "").trim(),
      enrolled: toNumber(r[4], 0),
      roomType: String(r[5] ?? "").trim(),
      duration: toNumber(r[6], 1.5),
      instructor: String(r[7] ?? "").trim(),
      status: "Pending",
      room: "",
      time: "",
      pattern: "",
    }))
    .filter((course) => course.code);
}

export function parseImportCsv(csvText) {
  const rows = parseCsvText(csvText);
  if (rows.length < 2) {
    throw new Error("CSV must include a header row and at least one record.");
  }

  const headers = rows[0];
  const dataRows = rows.slice(1);

  if (assertHeaderMatch(headers, SCHEDULE_HEADERS)) {
    const courses = parseScheduleRows(dataRows);
    return {
      type: "schedule",
      courses,
      instructorNames: courses
        .map((c) => c.instructor)
        .filter((name) => normalizeInstructorName(name)),
    };
  }

  if (assertHeaderMatch(headers, FACULTY_HEADERS)) {
    return {
      type: "faculty",
      instructors: parseFacultyRows(dataRows),
    };
  }

  if (assertHeaderMatch(headers, ROOM_HEADERS)) {
    return {
      type: "rooms",
      rooms: parseRoomRows(dataRows),
    };
  }

  if (assertHeaderMatch(headers, SUBJECT_HEADERS)) {
    const courses = parseSubjectRows(dataRows);
    return {
      type: "subjects",
      courses,
      instructorNames: courses
        .map((c) => c.instructor)
        .filter((name) => normalizeInstructorName(name)),
    };
  }

  throw new Error(
    "Unsupported CSV format. Use exported schedule format or Faculty/Rooms/Subjects templates from public/csv.",
  );
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
    courses: Array.isArray(value?.courses) ? value.courses : [],
  };
}

export function mergeUniqueInstructors(
  existingInstructors,
  importedInstructors = [],
  instructorNames = [],
  courses = [],
) {
  const merged = [];
  const seen = new Set();
  let addedCount = 0;

  const addIfUnique = (value) => {
    const inst = ensureInstructorObject(value);
    const key = normalizeInstructorName(inst.name);
    if (!key || seen.has(key)) return;
    seen.add(key);
    merged.push(inst);
  };

  (existingInstructors ?? []).forEach((inst) => addIfUnique(inst));

  (importedInstructors ?? []).forEach((inst) => {
    const key = normalizeInstructorName(inst?.name);
    if (!key || seen.has(key)) return;
    addedCount += 1;
    addIfUnique(inst);
  });

  (instructorNames ?? []).forEach((name) => {
    const key = normalizeInstructorName(name);
    if (!key || seen.has(key)) return;
    addedCount += 1;
    addIfUnique(name);
  });

  if ((courses ?? []).length > 0) {
    merged.forEach((inst) => {
      const key = normalizeInstructorName(inst.name);
      inst.courses = courses
        .filter((course) => normalizeInstructorName(course.instructor) === key)
        .map((course) => course.code);
    });
  }

  return { instructors: merged, addedCount };
}

export function exportToExcel(scheduleAssignments) {
  if (scheduleAssignments.length === 0) {
    return false;
  }

  const headers = SCHEDULE_HEADERS;
  const rows = scheduleAssignments.map((c) => [
    c.code,
    c.title,
    c.program,
    c.year,
    c.enrolled,
    c.room,
    c.roomType,
    c.pattern,
    c.time,
    c.duration,
    c.instructor || "—",
    c.status,
  ]);

  const csvContent = [headers, ...rows]
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
        .join(","),
    )
    .join("\n");

  const blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `TSU_CCS_Schedule_AY2025-2026.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}