/* global require, process */
const fs = require("fs");
const filePath = "src/utils/scheduleUtils.js";
let content = fs.readFileSync(filePath, "utf8");

// Find where validateAssignmentReferences starts
const startValidateRef =
  "/**\n * Validates that an assignment references valid subjects, rooms, and instructors.";

const insertionPoint = content.indexOf(startValidateRef);
if (insertionPoint === -1) {
  console.error("Could not find insertion point");
  process.exit(1);
}

const newFunctions = `
/**
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
      rawFailure.sources.push(assignment?.sectionId || 'unknown');
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
      '[scheduleUtils] ✓ Subject resolution: All subjects resolved successfully.',
    );
    return;
  }

  console.warn(
    \`\\n[scheduleUtils] ⚠ Subject Resolution Report:\\n  Total Unresolved: \${report.totalFailures} assignments | Unique Identifiers: \${report.uniqueIdentifiers}\\n\`,
  );

  report.failures.forEach(({ identifier, count, examples }) => {
    console.warn(
      \`  ✗ '\${identifier}' (\${count} occurrence\${count > 1 ? 's' : ''})\`,
    );
    if (examples.length > 0) {
      examples.forEach((ex) => {
        console.warn(
          \`    └─ Section: \${ex.sectionId ?? 'unknown'} | \${ex.row} | Raw: '\${ex.rawValue}'\`,
        );
      });
    }
  });

  console.warn(
    \`\\nTotal conflicts created from unresolved subjects: \${conflictCount}\\n\`,
  );
}

`;

const updated =
  content.slice(0, insertionPoint) +
  newFunctions +
  content.slice(insertionPoint);
fs.writeFileSync(filePath, updated, "utf8");
console.log("✓ New functions inserted successfully");
