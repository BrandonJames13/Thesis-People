import { useEffect, useMemo, useState } from "react";
import Modal from "./Modal";
import { useData } from "../../context/DataContext";
import { useNotification } from "../../context/NotificationContext";
import {
  CSV_TYPE_OPTIONS,
  CSV_TYPES,
  dedupeImportedRecords,
  downloadCsvTemplate,
  getCsvTypeConfig,
  parseImportCsv,
  summarizeImportedRows,
} from "../../utils/exportUtils";

async function readFileText(file) {
  return file.text();
}

export default function ImportModal({ isOpen, onClose }) {
  const {
    updateSubjectSectionsFromCourseRows,
    updateInstructors,
    updateRooms,
    updateScheduleAssignments,
  } = useData();
  const { showNotification } = useNotification();

  const [source, setSource] = useState("upload");
  const [importType, setImportType] = useState(CSV_TYPES.FULL_LIST);
  const [localFile, setLocalFile] = useState(null);
  const [repoFiles, setRepoFiles] = useState([]);
  const [selectedRepoPath, setSelectedRepoPath] = useState("");
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState("");
  const [isParsing, setIsParsing] = useState(false);

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

  const applyImport = () => {
    if (!parsed) {
      setError("Parse a CSV file before importing.");
      return;
    }

    if (parsed.type === CSV_TYPES.FULL_LIST) {
      const rows = dedupeImportedRecords(parsed.type, parsed.rows);
      updateScheduleAssignments(rows);
      showNotification(`Imported ${rows.length} full list row(s).`);
      onClose();
      return;
    }

    if (parsed.type === CSV_TYPES.SUBJECTS) {
      const rows = dedupeImportedRecords(parsed.type, parsed.subjects);
      updateSubjectSectionsFromCourseRows(rows);
      showNotification(`Imported ${rows.length} subject section row(s).`);
      onClose();
      return;
    }

    if (parsed.type === CSV_TYPES.ROOMS) {
      const rows = dedupeImportedRecords(parsed.type, parsed.rooms);
      updateRooms(rows);
      showNotification(`Imported ${rows.length} room row(s).`);
      onClose();
      return;
    }

    if (parsed.type === CSV_TYPES.INSTRUCTORS) {
      const rows = dedupeImportedRecords(parsed.type, parsed.instructors);
      updateInstructors(rows);
      showNotification(`Imported ${rows.length} instructor row(s).`);
      onClose();
      return;
    }

    setError(`Unsupported import type: ${parsed.type}`);
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
            Import
          </button>
        </div>
      </div>
    </Modal>
  );
}
