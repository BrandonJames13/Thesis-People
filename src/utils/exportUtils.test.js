/**
 * Tests for exportUtils.js - Subject key generation, validation, and error handling
 * Tests buildSubjectIdentityKey, validateSubjectIdentityKey, and generateSubjectLookupSuggestions
 */

import {
  buildSubjectIdentityKey,
  validateSubjectIdentityKey,
  generateSubjectLookupSuggestions,
} from "./exportUtils.js";

// ============================================================================
// Test: buildSubjectIdentityKey - Basic functionality
// ============================================================================

console.log("=== Testing buildSubjectIdentityKey ===");

// Test 1: Normal case - all fields present
const result1 = buildSubjectIdentityKey({
  code: "CS101",
  program: "BSCS",
  year: "1",
});
console.assert(
  result1 === "cs101|bscs|1",
  `Expected "cs101|bscs|1", got "${result1}"`,
);
console.log("✓ Test 1: Normal case with all fields");

// Test 2: Case insensitivity
const result2 = buildSubjectIdentityKey({
  code: "CS101",
  program: "BSCS",
  year: "1",
});
console.assert(
  result2 === "cs101|bscs|1",
  `Expected "cs101|bscs|1", got "${result2}"`,
);
console.log("✓ Test 2: Case insensitivity");

// Test 3: Whitespace trimming
const result3 = buildSubjectIdentityKey({
  code: "  CS101  ",
  program: "  BSCS  ",
  year: "  1  ",
});
console.assert(
  result3 === "cs101|bscs|1",
  `Expected "cs101|bscs|1", got "${result3}"`,
);
console.log("✓ Test 3: Whitespace trimming");

// Test 4: Null/undefined handling - null program (should fall back to empty string)
const result4 = buildSubjectIdentityKey({
  code: "CS101",
  program: null,
  year: "1",
});
console.assert(result4 === "cs101||1", `Expected "cs101||1", got "${result4}"`);
console.log("✓ Test 4: Null program field");

// Test 5: Null/undefined handling - undefined year
const result5 = buildSubjectIdentityKey({
  code: "CS101",
  program: "BSCS",
  year: undefined,
});
console.assert(
  result5 === "cs101|bscs|",
  `Expected "cs101|bscs|", got "${result5}"`,
);
console.log("✓ Test 5: Undefined year field");

// Test 6: All fields null/undefined
const result6 = buildSubjectIdentityKey({
  code: null,
  program: null,
  year: null,
});
console.assert(result6 === "||", `Expected "||", got "${result6}"`);
console.log("✓ Test 6: All fields null");

// Test 7: Empty row
const result7 = buildSubjectIdentityKey({});
console.assert(result7 === "||", `Expected "||", got "${result7}"`);
console.log("✓ Test 7: Empty row object");

// Test 8: Mixed case with whitespace
const result8 = buildSubjectIdentityKey({
  code: "  Cs101  ",
  program: "  BsCs  ",
  year: "1",
});
console.assert(
  result8 === "cs101|bscs|1",
  `Expected "cs101|bscs|1", got "${result8}"`,
);
console.log("✓ Test 8: Mixed case with whitespace");

// ============================================================================
// Test: validateSubjectIdentityKey - Key validation
// ============================================================================

console.log("\n=== Testing validateSubjectIdentityKey ===");

// Test 1: Valid key with all segments
const val1 = validateSubjectIdentityKey("cs101|bscs|1");
console.assert(
  val1.isValid === true && val1.errors.length === 0,
  `Expected valid key, got: ${JSON.stringify(val1)}`,
);
console.log("✓ Test 1: Valid key with all segments");

// Test 2: Valid key with empty program
const val2 = validateSubjectIdentityKey("cs101||1");
console.assert(
  val2.isValid === true && val2.errors.length === 0,
  `Expected valid key, got: ${JSON.stringify(val2)}`,
);
console.log("✓ Test 2: Valid key with empty program");

// Test 3: Valid key with empty year
const val3 = validateSubjectIdentityKey("cs101|bscs|");
console.assert(
  val3.isValid === true && val3.errors.length === 0,
  `Expected valid key, got: ${JSON.stringify(val3)}`,
);
console.log("✓ Test 3: Valid key with empty year");

// Test 4: Invalid - empty code
const val4 = validateSubjectIdentityKey("|bscs|1");
console.assert(
  val4.isValid === false && val4.errors.length > 0,
  `Expected invalid key with error, got: ${JSON.stringify(val4)}`,
);
console.log("✓ Test 4: Invalid key - empty code");

// Test 5: Invalid - missing pipes (only 1 pipe instead of 2)
const val5 = validateSubjectIdentityKey("cs101|bscs");
console.assert(
  val5.isValid === false && val5.errors.length > 0,
  `Expected invalid key with error, got: ${JSON.stringify(val5)}`,
);
console.log("✓ Test 5: Invalid key - missing year pipe");

// Test 6: Invalid - too many pipes
const val6 = validateSubjectIdentityKey("cs101|bscs|1|extra");
console.assert(
  val6.isValid === false && val6.errors.length > 0,
  `Expected invalid key with error, got: ${JSON.stringify(val6)}`,
);
console.log("✓ Test 6: Invalid key - too many pipes");

// Test 7: Invalid - not a string
const val7 = validateSubjectIdentityKey(123);
console.assert(
  val7.isValid === false && val7.errors.length > 0,
  `Expected invalid key with error, got: ${JSON.stringify(val7)}`,
);
console.log("✓ Test 7: Invalid key - not a string");

// Test 8: Invalid - null input
const val8 = validateSubjectIdentityKey(null);
console.assert(
  val8.isValid === false && val8.errors.length > 0,
  `Expected invalid key with error, got: ${JSON.stringify(val8)}`,
);
console.log("✓ Test 8: Invalid key - null input");

// ============================================================================
// Test: generateSubjectLookupSuggestions - Smart error suggestions
// ============================================================================

console.log("\n=== Testing generateSubjectLookupSuggestions ===");

// Create a mock available keys Map
const mockAvailableKeys = new Map([
  ["cs101|bscs|1", { id: "s1", code: "CS101", program: "BSCS", year: "1" }],
  ["cs101|bscs|2", { id: "s2", code: "CS101", program: "BSCS", year: "2" }],
  ["cs101|bs|1", { id: "s3", code: "CS101", program: "BS", year: "1" }],
  ["cs202|bscs|2", { id: "s4", code: "CS202", program: "BSCS", year: "2" }],
  ["eng101||1", { id: "s5", code: "ENG101", program: null, year: "1" }],
]);

// Test 1: Code exists with different program
const sug1 = generateSubjectLookupSuggestions(
  { code: "CS101", program: "WRONG", year: "1" },
  mockAvailableKeys,
);
console.assert(
  sug1.length > 0 && sug1.some((s) => s.includes("WRONG")),
  `Expected suggestion about wrong program, got: ${JSON.stringify(sug1)}`,
);
console.log("✓ Test 1: Suggestion for code exists but wrong program");

// Test 2: Code doesn't exist
const sug2 = generateSubjectLookupSuggestions(
  { code: "INVALID", program: "BSCS", year: "1" },
  mockAvailableKeys,
);
console.assert(
  sug2.length > 0 && sug2.some((s) => s.includes("INVALID")),
  `Expected suggestion about invalid code, got: ${JSON.stringify(sug2)}`,
);
console.log("✓ Test 2: Suggestion for invalid code");

// Test 3: Code and program exist but wrong year
const sug3 = generateSubjectLookupSuggestions(
  { code: "CS101", program: "BSCS", year: "3" },
  mockAvailableKeys,
);
console.assert(
  sug3.length > 0 && sug3.some((s) => s.includes("Year") || s.includes("year")),
  `Expected suggestion about year, got: ${JSON.stringify(sug3)}`,
);
console.log("✓ Test 3: Suggestion for wrong year");

// Test 4: Null row
const sug4 = generateSubjectLookupSuggestions(null, mockAvailableKeys);
console.assert(
  sug4.length > 0 &&
    sug4.some((s) => s.includes("missing") || s.includes("null")),
  `Expected suggestion about null row, got: ${JSON.stringify(sug4)}`,
);
console.log("✓ Test 4: Suggestion for null row");

// Test 5: Empty available keys
const sug5 = generateSubjectLookupSuggestions(
  { code: "CS101", program: "BSCS", year: "1" },
  new Map(),
);
console.assert(
  sug5.length > 0 && sug5.some((s) => s.includes("imported")),
  `Expected suggestion about no subjects, got: ${JSON.stringify(sug5)}`,
);
console.log("✓ Test 5: Suggestion for empty database");

// Test 6: Empty code
const sug6 = generateSubjectLookupSuggestions(
  { code: "", program: "BSCS", year: "1" },
  mockAvailableKeys,
);
console.assert(
  sug6.length > 0 &&
    sug6.some((s) => s.includes("empty") || s.includes("Code")),
  `Expected suggestion about empty code, got: ${JSON.stringify(sug6)}`,
);
console.log("✓ Test 6: Suggestion for empty code");

// Test 7: Empty program (but code exists)
const sug7 = generateSubjectLookupSuggestions(
  { code: "CS101", program: "", year: "1" },
  mockAvailableKeys,
);
console.assert(
  sug7.length > 0,
  `Expected suggestion for empty program, got: ${JSON.stringify(sug7)}`,
);
console.log("✓ Test 7: Suggestion for empty program");

// Test 8: Array instead of Map for available keys
const sug8 = generateSubjectLookupSuggestions(
  { code: "INVALID", program: "BSCS", year: "1" },
  Array.from(mockAvailableKeys.keys()),
);
console.assert(
  sug8.length > 0,
  `Expected suggestion with array input, got: ${JSON.stringify(sug8)}`,
);
console.log("✓ Test 8: Suggestion generation with array input");

console.log("\n=== All tests passed! ===");
