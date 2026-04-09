import { useEffect, useMemo, useState } from "react";
import Modal from "./Modal";
import { useData } from "../../context/DataContext";
import { useNotification } from "../../context/NotificationContext";
import { supabase } from "../../lib/supabaseClient";
import { getDefaultRoomCapacity } from "../../data/constants";
import { getWingFromRoomInput } from "../../utils/roomUtils";
import {
  buildSectionIdentityKey,
  buildSubjectIdentityKey,
  CSV_TYPE_OPTIONS,
  CSV_TYPES,
  downloadCsvTemplate,
  getCsvTypeConfig,
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

  const normalizeDbError = (err, fallback) => {
    if (!err) return fallback;
    const parts = [err.message, err.details, err.hint].filter(Boolean);
    return parts.join(" | ") || fallback;
  };

  const isNotNullViolation = (err) => {
    if (!err) return false;
    const code = String(err.code ?? "").trim();
    if (code === "23502") return true;
    const message = `${err.message ?? ""} ${err.details ?? ""}`.toLowerCase();
    return (
      message.includes("null value") && message.includes("violates not-null")
    );
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

    const { data, error } = await supabase
      .from(table)
      .upsert(rows, { onConflict })
      .select(select);

    if (error) {
      const normalizedError = new Error(
        normalizeDbError(error, fallbackMessage),
      );
      normalizedError.code = error.code;
      normalizedError.details = error.details;
      normalizedError.hint = error.hint;
      throw normalizedError;
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
      const normalizedError = new Error(
        normalizeDbError(error, `Unable to load existing ${table}.`),
      );
      normalizedError.code = error.code;
      normalizedError.details = error.details;
      normalizedError.hint = error.hint;
      throw normalizedError;
    }

    return data ?? [];
  };

  const importRooms = async (payload) => {
    const dbRows = Array.isArray(payload?.dbRows) ? payload.dbRows : [];
    if (dbRows.length === 0) {
      throw new Error("No room rows were parsed for import.");
    }

    await upsertRows("rooms", dbRows, "number", "Unable to import rooms.");
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
        };

        if (!existingRow) {
          toInsert.push(payloadRow);
          return;
        }

        updateOps.push(
          supabase
            .from("instructors")
            .update(payloadRow)
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
          throw updateError;
        }
      }
    };

    try {
      await importRows(rawRows);
    } catch (err) {
      if (!isNotNullViolation(err) || defaultRows.length === 0) {
        throw new Error(normalizeDbError(err, "Unable to import instructors."));
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
      throw new Error(
        normalizeDbError(
          subjectIndexError,
          "Unable to map imported sections to subjects.",
        ),
      );
    }

    const subjectIdByIdentity = new Map(
      (subjectIndexRows ?? []).map((row) => [
        buildSubjectIdentityKey(row),
        row.id,
      ]),
    );

    const sectionUpsertRows = sectionRows
      .map((row) => {
        const key = buildSubjectIdentityKey(row?.subject_ref);
        const subjectId = subjectIdByIdentity.get(key);
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
      throw new Error(
        "No subject sections could be matched to subjects. Check subject code/program/year values.",
      );
    }

    await upsertRows(
      "subject_sections",
      sectionUpsertRows,
      "subject_id,section,academic_year,semester",
      "Unable to import subject sections.",
    );
  };

  const importFullList = async (payload) => {
    const sourceRows = Array.isArray(payload?.rows) ? payload.rows : [];
    const scheduleDbRows = Array.isArray(payload?.dbRows) ? payload.dbRows : [];

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
      department: "TBD",
      availability: null,
      status: "Active",
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
      return existing
        ? {
            number: row.room,
            type: row.roomType,
            capacity,
            status: existing.status ?? "Available",
            wing: existing.wing ?? resolvedWing,
          }
        : {
            number: row.room,
            type: row.roomType,
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
      return existing
        ? {
            name: row.name,
            department: existing.department ?? row.department,
            availability: existing.availability ?? row.availability,
            status: existing.status ?? row.status,
          }
        : row;
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
          ...(row.section_id ? { id: row.section_id } : {}),
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

      scheduleUpsertRows.push({
        ...scheduleRow,
        section_id: resolvedSection.id,
        subject_id: subject?.id ?? scheduleRow.subject_id ?? null,
        room_id: room?.id ?? null,
        instructor_id: instructor?.id ?? null,
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
      } else {
        throw new Error(`Unsupported import type: ${parsed.type}`);
      }

      resetAllData();
      showNotification(
        `Imported ${parsed.rowCount ?? 0} ${selectedTypeConfig.label.toLowerCase()} row(s).`,
      );
      onClose();
    } catch (err) {
      setError(err.message || "Unable to import CSV data.");
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
            <div style={{ fontWeight: 700 }}>Validation feedback</div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {parsed.warnings.map((warning, index) => (
                <li key={`${warning}-${index}`}>{warning}</li>
              ))}
            </ul>
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
