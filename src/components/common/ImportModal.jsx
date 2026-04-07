import { useEffect, useMemo, useState } from "react";
import Modal from "./Modal";
import { useData } from "../../context/DataContext";
import { useNotification } from "../../context/NotificationContext";
import {
  mergeUniqueInstructors,
  parseImportCsv,
} from "../../utils/exportUtils";

function summarizeParsed(parsed) {
  if (!parsed) return "No file selected";

  if (parsed.type === "schedule") {
    return `${parsed.courses.length} schedule row(s)`;
  }

  if (parsed.type === "subjects") {
    return `${parsed.courses.length} subject row(s)`;
  }

  if (parsed.type === "rooms") {
    return `${parsed.rooms.length} room row(s)`;
  }

  if (parsed.type === "faculty") {
    return `${parsed.instructors.length} faculty row(s)`;
  }

  return "Unknown import payload";
}

async function readFileText(file) {
  return file.text();
}

export default function ImportModal({ isOpen, onClose }) {
  const {
    courses,
    instructors,
    updateCourses,
    updateInstructors,
    updateRooms,
    updateScheduleAssignments,
  } = useData();
  const { showNotification } = useNotification();

  const [source, setSource] = useState("upload");
  const [localFile, setLocalFile] = useState(null);
  const [repoFiles, setRepoFiles] = useState([]);
  const [selectedRepoPath, setSelectedRepoPath] = useState("");
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState("");
  const [isParsing, setIsParsing] = useState(false);

  const selectedRepoItem = useMemo(
    () => repoFiles.find((f) => f.path === selectedRepoPath),
    [repoFiles, selectedRepoPath],
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
        if (files.length > 0) {
          setSelectedRepoPath(files[0].path);
        }
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
  }, [isOpen]);

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

      const payload = parseImportCsv(text);
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

    if (parsed.type === "schedule") {
      const nextCourses = parsed.courses;
      const assigned = nextCourses.filter((c) => c.status === "Assigned");
      const merged = mergeUniqueInstructors(
        instructors,
        [],
        parsed.instructorNames,
        nextCourses,
      );

      updateCourses(nextCourses);
      updateScheduleAssignments(assigned);
      updateInstructors(merged.instructors);

      showNotification(
        `Imported ${nextCourses.length} schedule rows. Added ${merged.addedCount} instructor(s).`,
      );
      onClose();
      return;
    }

    if (parsed.type === "subjects") {
      const nextCourses = parsed.courses;
      const merged = mergeUniqueInstructors(
        instructors,
        [],
        parsed.instructorNames,
        nextCourses,
      );

      updateCourses(nextCourses);
      updateScheduleAssignments([]);
      updateInstructors(merged.instructors);

      showNotification(
        `Imported ${nextCourses.length} subjects. Added ${merged.addedCount} instructor(s).`,
      );
      onClose();
      return;
    }

    if (parsed.type === "rooms") {
      updateRooms(parsed.rooms);
      showNotification(`Imported ${parsed.rooms.length} room records.`);
      onClose();
      return;
    }

    if (parsed.type === "faculty") {
      const merged = mergeUniqueInstructors(
        instructors,
        parsed.instructors,
        [],
        courses,
      );
      updateInstructors(merged.instructors);
      showNotification(
        `Imported ${parsed.instructors.length} faculty rows. Added ${merged.addedCount} new instructor(s).`,
      );
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
          Import CSV Data
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
              disabled={repoFiles.length === 0}
            >
              {repoFiles.length === 0 ? (
                <option value="">No repository csv files found</option>
              ) : (
                repoFiles.map((item) => (
                  <option value={item.path} key={item.path}>
                    {item.label}
                  </option>
                ))
              )}
            </select>
            <div style={{ fontSize: 12, color: "var(--text3)" }}>
              {selectedRepoItem?.description ||
                "Choose a CSV file from public/csv to import."}
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={parseCsvText}>
            {isParsing ? "Parsing..." : "Preview CSV"}
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
            Type: <strong>{parsed?.type ?? "-"}</strong>
          </div>
          <div style={{ color: "var(--text2)", marginTop: 4 }}>
            Preview: <strong>{summarizeParsed(parsed)}</strong>
          </div>
          <div style={{ color: "var(--text3)", marginTop: 6 }}>
            Supports: schedule export format, faculty list, rooms list, subjects
            list.
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
