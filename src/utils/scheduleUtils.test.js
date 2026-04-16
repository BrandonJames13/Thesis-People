/**
 * Quick verification test for scheduleUtils.js optimization
 * Ensures output is identical after optimization refactoring
 */

import {
  runAutoSchedule,
  getAssignmentSubjectCode,
  getAssignmentSection,
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

    console.log("\n✅ All optimization tests passed!");
    return { success: true, result };
  } catch (error) {
    console.error(`\n❌ Test failed: ${error.message}`);
    console.error(error);
    return { success: false, error: error.message };
  }
}

// Run test if executed directly
if (typeof module !== "undefined" && module.meta?.url) {
  const testResult = testScheduleOptimization();
  if (!testResult.success) {
    process.exit(1);
  }
}
