import { useMemo, useState } from "react";
import Modal from "./Modal";
import { useData } from "../../context/DataContext";
import { useNotification } from "../../context/NotificationContext";
import {
  CSV_TYPES,
  CSV_TYPE_OPTIONS,
  downloadCsvTemplate,
  exportCsv,
  getCsvTypeConfig,
} from "../../utils/exportUtils";

export default function ExportModal({ isOpen, onClose }) {
  const { subjects, subjectSections, rooms, instructors, scheduleAssignments } =
    useData();
  const { showNotification } = useNotification();
  const [exportType, setExportType] = useState(CSV_TYPES.FULL_LIST);

  const selectedTypeConfig = useMemo(
    () => getCsvTypeConfig(exportType),
    [exportType],
  );

  const subjectSectionRows = useMemo(() => {
    const subjectByCode = new Map(
      subjects.map((subject) => [String(subject.code ?? "").trim(), subject]),
    );

    return subjectSections.map((section) => {
      const subject = subjectByCode.get(
        String(section.subjectCode ?? "").trim(),
      );

      return {
        code: section.subjectCode,
        title: subject?.title ?? "",
        section: section.section,
        academicYear: section.academicYear,
        semester: section.semester,
        program: subject?.program ?? "",
        year: subject?.year ?? "",
        enrolled: Number(section.enrolled ?? 0),
        roomType: section.roomType ?? subject?.roomType ?? "Lecture",
        duration: Number(section.duration ?? subject?.duration ?? 1.5),
        instructor: section.instructor ?? "",
        status: section.status ?? "Pending",
      };
    });
  }, [subjectSections, subjects]);

  const selectedRows = useMemo(() => {
    if (exportType === CSV_TYPES.FULL_LIST) {
      const instructorByName = new Map(
        instructors.map((row) => [
          String(row.name ?? "")
            .trim()
            .toLowerCase(),
          row,
        ]),
      );

      return scheduleAssignments.map((row) => {
        const instructor = instructorByName.get(
          String(row.instructor ?? "")
            .trim()
            .toLowerCase(),
        );

        return {
          ...row,
          employment_status: instructor?.employment_status ?? [],
          max_units: instructor?.max_units ?? "",
          allow_night_class: instructor?.allow_night_class ?? false,
        };
      });
    }
    if (exportType === CSV_TYPES.ROOMS) return rooms;
    if (exportType === CSV_TYPES.INSTRUCTORS) return instructors;
    if (exportType === CSV_TYPES.SUBJECTS) return subjectSectionRows;
    if (exportType === CSV_TYPES.SCHEDULE) return scheduleAssignments;
    return [];
  }, [exportType, instructors, rooms, scheduleAssignments, subjectSectionRows]);

  const handleExport = () => {
    const didExport = exportCsv(exportType, selectedRows);
    if (!didExport) {
      showNotification(
        `No ${selectedTypeConfig.label.toLowerCase()} rows to export.`,
      );
      return;
    }

    showNotification(`${selectedTypeConfig.label} exported to CSV ✓`);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
          Export CSV Data
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 12, color: "var(--text3)" }}>Export type</div>
          <select
            className="search-input"
            value={exportType}
            onChange={(e) => setExportType(e.target.value)}
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
            Rows: <strong>{selectedRows.length}</strong>
          </div>
          <div style={{ color: "var(--text3)", marginTop: 4 }}>
            Template: {selectedTypeConfig.templateLabel}
          </div>
          <div style={{ color: "var(--text3)", marginTop: 4 }}>
            Filename: {selectedTypeConfig.filename}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            className="btn btn-secondary"
            onClick={() => downloadCsvTemplate(exportType)}
          >
            Download {selectedTypeConfig.templateLabel}
          </button>
          <button
            className="btn btn-primary"
            onClick={handleExport}
            disabled={selectedRows.length === 0}
          >
            Export {selectedTypeConfig.label}
          </button>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
