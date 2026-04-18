import fs from "fs";

const filePath = "src/utils/scheduleUtils.js";
let content = fs.readFileSync(filePath, "utf8");

console.log("[1] Updating getAssignmentSubjectCode function...");

// Replace 1: Update getAssignmentSubjectCode with enhanced property lookups
const oldGetSubjectCode = `export function getAssignmentSubjectCode(row) {
  return String(row?.code ?? row?.subjectCode ?? row?.subject_code ?? "")
    .trim()
    .toUpperCase();
}`;

const newGetSubjectCode = `export function getAssignmentSubjectCode(row) {
  // Enhanced lookup paths: code → subjectCode → subject_code → subject.code → subject_id → subject_title
  let result = String(
    row?.code ??
      row?.subjectCode ??
      row?.subject_code ??
      row?.subject?.code ??
      row?.subject_id ??
      "",
  )
    .trim()
    .toUpperCase();

  // Fallback: if subject_title exists but no code found, use first 5 chars of title
  if (!result && row?.subject_title) {
    result = String(row.subject_title)
      .trim()
      .substring(0, 5)
      .toUpperCase();
  }

  return result;
}`;

if (!content.includes(newGetSubjectCode)) {
  if (content.includes(oldGetSubjectCode)) {
    content = content.replace(oldGetSubjectCode, newGetSubjectCode);
    console.log("  [OK] Updated getAssignmentSubjectCode");
  } else {
    console.error(
      "  [ERROR] Could not find old getAssignmentSubjectCode to replace",
    );
    process.exit(1);
  }
} else {
  console.log("  [SKIP] getAssignmentSubjectCode already updated");
}

// Replace 2: Update runAutoSchedule initialization - add buildSubjectLookupIndex call
console.log("[2] Updating runAutoSchedule initialization...");

const oldInit = `  const weights = getSoftWeights();
  const newRooms = (Array.isArray(rooms) ? rooms : []).map((r) => ({ ...r }));
  const subjectByCode = new Map(
    (Array.isArray(subjects) ? subjects : []).map((subject) => [
      String(subject?.code ?? "")
        .trim()
        .toUpperCase(),
      subject,
    ]),
  );`;

const newInit = `  const weights = getSoftWeights();
  const newRooms = (Array.isArray(rooms) ? rooms : []).map((r) => ({ ...r }));

  // ── Build enhanced subject lookup index ────────────────────────────────────
  const { subjectByCode, subjectById } = buildSubjectLookupIndex(subjects);

  // ── Initialize subject resolution failure tracking ────────────────────────
  const resolutionCache = new SubjectResolutionCache();`;

if (content.includes(oldInit)) {
  content = content.replace(oldInit, newInit);
  console.log("  [OK] Updated runAutoSchedule initialization");
} else {
  console.error(
    "  [ERROR] Could not find runAutoSchedule initialization to replace",
  );
  process.exit(1);
}

// Replace 3: Update conflict creation to include raw identifier and logging
console.log("[3] Updating conflict creation logic with real-time logging...");

const oldConflict = `    // If subject code exists but was not found in database, mark as conflict
    if (courseSubjectCode && !subjectLookup.found) {
      generatedAssignments.push({
        ...course,
        room: "",
        time: "",
        duration: 1.5,
        pattern: pattern,
        instructor: "",
        instructorId: "",
        instructor_id: "",
        status: "Conflict",
        conflictReason: \`Subject not found: \${courseSubjectCode}\`,
      });
      conflictCount++;
      return;
    }`;

const newConflict = `    // If subject code exists but was not found in database, mark as conflict
    if (courseSubjectCode && !subjectLookup.found) {
      // Capture raw identifier for debugging
      const rawIdentifier =
        course?.code ?? course?.subjectCode ?? course?.subject_code ?? "???";

      resolutionCache.recordFailure(courseSubjectCode, rawIdentifier, course);

      console.warn(
        \`[scheduleUtils] Subject resolution failed: '\${courseSubjectCode}' (raw: '\${rawIdentifier}') for section \${course.sectionId}\`,
      );

      generatedAssignments.push({
        ...course,
        room: "",
        time: "",
        duration: 1.5,
        pattern: pattern,
        instructor: "",
        instructorId: "",
        instructor_id: "",
        status: "Conflict",
        conflictReason: \`Subject not found: '\${courseSubjectCode}' (raw identifier: '\${rawIdentifier}')\`,
      });
      conflictCount++;
      return;
    }`;

if (content.includes(oldConflict)) {
  content = content.replace(oldConflict, newConflict);
  console.log("  [OK] Updated conflict creation");
} else {
  console.error("  [ERROR] Could not find conflict creation to replace");
  process.exit(1);
}

// Replace 4: Add report generation at the end of runAutoSchedule
console.log(
  "[4] Adding resolution report generation at end of runAutoSchedule...",
);

const endOfRunAutoSchedule =
  "  return {\n" +
  "    rooms: newRooms,\n" +
  "    scheduleAssignments: generatedAssignments,\n" +
  "    assigned,\n" +
  "    conflictCount,\n" +
  '    message: `Auto-schedule completed: ${assigned} section${assigned !== 1 ? "s" : ""} scheduled${conflictCount > 0 ? `, ${conflictCount} conflict${conflictCount !== 1 ? "s" : ""} created` : ""}`,\n' +
  "  };\n" +
  "  };\n" +
  "}";

const newEndOfRunAutoSchedule =
  "  // ── Generate subject resolution report for debugging ──────────────────────\n" +
  "  generateSubjectResolutionReport(resolutionCache, conflictCount);\n" +
  "\n" +
  "  return {\n" +
  "    rooms: newRooms,\n" +
  "    scheduleAssignments: generatedAssignments,\n" +
  "    assigned,\n" +
  "    conflictCount,\n" +
  '    message: `Auto-schedule completed: ${assigned} section${assigned !== 1 ? "s" : ""} scheduled${conflictCount > 0 ? `, ${conflictCount} conflict${conflictCount !== 1 ? "s" : ""} created` : ""}`,\n' +
  "  };\n" +
  "}";

if (content.includes(endOfRunAutoSchedule)) {
  content = content.replace(endOfRunAutoSchedule, newEndOfRunAutoSchedule);
  console.log("  [OK] Added report generation");
} else {
  console.error("  [ERROR] Could not find end of runAutoSchedule to replace");
  process.exit(1);
}

// Now add the new helper functions before validateAssignmentReferences
console.log("[5] Adding new helper functions...");

const insertionMarker = `/**
 * Validates that an assignment references valid subjects, rooms, and instructors.
 * Used to detect UNKNOWN subject codes and invalid foreign key references before persistence.`;

// Use single quotes and manual concatenation to avoid template literal parsing issues
const newFunctions =
  "/**\n" +
  " * Builds an enhanced subject lookup index with multiple mapping strategies.\n" +
  " * Creates maps by code AND by id for more flexible subject resolution.\n" +
  " *\n" +
  " * @param {Array} subjects - Array of subject objects\n" +
  " * @returns {object} Object with subjectByCode and subjectById maps\n" +
  " */\n" +
  "function buildSubjectLookupIndex(subjects) {\n" +
  "  const subjectByCode = new Map();\n" +
  "  const subjectById = new Map();\n" +
  "\n" +
  "  (Array.isArray(subjects) ? subjects : []).forEach((subject) => {\n" +
  "    if (subject?.code) {\n" +
  "      const normalizedCode = String(subject.code)\n" +
  "        .trim()\n" +
  "        .toUpperCase();\n" +
  "      subjectByCode.set(normalizedCode, subject);\n" +
  "    }\n" +
  "\n" +
  "    if (subject?.id) {\n" +
  "      const normalizedId = String(subject.id).trim().toUpperCase();\n" +
  "      subjectById.set(normalizedId, subject);\n" +
  "    }\n" +
  "  });\n" +
  "\n" +
  "  return { subjectByCode, subjectById };\n" +
  "}\n" +
  "\n" +
  "/**\n" +
  " * Tracks subject resolution failures during scheduling for debugging.\n" +
  " * Captures unresolved identifiers and raw assignment properties.\n" +
  " */\n" +
  "class SubjectResolutionCache {\n" +
  "  constructor() {\n" +
  "    this.failures = new Map(); // key: unresolved identifier, value: { count, examples }\n" +
  "    this.failuresByRawValue = new Map(); // key: raw value from assignment, value: details\n" +
  "  }\n" +
  "\n" +
  "  recordFailure(identifier, rawValue, assignment) {\n" +
  "    // Track by normalized identifier\n" +
  "    if (!this.failures.has(identifier)) {\n" +
  "      this.failures.set(identifier, { count: 0, examples: [] });\n" +
  "    }\n" +
  "    const failure = this.failures.get(identifier);\n" +
  "    failure.count += 1;\n" +
  "    if (failure.examples.length < 2) {\n" +
  "      failure.examples.push({\n" +
  "        rawValue,\n" +
  "        sectionId: assignment?.sectionId,\n" +
  "        row: `${assignment?.code}::${assignment?.section}`,\n" +
  "      });\n" +
  "    }\n" +
  "\n" +
  "    // Track by raw value for detailed debugging\n" +
  "    if (!this.failuresByRawValue.has(rawValue)) {\n" +
  "      this.failuresByRawValue.set(rawValue, { count: 0, sources: [] });\n" +
  "    }\n" +
  "    const rawFailure = this.failuresByRawValue.get(rawValue);\n" +
  "    rawFailure.count += 1;\n" +
  "    if (rawFailure.sources.length < 1) {\n" +
  '      rawFailure.sources.push(assignment?.sectionId || "unknown");\n' +
  "    }\n" +
  "  }\n" +
  "\n" +
  "  getReport() {\n" +
  "    if (this.failures.size === 0) {\n" +
  "      return null;\n" +
  "    }\n" +
  "\n" +
  "    const summary = [];\n" +
  "    this.failures.forEach((failure, identifier) => {\n" +
  "      summary.push({\n" +
  "        identifier,\n" +
  "        count: failure.count,\n" +
  "        examples: failure.examples,\n" +
  "      });\n" +
  "    });\n" +
  "\n" +
  "    return {\n" +
  "      totalFailures: Array.from(this.failures.values()).reduce(\n" +
  "        (sum, f) => sum + f.count,\n" +
  "        0,\n" +
  "      ),\n" +
  "      uniqueIdentifiers: this.failures.size,\n" +
  "      failures: summary,\n" +
  "    };\n" +
  "  }\n" +
  "}\n" +
  "\n" +
  "/**\n" +
  " * Generates a human-readable report of subject resolution failures.\n" +
  " * Called after scheduling to provide debugging insights.\n" +
  " *\n" +
  " * @param {SubjectResolutionCache} cache - The resolution cache with failure data\n" +
  " * @param {number} conflictCount - Total conflicts generated\n" +
  " * @returns {void} Logs report to console\n" +
  " */\n" +
  "function generateSubjectResolutionReport(cache, conflictCount) {\n" +
  "  const report = cache.getReport();\n" +
  "  if (!report) {\n" +
  "    console.log(\n" +
  '      "[scheduleUtils] [OK] Subject resolution: All subjects resolved successfully.",\n' +
  "    );\n" +
  "    return;\n" +
  "  }\n" +
  "\n" +
  "  console.warn(\n" +
  "    `\\n[scheduleUtils] [WARN] Subject Resolution Report:\\n  Total Unresolved: ${report.totalFailures} assignments | Unique Identifiers: ${report.uniqueIdentifiers}\\n`,\n" +
  "  );\n" +
  "\n" +
  "  report.failures.forEach(({ identifier, count, examples }) => {\n" +
  "    console.warn(\n" +
  '      `  [X] \'${identifier}\' (${count} occurrence${count > 1 ? "s" : ""})`\n' +
  "    );\n" +
  "    if (examples.length > 0) {\n" +
  "      examples.forEach((ex) => {\n" +
  "        console.warn(\n" +
  "          `    |-- Section: ${ex.sectionId ?? \"unknown\"} | ${ex.row} | Raw: '${ex.rawValue}'`\n" +
  "        );\n" +
  "      });\n" +
  "    }\n" +
  "  });\n" +
  "\n" +
  "  console.warn(\n" +
  "    `\\nTotal conflicts created from unresolved subjects: ${conflictCount}\\n`,\n" +
  "  );\n" +
  "}\n";

if (!content.includes("buildSubjectLookupIndex")) {
  const insertionPoint = content.indexOf(insertionMarker);
  if (insertionPoint !== -1) {
    content =
      content.slice(0, insertionPoint) +
      newFunctions +
      content.slice(insertionPoint);
    console.log("  [OK] Added new helper functions");
  } else {
    console.error(
      "  [ERROR] Could not find insertion point for helper functions",
    );
    process.exit(1);
  }
} else {
  console.log("  [SKIP] Helper functions already exist");
}

// Write the updated content
fs.writeFileSync(filePath, content, "utf8");
console.log("[DONE] All updates completed successfully!");
