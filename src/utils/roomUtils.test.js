import { describe, it, expect } from "vitest";
import { isValidRoomNumber, validateRoomPayload } from "./roomUtils";

describe("roomUtils - Room Number Validation", () => {
  describe("isValidRoomNumber", () => {
    describe("Standard format [LCR]### - VALID", () => {
      it("should accept L-wing rooms (L101, L200, L999)", () => {
        expect(isValidRoomNumber("L101")).toBe(true);
        expect(isValidRoomNumber("l101")).toBe(true); // lowercase should be converted to uppercase
        expect(isValidRoomNumber("L200")).toBe(true);
        expect(isValidRoomNumber("L999")).toBe(true);
      });

      it("should accept C-wing rooms (C101, C200, C999)", () => {
        expect(isValidRoomNumber("C101")).toBe(true);
        expect(isValidRoomNumber("c101")).toBe(true);
        expect(isValidRoomNumber("C202")).toBe(true);
        expect(isValidRoomNumber("C999")).toBe(true);
      });

      it("should accept R-wing rooms (R101, R200, R999)", () => {
        expect(isValidRoomNumber("R101")).toBe(true);
        expect(isValidRoomNumber("r101")).toBe(true);
        expect(isValidRoomNumber("R315")).toBe(true);
        expect(isValidRoomNumber("R999")).toBe(true);
      });
    });

    describe("Standard format - INVALID", () => {
      it("should reject wrong wing prefix", () => {
        expect(isValidRoomNumber("A101")).toBe(false);
        expect(isValidRoomNumber("B101")).toBe(false);
        expect(isValidRoomNumber("X101")).toBe(false);
      });

      it("should reject malformed attempts (missing or extra digits)", () => {
        expect(isValidRoomNumber("L10")).toBe(false); // too few digits
        expect(isValidRoomNumber("C20")).toBe(false); // too few digits
        expect(isValidRoomNumber("R1")).toBe(false); // too few digits
        expect(isValidRoomNumber("L1010")).toBe(false); // too many digits
        expect(isValidRoomNumber("L001")).toBe(true); // valid - leading zeros allowed
      });
    });

    describe("Non-standard format - VALID", () => {
      it("should accept descriptive room names (letters only)", () => {
        expect(isValidRoomNumber("Accreditation")).toBe(true);
        expect(isValidRoomNumber("accreditation")).toBe(true);
        expect(isValidRoomNumber("AVR")).toBe(true);
        expect(isValidRoomNumber("CISCO")).toBe(true);
        expect(isValidRoomNumber("AV")).toBe(true); // at least 1 char
      });

      it("should accept names with numbers", () => {
        expect(isValidRoomNumber("Lab1")).toBe(true);
        expect(isValidRoomNumber("Room2")).toBe(true);
        expect(isValidRoomNumber("AVR2024")).toBe(true);
      });

      it("should accept names with spaces and hyphens", () => {
        expect(isValidRoomNumber("Accreditation Room")).toBe(true);
        expect(isValidRoomNumber("AVR Lab")).toBe(true);
        expect(isValidRoomNumber("CISCO-1")).toBe(true);
        expect(isValidRoomNumber("Test Room 1")).toBe(true);
        expect(isValidRoomNumber("A-B-C")).toBe(true);
      });

      it("should accept names up to 50 characters", () => {
        const fiftyChars = "A".repeat(50);
        expect(isValidRoomNumber(fiftyChars)).toBe(true);

        const fiftyOneChars = "A".repeat(51);
        expect(isValidRoomNumber(fiftyOneChars)).toBe(false);
      });
    });

    describe("Non-standard format - INVALID", () => {
      it("should reject empty or whitespace-only strings", () => {
        expect(isValidRoomNumber("")).toBe(false);
        expect(isValidRoomNumber("   ")).toBe(false);
      });

      it("should reject names exceeding 50 characters", () => {
        const tooLong = "A".repeat(51);
        expect(isValidRoomNumber(tooLong)).toBe(false);
      });

      it("should reject special characters not allowed", () => {
        expect(isValidRoomNumber("Room@123")).toBe(false);
        expect(isValidRoomNumber("Room#1")).toBe(false);
        expect(isValidRoomNumber("Room$A")).toBe(false);
        expect(isValidRoomNumber("Room.1")).toBe(false);
        expect(isValidRoomNumber("Room/1")).toBe(false);
        expect(isValidRoomNumber("Room&1")).toBe(false);
      });
    });
  });

  describe("validateRoomPayload", () => {
    describe("Standard format rooms", () => {
      it("should validate standard room (L101) with auto-inferred wing", () => {
        const payload = {
          number: "L101",
          type: "Lecture Hall",
          capacity: 50,
          status: "Available",
          wing: null,
        };
        expect(validateRoomPayload(payload)).toBeNull();
      });

      it("should validate standard room with explicit wing override", () => {
        const payload = {
          number: "L101",
          type: "Lecture Hall",
          capacity: 50,
          status: "Available",
          wing: "C", // explicitly set to different wing
        };
        expect(validateRoomPayload(payload)).toBeNull();
      });
    });

    describe("Non-standard format rooms", () => {
      it("should validate non-standard room without wing (nullable)", () => {
        const payload = {
          number: "Accreditation",
          type: "Laboratory",
          capacity: 30,
          status: "Available",
          wing: null,
        };
        expect(validateRoomPayload(payload)).toBeNull();
      });

      it("should validate non-standard room with manual wing assignment", () => {
        const payload = {
          number: "AVR",
          type: "Lecture Hall",
          capacity: 45,
          status: "Available",
          wing: "C",
        };
        expect(validateRoomPayload(payload)).toBeNull();
      });

      it("should validate non-standard room with space and hyphen in name", () => {
        const payload = {
          number: "CISCO Lab-1",
          type: "Laboratory",
          capacity: 25,
          status: "Available",
          wing: "R",
        };
        expect(validateRoomPayload(payload)).toBeNull();
      });

      it("should reject non-standard room with invalid wing", () => {
        const payload = {
          number: "Accreditation",
          type: "Lecture Hall",
          capacity: 50,
          status: "Available",
          wing: "X", // invalid wing
        };
        const error = validateRoomPayload(payload);
        expect(error).not.toBeNull();
        expect(error).toContain("Wing must be one of");
      });

      it("should reject invalid room number", () => {
        const payload = {
          number: "Invalid@Room",
          type: "Lecture Hall",
          capacity: 50,
          status: "Available",
          wing: null,
        };
        const error = validateRoomPayload(payload);
        expect(error).not.toBeNull();
        expect(error).toContain("Room number must match pattern");
      });

      it("should reject room number exceeding 50 characters", () => {
        const payload = {
          number: "A".repeat(51),
          type: "Lecture Hall",
          capacity: 50,
          status: "Available",
          wing: null,
        };
        const error = validateRoomPayload(payload);
        expect(error).not.toBeNull();
        expect(error).toContain("Room number must match pattern");
      });
    });

    describe("Error messages", () => {
      it("should provide helpful error message for invalid room number", () => {
        const payload = {
          number: "Invalid@",
          type: "Lecture Hall",
          capacity: 50,
          status: "Available",
          wing: null,
        };
        const error = validateRoomPayload(payload);
        expect(error).toContain("[LCR]###");
        expect(error).toContain("Accreditation");
        expect(error).toContain("AVR");
        expect(error).toContain("CISCO");
      });
    });
  });
});
