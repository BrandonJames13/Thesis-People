import { useEffect, useMemo, useState } from "react";
import Modal from "./Modal";
import { useData } from "../../context/DataContext";
import { useNotification } from "../../context/NotificationContext";
import { supabase } from "../../lib/supabaseClient";
import {
  detectSpecialRoomType,
  getDefaultRoomCapacity,
  normalizeDepartment,
} from "../../data/constants";
import { getWingFromRoomInput } from "../../utils/roomUtils";
import {
  buildDatabaseErrorMessage,
  isCheckViolation,
  isForeignKeyViolation,
  isNotNullViolation,
  isRlsViolation,
  isUniqueViolation,
  normalizePostgresError,
} from "../../utils/errorUtils";
import {
  buildSectionIdentityKey,
  buildSubjectIdentityKey,
  validateSubjectIdentityKey,
  generateSubjectLookupSuggestions,
  CSV_TYPE_OPTIONS,
  CSV_TYPES,
  downloadCsvTemplate,
  getCsvTypeConfig,
  isNightClassFromTime,
  parseImportCsv,
  normalizeSectionStatusForDb,
  summarizeImportedRows,
} from "../../utils/exportUtils";

async function readFileText(file) {
  return file.text();
}

function normalizeLookupKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function dedupeByKey(rows, keyFn) {
  const seen = new Set();
  const deduped = [];

  (rows ?? []).forEach((row) => {
    const key = normalizeLookupKey(keyFn(row));
    if (!key || seen.has(key)) return;
    seen.add(key);
    deduped.push(row);
  });

  return deduped;
}

export default function ImportModal({ isOpen, onClose }) {
  const { resetAllData } = useData();
  const { showNotification } = useNotification();

  const [source, setSource] = useState("upload");
  const [importType, setImportType] = useState(CSV_TYPES.FULL_LIST);
  const [localFile, setLocalFile] = useState(null);
  const [repoFiles, setRepoFiles] = useState([]);
  const [selectedRepoPath, setSelectedRepoPath] = useState("");
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showValidationLogs, setShowValidationLogs] = useState(false);
  const [expandedLogSections, setExpandedLogSections] = useState({
    matched: true,
    skipped: true,
    errors: true,
  });

  const selectedTypeConfig = useMemo(
    () => getCsvTypeConfig(importType),
    [importType],
  );

  const repoFilesForType = useMemo(() => {
    return repoFiles.filter((item) => !item.type || item.type === importType);
  }, [repoFiles, importType]);

  const selectedRepoItem = useMemo(
    () => repoFilesForType.find((f) => f.path === selectedRepoPath),
    [repoFilesForType, selectedRepoPath],
  );

  useEffect(() => {
    if (!isOpen) return;
    let mounted = true;

    async function loadRepoManifest() {
      try {
        const response = await fetch("/csv/index.json");
        if (!response.ok) throw new Error("Unable to read csv index manifest.");
        const data = await response.json();
        if (!mounted) return;

        const files = Array.isArray(data?.files) ? data.files : [];
        setRepoFiles(files);
      } catch {
        if (!mounted) return;
        setRepoFiles([]);
      }
    }

    loadRepoManifest();

    return () => {
      mounted = false;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setParsed(null);
    setShowValidationLogs(false);
    setError("");
    setLocalFile(null);
    setSource("upload");
    setImportType(CSV_TYPES.FULL_LIST);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (repoFilesForType.length === 0) {
      setSelectedRepoPath("");
      return;
    }
    if (!repoFilesForType.some((item) => item.path === selectedRepoPath)) {
      setSelectedRepoPath(repoFilesForType[0].path);
    }
  }, [isOpen, repoFilesForType, selectedRepoPath]);

  const parseCsvText = async () => {
    setIsParsing(true);
    setError("");
    setParsed(null);

    try {
      let text = "";

      if (source === "upload") {
        if (!localFile) {
          throw new Error("Please choose a CSV file to import.");
        }
        text = await readFileText(localFile);
      } else {
        if (!selectedRepoPath) {
          throw new Error("Please choose a repository CSV file.");
        }
        const response = await fetch(selectedRepoPath);
        if (!response.ok) {
          throw new Error("Failed to fetch selected repository CSV file.");
        }
        text = await response.text();
      }

      const payload = parseImportCsv(text, importType);
      setParsed(payload);
    } catch (err) {
      setError(err.message || "Unable to parse CSV file.");
    } finally {
      setIsParsing(false);
    }
  };

  const toNormalizedError = (err, fallbackMessage, context = {}) => {
    const normalized = normalizePostgresError(err, fallbackMessage);
    const { userMessage } = buildDatabaseErrorMessage(err, {
      fallbackMessage,
      ...context,
    });

    const wrappedError = new Error(userMessage || normalized.message);
    wrappedError.code = normalized.code;
    wrappedError.details = normalized.details;
    wrappedError.hint = normalized.hint;
    wrappedError.constraint = normalized.constraint;
    wrappedError.column = normalized.column;
    wrappedError.table = normalized.table;
    return wrappedError;
  };

  const buildRlsError = (err, tableName = null, action = "write") => {
    const rlsError = toNormalizedError(
      err,
      "Permission denied by row-level security.",
      {
        operation: action,
        table: tableName,
      },
    );

    rlsError.message = `${rlsError.message} Ask an admin to update RLS policies or use an authorized account. Recommended fix: run supabase/snippets/fix_import_rls.sql in Supabase SQL Editor.`;
    return rlsError;
  };

  const isSubjectsCodeProgramUniqueViolation = (err) => {
    if (!isUniqueViolation(err)) return false;
    const message = `${err.message ?? ""} ${err.details ?? ""}`.toLowerCase();
    return message.includes("subjects_code_program_unique");
  };

  const dedupeSubjectsByCodeProgram = (rows) => {
    const sourceRows = Array.isArray(rows) ? rows : [];

    // Last-row-wins for duplicate code+program rows in one import batch.
    return dedupeByKey(
      [...sourceRows].reverse(),
      (row) => `${row?.code ?? ""}|${row?.program ?? ""}`,
    ).reverse();
  };

  const upsertRows = async (
    table,
    rows,
    onConflict,
    fallbackMessage,
    select = "*",
  ) => {
    if (!Array.isArray(rows) || rows.length === 0) {
      return [];
    }

    const rowsToUpsert =
      table === "subjects" ? dedupeSubjectsByCodeProgram(rows) : rows;

    const { data, error } = await supabase
      .from(table)
      .upsert(rowsToUpsert, { onConflict })
      .select(select);

    if (
      error &&
      table === "subjects" &&
      onConflict !== "code,program,year" &&
      isSubjectsCodeProgramUniqueViolation(error)
    ) {
      const retryRows = dedupeSubjectsByCodeProgram(rowsToUpsert);
      const { data: retryData, error: retryError } = await supabase
        .from(table)
        .upsert(retryRows, { onConflict: "code,program,year" })
        .select(select);

      if (!retryError) {
        return retryData ?? [];
      }

      const normalizedRetryError = toNormalizedError(
        retryError,
        "Unable to import subjects. Duplicate subject code+program rows conflicted with existing records.",
        {
          operation: "write",
          table,
        },
      );
      throw normalizedRetryError;
    }

    if (error) {
      if (isRlsViolation(error)) {
        throw buildRlsError(error, table, "write");
      }

      if (table === "subjects" && isSubjectsCodeProgramUniqueViolation(error)) {
        const normalizedSubjectsError = toNormalizedError(
          error,
          "Unable to import subjects. Duplicate Subject Code + Program records were detected. Keep only one row per code/program in the import batch.",
          {
            operation: "write",
            table,
          },
        );
        throw normalizedSubjectsError;
      }

      throw toNormalizedError(error, fallbackMessage, {
        operation: "write",
        table,
      });
    }

    return data ?? [];
  };

  const fetchExistingRows = async (table, column, values) => {
    const uniqueValues = Array.from(
      new Set(
        (values ?? [])
          .map((value) => String(value ?? "").trim())
          .filter(Boolean),
      ),
    );

    if (uniqueValues.length === 0) {
      return [];
    }

    const { data, error } = await supabase
      .from(table)
      .select("*")
      .in(column, uniqueValues);

    if (error) {
      if (isRlsViolation(error)) {
        throw buildRlsError(error, table, "read");
      }

      throw toNormalizedError(error, `Unable to load existing ${table}.`, {
        operation: "read",
        table,
      });
    }

    return data ?? [];
  };

  const importRooms = async (payload) => {
    const dbRows = Array.isArray(payload?.dbRows) ? payload.dbRows : [];
    if (dbRows.length === 0) {
      throw new Error("No room rows were parsed for import.");
    }

    // Apply special room type detection
    const dbRowsWithDetection = dbRows.map((row) => {
      const detectedType = detectSpecialRoomType(row.number);
      return {
        ...row,
        type: detectedType || row.type,
      };
    });

    await upsertRows(
      "rooms",
      dbRowsWithDetection,
      "number",
      "Unable to import rooms.",
    );
  };

  const importInstructors = async (payload) => {
    const rawRows = Array.isArray(payload?.dbRows) ? payload.dbRows : [];
    const defaultRows = Array.isArray(payload?.dbRowsWithDefaults)
      ? payload.dbRowsWithDefaults
      : [];

    if (rawRows.length === 0) {
      throw new Error("No instructor rows were parsed for import.");
    }

    const importRows = async (rows) => {
      const names = rows.map((row) => row.name).filter(Boolean);
      const existing = await fetchExistingRows("instructors", "name", names);

      const existingByName = new Map(
        (existing ?? []).map((row) => [
          String(row.name).trim().toLowerCase(),
          row,
        ]),
      );

      const toInsert = [];
      const updateOps = [];

      rows.forEach((row) => {
        const key = String(row.name ?? "")
          .trim()
          .toLowerCase();
        const existingRow = existingByName.get(key);
        const payloadRow = {
          name: row.name,
          department: row.department,
          availability: row.availability,
          status: row.status,
          employment_status: row.employment_status ?? [],
          max_units: row.max_units ?? null,
          allow_night_class: row.allow_night_class ?? false,
        };

        if (!existingRow) {
          toInsert.push(payloadRow);
          return;
        }

        const updatePayload = {
          name: row.name,
          department: row.department,
          availability: row.availability,
          status: row.status,
          employment_status: row.employment_status_provided
            ? (row.employment_status ?? [])
            : (existingRow.employment_status ?? []),
          max_units: row.max_units_provided
            ? (row.max_units ?? null)
            : (existingRow.max_units ?? null),
          allow_night_class: row.allow_night_class_provided
            ? (row.allow_night_class ?? false)
            : (existingRow.allow_night_class ?? false),
        };

        updateOps.push(
          supabase
            .from("instructors")
            .update(updatePayload)
            .eq("id", existingRow.id),
        );
      });

      if (toInsert.length > 0) {
        await upsertRows(
          "instructors",
          toInsert,
          "name",
          "Unable to import instructors.",
        );
      }

      for (const op of updateOps) {
        const { error: updateError } = await op;
        if (updateError) {
          if (isRlsViolation(updateError)) {
            throw buildRlsError(updateError, "instructors", "update");
          }
          throw toNormalizedError(
            updateError,
            "Unable to update instructors.",
            {
              operation: "update",
              table: "instructors",
            },
          );
        }
      }
    };

    try {
      await importRows(rawRows);
    } catch (err) {
      if (!isNotNullViolation(err) || defaultRows.length === 0) {
        if (isRlsViolation(err)) {
          throw buildRlsError(err, "instructors", "write");
        }
        throw toNormalizedError(err, "Unable to import instructors.", {
          operation: "write",
          table: "instructors",
        });
      }
      await importRows(defaultRows);
    }
  };

  const importSubjectsAndSections = async (payload) => {
    const subjectRows = payload?.dbRows?.subjects ?? [];
    const sectionRows = payload?.dbRows?.subject_sections ?? [];

    if (subjectRows.length === 0 && sectionRows.length === 0) {
      throw new Error("No subject section rows were parsed for import.");
    }

    // PRE-IMPORT VALIDATION: Verify all subjects have non-empty required fields
    const invalidSubjects = subjectRows.filter(
      (row) =>
        !row.code ||
        !row.program ||
        !row.year ||
        row.code.includes("|") ||
        String(row.code ?? "").trim() === "",
    );

    if (invalidSubjects.length > 0) {
      const details = invalidSubjects
        .slice(0, 3)
        .map(
          (row) =>
            `code="${row.code}", program="${row.program}", year="${row.year}"`,
        )
        .join("; ");
      throw new Error(
        `Subject import validation failed. Found ${invalidSubjects.length} subjects with missing or invalid code/program/year. ` +
          `Examples: ${details}. ` +
          `Ensure all subjects have non-empty code, program, and year fields.`,
      );
    }

    if (subjectRows.length > 0) {
      await upsertRows(
        "subjects",
        subjectRows.map((row) => ({
          code: row.code,
          title: row.title,
          program: row.program,
          year: row.year,
          room_type: row.room_type,
          duration: row.duration,
        })),
        "code,program,year",
        "Unable to import subjects.",
      );
    }

    if (sectionRows.length === 0) {
      return;
    }

    const codes = Array.from(
      new Set(sectionRows.map((row) => row?.subject_ref?.code).filter(Boolean)),
    );

    const { data: subjectIndexRows, error: subjectIndexError } = await supabase
      .from("subjects")
      .select("id, code, program, year")
      .in("code", codes);

    if (subjectIndexError) {
      throw toNormalizedError(
        subjectIndexError,
        "Unable to map imported sections to subjects.",
        {
          operation: "read",
          table: "subjects",
        },
      );
    }

    const subjectIdByIdentity = new Map(
      (subjectIndexRows ?? []).map((row) => [
        buildSubjectIdentityKey(row),
        row.id,
      ]),
    );

    // DEBUG LOGGING: Show available keys in database
    if (subjectIdByIdentity.size > 0) {
      const availableKeys = Array.from(subjectIdByIdentity.keys()).slice(0, 5);
      console.debug(
        "[ImportSubjects] Available subject keys in database (first 5):",
        availableKeys,
      );
    }

    const sectionUpsertRows = sectionRows
      .map((row) => {
        const lookupKey = buildSubjectIdentityKey(row?.subject_ref);
        const subjectId = subjectIdByIdentity.get(lookupKey);

        // DEBUG LOGGING: Log lookup details for troubleshooting
        if (!subjectId) {
          const rawValues = row?.subject_ref || {};
          console.warn("[ImportSubjects] Subject NOT FOUND - Lookup Details:", {
            constructedKey: lookupKey,
            rawCode: rawValues.code,
            rawProgram: rawValues.program,
            rawYear: rawValues.year,
            availableKeysCount: subjectIdByIdentity.size,
          });
        }

        if (!subjectId) return null;

        return {
          ...(row.id ? { id: row.id } : {}),
          subject_id: subjectId,
          section: row.section,
          enrolled: row.enrolled,
          status: row.status,
          academic_year: row.academic_year,
          semester: row.semester,
        };
      })
      .filter(Boolean);

    if (sectionUpsertRows.length === 0) {
      // Enhanced error message with helpful details
      const failedLookups = sectionRows.filter((row) => {
        const key = buildSubjectIdentityKey(row?.subject_ref);
        return !subjectIdByIdentity.has(key);
      });

      const failedDetails = failedLookups
        .slice(0, 3)
        .map((row) => {
          const ref = row?.subject_ref || {};
          return `code="${ref.code}", program="${ref.program}", year="${ref.year}"`;
        })
        .join("; ");

      const availableSample = Array.from(subjectIdByIdentity.keys())
        .slice(0, 5)
        .join(", ");

      throw new Error(
        `No subject sections could be matched to subjects. ` +
          `Failed to find ${failedLookups.length} sections. ` +
          `Examples: ${failedDetails}. ` +
          `Available subjects in database: ${availableSample || "(none imported yet)"}. ` +
          `Check that subject code, program, and year values match between import and database. ` +
          `Verify program values are correctly spelled (e.g., "WMA" not "wma").`,
      );
    }

    await upsertRows(
      "subject_sections",
      sectionUpsertRows,
      "subject_id,section,academic_year,semester",
      "Unable to import subject sections.",
    );

    // Assign instructors to subject sections with time data
    const instructorSections = Array.isArray(
      payload?.dbRows?.instructorSections,
    )
      ? payload.dbRows.instructorSections
      : [];

    if (instructorSections.length > 0) {
      const instructorNames = Array.from(
        new Set(
          instructorSections
            .map((row) => String(row.instructor ?? "").trim())
            .filter(Boolean),
        ),
      );

      const existingInstructors = await fetchExistingRows(
        "instructors",
        "name",
        instructorNames,
      );

      const instructorByName = new Map(
        existingInstructors.map((row) => [normalizeLookupKey(row.name), row]),
      );

      // Get existing sections to map to section_id
      const subjectSectionRows =
        sectionUpsertRows.length > 0
          ? await supabase
              .from("subject_sections")
              .select("id, subject_id, section, academic_year, semester")
          : { data: [], error: null };

      if (subjectSectionRows.error) {
        throw toNormalizedError(
          subjectSectionRows.error,
          "Unable to fetch subject sections for instructor assignment.",
          {
            operation: "read",
            table: "subject_sections",
          },
        );
      }

      // Build map of subject reference to section_id
      const sectionIdByRef = new Map(
        (subjectSectionRows.data ?? []).map((row) => [
          `${row.subject_id}::${row.section}::${row.academic_year}::${row.semester}`,
          row.id,
        ]),
      );

      const instructorSectionUpsertRows = instructorSections
        .map((row) => {
          const instructorName = String(row.instructor ?? "").trim();
          if (!instructorName) return null;

          const instructor = instructorByName.get(
            normalizeLookupKey(instructorName),
          );
          if (!instructor) {
            console.warn(
              `Skipping instructor section: instructor "${instructorName}" not found.`,
            );
            return null;
          }

          const subjectKey = buildSubjectIdentityKey(row?.subject_ref);
          const subjectId = subjectIdByIdentity.get(subjectKey);
          if (!subjectId) {
            console.warn(
              `Skipping instructor section: subject not found for ${subjectKey}.`,
            );
            return null;
          }

          const sectionRef = `${subjectId}::${row.section}::${row.academic_year}::${row.semester}`;
          const sectionId = sectionIdByRef.get(sectionRef);
          if (!sectionId) {
            console.warn(
              `Skipping instructor section: section not found for ${sectionRef}.`,
            );
            return null;
          }

          // Time fields are required by the database schema
          if (!row.time_start || !row.time_end) {
            console.warn(
              `Skipping instructor section for "${instructorName}" and section "${row.section}" (${row.academic_year} ${row.semester}): time data not provided in CSV. Provide a "Time" column with format "HH:MM - HH:MM" or use Schedule import to add time assignments separately.`,
            );
            return null;
          }

          return {
            instructor_id: instructor.id,
            section_id: sectionId,
            time_start: row.time_start,
            time_end: row.time_end,
            academic_year: row.academic_year,
            semester: row.semester,
          };
        })
        .filter(Boolean);

      if (instructorSectionUpsertRows.length > 0) {
        await upsertRows(
          "instructor_subject_sections",
          instructorSectionUpsertRows,
          "instructor_id,section_id",
          "Unable to import instructor subject sections.",
        );
      }
    }
  };

  const importSchedule = async (payload) => {
    const dbRows = Array.isArray(payload?.dbRows) ? payload.dbRows : [];

    if (dbRows.length === 0) {
      throw new Error("No schedule assignment rows were parsed for import.");
    }

    // Fetch all subjects codes, room numbers, and instructor names to resolve lookups
    const subjectCodes = Array.from(
      new Set(dbRows.map((row) => row?.subject_code).filter(Boolean)),
    );
    const roomNumbers = Array.from(
      new Set(dbRows.map((row) => row?.room_number).filter(Boolean)),
    );
    const instructorNames = Array.from(
      new Set(dbRows.map((row) => row?.instructor_name).filter(Boolean)),
    );

    // Query for existing data to resolve foreign keys
    // Note: .in() handles empty arrays gracefully, but we build queries safely
    const subjectPromise =
      subjectCodes.length > 0
        ? supabase
            .from("subjects")
            .select("id, code, program, year")
            .in("code", subjectCodes)
        : Promise.resolve({ data: [], error: null });

    const roomPromise =
      roomNumbers.length > 0
        ? supabase.from("rooms").select("id, number").in("number", roomNumbers)
        : Promise.resolve({ data: [], error: null });

    const instructorPromise =
      instructorNames.length > 0
        ? supabase
            .from("instructors")
            .select("id, name, allow_night_class")
            .in("name", instructorNames)
        : Promise.resolve({ data: [], error: null });

    const [subjectRows, roomRows, instructorRows, subjectSectionRows] =
      await Promise.all([
        subjectPromise,
        roomPromise,
        instructorPromise,
        supabase
          .from("subject_sections")
          .select("id, subject_id, section, academic_year, semester"),
      ]);

    // Handle query errors
    if (
      subjectRows.error ||
      roomRows.error ||
      instructorRows.error ||
      subjectSectionRows.error
    ) {
      const failedTable = subjectRows.error
        ? "subjects"
        : roomRows.error
          ? "rooms"
          : instructorRows.error
            ? "instructors"
            : "subject_sections";

      throw toNormalizedError(
        subjectRows.error ||
          roomRows.error ||
          instructorRows.error ||
          subjectSectionRows.error,
        `Unable to load existing ${failedTable} for schedule import.`,
        {
          operation: "read",
          table: failedTable,
        },
      );
    }

    // Build lookup maps
    const subjectByCode = new Map(
      (subjectRows.data ?? []).map((row) => [
        normalizeLookupKey(row.code),
        row,
      ]),
    );

    const roomByNumber = new Map(
      (roomRows.data ?? []).map((row) => [normalizeLookupKey(row.number), row]),
    );

    const instructorByName = new Map(
      (instructorRows.data ?? []).map((row) => [
        normalizeLookupKey(row.name),
        row,
      ]),
    );

    // Night class eligibility validation disabled during import to allow assignment
    // of night classes regardless of instructor allow_night_class flag
    // const nightClassViolations = [];
    // dbRows.forEach((row, index) => {
    //   if (!row?.instructor_name || !isNightClassFromTime(row?.time_display)) {
    //     return;
    //   }
    //
    //   const instructor = instructorByName.get(
    //     normalizeLookupKey(row.instructor_name),
    //   );
    //   if (!instructor) return;
    //   if (instructor.allow_night_class) return;
    //
    //   nightClassViolations.push(
    //     `Schedule row ${index + 2}: ${row.instructor_name} is not eligible for night classes (${row.time_display}).`,
    //   );
    // });
    //
    // if (nightClassViolations.length > 0) {
    //   throw new Error(nightClassViolations.join(" "));
    // }

    // Build section lookup by composite key: (subject_id, section, academic_year, semester)
    const sectionByCompositeKey = new Map(
      (subjectSectionRows.data ?? []).map((row) => [
        `${normalizeLookupKey(row.subject_id)}|${normalizeLookupKey(row.section)}|${normalizeLookupKey(row.academic_year)}|${normalizeLookupKey(row.semester)}`,
        row,
      ]),
    );

    // Transform dbRows into schedule_assignments upsert rows
    const scheduleUpsertRows = dbRows
      .map((row) => {
        const subject = subjectByCode.get(normalizeLookupKey(row.subject_code));
        if (!subject) {
          return null; // Skip rows where subject cannot be resolved
        }

        const section = sectionByCompositeKey.get(
          `${normalizeLookupKey(subject.id)}|${normalizeLookupKey(row.section)}|${normalizeLookupKey(row.academic_year)}|${normalizeLookupKey(row.semester)}`,
        );
        if (!section) {
          return null; // Skip rows where section cannot be resolved
        }

        const room = row.room_number
          ? roomByNumber.get(normalizeLookupKey(row.room_number))
          : null;

        const instructor = row.instructor_name
          ? instructorByName.get(normalizeLookupKey(row.instructor_name))
          : null;

        return {
          section_id: section.id,
          subject_id: subject.id,
          room_id: room?.id ?? null,
          instructor_id: instructor?.id ?? null,
          subject_code: row.subject_code,
          section: row.section,
          academic_year: row.academic_year,
          semester: row.semester,
          pattern: row.pattern,
          time_display: row.time_display,
          time_start: row.time_start || null,
          time_end: row.time_end || null,
          status: row.status,
        };
      })
      .filter(Boolean);

    if (scheduleUpsertRows.length === 0) {
      throw new Error(
        "No schedule assignments could be matched to existing subject sections, rooms, or instructors. Ensure subjects, sections, rooms, and instructors exist before importing schedule assignments.",
      );
    }

    await upsertRows(
      "schedule_assignments",
      scheduleUpsertRows,
      "section_id,academic_year,semester",
      "Unable to import schedule assignments.",
    );
  };

  const importFullList = async (payload) => {
    const sourceRows = Array.isArray(payload?.rows) ? payload.rows : [];
    const payloadDbRows = payload?.dbRows;

    // Handle both old array format and new object format for dbRows
    let scheduleDbRows = [];

    if (Array.isArray(payloadDbRows)) {
      // Old format: dbRows is an array of schedule assignments
      scheduleDbRows = payloadDbRows;
    } else if (payloadDbRows && typeof payloadDbRows === "object") {
      // New format: dbRows is an object with scheduleAssignments and instructorSections
      scheduleDbRows = Array.isArray(payloadDbRows.scheduleAssignments)
        ? payloadDbRows.scheduleAssignments
        : [];
    }

    if (sourceRows.length === 0 || scheduleDbRows.length === 0) {
      throw new Error("No full list rows were parsed for import.");
    }

    const subjectSourceRows = dedupeByKey(sourceRows, (row) =>
      buildSubjectIdentityKey(row),
    ).map((row) => ({
      code: row.code,
      title: row.title,
      program: row.program,
      year: row.year,
      room_type: row.roomType,
      duration: Number(row.duration ?? 1.5),
    }));

    const roomSourceRows = dedupeByKey(
      sourceRows.filter((row) => String(row.room ?? "").trim()),
      (row) => String(row.room ?? ""),
    );

    const instructorSourceRows = dedupeByKey(
      sourceRows.filter((row) => String(row.instructor ?? "").trim()),
      (row) => String(row.instructor ?? ""),
    ).map((row) => ({
      name: row.instructor,
      department: row.department ?? null,
      availability: null,
      status: "Active",
      employment_status: row.employment_status ?? null,
      max_units: row.max_units ?? null,
      allow_night_class: row.allow_night_class ?? false,
      employment_status_provided: !!row.employment_status_provided,
      max_units_provided: !!row.max_units_provided,
      allow_night_class_provided: !!row.allow_night_class_provided,
    }));

    const existingRooms = await fetchExistingRows(
      "rooms",
      "number",
      roomSourceRows.map((row) => row.room),
    );
    const existingRoomByNumber = new Map(
      existingRooms.map((row) => [normalizeLookupKey(row.number), row]),
    );

    const roomUpsertRows = roomSourceRows.map((row) => {
      const existing = existingRoomByNumber.get(normalizeLookupKey(row.room));
      const resolvedWing = getWingFromRoomInput(row.room).resolvedWing;
      const capacity =
        existing?.capacity ?? getDefaultRoomCapacity(row.roomType);
      const detectedType = detectSpecialRoomType(row.room);
      const resolvedType = detectedType || row.roomType;
      return existing
        ? {
            number: row.room,
            type: resolvedType,
            capacity,
            status: existing.status ?? "Available",
            wing: existing.wing ?? resolvedWing,
          }
        : {
            number: row.room,
            type: resolvedType,
            capacity,
            status: "Available",
            wing: resolvedWing,
          };
    });

    const existingInstructors = await fetchExistingRows(
      "instructors",
      "name",
      instructorSourceRows.map((row) => row.name),
    );
    const existingInstructorByName = new Map(
      existingInstructors.map((row) => [normalizeLookupKey(row.name), row]),
    );

    const instructorUpsertRows = instructorSourceRows.map((row) => {
      const existing = existingInstructorByName.get(
        normalizeLookupKey(row.name),
      );
      const normalizedDepartment = normalizeDepartment(
        existing?.department ?? row.department,
      );

      const resolvedEmploymentStatus = row.employment_status_provided
        ? (row.employment_status ?? [])
        : (existing?.employment_status ?? []);
      const resolvedMaxUnits = row.max_units_provided
        ? (row.max_units ?? null)
        : (existing?.max_units ?? null);
      const resolvedAllowNightClass = row.allow_night_class_provided
        ? (row.allow_night_class ?? false)
        : (existing?.allow_night_class ?? false);

      return {
        name: row.name,
        department: normalizedDepartment,
        availability: existing?.availability ?? row.availability,
        status: existing?.status ?? row.status,
        employment_status: resolvedEmploymentStatus,
        max_units: resolvedMaxUnits,
        allow_night_class: resolvedAllowNightClass,
      };
    });

    const subjectUpsertRows = subjectSourceRows.map((row) => ({
      code: row.code,
      title: row.title,
      program: row.program,
      year: row.year,
      room_type: row.room_type,
      duration: row.duration,
    }));

    const [importedRooms, importedInstructors, importedSubjects] =
      await Promise.all([
        upsertRows(
          "rooms",
          roomUpsertRows,
          "number",
          "Unable to import rooms.",
        ),
        upsertRows(
          "instructors",
          instructorUpsertRows,
          "name",
          "Unable to import instructors.",
        ),
        upsertRows(
          "subjects",
          subjectUpsertRows,
          "code,program,year",
          "Unable to import subjects.",
        ),
      ]);

    const subjectByKey = new Map(
      importedSubjects.map((row) => [buildSubjectIdentityKey(row), row]),
    );
    const roomByNumber = new Map(
      importedRooms.map((row) => [normalizeLookupKey(row.number), row]),
    );
    const instructorByName = new Map(
      importedInstructors.map((row) => [normalizeLookupKey(row.name), row]),
    );

    const sectionSourceRows = dedupeByKey(sourceRows, (row) =>
      buildSectionIdentityKey(row, { includeProgramYear: true }),
    );

    const sectionUpsertRows = sectionSourceRows
      .map((row) => {
        const subject = subjectByKey.get(buildSubjectIdentityKey(row));
        if (!subject) {
          return null;
        }

        return {
          subject_id: subject.id,
          section: row.section,
          enrolled: Number(row.enrolled ?? 0),
          status: normalizeSectionStatusForDb(row.status),
          academic_year: row.academicYear,
          semester: row.semester,
        };
      })
      .filter(Boolean);

    const importedSections = await upsertRows(
      "subject_sections",
      sectionUpsertRows,
      "subject_id,section,academic_year,semester",
      "Unable to import subject sections.",
    );

    const sectionById = new Map(
      importedSections.map((row) => [normalizeLookupKey(row.id), row]),
    );
    const sectionByKey = new Map(
      importedSections.map((row) => [
        `${normalizeLookupKey(row.subject_id)}|${normalizeLookupKey(row.section)}|${normalizeLookupKey(row.academic_year)}|${normalizeLookupKey(row.semester)}`,
        row,
      ]),
    );

    const scheduleUpsertRows = [];
    sourceRows.forEach((row, index) => {
      const scheduleRow = scheduleDbRows[index];
      if (!scheduleRow) return;

      const subject = subjectByKey.get(buildSubjectIdentityKey(row));
      const directSection = row.section_id
        ? sectionById.get(normalizeLookupKey(row.section_id))
        : null;
      const derivedSection = sectionByKey.get(
        `${normalizeLookupKey(subject?.id)}|${normalizeLookupKey(row.section)}|${normalizeLookupKey(row.academicYear)}|${normalizeLookupKey(row.semester)}`,
      );
      const resolvedSection = directSection ?? derivedSection;

      if (!resolvedSection) {
        return;
      }

      const room = roomByNumber.get(normalizeLookupKey(row.room));
      const instructor = instructorByName.get(
        normalizeLookupKey(row.instructor),
      );

      // Night class eligibility validation disabled during import to allow assignment
      // of night classes regardless of instructor allow_night_class flag
      // if (
      //   instructor &&
      //   isNightClassFromTime(scheduleRow.time_display) &&
      //   !instructor.allow_night_class
      // ) {
      //   throw new Error(
      //     `Full list row ${index + 2}: ${row.instructor} is not eligible for night classes (${scheduleRow.time_display}).`,
      //   );
      // }

      scheduleUpsertRows.push({
        ...scheduleRow,
        section_id: resolvedSection.id,
        subject_id: subject?.id ?? scheduleRow.subject_id ?? null,
        room_id: room?.id ?? null,
        instructor_id: instructor?.id ?? null,
        status: "Assigned", // ! ← add this line
      });
    });

    if (scheduleUpsertRows.length === 0) {
      throw new Error(
        "No schedule rows could be matched to subject sections. Check subject, section, room, and instructor values.",
      );
    }

    await upsertRows(
      "schedule_assignments",
      scheduleUpsertRows,
      "section_id,academic_year,semester",
      "Unable to import schedule assignments.",
    );

    // Assign instructors to subject sections with time data from full list
    const instructorSectionUpsertRows = [];
    console.log("=== START Instructor-Subject Section Assignment ===");
    console.log(`Total rows to process: ${sourceRows.length}`);
    console.log(`Available instructors in DB: ${instructorByName.size}`);
    console.log(`Available subjects in DB: ${subjectByKey.size}`);
    console.log(`Available sections in DB: ${sectionByKey.size}`);

    // Show sample keys for debugging
    if (instructorByName.size > 0) {
      console.log(
        `Sample instructor keys (first 3): ${Array.from(instructorByName.keys()).slice(0, 3).join(", ")}`,
      );
    }
    if (subjectByKey.size > 0) {
      console.log(
        `Sample subject keys (first 3): ${Array.from(subjectByKey.keys()).slice(0, 3).join(", ")}`,
      );
    }
    if (sectionByKey.size > 0) {
      console.log(
        `Sample section keys (first 3): ${Array.from(sectionByKey.keys()).slice(0, 3).join(", ")}`,
      );
    }

    const debugLogs = [];
    sourceRows.forEach((row, idx) => {
      const instructorName = String(row.instructor ?? "").trim();
      if (!instructorName) {
        debugLogs.push(`Row ${idx + 1}: No instructor name provided`);
        return;
      }

      // Time fields are required by the database schema
      if (!row.time_start || !row.time_end) {
        console.warn(
          `Skipping instructor section for "${instructorName}" and section "${row.section}" (${row.academicYear} ${row.semester}): time data not provided in CSV.`,
        );
        debugLogs.push(
          `Row ${idx + 1}: Missing time data for "${instructorName}"`,
        );
        return;
      }

      const normalizedInstructorName = normalizeLookupKey(instructorName);
      const instructor = instructorByName.get(normalizedInstructorName);
      if (!instructor) {
        debugLogs.push(
          `Row ${idx + 1}: Instructor NOT FOUND - searching for "${instructorName}" (normalized: "${normalizedInstructorName}")`,
        );
        return;
      }

      const subjectKey = buildSubjectIdentityKey(row);
      const subject = subjectByKey.get(subjectKey);
      if (!subject) {
        // Enhanced error logging with full row context and smart suggestions
        const keyValidation = validateSubjectIdentityKey(subjectKey);
        const suggestions = generateSubjectLookupSuggestions(row, subjectByKey);

        // Log to console for developer debugging
        console.error(
          `[ImportModal] Subject lookup failed for row ${idx + 1}`,
          {
            searchedKey: subjectKey,
            rowData: { code: row.code, program: row.program, year: row.year },
            keyValid: keyValidation.isValid,
            keyErrors: keyValidation.errors,
            availableKeyCount: subjectByKey.size,
            sampleKeys: Array.from(subjectByKey.keys()).slice(0, 5),
          },
        );

        // Log suggestions to console
        console.warn(
          `[ImportModal] Suggestions for row ${idx + 1}:`,
          suggestions,
        );

        // Add comprehensive debug log for display
        const rawCode = row.code || "(empty)";
        const rawProgram = row.program || "(empty)";
        const rawYear = row.year || "(empty)";
        const sampleKeys = Array.from(subjectByKey.keys())
          .slice(0, 3)
          .join(" | ");
        const availableKeysMsg =
          sampleKeys.length > 0
            ? `Available sample keys: ${sampleKeys}`
            : "No subjects available in database";

        debugLogs.push(
          `Row ${idx + 1}: Subject NOT FOUND\n` +
            `  Searched for key: "${subjectKey}"\n` +
            `  Raw CSV values: code="${rawCode}", program="${rawProgram}", year="${rawYear}"\n` +
            `  ${availableKeysMsg}\n` +
            `  Suggestions: ${suggestions.join(" ")}`,
        );
        return;
      }

      const sectionKey = `${normalizeLookupKey(subject.id)}|${normalizeLookupKey(row.section)}|${normalizeLookupKey(row.academicYear)}|${normalizeLookupKey(row.semester)}`;
      const section = sectionByKey.get(sectionKey);
      if (!section) {
        debugLogs.push(
          `Row ${idx + 1}: Section NOT FOUND - looked for key "${sectionKey}"`,
        );
        return;
      }

      debugLogs.push(
        `Row ${idx + 1}: ✅ MATCH - Instructor: ${instructor.id.substring(0, 8)}, Section: ${section.id.substring(0, 8)}`,
      );

      instructorSectionUpsertRows.push({
        instructor_id: instructor.id,
        section_id: section.id,
        time_start: row.time_start,
        time_end: row.time_end,
        academic_year: row.academicYear,
        semester: row.semester,
      });
    });

    console.log(`\n=== Assignment Results ===`);
    console.log(
      `Successfully matched: ${instructorSectionUpsertRows.length} row(s)`,
    );
    console.log(`\n=== Detailed Row Processing ===`);
    debugLogs.forEach((log) => console.log(log));
    console.log(`\n=== END Instructor-Subject Section Assignment ===\n`);

    if (instructorSectionUpsertRows.length > 0) {
      await upsertRows(
        "instructor_subject_sections",
        instructorSectionUpsertRows,
        "instructor_id,section_id",
        "Unable to import instructor subject sections.",
      );
      console.log(
        `✅ Successfully upserted ${instructorSectionUpsertRows.length} instructor-section assignments`,
      );
    } else {
      console.warn(
        `⚠️ No instructor-section assignments were created. This may indicate:
        1. No matching instructors in database (check instructor names)
        2. No matching subjects/sections (check subject import)
        3. Missing time data in CSV (check column 13)`,
      );
    }

    // NOTE: Instructor-section assignment is already handled by the importFullList workflow above
    // via direct upsert to instructor_subject_sections table with proper section_id + timing.
    // The manage_subject RPC approach is incompatible with the section-level assignment model
    // (instructor_subject_sections.section_id FK, not subject_id).
    // No additional RPC call needed - all mappings created during schedule assignment phase.
  };

  const applyImport = async () => {
    if (!parsed) {
      setError("Parse a CSV file before importing.");
      return;
    }

    setIsImporting(true);
    setError("");

    try {
      if (parsed.type === CSV_TYPES.FULL_LIST) {
        await importFullList(parsed);
      } else if (parsed.type === CSV_TYPES.SUBJECTS) {
        await importSubjectsAndSections(parsed);
      } else if (parsed.type === CSV_TYPES.ROOMS) {
        await importRooms(parsed);
      } else if (parsed.type === CSV_TYPES.INSTRUCTORS) {
        await importInstructors(parsed);
      } else if (parsed.type === CSV_TYPES.SCHEDULE) {
        await importSchedule(parsed);
      } else {
        throw new Error(`Unsupported import type: ${parsed.type}`);
      }

      resetAllData();

      let notificationMessage;
      if (parsed.type === CSV_TYPES.FULL_LIST) {
        notificationMessage =
          "Full list imported successfully. Schedule assignments and instructor-section mappings are ready to use.";
      } else {
        notificationMessage = `Imported ${parsed.rowCount ?? 0} ${selectedTypeConfig.label.toLowerCase()} row(s). Generate schedules from the Dashboard when ready.`;
      }
      showNotification(notificationMessage);
      onClose();
    } catch (err) {
      if (isRlsViolation(err)) {
        const rlsError = buildRlsError(err, null, "write");
        setError(rlsError.message);
      } else if (isForeignKeyViolation(err) || isCheckViolation(err)) {
        const { userMessage } = buildDatabaseErrorMessage(err, {
          operation: "import",
          entity: "data",
        });
        setError(userMessage || "Unable to import CSV data.");
      } else {
        setError(err.message || "Unable to import CSV data.");
      }
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
          Import CSV Data
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 12, color: "var(--text3)" }}>Import type</div>
          <select
            className="search-input"
            value={importType}
            onChange={(e) => {
              setImportType(e.target.value);
              setParsed(null);
              setError("");
            }}
          >
            {CSV_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div style={{ fontSize: 12, color: "var(--text3)" }}>
            {selectedTypeConfig.description}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            className={
              source === "upload" ? "btn btn-primary" : "btn btn-secondary"
            }
            onClick={() => {
              setSource("upload");
              setParsed(null);
              setShowValidationLogs(false);
              setError("");
            }}
          >
            Upload File
          </button>
          <button
            className={
              source === "repo" ? "btn btn-primary" : "btn btn-secondary"
            }
            onClick={() => {
              setSource("repo");
              setParsed(null);
              setShowValidationLogs(false);
              setError("");
            }}
          >
            Pull from Repository
          </button>
        </div>

        {source === "upload" ? (
          <input
            className="search-input"
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setLocalFile(e.target.files?.[0] ?? null)}
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <select
              className="search-input"
              value={selectedRepoPath}
              onChange={(e) => setSelectedRepoPath(e.target.value)}
              disabled={repoFilesForType.length === 0}
            >
              {repoFilesForType.length === 0 ? (
                <option value="">No repository csv files found</option>
              ) : (
                repoFilesForType.map((item) => (
                  <option value={item.path} key={item.path}>
                    {item.label}
                  </option>
                ))
              )}
            </select>
            <div style={{ fontSize: 12, color: "var(--text3)" }}>
              {selectedRepoItem?.description ||
                `Choose a ${selectedTypeConfig.label.toLowerCase()} CSV file from public/csv to import.`}
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-secondary" onClick={parseCsvText}>
            {isParsing ? "Parsing..." : "Preview CSV"}
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => downloadCsvTemplate(importType)}
          >
            Download {selectedTypeConfig.templateLabel}
          </button>
        </div>

        <div
          style={{
            padding: 10,
            borderRadius: 8,
            background: "var(--bg2)",
            border: "1px solid var(--border)",
            fontSize: 12,
          }}
        >
          <div style={{ color: "var(--text2)" }}>
            Type: <strong>{selectedTypeConfig.label}</strong>
          </div>
          <div style={{ color: "var(--text2)", marginTop: 4 }}>
            Preview: <strong>{summarizeImportedRows(parsed)}</strong>
          </div>
          <div style={{ color: "var(--text3)", marginTop: 6 }}>
            Supported payloads: full list, rooms, instructors, subject sections.
          </div>
        </div>

        {Array.isArray(parsed?.warnings) && parsed.warnings.length > 0 && (
          <div
            style={{
              padding: 10,
              borderRadius: 8,
              fontSize: 12,
              color: "#92400e",
              background: "#fffbeb",
              border: "1px solid #fcd34d",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ fontWeight: 700 }}>
                {parsed.warnings.length} warning
                {parsed.warnings.length !== 1 ? "s" : ""} found
              </div>
              <button
                className="btn btn-secondary"
                onClick={() => setShowValidationLogs(!showValidationLogs)}
                style={{ fontSize: 11, padding: "4px 8px" }}
              >
                {showValidationLogs ? "Hide Details" : "Show Details"}
              </button>
            </div>
            {showValidationLogs && (
              <div
                style={{
                  marginTop: 6,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {(() => {
                  // Categorize warnings
                  const matched = parsed.warnings.filter(
                    (w) => w.includes("MATCH") || w.includes("✅"),
                  );
                  const skipped = parsed.warnings.filter(
                    (w) =>
                      w.includes("Missing") ||
                      w.includes("No ") ||
                      w.includes("Skipping"),
                  );
                  const errors = parsed.warnings.filter(
                    (w) =>
                      !matched.includes(w) &&
                      !skipped.includes(w) &&
                      (w.includes("NOT FOUND") ||
                        w.includes("Error") ||
                        w.includes("row") ||
                        w.includes("defaulted") ||
                        w.includes("invalid") ||
                        w.includes("unrecognized") ||
                        w.includes("ignored") ||
                        w.includes("normalized") ||
                        w.includes("blank") ||
                        w.includes("column")),
                  );

                  const categoryConfig = [
                    {
                      key: "matched",
                      label: "✅ Matched",
                      logs: matched,
                      color: "#10b981",
                      bgColor: "#ecfdf5",
                      borderColor: "#86efac",
                    },
                    {
                      key: "skipped",
                      label: "⚠️ Skipped",
                      logs: skipped,
                      color: "#d97706",
                      bgColor: "#fffbeb",
                      borderColor: "#fcd34d",
                    },
                    {
                      key: "errors",
                      label: "❌ Errors",
                      logs: errors,
                      color: "#dc2626",
                      bgColor: "#fef2f2",
                      borderColor: "#fecaca",
                    },
                  ];

                  return categoryConfig.map(
                    (category) =>
                      category.logs.length > 0 && (
                        <div key={category.key}>
                          <button
                            onClick={() =>
                              setExpandedLogSections({
                                ...expandedLogSections,
                                [category.key]:
                                  !expandedLogSections[category.key],
                              })
                            }
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: 0,
                              textAlign: "left",
                              width: "100%",
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              fontSize: 11,
                              fontWeight: 600,
                              color: category.color,
                            }}
                          >
                            <span style={{ fontSize: 10 }}>
                              {expandedLogSections[category.key] ? "▼" : "▶"}
                            </span>
                            {category.label} ({category.logs.length})
                          </button>
                          {expandedLogSections[category.key] && (
                            <div
                              style={{
                                marginTop: 6,
                                padding: 8,
                                backgroundColor: category.bgColor,
                                border: `1px solid ${category.borderColor}`,
                                borderRadius: 4,
                                maxHeight: "250px",
                                overflowY: "auto",
                                fontFamily: "monospace",
                                fontSize: 11,
                                lineHeight: 1.5,
                                color: "#1f2937",
                              }}
                            >
                              {category.logs.map((log, idx) => (
                                <div
                                  key={`${category.key}-${idx}`}
                                  style={{
                                    marginBottom:
                                      idx < category.logs.length - 1 ? 6 : 0,
                                    paddingBottom:
                                      idx < category.logs.length - 1 ? 6 : 0,
                                    borderBottom:
                                      idx < category.logs.length - 1
                                        ? `1px solid ${category.borderColor}`
                                        : "none",
                                    whiteSpace: "pre-wrap",
                                    wordBreak: "break-word",
                                  }}
                                >
                                  {log}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ),
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {error && (
          <div
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              fontSize: 12,
              color: "#b42318",
              background: "#fef3f2",
              border: "1px solid #fecdca",
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={applyImport}>
            {isImporting ? "Importing..." : "Import"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
