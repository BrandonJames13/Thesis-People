import fs from 'fs';

const filePath = 'src/utils/scheduleUtils.js';
let content = fs.readFileSync(filePath, 'utf8');

console.log('[1] Updating getAssignmentSubjectCode function...');

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
    console.log('  [OK] Updated getAssignmentSubjectCode');
  } else {
    console.error('  [ERROR] Could not find old getAssignmentSubjectCode to replace');
    process.exit(1);
  }
} else {
  console.log('  [SKIP] getAssignmentSubjectCode already updated');
}

// Replace 2: Update runAutoSchedule initialization - add buildSubjectLookupIndex call
console.log('[2] Updating runAutoSchedule initialization...');

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
  console.log('  [OK] Updated runAutoSchedule initialization');
} else {
  console.error('  [ERROR] Could not find runAutoSchedule initialization to replace');
  process.exit(1);
}

// Replace 3: Update conflict creation to include raw identifier and logging
console.log('[3] Updating conflict creation logic with real-time logging...');

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
  console.log('  [OK] Updated conflict creation');
} else {
  console.error('  [ERROR] Could not find conflict creation to replace');
  process.exit(1);
}

// Replace 4: Add report generation at the end of runAutoSchedule
console.log('[4] Adding resolution report generation at end of runAutoSchedule...');

const endOfRunAutoSchedule = `  return {
    rooms: newRooms,
    scheduleAssignments: generatedAssignments,
    assigned,
    conflictCount,
    message: \`Auto-schedule completed: \${assigned} section\${assigned !== 1 ? "s" : ""} scheduled\${conflictCount > 0 ? `, \${conflictCount} conflict\${conflictCount !== 1 ? "s" : ""} created` : ""}\`,
  };
}`;

const newEndOfRunAutoSchedule = `  // ── Generate subject resolution report for debugging ──────────────────────
  generateSubjectResolutionReport(resolutionCache, conflictCount);

  return {
    rooms: newRooms,
    scheduleAssignments: generatedAssignments,
    assigned,
    conflictCount,
    message: \`Auto-schedule completed: \${assigned} section\${assigned !== 1 ? "s" : ""} scheduled\${conflictCount > 0 ? \`, \${conflictCount} conflict\${conflictCount !== 1 ? "s" : ""} created\` : ""}\`,
  };
}`;

if (content.includes(endOfRunAutoSchedule)) {
  content = content.replace(endOfRunAutoSchedule, newEndOfRunAutoSchedule);
  console.log('  [OK] Added report generation');
} else {
  console.error('  [ERROR] Could not find end of runAutoSchedule to replace');
  process.exit(1);
}

// Now add the new helper functions before validateAssignmentReferences
console.log('[5] Adding new helper functions...');

const insertionMarker = `/**
 * Validates that an assignment references valid subjects, rooms, and instructors.
 * Used to detect UNKNOWN subject codes and invalid foreign key references before persistence.`;

const newFunctions = `/**
 * Builds an enhanced subject lookup index with multiple mapping strategies.
 * Creates maps by code AND by id for more flexible subject resolution.
 *
 * @param {Array} subjects - Array of subject objects
 * @returns {object} Object with subjectByCode and subjectById maps
 */
function buildSubjectLookupIndex(subjects) {
  const subjectByCode = new Map();
  const subjectById = new Map();

  (Array.isArray(subjects) ? subjects : []).forEach((subject) => {
    if (subject?.code) {
      const normalizedCode = String(subject.code)
        .trim()
        .toUpperCase();
      subjectByCode.set(normalizedCode, subject);
    }

    if (subject?.id) {
      const normalizedId = String(subject.id).trim().toUpperCase();
      subjectById.set(normalizedId, subject);
    }
  });

  return { subjectByCode, subjectById };
}

/**
 * Tracks subject resolution failures during scheduling for debugging.
 * Captures unresolved identifiers and raw assignment properties.
 */
class SubjectResolutionCache {
  constructor() {
    this.failures = new Map(); // key: unresolved identifier, value: { count, examples }
    this.failuresByRawValue = new Map(); // key: raw value from assignment, value: details
  }

  recordFailure(identifier, rawValue, assignment) {
    // Track by normalized identifier
    if (!this.failures.has(identifier)) {
      this.failures.set(identifier, { count: 0, examples: [] });
    }
    const failure = this.failures.get(identifier);
    failure.count += 1;
    if (failure.examples.length < 2) {
      failure.examples.push({
        rawValue,
        sectionId: assignment?.sectionId,
        row: \`\${assignment?.code}::\${assignment?.section}\`,
      });
    }

    // Track by raw value for detailed debugging
    if (!this.failuresByRawValue.has(rawValue)) {
      this.failuresByRawValue.set(rawValue, { count: 0, sources: [] });
    }
    const rawFailure = this.failuresByRawValue.get(rawValue);
    rawFailure.count += 1;
    if (rawFailure.sources.length < 1) {
      rawFailure.sources.push(assignment?.sectionId || "unknown");
    }
  }

  getReport() {
    if (this.failures.size === 0) {
      return null;
    }

    const summary = [];
    this.failures.forEach((failure, identifier) => {
      summary.push({
        identifier,
        count: failure.count,
        examples: failure.examples,
      });
    });

    return {
      totalFailures: Array.from(this.failures.values()).reduce(
        (sum, f) => sum + f.count,
        0,
      ),
      uniqueIdentifiers: this.failures.size,
      failures: summary,
    };
  }
}

/**
 * Generates a human-readable report of subject resolution failures.
 * Called after scheduling to provide debugging insights.
 *
 * @param {SubjectResolutionCache} cache - The resolution cache with failure data
 * @param {number} conflictCount - Total conflicts generated
 * @returns {void} Logs report to console
 */
function generateSubjectResolutionReport(cache, conflictCount) {
  const report = cache.getReport();
  if (!report) {
    console.log(
      "[scheduleUtils] [OK] Subject resolution: All subjects resolved successfully.",
    );
    return;
  }

  console.warn(
    \`\\n[scheduleUtils] [WARN] Subject Resolution Report:\\n  Total Unresolved: \${report.totalFailures} assignments | Unique Identifiers: \${report.uniqueIdentifiers}\\n\`,
  );

  report.failures.forEach(({ identifier, count, examples }) => {
    console.warn(
      \`  [X] '\${identifier}' (\${count} occurrence\${count > 1 ? "s" : ""})\`,
    );
    if (examples.length > 0) {
      examples.forEach((ex) => {
        console.warn(
          \`    |-- Section: \${ex.sectionId ?? "unknown"} | \${ex.row} | Raw: '\${ex.rawValue}'\`,
        );
      });
    }
  });

  console.warn(
    \`\\nTotal conflicts created from unresolved subjects: \${conflictCount}\\n\`,
  );
}

\`;

if (!content.includes('buildSubjectLookupIndex')) {
  const insertionPoint = content.indexOf(insertionMarker);
  if (insertionPoint !== -1) {
    content = content.slice(0, insertionPoint) + newFunctions + content.slice(insertionPoint);
    console.log('  [OK] Added new helper functions');
  } else {
    console.error('  [ERROR] Could not find insertion point for helper functions');
    process.exit(1);
  }
} else {
  console.log('  [SKIP] Helper functions already exist');
}

// Write the updated content
fs.writeFileSync(filePath, content, 'utf8');
console.log('[DONE] All updates completed successfully!');
