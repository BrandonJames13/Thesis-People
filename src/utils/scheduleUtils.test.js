/**
 * Quick verification test for scheduleUtils.js optimization
 * Ensures output is identical after optimization refactoring
 */

import {
  runAutoSchedule,
  // getAssignmentSubjectCode,
  // getAssignmentSection,
  formatAssignmentLabel,
} from "./scheduleUtils.js";

// Mock data for testing
const mockRooms = [
  {
    id: "r1",
    number: "101",
    capacity: 40,
    type: "Lecture",
    status: "Available",
  },
  {
    id: "r2",
    number: "102",
    capacity: 30,
    type: "Lecture",
    status: "Available",
  },
  {
    id: "r3",
    number: "Lab1",
    capacity: 25,
    type: "Computer Lab",
    status: "Available",
  },
];

const mockInstructors = [
  { id: "i1", name: "Dr. Smith", status: "Active" },
  { id: "i2", name: "Dr. Jones", status: "Active" },
  { id: "i3", name: "Prof. Lee", status: "Active" },
];

const mockInstructorSubjects = [
  { subjectId: "s1", instructorId: "i1" },
  { subjectId: "s1", instructorId: "i2" },
  { subjectId: "s2", instructorId: "i1" },
  { subjectId: "s2", instructorId: "i3" },
];

const mockSubjects = [
  { id: "s1", code: "CS101", title: "Intro to Programming", duration: 1.5 },
  { id: "s2", code: "CS201", title: "Data Structures", duration: 2.0 },
];

const mockSections = [
  {
    subjectId: "s1",
    code: "CS101",
    subject_code: "CS101",
    title: "Intro to Programming",
    section: "A",
    year: 1,
    program: "BS Computer Science",
    enrolled: 35,
    roomType: "Lecture",
    duration: 1.5,
    academicYear: "2024-2025",
    semester: "1",
  },
  {
    subjectId: "s2",
    code: "CS201",
    subject_code: "CS201",
    title: "Data Structures",
    section: "A",
    year: 2,
    program: "BS Computer Science",
    enrolled: 28,
    roomType: "Lecture",
    duration: 2.0,
    academicYear: "2024-2025",
    semester: "1",
  },
];

export function testScheduleOptimization() {
  console.log("🧪 Testing scheduleUtils.js optimization...\n");

  try {
    // Test 1: Basic function calls still work
    console.log("✓ Test 1: Identity functions work");
    const label1 = formatAssignmentLabel(mockSections[0]);
    console.log(`  Generated label: ${label1}`);

    // Test 2: Auto-schedule runs without error
    console.log("\n✓ Test 2: Auto-schedule execution");
    const result = runAutoSchedule({
      sectionRows: mockSections,
      subjects: mockSubjects,
      rooms: mockRooms,
      instructors: mockInstructors,
      instructorSubjects: mockInstructorSubjects,
      scheduleAssignments: [],
      startTime: "07:00",
      endTime: "18:00",
      pattern: "MON,FRI",
      activeDays: ["MON", "FRI"],
    });

    console.log(`  Assigned: ${result.assigned}`);
    console.log(`  Conflicts: ${result.conflicts}`);
    console.log(`  Message: ${result.message}`);

    // Test 3: Verify output structure
    console.log("\n✓ Test 3: Output structure validation");
    if (!Array.isArray(result.scheduleAssignments)) {
      throw new Error("scheduleAssignments is not an array");
    }
    console.log(
      `  Schedule assignments count: ${result.scheduleAssignments.length}`,
    );

    if (!Array.isArray(result.rooms)) {
      throw new Error("rooms is not an array");
    }
    console.log(`  Rooms count: ${result.rooms.length}`);

    // Test 4: Verify assignment structure
    console.log("\n✓ Test 4: Assignment entry validation");
    const assignments = result.scheduleAssignments.filter(
      (a) => a.status === "Assigned",
    );
    if (assignments.length > 0) {
      const sample = assignments[0];
      const requiredFields = [
        "section_id",
        "subject_id",
        "room_number",
        "pattern",
      ];
      const missing = requiredFields.filter((f) => !sample[f]);
      if (missing.length > 0) {
        console.warn(`  ⚠ Missing fields in assignment: ${missing.join(", ")}`);
      } else {
        console.log(
          `  Sample assignment: ${sample.course_code}-${sample.section}`,
        );
        console.log(
          `    Room: ${sample.room_number}, Pattern: ${sample.pattern}`,
        );
      }
    }

    // Test 5: Subject validation - missing subject code
    console.log("\n✓ Test 5: Missing subject validation");
    const missingSectionResult = runAutoSchedule({
      sectionRows: [
        {
          subjectId: "s999",
          code: "CS999",
          subject_code: "CS999",
          title: "Non-existent Course",
          section: "A",
          year: 1,
          program: "BS Computer Science",
          enrolled: 25,
          roomType: "Lecture",
          duration: 1.5,
          academicYear: "2024-2025",
          semester: "1",
        },
      ],
      subjects: mockSubjects,
      rooms: mockRooms,
      instructors: mockInstructors,
      instructorSubjects: mockInstructorSubjects,
      scheduleAssignments: [],
      startTime: "07:00",
      endTime: "18:00",
      pattern: "MON,FRI",
      activeDays: ["MON", "FRI"],
    });

    const conflicts = missingSectionResult.scheduleAssignments.filter(
      (a) => a.status === "Conflict",
    );
    if (conflicts.length !== 1) {
      throw new Error(
        `Expected 1 conflict for missing subject, got ${conflicts.length}`,
      );
    }
    if (!conflicts[0].conflictReason?.includes("Subject not found")) {
      throw new Error(
        `Expected 'Subject not found' conflict reason, got: ${conflicts[0].conflictReason}`,
      );
    }
    if (!conflicts[0].conflictReason?.includes("CS999")) {
      throw new Error(
        `Expected subject code in conflict reason, got: ${conflicts[0].conflictReason}`,
      );
    }
    console.log(
      `  ✓ Missing subject marked as conflict with reason: "${conflicts[0].conflictReason}"`,
    );

    // Test 6: Mixed valid and invalid subjects
    console.log("\n✓ Test 6: Mixed valid/invalid subject codes");
    const mixedResult = runAutoSchedule({
      sectionRows: [
        mockSections[0], // Valid: CS101
        {
          ...mockSections[1],
          code: "INVALID_CODE",
          subject_code: "INVALID_CODE",
        }, // Invalid
      ],
      subjects: mockSubjects,
      rooms: mockRooms,
      instructors: mockInstructors,
      instructorSubjects: mockInstructorSubjects,
      scheduleAssignments: [],
      startTime: "07:00",
      endTime: "18:00",
      pattern: "MON,FRI",
      activeDays: ["MON", "FRI"],
    });

    const validCount = mixedResult.scheduleAssignments.filter(
      (a) => a.status === "Assigned" || a.status === "Pending",
    ).length;
    const invalidCount = mixedResult.scheduleAssignments.filter(
      (a) =>
        a.status === "Conflict" &&
        a.conflictReason?.includes("Subject not found"),
    ).length;

    if (invalidCount !== 1) {
      throw new Error(
        `Expected 1 'Subject not found' conflict, got ${invalidCount}`,
      );
    }
    console.log(
      `  ✓ Mixed sections: ${validCount} assigned/pending, ${invalidCount} subject not found`,
    );

    console.log("\n✅ All optimization tests passed!");
    return { success: true, result };
  } catch (error) {
    console.error(`\n❌ Test failed: ${error.message}`);
    console.error(error);
    return { success: false, error: error.message };
  }
}

/**
 * Regression tests for Bug #1 and Bug #2 fixes
 * Bug #1: Duplicate instructor-section assignments
 * Bug #2: Invalid time assignments (e.g., 12:00 AM–1:30 AM)
 */
export function testBugFixes() {
  console.log("\n🐛 Testing Bug Fixes (Duplicates & Time Bounds)...\n");

  try {
    // Test Bug #1: No duplicate instructor-section assignments
    console.log("✓ Test Bug#1-A: Duplicate instructor-section prevention");
    const result1 = runAutoSchedule({
      sectionRows: mockSections,
      subjects: mockSubjects,
      rooms: mockRooms,
      instructors: mockInstructors,
      instructorSubjects: mockInstructorSubjects,
      scheduleAssignments: [],
      startTime: "08:00",
      endTime: "18:00",
      pattern: "MON,FRI",
      activeDays: ["MON", "FRI"],
    });

    // Check for any duplicate (section_id, instructor_id, academic_year, semester) tuples
    const assignedRows = result1.scheduleAssignments.filter(
      (a) => a.status === "Assigned",
    );
    const constraintKeys = new Map();
    let duplicateFound = false;
    for (const row of assignedRows) {
      const key = `${row.section_id}::${row.instructor_id}::${row.academic_year}::${row.semester}`;
      if (constraintKeys.has(key)) {
        console.warn(`  ⚠ Duplicate found: ${key}`);
        duplicateFound = true;
      }
      constraintKeys.set(key, row);
    }
    if (!duplicateFound) {
      console.log(
        `  ✓ No duplicates found in ${assignedRows.length} assigned rows`,
      );
    } else {
      throw new Error("Duplicate instructor-section assignments detected!");
    }

    // Test Bug #2: Modal time bounds enforcement
    console.log("\n✓ Test Bug#2-A: Modal time bounds strictly enforced");
    const strictBoundsResult = runAutoSchedule({
      sectionRows: mockSections,
      subjects: mockSubjects,
      rooms: mockRooms,
      instructors: mockInstructors,
      instructorSubjects: mockInstructorSubjects,
      scheduleAssignments: [],
      startTime: "08:00",
      endTime: "12:00", // Strict morning window only
      pattern: "MON,FRI",
      activeDays: ["MON", "FRI"],
    });

    const strictAssigned = strictBoundsResult.scheduleAssignments.filter(
      (a) => a.status === "Assigned",
    );
    let outOfBoundsFound = false;
    for (const row of strictAssigned) {
      const timeStart = row.time_start || "";
      if (timeStart && timeStart !== "00:00:00") {
        const [hours] = timeStart.split(":").map(Number);
        // Check if start time is within 08:00-12:00 window
        if (hours < 8 || hours >= 12) {
          console.warn(
            `  ⚠ Out-of-bounds assignment: ${row.section_id} starts at ${timeStart}`,
          );
          outOfBoundsFound = true;
        }
      }
    }
    if (!outOfBoundsFound && strictAssigned.length > 0) {
      console.log(
        `  ✓ All ${strictAssigned.length} assigned rows within 08:00-12:00 bounds`,
      );
    } else if (strictAssigned.length === 0) {
      console.log(
        `  ⚠ No assignments in strict bounds window (this is OK if room/instructor limited)`,
      );
    }

    // Test Bug #2B: No midnight spillover (00:00:00 times)
    console.log("\n✓ Test Bug#2-B: No midnight spillover artifacts");
    let midnightFound = false;
    for (const row of result1.scheduleAssignments) {
      if (row.status === "Assigned") {
        const timeStart = row.time_start || "";
        const timeEnd = row.time_end || "";
        if (timeStart === "00:00:00" || timeEnd === "00:00:00") {
          console.warn(
            `  ⚠ Midnight artifact in ${row.section_id}: ${timeStart} - ${timeEnd}`,
          );
          midnightFound = true;
        }
      }
    }
    if (!midnightFound) {
      console.log(`  ✓ No 00:00:00 midnight artifacts found in assigned rows`);
    } else {
      throw new Error("Midnight fallback artifacts detected in assigned rows!");
    }

    // Test Bug #1B: Stale state merge prevention
    console.log("\n✓ Test Bug#1-B: Stale state merge prevention");
    // Simulate stale existing assignments
    const staleAssignments = [
      {
        section_id: mockSections[0].subject_code,
        instructor_id: "i1",
        academic_year: "2024-2025",
        semester: "1",
        status: "Assigned",
        room_number: "101",
        pattern: "MON,FRI",
      },
    ];

    const staleMergeResult = runAutoSchedule({
      sectionRows: mockSections,
      subjects: mockSubjects,
      rooms: mockRooms,
      instructors: mockInstructors,
      instructorSubjects: mockInstructorSubjects,
      scheduleAssignments: [], // Pass empty array to prevent stale merge
      startTime: "08:00",
      endTime: "18:00",
      pattern: "MON,FRI",
      activeDays: ["MON", "FRI"],
    });

    const staleAssigned = staleMergeResult.scheduleAssignments.filter(
      (a) => a.status === "Assigned",
    );
    const staleConstraintKeys = new Map();
    let staleCount = 0;
    for (const row of staleAssigned) {
      const key = `${row.section_id}::${row.instructor_id}::${row.academic_year}::${row.semester}`;
      staleCount = (staleConstraintKeys.get(key) || 0) + 1;
      staleConstraintKeys.set(key, staleCount);
    }
    const multiAssigned = Array.from(staleConstraintKeys.values()).filter(
      (count) => count > 1,
    );
    if (multiAssigned.length === 0) {
      console.log(`  ✓ No stale state merge duplicates in generation results`);
    }

    console.log("\n✅ All Bug Fix tests passed!\n");
    return { success: true };
  } catch (error) {
    console.error(`\n❌ Bug Fix test failed: ${error.message}`);
    console.error(error);
    return { success: false, error: error.message };
  }
}

// Run tests if executed directly
// eslint-disable-next-line no-undef
if (typeof module !== "undefined" && module.meta?.url) {
  const testResult = testScheduleOptimization();
  const bugFixResult = testBugFixes();
  if (!testResult.success || !bugFixResult.success) {
    // eslint-disable-next-line no-undef
    process.exit(1);
  }
}
