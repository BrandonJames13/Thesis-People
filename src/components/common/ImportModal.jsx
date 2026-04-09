import { useEffect, useMemo, useState } from "react";
import Modal from "./Modal";
import { useData } from "../../context/DataContext";
import { useNotification } from "../../context/NotificationContext";
import { supabase } from "../../lib/supabaseClient";
import {
  CSV_TYPE_OPTIONS,
  CSV_TYPES,
  downloadCsvTemplate,
  getCsvTypeConfig,
  parseImportCsv,
  summarizeImportedRows,
} from "../../utils/exportUtils";

async function readFileText(file) {
  return file.text();
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

  const buildCompositeSubjectKey = (code, program, year) =>
    [code, program, year]
      .map((value) =>
        String(value ?? "")
          .trim()
          .toLowerCase(),
      )
      .join("|");

  const importRooms = async (payload) => {
    const dbRows = Array.isArray(payload?.dbRows) ? payload.dbRows : [];
    if (dbRows.length === 0) {
      throw new Error("No room rows were parsed for import.");
    }

    const { error: writeError } = await supabase
      .from("rooms")
      .upsert(dbRows, { onConflict: "number" });

    if (writeError) {
      throw new Error(normalizeDbError(writeError, "Unable to import rooms."));
    }
  };

  const importScheduleAssignments = async (payload) => {
    const dbRows = Array.isArray(payload?.dbRows) ? payload.dbRows : [];
    if (dbRows.length === 0) {
      throw new Error("No schedule assignment rows were parsed for import.");
    }

    const rowsWithSectionId = dbRows.filter((row) => row.section_id);
    const rowsWithoutSectionId = dbRows.filter((row) => !row.section_id);

    if (rowsWithSectionId.length > 0) {
      const { error: upsertError } = await supabase
        .from("schedule_assignments")
        .upsert(rowsWithSectionId, {
          onConflict: "section_id,academic_year,semester",
        });

      if (upsertError) {
        throw new Error(
          normalizeDbError(
            upsertError,
            "Unable to upsert schedule assignments.",
          ),
        );
      }
    }

    if (rowsWithoutSectionId.length > 0) {
      const { error: insertError } = await supabase
        .from("schedule_assignments")
        .insert(rowsWithoutSectionId);

      if (insertError) {
        throw new Error(
          normalizeDbError(
            insertError,
            "Unable to insert schedule assignments.",
          ),
        );
      }
    }
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
      const { data: existing, error: existingError } = await supabase
        .from("instructors")
        .select("id, name")
        .in("name", names);

      if (existingError) {
        throw new Error(
          normalizeDbError(
            existingError,
            "Unable to load existing instructors.",
          ),
        );
      }

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
        const { error: insertError } = await supabase
          .from("instructors")
          .insert(toInsert);
        if (insertError) {
          throw insertError;
        }
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
      const { error: subjectError } = await supabase.from("subjects").upsert(
        subjectRows.map((row) => ({
          code: row.code,
          title: row.title,
          program: row.program,
          year: row.year,
          room_type: row.room_type,
          duration: row.duration,
        })),
        { onConflict: "code,program,year" },
      );

      if (subjectError) {
        throw new Error(
          normalizeDbError(subjectError, "Unable to import subjects."),
        );
      }
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
        buildCompositeSubjectKey(row.code, row.program, row.year),
        row.id,
      ]),
    );

    const sectionUpsertRows = sectionRows
      .map((row) => {
        const key = buildCompositeSubjectKey(
          row?.subject_ref?.code,
          row?.subject_ref?.program,
          row?.subject_ref?.year,
        );
        const subjectId = subjectIdByIdentity.get(key);
        if (!subjectId) return null;

        return {
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

    const { error: sectionError } = await supabase
      .from("subject_sections")
      .upsert(sectionUpsertRows, {
        onConflict: "subject_id,section,academic_year,semester",
      });

    if (sectionError) {
      throw new Error(
        normalizeDbError(sectionError, "Unable to import subject sections."),
      );
    }
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
        await importScheduleAssignments(parsed);
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
