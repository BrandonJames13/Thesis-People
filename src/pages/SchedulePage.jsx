import { useState, useMemo } from "react";
import { useData } from "../context/DataContext";
import { TIME_SLOTS, DAYS, COLOR_MAP } from "../data/constants";
import { patternDaysMap } from "../data/constants";
import ScheduleModal from "../components/schedule/ScheduleModal";
import ExportModal from "../components/common/ExportModal";
import {
  formatAssignmentLabel,
  getAssignmentSectionId,
} from "../utils/scheduleUtils";
import { formatTimeFromMin } from "../utils/timeUtils";

function getTimeRangeFromAssignment(assignment) {
  const rawTime = String(assignment?.time ?? "");
  const match = rawTime.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = String(match[3]).toUpperCase();

  if (period === "PM" && hour !== 12) hour += 12;
  if (period === "AM" && hour === 12) hour = 0;

  const startMin = hour * 60 + minute;
  const durationMinutes = Math.max(
    1,
    Math.round((Number(assignment?.duration ?? 1.5) || 1.5) * 60),
  );
  const endMin = startMin + durationMinutes;

  return { startMin, endMin };
}

export default function SchedulePage() {
  const { rooms, scheduleAssignments, instructors } = useData();

  const [roomFilter, setRoomFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [instructorFilter, setInstructorFilter] = useState("");
  const [instructorSearch, setInstructorSearch] = useState("");
  const [showInstructorDropdown, setShowInstructorDropdown] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  // Get unique instructor names from assignments + instructor list
  const allInstructorNames = useMemo(() => {
    const fromAssignments = scheduleAssignments
      .map((a) => a.instructor)
      .filter(Boolean);
    const fromList = instructors.map((i) => i.name);
    return [...new Set([...fromList, ...fromAssignments])].sort();
  }, [scheduleAssignments, instructors]);

  const filteredInstructorNames = allInstructorNames.filter((name) =>
    name.toLowerCase().includes(instructorSearch.toLowerCase()),
  );

  const labelCounts = useMemo(() => {
    const counts = new Map();
    scheduleAssignments.forEach((assignment) => {
      const label = formatAssignmentLabel(assignment);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    });
    return counts;
  }, [scheduleAssignments]);

  const getDisplayLabel = (assignment) => {
    const label = formatAssignmentLabel(assignment);
    if ((labelCounts.get(label) ?? 0) <= 1) return label;

    const sectionRef = String(
      getAssignmentSectionId(assignment) ?? assignment?.assignment_id ?? "",
    ).trim();
    if (!sectionRef) return label;

    const shortRef =
      sectionRef.length > 14 ? sectionRef.slice(-14).toUpperCase() : sectionRef;
    return `${label} · ${shortRef}`;
  };

  // Filter assignments by selected room, year, and instructor
  const visibleAssignments = scheduleAssignments.filter((assignment) => {
    const roomMatch = roomFilter ? assignment.room === roomFilter : true;
    const yearMatch = yearFilter ? assignment.year === yearFilter : true;
    const instrMatch = instructorFilter
      ? assignment.instructor?.trim().toLowerCase() ===
        instructorFilter.trim().toLowerCase()
      : true;
    const sectionMatch = sectionFilter
      ? formatAssignmentLabel(assignment)
          .toLowerCase()
          .includes(sectionFilter.trim().toLowerCase())
      : true;
    return roomMatch && yearMatch && instrMatch && sectionMatch;
  });

  // Build bounded grid map (one visible block per day/slot cell).
  const grid = {};
  DAYS.forEach((d) => {
    grid[d] = {};
  });

  const slotRanges = TIME_SLOTS.map((hour, index) => ({
    hour,
    index,
    startMin: hour * 60,
    endMin: (hour + 1) * 60,
  }));

  visibleAssignments.forEach((assignment) => {
    if (!assignment.time || !assignment.pattern) return;

    const timeRange = getTimeRangeFromAssignment(assignment);
    if (!timeRange) return;

    const coveredSlots = slotRanges.filter(
      (slot) =>
        timeRange.startMin < slot.endMin && timeRange.endMin > slot.startMin,
    );
    if (coveredSlots.length === 0) return;

    const startingSlot = coveredSlots[0];
    const boundedSpan = coveredSlots.length;

    const assignedDays = patternDaysMap[assignment.pattern] || [];
    assignedDays.forEach((day) => {
      if (!DAYS.includes(day)) return;
      if (grid[day][startingSlot.hour]) return;

      coveredSlots.forEach((slot, slotIndex) => {
        grid[day][slot.hour] =
          slotIndex === 0
            ? {
                assignment,
                span: boundedSpan,
                color: COLOR_MAP[assignment.pattern] || "blue",
                visibleStartMin: timeRange.startMin,
                visibleEndMin: timeRange.endMin,
              }
            : "blocked";
      });

      for (const slot of coveredSlots) {
        if (!TIME_SLOTS.includes(slot.hour)) {
          delete grid[day][slot.hour];
        }
      }
    });
  });

  const renderBody = () => {
    if (scheduleAssignments.length === 0) {
      return (
        <tr>
          <td colSpan={7} className="schedule-empty-state">
            <div className="empty-icon">📅</div>
            <div className="empty-title">No schedule generated yet</div>
            <div className="empty-sub">
              Click <strong>▶ Generate Schedule</strong> on the Dashboard to
              auto-assign or manually add section assignments.
            </div>
          </td>
        </tr>
      );
    }

    if (
      (roomFilter || yearFilter || instructorFilter) &&
      visibleAssignments.length === 0
    ) {
      return (
        <tr>
          <td colSpan={7} className="schedule-empty-state">
            <div className="empty-icon">🏫</div>
            <div className="empty-title">No section assignments found</div>
            <div className="empty-sub">
              No assignments match the selected filters.
            </div>
          </td>
        </tr>
      );
    }

    return TIME_SLOTS.map((h) => {
      const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
      const ampm = h >= 12 ? "PM" : "AM";
      const cells = [];
      DAYS.forEach((day) => {
        const cell = grid[day][h];
        if (cell === "blocked") return;
        if (!cell) {
          cells.push(<td key={day} className="sched-td empty-slot" />);
          return;
        }
        const assignment = cell.assignment;
        const dh = Math.floor(assignment.duration);
        const dm = Math.round((assignment.duration - dh) * 60);
        const visibleWindow =
          Number.isFinite(cell.visibleStartMin) &&
          Number.isFinite(cell.visibleEndMin)
            ? `${formatTimeFromMin(cell.visibleStartMin)}-${formatTimeFromMin(cell.visibleEndMin)}`
            : assignment.time;
        cells.push(
          <td
            key={day}
            className={`sched-td occupied-${cell.color}${assignment.status === "Conflict" ? " conflict-slot" : ""}`}
            rowSpan={cell.span}
          >
            <div
              className={`sched-section${assignment.status === "Conflict" ? " conflict-text" : ""}`}
              title={getDisplayLabel(assignment)}
            >
              {getDisplayLabel(assignment)}
              {assignment.status === "Conflict" ? " ⚠" : ""}
            </div>
            <div className="sched-room">{assignment.room}</div>
            <div className="sched-prof">{assignment.instructor}</div>
            <div className="sched-time-window">{visibleWindow}</div>
            <div className="sched-dur">
              {dm > 0 ? `${dh}h ${dm}m` : `${dh}h`} · {assignment.pattern}
            </div>
          </td>,
        );
      });

      return (
        <tr key={h}>
          <td className="time-col-cell">
            {displayH}:00
            <br />
            <span style={{ fontSize: 10 }}>{ampm}</span>
          </td>
          {cells}
        </tr>
      );
    });
  };

  return (
    <div className="page-container">
      <div className="section-header">
        <div>
          <div className="section-title">Weekly Schedule</div>
          <div className="section-subtitle">
            AY 2025–2026 · 1st Semester · Permanent Schedule
            {instructorFilter ? ` · ${instructorFilter}` : ""}
            {yearFilter ? ` · ${yearFilter} Year` : " · All Year Levels"}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {/* Instructor Dropdown Search */}
          <div style={{ position: "relative" }}>
            <input
              className="search-input"
              style={{ width: 230 }}
              placeholder="🔎 Subject/Section (e.g., IT101-A)"
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
            />
          </div>

          <div style={{ position: "relative" }}>
            <input
              className="search-input"
              style={{ width: 200 }}
              placeholder="🔍 Search instructor..."
              value={instructorSearch}
              onFocus={() => setShowInstructorDropdown(true)}
              onBlur={() =>
                setTimeout(() => setShowInstructorDropdown(false), 150)
              }
              onChange={(e) => {
                setInstructorSearch(e.target.value);
                setInstructorFilter("");
                setShowInstructorDropdown(true);
              }}
            />
            {instructorFilter && (
              <button
                style={{
                  position: "absolute",
                  right: 6,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text3)",
                  fontSize: 14,
                }}
                onClick={() => {
                  setInstructorFilter("");
                  setInstructorSearch("");
                }}
              >
                ✕
              </button>
            )}
            {showInstructorDropdown && filteredInstructorNames.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: "110%",
                  left: 0,
                  right: 0,
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  zIndex: 100,
                  maxHeight: 200,
                  overflowY: "auto",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
                }}
              >
                <div
                  style={{
                    padding: "8px 12px",
                    cursor: "pointer",
                    fontSize: 13,
                    color: "var(--text3)",
                  }}
                  onMouseDown={() => {
                    setInstructorFilter("");
                    setInstructorSearch("");
                  }}
                >
                  All Instructors
                </div>
                {filteredInstructorNames.map((name) => (
                  <div
                    key={name}
                    style={{
                      padding: "8px 12px",
                      cursor: "pointer",
                      fontSize: 13,
                      background:
                        instructorFilter === name
                          ? "var(--accent)"
                          : "transparent",
                      color: instructorFilter === name ? "#fff" : "var(--text)",
                    }}
                    onMouseDown={() => {
                      setInstructorFilter(name);
                      setInstructorSearch(name);
                    }}
                  >
                    {name}
                  </div>
                ))}
              </div>
            )}
          </div>
          <select
            className="search-input"
            style={{ width: 150 }}
            value={yearFilter || "All Years"}
            onChange={(e) =>
              setYearFilter(
                e.target.value === "All Years" ? "" : e.target.value,
              )
            }
          >
            <option>All Years</option>
            <option value="1st">1st Year</option>
            <option value="2nd">2nd Year</option>
            <option value="3rd">3rd Year</option>
            <option value="4th">4th Year</option>
          </select>
          <select
            className="search-input"
            style={{ width: 150 }}
            value={roomFilter || "All Rooms"}
            onChange={(e) =>
              setRoomFilter(
                e.target.value === "All Rooms" ? "" : e.target.value,
              )
            }
          >
            <option>All Rooms</option>
            {rooms.map((r) => (
              <option key={r.number} value={r.number}>
                {r.number}
              </option>
            ))}
          </select>
          <button
            className="btn btn-primary"
            onClick={() => setShowExportModal(true)}
          >
            ↓ Export
          </button>
        </div>
      </div>

      <div className="card">
        <div className="schedule-wrapper">
          <div className="schedule-table-wrap">
            <table className="schedule-table">
              <thead>
                <tr>
                  <th className="time-col">Time</th>
                  {DAYS.map((d) => (
                    <th key={d}>{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>{renderBody()}</tbody>
            </table>
          </div>
        </div>
        <div className="legend">
          <div className="legend-item">
            <div
              className="legend-dot"
              style={{
                background: "rgba(47,129,247,0.5)",
                border: "1px solid var(--accent)",
              }}
            />
            MWF Block
          </div>
          <div className="legend-item">
            <div
              className="legend-dot"
              style={{
                background: "rgba(63,185,80,0.5)",
                border: "1px solid var(--green)",
              }}
            />
            TTH Block
          </div>
          <div className="legend-item">
            <div
              className="legend-dot"
              style={{
                background: "rgba(188,140,255,0.5)",
                border: "1px solid var(--purple)",
              }}
            />
            Other Pattern
          </div>
          <div className="legend-item">
            <div
              className="legend-dot"
              style={{
                background: "rgba(248,81,73,0.5)",
                border: "1px solid var(--red)",
              }}
            />
            Conflict
          </div>
          <div className="legend-item">
            <div
              className="legend-dot"
              style={{
                background: "var(--surface2)",
                border: "1px solid var(--border)",
              }}
            />
            Available
          </div>
        </div>
      </div>

      {showModal && <ScheduleModal onClose={() => setShowModal(false)} />}

      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
      />
    </div>
  );
}
