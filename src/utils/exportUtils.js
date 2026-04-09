export const CSV_TYPES = {
  FULL_LIST: "full-list",
  ROOMS: "rooms",
  INSTRUCTORS: "instructors",
  SUBJECTS: "subjects",
};

const DEFAULT_INSTRUCTOR = {
  department: "TBD",
  availability: "TBD",
  courses: [],
  status: "Active",
};

export const CSV_FORMATS = {
  [CSV_TYPES.FULL_LIST]: {
    label: "Full List",
    description:
      "Schedule assignments with subject, room, time, duration, instructor, and status fields.",
    templatePath: "/csv/full-list.csv",
    templateLabel: "Full List Template",
    filename: "TSU_CCS_Subjects_Full_List_AY2025-2026.csv",
    headers: [
      "Section ID",
      "Subject Code",
      "Subject Title",
      "Section",
      "Academic Year",
      "Semester",
      "Program",
      "Year",
      "Enrolled",
      "Type Required",
      "Room",
      "Pattern",
      "Time",
      "Duration (hrs)",
      "Instructor",
      "Status",
    ],
    rowKey: (row) => {
      const sectionId = String(row?.section_id ?? row?.sectionId ?? "").trim();
      if (sectionId) return `id:${sectionId.toLowerCase()}`;
      return [
        row?.code,
        row?.section,
        row?.academicYear,
        row?.semester,
        row?.room,
        row?.time,
        row?.instructor,
      ]
        .map((value) => normalizeHeader(value))
        .join("|");
    },
  },
  [CSV_TYPES.ROOMS]: {
    label: "Rooms",
    description: "Room inventory records.",
    templatePath: "/csv/rooms-list.csv",
    templateLabel: "Rooms Template",
    filename: "TSU_CCS_Rooms_List_AY2025-2026.csv",
    headers: ["Room Number", "Room Type", "Capacity", "Status"],
    rowKey: (row) => normalizeHeader(row?.number),
  },
  [CSV_TYPES.INSTRUCTORS]: {
    label: "Instructors",
    description: "Instructor records and availability settings.",
    templatePath: "/csv/instructors-list.csv",
    templateLabel: "Instructors Template",
    filename: "TSU_CCS_Instructors_List_AY2025-2026.csv",
    headers: ["Name", "Department", "Availability", "Status"],
    rowKey: (row) => normalizeInstructorName(row?.name),
  },
  [CSV_TYPES.SUBJECTS]: {
    label: "Subjects",
    description:
      "Subject catalog records with section, academic year, and semester.",
    templatePath: "/csv/subjects-list.csv",
    templateLabel: "Subjects Template",
    filename: "TSU_CCS_Subjects_List_AY2025-2026.csv",
    headers: [
      "Subject Code",
      "Subject Title",
      "Section",
      "Academic Year",
      "Semester",
      "Program",
      "Year",
      "Enrolled",
      "Type Required",
      "Duration (hrs)",
      "Instructor",
      "Status",
    ],
    rowKey: (row) =>
      [row?.code, row?.section, row?.academicYear, row?.semester]
        .map((value) => normalizeHeader(value))
        .join("|"),
  },
};

export const CSV_TYPE_OPTIONS = Object.entries(CSV_FORMATS).map(
  ([value, config]) => ({
    value,
    label: config.label,
    description: config.description,
    templatePath: config.templatePath,
    templateLabel: config.templateLabel,
  }),
);

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

function normalizeSectionIdentity(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toCsvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
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

function getTypeConfig(type) {
  const config = CSV_FORMATS[type];
  if (!config) {
    throw new Error(
      `Unsupported CSV type. Choose one of: ${Object.values(CSV_TYPES).join(", ")}.`,
    );
  }
  return config;
}

function parseFullListRows(rows) {
  return rows.map((r) => {
    return {
      section_id: String(r[0] ?? "").trim(),
      code: String(r[1] ?? "")
        .trim()
        .toUpperCase(),
      title: String(r[2] ?? "").trim(),
      section: String(r[3] ?? "").trim(),
      academicYear: String(r[4] ?? "").trim(),
      semester: String(r[5] ?? "").trim(),
      program: String(r[6] ?? "")
        .trim()
        .toUpperCase(),
      year: String(r[7] ?? "").trim(),
      enrolled: toNumber(r[8], 0),
      roomType: String(r[9] ?? "").trim(),
      room: String(r[10] ?? "").trim(),
      pattern: String(r[11] ?? "").trim(),
      time: String(r[12] ?? "").trim(),
      duration: toNumber(r[13], 0),
      instructor: String(r[14] ?? "")
        .trim()
        .replace(/^—$/, ""),
      status: String(r[15] ?? "").trim() || "Pending",
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
      section: String(r[2] ?? "").trim(),
      academicYear: String(r[3] ?? "").trim(),
      semester: String(r[4] ?? "").trim(),
      program: String(r[5] ?? "")
        .trim()
        .toUpperCase(),
      year: String(r[6] ?? "").trim(),
      enrolled: toNumber(r[7], 0),
      roomType: String(r[8] ?? "").trim(),
      duration: toNumber(r[9], 1.5),
      instructor: String(r[10] ?? "").trim(),
      status: String(r[11] ?? "").trim() || "Pending",
      room: "",
      time: "",
      pattern: "",
    }))
    .filter((course) => course.code);
}

function dedupeByIdentity(records, keyFn) {
  const seen = new Set();
  const deduped = [];

  (records ?? []).forEach((record) => {
    const key = normalizeSectionIdentity(keyFn(record));
    if (!key || seen.has(key)) return;
    seen.add(key);
    deduped.push(record);
  });

  return deduped;
}

function normalizeImportedInstructor(value) {
  return {
    ...DEFAULT_INSTRUCTOR,
    ...value,
    name: String(value?.name ?? "").trim(),
    department:
      String(value?.department ?? "").trim() || DEFAULT_INSTRUCTOR.department,
    availability:
      String(value?.availability ?? "").trim() ||
      DEFAULT_INSTRUCTOR.availability,
    status: String(value?.status ?? "").trim() || DEFAULT_INSTRUCTOR.status,
    courses: Array.isArray(value?.courses) ? value.courses : [],
  };
}

export function parseImportCsv(csvText, type) {
  const config = type ? getTypeConfig(type) : null;
  const rows = parseCsvText(csvText);
  if (rows.length < 2) {
    throw new Error("CSV must include a header row and at least one record.");
  }

  const headers = rows[0];
  const dataRows = rows.slice(1);

  const typesToCheck = config ? [type] : Object.values(CSV_TYPES);
  const selectedType = typesToCheck.find((candidate) => {
    return assertHeaderMatch(headers, getTypeConfig(candidate).headers);
  });

  if (!selectedType) {
    throw new Error(
      "Unsupported CSV format. Use the matching template for the selected type from public/csv.",
    );
  }

  if (config && selectedType !== type) {
    throw new Error(
      `Invalid ${config.label.toLowerCase()} CSV header. Use the matching template from public/csv.`,
    );
  }

  if (selectedType === CSV_TYPES.FULL_LIST) {
    const rows = dedupeByIdentity(
      parseFullListRows(dataRows),
      config?.rowKey ?? getTypeConfig(selectedType).rowKey,
    );
    return { type: selectedType, rows, rowCount: rows.length };
  }

  if (selectedType === CSV_TYPES.ROOMS) {
    const rooms = dedupeByIdentity(
      parseRoomRows(dataRows),
      getTypeConfig(selectedType).rowKey,
    );
    return { type: selectedType, rooms, rowCount: rooms.length };
  }

  if (selectedType === CSV_TYPES.INSTRUCTORS) {
    const instructors = dedupeByIdentity(
      parseFacultyRows(dataRows).map(normalizeImportedInstructor),
      getTypeConfig(selectedType).rowKey,
    );
    return { type: selectedType, instructors, rowCount: instructors.length };
  }

  if (selectedType === CSV_TYPES.SUBJECTS) {
    const subjects = dedupeByIdentity(
      parseSubjectRows(dataRows),
      getTypeConfig(selectedType).rowKey,
    );
    return { type: selectedType, subjects, rowCount: subjects.length };
  }

  throw new Error(`Unsupported CSV type: ${selectedType}`);
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
  const merged = dedupeByIdentity(
    [
      ...(existingInstructors ?? []).map(ensureInstructorObject),
      ...(importedInstructors ?? []).map(ensureInstructorObject),
      ...(instructorNames ?? []).map((name) => ensureInstructorObject(name)),
    ],
    (value) => normalizeInstructorName(value?.name),
  );

  if ((courses ?? []).length > 0) {
    merged.forEach((inst) => {
      const key = normalizeInstructorName(inst.name);
      inst.courses = courses
        .filter((course) => normalizeInstructorName(course.instructor) === key)
        .map((course) => course.code);
    });
  }

  const existingCount = (existingInstructors ?? []).length;
  return {
    instructors: merged,
    addedCount: Math.max(0, merged.length - existingCount),
  };
}

function serializeFullListRow(row) {
  return [
    row.section_id ?? row.sectionId ?? "",
    row.code ?? "",
    row.title ?? "",
    row.section ?? "",
    row.academicYear ?? "",
    row.semester ?? "",
    row.program ?? "",
    row.year ?? "",
    row.enrolled ?? "",
    row.roomType ?? "",
    row.room ?? "",
    row.pattern ?? "",
    row.time ?? "",
    row.duration ?? "",
    row.instructor ?? "",
    row.status ?? "Pending",
  ];
}

function serializeRoomRow(row) {
  return [
    row.number ?? "",
    row.type ?? "",
    row.capacity ?? "",
    row.status ?? "Available",
  ];
}

function serializeInstructorRow(row) {
  return [
    row.name ?? "",
    row.department ?? DEFAULT_INSTRUCTOR.department,
    row.availability ?? DEFAULT_INSTRUCTOR.availability,
    row.status ?? DEFAULT_INSTRUCTOR.status,
  ];
}

function serializeSubjectRow(row) {
  return [
    row.code ?? "",
    row.title ?? "",
    row.section ?? "",
    row.academicYear ?? "",
    row.semester ?? "",
    row.program ?? "",
    row.year ?? "",
    row.enrolled ?? "",
    row.roomType ?? "",
    row.duration ?? "",
    row.instructor ?? "",
    row.status ?? "Pending",
  ];
}

function serializeRecords(type, data) {
  if (type === CSV_TYPES.FULL_LIST)
    return (data ?? []).map(serializeFullListRow);
  if (type === CSV_TYPES.ROOMS) return (data ?? []).map(serializeRoomRow);
  if (type === CSV_TYPES.INSTRUCTORS)
    return (data ?? []).map(serializeInstructorRow);
  if (type === CSV_TYPES.SUBJECTS) return (data ?? []).map(serializeSubjectRow);
  throw new Error(`Unsupported CSV type: ${type}`);
}

export function exportCsv(type, data = []) {
  const config = getTypeConfig(type);
  if (!Array.isArray(data) || data.length === 0) {
    return false;
  }

  const rows = serializeRecords(type, data);
  const csvContent = [config.headers, ...rows]
    .map((row) => row.map(toCsvCell).join(","))
    .join("\n");

  const blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = config.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return true;
}

export function downloadCsvTemplate(type) {
  const config = getTypeConfig(type);
  const a = document.createElement("a");
  a.href = config.templatePath;
  a.download = config.templatePath.split("/").pop() || config.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  return true;
}

export function summarizeImportedRows(payload) {
  if (!payload) return "No file selected";
  return `${payload.rowCount ?? 0} ${getTypeConfig(payload.type).label.toLowerCase()} row(s)`;
}

export function dedupeImportedRecords(type, records = []) {
  const config = getTypeConfig(type);
  return dedupeByIdentity(records, config.rowKey);
}

export function getCsvTypeConfig(type) {
  return getTypeConfig(type);
}

export function getCsvTypeOptions() {
  return CSV_TYPE_OPTIONS;
}

export function exportToExcel(scheduleAssignments) {
  return exportCsv(CSV_TYPES.FULL_LIST, scheduleAssignments);
}
