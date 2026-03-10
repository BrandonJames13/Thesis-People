import { useState } from "react";
import { useData } from "../context/DataContext";
import { useNotification } from "../context/NotificationContext";
import { exportToExcel } from "../utils/exportUtils";
import { TIME_SLOTS, DAYS, COLOR_MAP } from "../data/constants";
import { patternDaysMap } from "../data/constants";
import ScheduleModal from "../components/schedule/ScheduleModal";

export default function SchedulePage() {
  const { rooms, scheduleAssignments } = useData();
  const { showNotification } = useNotification();

  const [weekOffset, setWeekOffset] = useState(0);
  const [roomFilter, setRoomFilter] = useState("");
  const [showModal, setShowModal] = useState(false);

  // Compute week label
  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() - baseDate.getDay() + 1 + weekOffset * 7);
  const endDate = new Date(baseDate);
  endDate.setDate(baseDate.getDate() + 5);
  const fmt = (d) =>
    d.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
  const weekLabel = `${fmt(baseDate)} – ${fmt(endDate)}, ${baseDate.getFullYear()}`;

  // Filter assignments by selected room
  const visibleAssignments = roomFilter
    ? scheduleAssignments.filter((c) => c.room === roomFilter)
    : scheduleAssignments;

  // Build grid
  const grid = {};
  DAYS.forEach((d) => {
    grid[d] = {};
  });

  visibleAssignments.forEach((course) => {
    if (!course.time || !course.pattern) return;
    const timeMatch = course.time.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!timeMatch) return;
    let h = parseInt(timeMatch[1]);
    const ampm = timeMatch[3].toUpperCase();
    if (ampm === "PM" && h !== 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    const spanCount = Math.max(
      1,
      Math.ceil(Math.round((course.duration || 1.5) * 60) / 60),
    );
    const assignedDays = patternDaysMap[course.pattern] || [];
    assignedDays.forEach((day) => {
      for (let s = 0; s < spanCount; s++) {
        const slotH = h + s;
        if (!TIME_SLOTS.includes(slotH)) continue;
        grid[day][slotH] =
          s === 0
            ? {
                course,
                span: spanCount,
                color: COLOR_MAP[course.pattern] || "blue",
              }
            : "blocked";
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
              auto-assign or manually add courses.
            </div>
          </td>
        </tr>
      );
    }

    if (roomFilter && visibleAssignments.length === 0) {
      return (
        <tr>
          <td colSpan={7} className="schedule-empty-state">
            <div className="empty-icon">🏫</div>
            <div className="empty-title">No classes in this room</div>
            <div className="empty-sub">
              {roomFilter} has no assignments in the current schedule.
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
        const c = cell.course;
        const dh = Math.floor(c.duration);
        const dm = Math.round((c.duration - dh) * 60);
        cells.push(
          <td
            key={day}
            className={`sched-td occupied-${cell.color}${c.status === "Conflict" ? " conflict-slot" : ""}`}
            rowSpan={cell.span}
          >
            <div
              className={`sched-course${c.status === "Conflict" ? " conflict-text" : ""}`}
            >
              {c.code}
              {c.status === "Conflict" ? " ⚠" : ""}
            </div>
            <div className="sched-room">{c.room}</div>
            <div className="sched-prof">{c.instructor}</div>
            <div className="sched-dur">
              {dm > 0 ? `${dh}h ${dm}m` : `${dh}h`} · {c.pattern}
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
            AY 2025–2026 · 1st Semester · Week of {weekLabel}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
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
            className="btn btn-secondary"
            onClick={() => setWeekOffset((w) => w - 1)}
          >
            ← Prev
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setWeekOffset((w) => w + 1)}
          >
            Next →
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              exportToExcel(scheduleAssignments);
              showNotification("Schedule exported to Excel (CSV) ✓");
            }}
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
    </div>
  );
}
