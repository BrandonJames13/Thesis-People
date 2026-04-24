import { useEffect, useState, useCallback } from "react";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  WidthType,
  BorderStyle,
  ShadingType,
  VerticalAlign,
  PageOrientation,
} from "docx";
import { saveAs } from "file-saver";
import Modal from "../common/Modal";
import { supabase } from "../../lib/supabaseClient";
import { formatTimeFromMin } from "../../utils/timeUtils";
import { patternDaysMap } from "../../data/constants";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseSqlTimeToMinutes(value) {
  const text = String(value ?? "").trim();
  const match = text.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

function getDayLabels(pattern) {
  if (!pattern) return "—";
  const days = patternDaysMap[pattern.toUpperCase()];
  if (days && days.length) return days.join(", ");
  return pattern;
}

function getTimeDisplay(assignment) {
  const startMin = parseSqlTimeToMinutes(assignment.time_start);
  const endMin = parseSqlTimeToMinutes(assignment.time_end);
  if (Number.isFinite(startMin) && Number.isFinite(endMin)) {
    return `${formatTimeFromMin(startMin)} – ${formatTimeFromMin(endMin)}`;
  }
  if (assignment.time_display) return assignment.time_display;
  if (assignment.time) return assignment.time;
  return "—";
}

const STATUS_COLORS = {
  Assigned: { bg: "var(--green)", text: "#fff" },
  Pending: { bg: "var(--surface3)", text: "var(--text2)" },
  Conflict: { bg: "var(--red)", text: "#fff" },
};

// ---------------------------------------------------------------------------
// Day-grid helpers for the print preview
// ---------------------------------------------------------------------------

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Map pattern → which day indices are active
const PATTERN_DAY_MAP = {
  MW: [0, 2], // Mon, Wed
  TTH: [1, 3], // Tue, Thu
  WF: [2, 4], // Wed, Fri
  TF: [1, 4], // Tue, Fri
  MWF: [0, 2, 4], // Mon, Wed, Fri
  SAT: [5], // Sat
  MTH: [0, 3], // Mon, Thu
  TW: [1, 2], // Tue, Wed
  MTWTHF: [0, 1, 2, 3, 4],
};

function getPatternDayIndices(pattern) {
  if (!pattern) return [];
  return PATTERN_DAY_MAP[pattern.toUpperCase()] ?? [];
}

// Build a map: dayIndex → time slot key → assignment
function buildGrid(schedules) {
  const grid = {}; // grid[dayIdx][slotKey] = assignment
  DAYS.forEach((_, i) => {
    grid[i] = {};
  });

  schedules.forEach((s) => {
    const startMin = parseSqlTimeToMinutes(s.time_start);
    const endMin = parseSqlTimeToMinutes(s.time_end);
    if (!Number.isFinite(startMin)) return;
    const slotKey = `${startMin}-${endMin ?? startMin + 60}`;
    const dayIndices = getPatternDayIndices(s.pattern);
    dayIndices.forEach((di) => {
      grid[di][slotKey] = s;
    });
  });
  return grid;
}

// Generate 30-min time slots from 7:00 AM to 9:00 PM
function generateTimeSlots() {
  const slots = [];
  for (let min = 7 * 60; min < 21 * 60; min += 30) {
    slots.push(min);
  }
  return slots;
}

function formatMinTo12(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const hh = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${hh}:${String(m).padStart(2, "0")} ${ampm}`;
}

// Pattern → pastel cell color (matching image style)
const PATTERN_CELL_COLORS = {
  MW: "#fde9a2",
  TTH: "#d4edda",
  WF: "#cce5ff",
  TF: "#e2d9f3",
  MWF: "#fde9a2",
  SAT: "#f8d7da",
  MTH: "#fff3cd",
  default: "#e8f4fd",
};

function getCellColor(pattern) {
  return (
    PATTERN_CELL_COLORS[pattern?.toUpperCase()] ?? PATTERN_CELL_COLORS.default
  );
}

// ---------------------------------------------------------------------------
// Export to DOCX  (client-side via docx npm package loaded from CDN)
// ---------------------------------------------------------------------------

async function exportToDocx(schedules, room, docMeta) {
  const timeSlots = generateTimeSlots();
  const grid = buildGrid(schedules);

  // Column widths (landscape Letter: 15840 - 2*720 margin = 14400 DXA content)
  // Time col: 900, 6 day cols: (14400-900)/6 = 2250 each
  const TIME_COL = 900;
  const DAY_COL = 2250;
  const colWidths = [TIME_COL, ...DAYS.map(() => DAY_COL)];
  const tableWidth = colWidths.reduce((a, b) => a + b, 0); // 14400

  const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" };
  const thickBorder = { style: BorderStyle.SINGLE, size: 8, color: "999999" };
  const borders = {
    top: thinBorder,
    bottom: thinBorder,
    left: thinBorder,
    right: thinBorder,
  };
  const headerBorders = {
    top: thickBorder,
    bottom: thickBorder,
    left: thickBorder,
    right: thickBorder,
  };

  // Build table rows
  const rows = [];

  // Header row: Time | Mon | Tue | ...
  rows.push(
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          width: { size: TIME_COL, type: WidthType.DXA },
          borders: headerBorders,
          shading: { fill: "4472C4", type: ShadingType.CLEAR },
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 60, bottom: 60, left: 80, right: 80 },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: "",
                  bold: true,
                  color: "FFFFFF",
                  size: 16,
                  font: "Arial",
                }),
              ],
            }),
          ],
        }),
        ...DAYS.map(
          (day, i) =>
            new TableCell({
              width: { size: DAY_COL, type: WidthType.DXA },
              borders: headerBorders,
              shading: { fill: "4472C4", type: ShadingType.CLEAR },
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 60, bottom: 60, left: 80, right: 80 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: day,
                      bold: true,
                      color: "FFFFFF",
                      size: 16,
                      font: "Arial",
                    }),
                  ],
                }),
              ],
            }),
        ),
      ],
    }),
  );

  // Build a set of occupied (dayIdx, slotKey) pairs to skip merged cells
  // For simplicity: each assignment spans from start to end slot
  const cellContent = {}; // "dayIdx-slotMin" => assignment | null | "skip"

  schedules.forEach((s) => {
    const startMin = parseSqlTimeToMinutes(s.time_start);
    const endMin = parseSqlTimeToMinutes(s.time_end);
    if (!Number.isFinite(startMin)) return;
    const end = Number.isFinite(endMin) ? endMin : startMin + 60;
    const dayIndices = getPatternDayIndices(s.pattern);
    dayIndices.forEach((di) => {
      // Mark start cell with assignment
      cellContent[`${di}-${startMin}`] = s;
      // Mark subsequent slots as "skip"
      for (let m = startMin + 30; m < end; m += 30) {
        cellContent[`${di}-${m}`] = "skip";
      }
    });
  });

  // Data rows
  timeSlots.forEach((slotMin, rowIdx) => {
    const isHour = slotMin % 60 === 0;

    const timeCell = new TableCell({
      width: { size: TIME_COL, type: WidthType.DXA },
      borders,
      shading: { fill: isHour ? "F2F2F2" : "FAFAFA", type: ShadingType.CLEAR },
      verticalAlign: VerticalAlign.CENTER,
      margins: { top: 40, bottom: 40, left: 60, right: 60 },
      children: [
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [
            new TextRun({
              text: formatMinTo12(slotMin),
              size: 14,
              bold: isHour,
              font: "Arial",
              color: "444444",
            }),
          ],
        }),
      ],
    });

    const dayCells = DAYS.map((_, di) => {
      const key = `${di}-${slotMin}`;
      const cell = cellContent[key];

      if (cell === "skip") {
        // Empty continuation cell (visually empty, no shading)
        return new TableCell({
          width: { size: DAY_COL, type: WidthType.DXA },
          borders,
          margins: { top: 40, bottom: 40, left: 60, right: 60 },
          children: [new Paragraph({ children: [] })],
        });
      }

      if (cell && cell !== "skip") {
        const s = cell;
        const subjectCode = s.subject_code ?? s.course_code ?? s.code ?? "";
        const section = s.section ?? "";
        const instructor = s.instructor_name ?? s.instructor ?? "";
        const fillHex = getCellColor(s.pattern).replace("#", "");

        return new TableCell({
          width: { size: DAY_COL, type: WidthType.DXA },
          borders,
          shading: { fill: fillHex, type: ShadingType.CLEAR },
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 40, bottom: 40, left: 60, right: 60 },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 0, after: 0 },
              children: [
                new TextRun({
                  text: "-Sched. 1-",
                  size: 14,
                  font: "Arial",
                  color: "333333",
                }),
              ],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 0, after: 0 },
              children: [
                new TextRun({
                  text: subjectCode,
                  bold: true,
                  size: 16,
                  font: "Arial",
                  color: "111111",
                }),
              ],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 0, after: 0 },
              children: [
                new TextRun({
                  text: section,
                  size: 14,
                  font: "Arial",
                  color: "333333",
                }),
              ],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 40, after: 0 },
              border: {
                top: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
              },
              children: [
                new TextRun({
                  text: instructor,
                  size: 13,
                  font: "Arial",
                  color: "444444",
                }),
              ],
            }),
          ],
        });
      }

      // Empty cell
      return new TableCell({
        width: { size: DAY_COL, type: WidthType.DXA },
        borders,
        margins: { top: 40, bottom: 40, left: 60, right: 60 },
        children: [new Paragraph({ children: [] })],
      });
    });

    rows.push(new TableRow({ children: [timeCell, ...dayCells] }));
  });

  const scheduleTable = new Table({
    width: { size: tableWidth, type: WidthType.DXA },
    columnWidths: colWidths,
    rows,
  });

  // Signature block helper
  function sigBlock(label, name, title) {
    return [
      new Paragraph({
        spacing: { before: 0, after: 40 },
        children: [
          new TextRun({
            text: `${label}`,
            size: 20,
            font: "Arial",
            bold: false,
          }),
        ],
      }),
      new Paragraph({
        spacing: { before: 200, after: 0 },
        border: {
          bottom: {
            style: BorderStyle.SINGLE,
            size: 6,
            color: "000000",
            space: 1,
          },
        },
        children: [new TextRun({ text: " ", size: 20 })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 40, after: 0 },
        children: [
          new TextRun({ text: name, size: 20, bold: true, font: "Arial" }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 20, after: 0 },
        children: [new TextRun({ text: title, size: 18, font: "Arial" })],
      }),
    ];
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 12240,
              height: 15840,
              orientation: PageOrientation.LANDSCAPE,
            },
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
        },
        children: [
          // ── Header text ──────────────────────────────────────────────
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 40 },
            children: [
              new TextRun({
                text: docMeta.schoolName,
                bold: true,
                size: 24,
                font: "Arial",
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 40 },
            children: [
              new TextRun({ text: docMeta.campus, size: 20, font: "Arial" }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 60, after: 40 },
            children: [
              new TextRun({
                text: "CLASSROOM SCHEDULE",
                bold: true,
                size: 22,
                font: "Arial",
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 40 },
            children: [
              new TextRun({ text: docMeta.semester, size: 20, font: "Arial" }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 40 },
            children: [
              new TextRun({
                text: `Building: ${docMeta.building}`,
                size: 20,
                font: "Arial",
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 120 },
            children: [
              new TextRun({
                text: `Room: ${docMeta.roomLabel}`,
                size: 20,
                font: "Arial",
              }),
            ],
          }),

          // ── Schedule Table ────────────────────────────────────────────
          scheduleTable,

          // ── Footer signature area ─────────────────────────────────────
          new Paragraph({
            spacing: { before: 360, after: 0 },
            children: [new TextRun("")],
          }),
          new Paragraph({
            spacing: { before: 0, after: 40 },
            children: [
              new TextRun({
                text: "Prepared By:",
                size: 18,
                font: "Arial",
                color: "555555",
              }),
            ],
          }),
          ...sigBlock("", docMeta.preparedByName, docMeta.preparedByTitle),
          new Paragraph({
            spacing: { before: 240, after: 0 },
            children: [new TextRun("")],
          }),
          new Paragraph({
            spacing: { before: 0, after: 40 },
            children: [
              new TextRun({
                text: "Recommending Approval:",
                size: 18,
                font: "Arial",
                color: "555555",
              }),
            ],
          }),
          ...sigBlock("", docMeta.approvalName, docMeta.approvalTitle),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${docMeta.roomLabel ?? room.number}_Schedule.docx`);
}

// ---------------------------------------------------------------------------
// Preview Modal
// ---------------------------------------------------------------------------

function SchedulePreviewModal({ room, schedules, onClose }) {
  const [docMeta, setDocMeta] = useState({
    schoolName: "Tarlac State University",
    campus: "TSU - San Isidro Campus",
    semester: "2025-2026 2nd Semester",
    building: "CCS - SI",
    roomLabel: room.number ?? "",
    preparedByName: "",
    preparedByTitle: "",
    approvalName: "",
    approvalTitle: "",
  });
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportToDocx(schedules, room, docMeta);
    } catch (err) {
      console.error("[SchedulePreviewModal] Export failed:", err);
      alert("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const timeSlots = generateTimeSlots();
  const grid = buildGrid(schedules);

  // Collect unique cell entries for preview rendering
  const cellContent = {};
  schedules.forEach((s) => {
    const startMin = parseSqlTimeToMinutes(s.time_start);
    const endMin = parseSqlTimeToMinutes(s.time_end);
    if (!Number.isFinite(startMin)) return;
    const end = Number.isFinite(endMin) ? endMin : startMin + 60;
    const dayIndices = getPatternDayIndices(s.pattern);
    dayIndices.forEach((di) => {
      cellContent[`${di}-${startMin}`] = {
        ...s,
        _spanRows: Math.max(1, Math.round((end - startMin) / 30)),
      };
      for (let m = startMin + 30; m < end; m += 30) {
        cellContent[`${di}-${m}`] = "skip";
      }
    });
  });

  const inputStyle = {
    background: "var(--surface2)",
    border: "1px solid var(--border)",
    borderRadius: 5,
    color: "var(--text)",
    fontSize: 12,
    padding: "4px 8px",
    width: "100%",
    outline: "none",
  };
  const labelStyle = {
    fontSize: 11,
    color: "var(--text3)",
    marginBottom: 3,
    display: "block",
  };

  function field(key, label, placeholder = "") {
    return (
      <div style={{ marginBottom: 10 }}>
        <label style={labelStyle}>{label}</label>
        <input
          style={inputStyle}
          value={docMeta[key]}
          placeholder={placeholder}
          onChange={(e) =>
            setDocMeta((prev) => ({ ...prev, [key]: e.target.value }))
          }
        />
      </div>
    );
  }

  return (
    <Modal isOpen onClose={onClose} size="xl">
      {/* Modal Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
            📄 Export Schedule — {room.number}
          </div>
          <div style={{ fontSize: 12, color: "var(--text3)" }}>
            Customize document fields, then export as Word (.docx)
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "1px solid var(--border)",
            color: "var(--text2)",
            cursor: "pointer",
            fontSize: 13,
            padding: "3px 9px",
            borderRadius: 6,
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ borderTop: "1px solid var(--border)", marginBottom: 20 }} />

      <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
        {/* Left: editable fields */}
        <div style={{ width: 240, flexShrink: 0 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "var(--text2)",
              marginBottom: 12,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Document Fields
          </div>
          {field("schoolName", "School Name")}
          {field("campus", "Campus")}
          {field("semester", "Semester")}
          {field("building", "Building")}
          {field("roomLabel", "Room Label")}

          <div
            style={{ borderTop: "1px solid var(--border)", margin: "14px 0" }}
          />
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "var(--text2)",
              marginBottom: 12,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Signatures
          </div>
          {field(
            "preparedByName",
            "Prepared By — Name",
            "e.g. Gilbert G. Gonzales",
          )}
          {field(
            "preparedByTitle",
            "Prepared By — Title",
            "e.g. BSIT Dept Head/Asso. Dean",
          )}
          {field(
            "approvalName",
            "Recommending Approval — Name",
            "e.g. Alvincent E. Danganan",
          )}
          {field(
            "approvalTitle",
            "Recommending Approval — Title",
            "e.g. CCS, Dean",
          )}
        </div>

        {/* Right: preview pane */}
        <div style={{ flex: 1, overflowX: "auto" }}>
          <div
            style={{
              background: "#fff",
              color: "#111",
              border: "1px solid #ccc",
              borderRadius: 6,
              padding: "16px 20px",
              fontSize: 10,
              minWidth: 560,
              fontFamily: "Arial, sans-serif",
            }}
          >
            {/* Document header preview */}
            <div style={{ textAlign: "center", marginBottom: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 12 }}>
                {docMeta.schoolName}
              </div>
              <div style={{ fontSize: 10 }}>{docMeta.campus}</div>
              <div style={{ fontWeight: 700, fontSize: 11, marginTop: 6 }}>
                CLASSROOM SCHEDULE
              </div>
              <div>{docMeta.semester}</div>
              <div>Building: {docMeta.building}</div>
              <div>Room: {docMeta.roomLabel}</div>
            </div>

            {/* Schedule grid preview */}
            <table
              style={{ width: "100%", borderCollapse: "collapse", fontSize: 9 }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      background: "#4472C4",
                      color: "#fff",
                      padding: "4px 3px",
                      border: "1px solid #999",
                      width: 52,
                      textAlign: "center",
                    }}
                  ></th>
                  {DAYS.map((d) => (
                    <th
                      key={d}
                      style={{
                        background: "#4472C4",
                        color: "#fff",
                        padding: "4px 3px",
                        border: "1px solid #999",
                        textAlign: "center",
                      }}
                    >
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timeSlots.map((slotMin) => {
                  const isHour = slotMin % 60 === 0;
                  return (
                    <tr key={slotMin}>
                      <td
                        style={{
                          background: isHour ? "#f2f2f2" : "#fafafa",
                          padding: "2px 4px",
                          border: "1px solid #ddd",
                          textAlign: "right",
                          whiteSpace: "nowrap",
                          fontWeight: isHour ? 700 : 400,
                          fontSize: 8,
                        }}
                      >
                        {formatMinTo12(slotMin)}
                      </td>
                      {DAYS.map((_, di) => {
                        const key = `${di}-${slotMin}`;
                        const cell = cellContent[key];
                        if (cell === "skip") return null;
                        const rowSpan = cell?._spanRows ?? 1;
                        const s = cell;
                        const subjectCode =
                          s?.subject_code ?? s?.course_code ?? s?.code ?? "";
                        const section = s?.section ?? "";
                        const instructor =
                          s?.instructor_name ?? s?.instructor ?? "";
                        return (
                          <td
                            key={di}
                            rowSpan={rowSpan}
                            style={{
                              border: "1px solid #ddd",
                              padding: "2px 3px",
                              textAlign: "center",
                              verticalAlign: "middle",
                              background: s ? getCellColor(s.pattern) : "#fff",
                              fontSize: 8,
                            }}
                          >
                            {s && (
                              <>
                                <div style={{ color: "#555" }}>-Sched. 1-</div>
                                <div style={{ fontWeight: 700 }}>
                                  {subjectCode}
                                </div>
                                <div>{section}</div>
                                <div
                                  style={{
                                    borderTop: "1px solid #999",
                                    marginTop: 2,
                                    paddingTop: 1,
                                    fontSize: 7,
                                    color: "#444",
                                  }}
                                >
                                  {instructor}
                                </div>
                              </>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Footer preview */}
            <div
              style={{ display: "flex", gap: 40, marginTop: 16, fontSize: 9 }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ color: "#777" }}>Prepared By:</div>
                <div
                  style={{
                    borderBottom: "1px solid #333",
                    marginTop: 20,
                    marginBottom: 3,
                  }}
                />
                <div style={{ fontWeight: 700, textAlign: "center" }}>
                  {docMeta.preparedByName || "________________________"}
                </div>
                <div style={{ textAlign: "center", color: "#555" }}>
                  {docMeta.preparedByTitle || " "}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: "#777" }}>Recommending Approval:</div>
                <div
                  style={{
                    borderBottom: "1px solid #333",
                    marginTop: 20,
                    marginBottom: 3,
                  }}
                />
                <div style={{ fontWeight: 700, textAlign: "center" }}>
                  {docMeta.approvalName || "________________________"}
                </div>
                <div style={{ textAlign: "center", color: "#555" }}>
                  {docMeta.approvalTitle || " "}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer actions */}
      <div
        style={{
          borderTop: "1px solid var(--border)",
          marginTop: 20,
          paddingTop: 16,
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
        }}
      >
        <button className="btn btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn btn-primary"
          onClick={handleExport}
          disabled={exporting}
          style={{ minWidth: 130 }}
        >
          {exporting ? "Exporting…" : "⬇ Export .docx"}
        </button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Main RoomScheduleModal
// ---------------------------------------------------------------------------

export default function RoomScheduleModal({ room, onClose }) {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  const fetchRoomSchedules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("schedule_assignments")
        .select("*")
        .eq("room_id", room.id)
        .order("time_start", { ascending: true });

      if (fetchError) throw fetchError;
      setSchedules(data ?? []);
    } catch (err) {
      console.error("[RoomScheduleModal] Failed to fetch schedules:", err);
      setError("Failed to load schedules. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [room.id]);

  useEffect(() => {
    fetchRoomSchedules();
  }, [fetchRoomSchedules]);

  const grouped = schedules.reduce((acc, s) => {
    const day = s.pattern || "Unassigned";
    if (!acc[day]) acc[day] = [];
    acc[day].push(s);
    return acc;
  }, {});

  const patternOrder = ["MW", "TTH", "WF", "TF", "SAT"];
  const sortedPatterns = Object.keys(grouped).sort((a, b) => {
    const ai = patternOrder.indexOf(a);
    const bi = patternOrder.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  return (
    <>
      <Modal isOpen onClose={onClose} size="lg">
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: 20,
            gap: 12,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "var(--text)",
                marginBottom: 4,
              }}
            >
              📅 {room.number} — Schedule
            </div>
            <div
              style={{
                fontSize: 12,
                color: "var(--text3)",
                display: "flex",
                gap: 12,
              }}
            >
              <span>{room.type}</span>
              {room.wing && <span>📍 {room.wing} Wing</span>}
              <span>Cap: {room.capacity}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "1px solid var(--border)",
              color: "var(--text2)",
              cursor: "pointer",
              fontSize: 14,
              padding: "4px 10px",
              borderRadius: 6,
              lineHeight: 1.4,
            }}
          >
            ✕
          </button>
        </div>

        <div
          style={{ borderTop: "1px solid var(--border)", marginBottom: 20 }}
        />

        {/* Body */}
        {loading ? (
          <div
            style={{
              textAlign: "center",
              padding: "40px 0",
              color: "var(--text3)",
              fontSize: 13,
            }}
          >
            Loading schedules…
          </div>
        ) : error ? (
          <div
            style={{
              textAlign: "center",
              padding: "40px 0",
              color: "var(--red)",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        ) : schedules.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "48px 0",
              color: "var(--text3)",
              fontSize: 13,
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 10 }}>🗓</div>
            <div
              style={{
                fontWeight: 600,
                marginBottom: 4,
                color: "var(--text2)",
              }}
            >
              No schedules assigned
            </div>
            <div>This room has no scheduled classes yet.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Summary bar */}
            <div
              style={{
                display: "flex",
                gap: 16,
                padding: "10px 14px",
                background: "var(--surface2)",
                borderRadius: 8,
                fontSize: 12,
                color: "var(--text2)",
              }}
            >
              <span>
                <strong style={{ color: "var(--text)" }}>
                  {schedules.length}
                </strong>{" "}
                {schedules.length === 1 ? "class" : "classes"} scheduled
              </span>
              <span style={{ color: "var(--border)" }}>|</span>
              <span>
                <strong style={{ color: "var(--text)" }}>
                  {sortedPatterns.length}
                </strong>{" "}
                day {sortedPatterns.length === 1 ? "pattern" : "patterns"}
              </span>
            </div>

            {/* Schedule groups by pattern */}
            {sortedPatterns.map((pattern) => (
              <div key={pattern}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--text3)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: 8,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span>{getDayLabels(pattern)}</span>
                  <div
                    style={{ flex: 1, height: 1, background: "var(--border)" }}
                  />
                  <span style={{ color: "var(--text3)", fontWeight: 500 }}>
                    {grouped[pattern].length} class
                    {grouped[pattern].length > 1 ? "es" : ""}
                  </span>
                </div>

                <div
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                  {grouped[pattern]
                    .slice()
                    .sort((a, b) => {
                      const aMin = parseSqlTimeToMinutes(a.time_start) ?? 9999;
                      const bMin = parseSqlTimeToMinutes(b.time_start) ?? 9999;
                      return aMin - bMin;
                    })
                    .map((s, idx) => {
                      const statusStyle =
                        STATUS_COLORS[s.status] ?? STATUS_COLORS["Pending"];
                      const subjectCode =
                        s.subject_code ?? s.course_code ?? s.code ?? "—";
                      const section = s.section ?? "—";
                      const instructor =
                        s.instructor_name ?? s.instructor ?? "—";
                      const timeDisplay = getTimeDisplay(s);

                      return (
                        <div
                          key={s.id ?? idx}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr 1fr auto",
                            alignItems: "center",
                            gap: 10,
                            padding: "10px 14px",
                            background: "var(--surface2)",
                            border: "1px solid var(--border)",
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                        >
                          <div>
                            <div
                              style={{
                                fontWeight: 700,
                                fontSize: 13,
                                color: "var(--text)",
                                fontFamily: "var(--mono)",
                              }}
                            >
                              {subjectCode}
                            </div>
                            <div
                              style={{ color: "var(--text3)", marginTop: 1 }}
                            >
                              Section {section}
                            </div>
                          </div>
                          <div>
                            <div
                              style={{ color: "var(--text2)", fontWeight: 500 }}
                            >
                              {instructor}
                            </div>
                            <div
                              style={{ color: "var(--text3)", marginTop: 1 }}
                            >
                              Instructor
                            </div>
                          </div>
                          <div>
                            <div
                              style={{
                                color: "var(--text2)",
                                fontFamily: "var(--mono)",
                                fontSize: 11,
                              }}
                            >
                              {timeDisplay}
                            </div>
                            <div
                              style={{ color: "var(--text3)", marginTop: 1 }}
                            >
                              Time
                            </div>
                          </div>
                          <div>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "3px 8px",
                                borderRadius: 20,
                                fontSize: 10,
                                fontWeight: 700,
                                background: statusStyle.bg,
                                color: statusStyle.text,
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                              }}
                            >
                              {s.status ?? "Pending"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            borderTop: "1px solid var(--border)",
            marginTop: 24,
            paddingTop: 16,
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          {!loading && !error && schedules.length > 0 && (
            <button
              className="btn btn-primary"
              onClick={() => setShowPreview(true)}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              📄 Export Schedule
            </button>
          )}
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </Modal>

      {showPreview && (
        <SchedulePreviewModal
          room={room}
          schedules={schedules}
          onClose={() => setShowPreview(false)}
        />
      )}
    </>
  );
}
