import { useEffect, useState, useCallback, useRef } from "react";
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
  VerticalMergeType,
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
// Day-grid helpers
// ---------------------------------------------------------------------------

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const PATTERN_DAY_MAP = {
  MW: [0, 2],
  TTH: [1, 3],
  WF: [2, 4],
  TF: [1, 4],
  MWF: [0, 2, 4],
  SAT: [5],
  MTH: [0, 3],
  TW: [1, 2],
  MTWTHF: [0, 1, 2, 3, 4],
};

function getPatternDayIndices(pattern) {
  if (!pattern) return [];
  return PATTERN_DAY_MAP[pattern.toUpperCase()] ?? [];
}

function generateTimeSlots() {
  const slots = [];
  for (let min = 7 * 60; min < 21 * 60; min += 30) slots.push(min);
  return slots;
}

function formatMinTo12(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const hh = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${hh}:${String(m).padStart(2, "0")} ${ampm}`;
}

const PATTERN_CELL_COLORS = {
  MW: "fde9a2",
  TTH: "d4edda",
  WF: "cce5ff",
  TF: "e2d9f3",
  MWF: "fde9a2",
  SAT: "f8d7da",
  MTH: "fff3cd",
  default: "e8f4fd",
};

function getCellColorHex(pattern) {
  return (
    PATTERN_CELL_COLORS[pattern?.toUpperCase()] ?? PATTERN_CELL_COLORS.default
  );
}

function getCellColor(pattern) {
  return "#" + getCellColorHex(pattern);
}

// Build cellContent map: "di-slotMin" => { ...assignment, _spanRows } | "skip"
function buildCellContent(schedules) {
  const cellContent = {};
  schedules.forEach((s) => {
    const startMin = parseSqlTimeToMinutes(s.time_start);
    const endMin = parseSqlTimeToMinutes(s.time_end);
    if (!Number.isFinite(startMin)) return;
    const end = Number.isFinite(endMin) ? endMin : startMin + 60;
    const spanRows = Math.max(1, Math.round((end - startMin) / 30));
    const dayIndices = getPatternDayIndices(s.pattern);
    dayIndices.forEach((di) => {
      cellContent[`${di}-${startMin}`] = { ...s, _spanRows: spanRows };
      for (let m = startMin + 30; m < end; m += 30) {
        cellContent[`${di}-${m}`] = "skip";
      }
    });
  });
  return cellContent;
}

// ---------------------------------------------------------------------------
// Export to DOCX with correct vertical row-spanning
// ---------------------------------------------------------------------------

async function exportToDocx(schedules, room, docMeta) {
  const timeSlots = generateTimeSlots();
  const cellContent = buildCellContent(schedules);

  // Portrait: 8.5" x 11" = 12240 x 15840 twips, margins 720 each side
  // Content width = 12240 - 1440 = 10800 twips
  const TIME_COL = 800;
  const DAY_COL = Math.floor((10800 - TIME_COL) / 6); // 1666 each
  const colWidths = [TIME_COL, ...DAYS.map(() => DAY_COL)];
  const tableWidth = colWidths.reduce((a, b) => a + b, 0);

  const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" };
  const thickBorder = { style: BorderStyle.SINGLE, size: 8, color: "999999" };
  const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };

  const allBorders = {
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

  const rows = [];

  // ── Header row ────────────────────────────────────────────────────────────
  rows.push(
    new TableRow({
      tableHeader: true,
      height: { value: 360, rule: "exact" },
      children: [
        new TableCell({
          width: { size: TIME_COL, type: WidthType.DXA },
          borders: headerBorders,
          shading: { fill: "4472C4", type: ShadingType.CLEAR },
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({ children: [] })],
        }),
        ...DAYS.map(
          (day) =>
            new TableCell({
              width: { size: DAY_COL, type: WidthType.DXA },
              borders: headerBorders,
              shading: { fill: "4472C4", type: ShadingType.CLEAR },
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 40, bottom: 40, left: 60, right: 60 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: day.toUpperCase(),
                      bold: true,
                      color: "FFFFFF",
                      size: 14,
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

  // ── Data rows — one per 30-min slot ──────────────────────────────────────
  timeSlots.forEach((slotMin) => {
    const isHour = slotMin % 60 === 0;

    const timeCell = new TableCell({
      width: { size: TIME_COL, type: WidthType.DXA },
      borders: allBorders,
      shading: { fill: isHour ? "F2F2F2" : "FAFAFA", type: ShadingType.CLEAR },
      verticalAlign: VerticalAlign.CENTER,
      margins: { top: 20, bottom: 20, left: 40, right: 40 },
      children: [
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [
            new TextRun({
              text: formatMinTo12(slotMin),
              size: isHour ? 13 : 11,
              bold: isHour,
              font: "Arial",
              color: isHour ? "444444" : "AAAAAA",
            }),
          ],
        }),
      ],
    });

    const dayCells = DAYS.map((_, di) => {
      const key = `${di}-${slotMin}`;
      const cell = cellContent[key];

      // "skip" = this slot is covered by a rowspan from a cell above
      // Use VerticalMergeType.CONTINUE to continue the merge
      if (cell === "skip") {
        return new TableCell({
          width: { size: DAY_COL, type: WidthType.DXA },
          borders: {
            top: noBorder,
            bottom: noBorder,
            left: thinBorder,
            right: thinBorder,
          },
          verticalMerge: VerticalMergeType.CONTINUE,
          children: [new Paragraph({ children: [] })],
        });
      }

      if (cell) {
        const subjectCode =
          cell.subject_code ?? cell.course_code ?? cell.code ?? "";
        const section = cell.section ?? "";
        const instructor = cell.instructor_name ?? cell.instructor ?? "";
        const fillHex = getCellColorHex(cell.pattern);

        return new TableCell({
          width: { size: DAY_COL, type: WidthType.DXA },
          borders: allBorders,
          shading: { fill: fillHex, type: ShadingType.CLEAR },
          verticalAlign: VerticalAlign.CENTER,
          verticalMerge: VerticalMergeType.RESTART,
          margins: { top: 40, bottom: 40, left: 40, right: 40 },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 0, after: 0 },
              children: [
                new TextRun({
                  text: "-Sched. 1-",
                  size: 12,
                  font: "Arial",
                  color: "555555",
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
                  size: 13,
                  font: "Arial",
                  color: "333333",
                }),
              ],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 20, after: 0 },
              border: {
                top: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
              },
              children: [
                new TextRun({
                  text: instructor,
                  size: 12,
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
        borders: allBorders,
        children: [new Paragraph({ children: [] })],
      });
    });

    rows.push(
      new TableRow({
        height: { value: 260, rule: "atLeast" },
        children: [timeCell, ...dayCells],
      }),
    );
  });

  const scheduleTable = new Table({
    width: { size: tableWidth, type: WidthType.DXA },
    columnWidths: colWidths,
    rows,
  });

  // ── Signature block helper ────────────────────────────────────────────────
  function sigBlock(name, title) {
    return [
      new Paragraph({
        spacing: { before: 300, after: 0 },
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
          new TextRun({
            text: name || "",
            size: 20,
            bold: true,
            font: "Arial",
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 20, after: 0 },
        children: [new TextRun({ text: title || "", size: 18, font: "Arial" })],
      }),
    ];
  }

  // ── Assemble document ─────────────────────────────────────────────────────
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 12240,
              height: 15840,
              orientation: PageOrientation.PORTRAIT,
            },
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 40 },
            children: [
              new TextRun({
                text: docMeta.schoolName,
                bold: true,
                size: 26,
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
                size: 24,
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
            spacing: { before: 0, after: 160 },
            children: [
              new TextRun({
                text: `Room: ${docMeta.roomLabel}`,
                size: 20,
                font: "Arial",
              }),
            ],
          }),

          scheduleTable,

          new Paragraph({
            spacing: { before: 400, after: 0 },
            children: [new TextRun("")],
          }),

          // Two-column signature area using a borderless table
          new Table({
            width: { size: tableWidth, type: WidthType.DXA },
            columnWidths: [tableWidth / 2, tableWidth / 2],
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
              insideH: { style: BorderStyle.NONE },
              insideV: { style: BorderStyle.NONE },
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    borders: {
                      top: { style: BorderStyle.NONE },
                      bottom: { style: BorderStyle.NONE },
                      left: { style: BorderStyle.NONE },
                      right: { style: BorderStyle.NONE },
                    },
                    margins: { right: 400 },
                    children: [
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
                      ...sigBlock(
                        docMeta.preparedByName,
                        docMeta.preparedByTitle,
                      ),
                    ],
                  }),
                  new TableCell({
                    borders: {
                      top: { style: BorderStyle.NONE },
                      bottom: { style: BorderStyle.NONE },
                      left: { style: BorderStyle.NONE },
                      right: { style: BorderStyle.NONE },
                    },
                    margins: { left: 400 },
                    children: [
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
                      ...sigBlock(docMeta.approvalName, docMeta.approvalTitle),
                    ],
                  }),
                ],
              }),
            ],
          }),
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
  const [exportingJpg, setExportingJpg] = useState(false);
  const previewRef = useRef(null);

  const timeSlots = generateTimeSlots();
  const cellContent = buildCellContent(schedules);

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

  const handleExportJpg = async () => {
    if (!previewRef.current) return;
    setExportingJpg(true);
    try {
      const html2canvas = (
        await import("https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.esm.js")
      ).default;
      const canvas = await html2canvas(previewRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });
      const link = document.createElement("a");
      link.download = `${docMeta.roomLabel ?? room.number}_Schedule.jpg`;
      link.href = canvas.toDataURL("image/jpeg", 0.95);
      link.click();
    } catch (err) {
      console.error("[SchedulePreviewModal] JPG export failed:", err);
      alert("JPG export failed. Please try again.");
    } finally {
      setExportingJpg(false);
    }
  };

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
            Customize document fields, then export as Word (.docx) or JPG image
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
        {/* Sidebar fields */}
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

        {/* Preview pane */}
        <div style={{ flex: 1, overflowX: "auto" }}>
          <div
            ref={previewRef}
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
                          fontSize: isHour ? 8 : 7,
                          color: isHour ? "#333" : "#aaa",
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
          className="btn btn-secondary"
          onClick={handleExportJpg}
          disabled={exportingJpg || exporting}
          style={{ minWidth: 130 }}
        >
          {exportingJpg ? "Exporting…" : "🖼 Export .jpg"}
        </button>
        <button
          className="btn btn-primary"
          onClick={handleExport}
          disabled={exporting || exportingJpg}
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
                    .sort(
                      (a, b) =>
                        (parseSqlTimeToMinutes(a.time_start) ?? 9999) -
                        (parseSqlTimeToMinutes(b.time_start) ?? 9999),
                    )
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
