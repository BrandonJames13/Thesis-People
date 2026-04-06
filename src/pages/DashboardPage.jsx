import { useNavigate } from "react-router-dom";
import { useData } from "../context/DataContext";
import { useConflicts } from "../context/ConflictContext";
import ScheduleModal from "../components/schedule/ScheduleModal";
import { useState } from "react";
import { exportToExcel } from "../utils/exportUtils";
import { useNotification } from "../context/NotificationContext";

const algoSteps = [
  {
    status: "done",
    icon: "✓",
    name: "Input Data Collection",
    desc: "127 courses · 48 rooms · 34 instructors · 30 time slots loaded",
    time: "0.3s",
  },
  {
    status: "done",
    icon: "✓",
    name: "Data Validation & Constraint Check",
    desc: "Hard constraints verified · Tier-1 rules activated",
    time: "0.6s",
  },
  {
    status: "done",
    icon: "✓",
    name: "Greedy Assignment — Tier 1 (Hard)",
    desc: "No double-booking · Capacity compliance · Instructor conflicts checked",
    time: "3.1s",
  },
  {
    status: "done",
    icon: "✓",
    name: "Soft Constraint Optimization — Tier 2",
    desc: "Time pref 30% · Room type 25% · Compactness 25% · Balance 20%",
    time: "2.1s",
  },
  {
    status: "active",
    icon: "!",
    name: "Localized Reallocation",
    desc: "3 conflicts detected — attempting alternative assignments",
    time: "1.3s",
  },
  {
    status: "idle",
    icon: "○",
    name: "Cloud Synchronization (PostgreSQL)",
    desc: "Awaiting conflict resolution before push to cloud storage",
    time: "—",
  },
];

const utilRows = [
  { label: "Labs", pct: 91, color: "var(--purple)" },
  { label: "Floor 1", pct: 85, color: "var(--green)" },
  { label: "Floor 2", pct: 78, color: "var(--accent2)" },
  { label: "Floor 3", pct: 64, color: "var(--orange)" },
];

export default function DashboardPage() {
  const navigate = useNavigate();
  const { rooms, courses, assignments, conflicts, scheduleAssignments } =
    useData();
  const { detectConflicts } = useConflicts();
  const { showNotification } = useNotification();
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [yearFilter, setYearFilter] = useState("");

  const utilization =
    courses.length > 0
      ? Math.round((assignments.length / courses.length) * 100)
      : 0;
  const { hard } = detectConflicts();
  const hardCount = hard.length;

  return (
    <div className="page-container">
      <div className="section-header">
        <div>
          <div className="section-title">Dashboard</div>
          <div className="section-subtitle">
            AY 2025–2026 · 1st Semester · College of Computer Studies, TSU
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            className="btn btn-secondary"
            onClick={() => {
              exportToExcel(scheduleAssignments);
              showNotification("Schedule exported to Excel (CSV) ✓");
            }}
          >
            ↓ Export
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setShowScheduleModal(true)}
          >
            ▶ Generate Schedule
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="stats-grid">
        <div className="stat-card blue">
          <div className="stat-icon">🏫</div>
          <div className="stat-label">Total Rooms</div>
          <div className="stat-value">{rooms.length}</div>
          <div className="stat-delta">
            {rooms.filter((r) => r.status === "Available").length} available
          </div>
        </div>
        <div className="stat-card green">
          <div className="stat-icon">✅</div>
          <div className="stat-label">Scheduled</div>
          <div className="stat-value">{assignments.length}</div>
          <div className="stat-delta">{courses.length} total courses</div>
        </div>
        <div className="stat-card red">
          <div className="stat-icon">⚠</div>
          <div className="stat-label">Conflicts</div>
          <div className="stat-value">{hardCount}</div>
          <div className="stat-delta">requires manual review</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-icon">📊</div>
          <div className="stat-label">Utilization</div>
          <div className="stat-value">{utilization}%</div>
          <div className="stat-delta">target ≥ 80%</div>
        </div>
      </div>

      {/* Dashboard Grid */}
      <div className="dashboard-grid">
        <div>
          {/* Recent Assignments */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">📋 Recent Assignments</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <select
                  className="search-input"
                  style={{ width: 120, padding: "4px 8px", fontSize: 11 }}
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
                <button
                  className="btn btn-secondary"
                  style={{ padding: "4px 10px", fontSize: 11 }}
                  onClick={() => navigate("/schedule")}
                >
                  View All
                </button>
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Room</th>
                  <th>Time Slot</th>
                  <th>Instructor</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {assignments
                  .filter((c) => (yearFilter ? c.year === yearFilter : true))
                  .slice(0, 6)
                  .map((c) => (
                    <tr key={c.code}>
                      <td>
                        <span className="monospace">{c.code}</span>
                        <br />
                        <span style={{ fontSize: 11, color: "var(--text3)" }}>
                          {c.title}
                        </span>
                      </td>
                      <td className="monospace">{c.room}</td>
                      <td className="monospace">{c.time}</td>
                      <td>{c.instructor}</td>
                      <td>
                        <span
                          className={`pill pill-${c.status === "Assigned" ? "green" : "red"}`}
                        >
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                {assignments.filter((c) =>
                  yearFilter ? c.year === yearFilter : true,
                ).length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      style={{
                        textAlign: "center",
                        padding: 40,
                        color: "var(--text3)",
                      }}
                    >
                      No assignments yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Algorithm Steps */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                ⚙ Constraint-Based Greedy Algorithm — Last Run
              </div>
              <span className="pill pill-green">Completed · 7.4s</span>
            </div>
            <div className="algo-steps">
              {algoSteps.map((step, i) => (
                <div className="algo-step" key={i}>
                  <div className={`step-dot ${step.status}`}>{step.icon}</div>
                  <div>
                    <div className="step-name">{step.name}</div>
                    <div className="step-desc">{step.desc}</div>
                  </div>
                  <div className="step-time">{step.time}</div>
                </div>
              ))}
            </div>
            <div className="progress-wrap">
              <div className="progress-header">
                <span>Generation Progress</span>
                <span>124 / 127 courses assigned</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: "97.6%" }} />
              </div>
            </div>
          </div>
        </div>

        {/* Side Panel */}
        <div className="side-panel">
          {/* Quick Actions */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">⚡ Quick Actions</div>
            </div>
            <div
              style={{
                padding: 14,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <button
                className="btn btn-primary"
                style={{ justifyContent: "center" }}
                onClick={() => setShowScheduleModal(true)}
              >
                ▶ Re-generate Schedule
              </button>
              <button
                className={hardCount > 0 ? "btn btn-danger" : "btn btn-success"}
                style={{ justifyContent: "center" }}
                onClick={() => navigate("/conflicts")}
              >
                {hardCount > 0
                  ? `⚠ Resolve ${hardCount} Conflict${hardCount !== 1 ? "s" : ""}`
                  : "✓ No Conflicts"}
              </button>
              <button
                className="btn btn-secondary"
                style={{ justifyContent: "center" }}
                onClick={() => {
                  exportToExcel(scheduleAssignments);
                  showNotification("Schedule exported to Excel (CSV) ✓");
                }}
              >
                ↓ Export to Excel
              </button>
              <button
                className="btn btn-success"
                style={{ justifyContent: "center" }}
              >
                ☁ Sync to PostgreSQL
              </button>
            </div>
          </div>

          {/* Room Utilization */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">📊 Room Utilization by Floor</div>
            </div>
            {utilRows.map((row) => (
              <div className="util-row" key={row.label}>
                <div className="util-label">{row.label}</div>
                <div className="util-bar-wrap">
                  <div
                    className="util-fill"
                    style={{ width: `${row.pct}%`, background: row.color }}
                  />
                </div>
                <div className="util-pct" style={{ color: row.color }}>
                  {row.pct}%
                </div>
              </div>
            ))}
            <div
              style={{
                padding: "12px 20px",
                fontSize: 11,
                color: "var(--text3)",
                borderTop: "1px solid var(--border)",
              }}
            >
              Intl benchmark: 80–90% · Labs &amp; Floor 1 on target ✓
            </div>
          </div>

          {/* System Status */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">🛈 System Status</div>
            </div>
            <div
              style={{
                padding: "12px 16px",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div className="mini-stat">
                <div
                  className="mini-icon"
                  style={{ background: "rgba(47,129,247,0.15)" }}
                >
                  ⚡
                </div>
                <div>
                  <div className="mini-label">Generation Time</div>
                  <div className="mini-value">
                    7.4s{" "}
                    <span style={{ fontSize: 11, color: "var(--text3)" }}>
                      / 127 courses
                    </span>
                  </div>
                </div>
              </div>
              <div className="mini-stat">
                <div
                  className="mini-icon"
                  style={{ background: "rgba(63,185,80,0.15)" }}
                >
                  🔄
                </div>
                <div>
                  <div className="mini-label">Last Sync</div>
                  <div className="mini-value">
                    2m{" "}
                    <span style={{ fontSize: 11, color: "var(--text3)" }}>
                      ago · Cloud OK
                    </span>
                  </div>
                </div>
              </div>
              <div className="mini-stat">
                <div
                  className="mini-icon"
                  style={{ background: "rgba(188,140,255,0.15)" }}
                >
                  📦
                </div>
                <div>
                  <div className="mini-label">Algorithm</div>
                  <div className="mini-value" style={{ fontSize: 12 }}>
                    Greedy+LocalRe
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showScheduleModal && (
        <ScheduleModal onClose={() => setShowScheduleModal(false)} />
      )}
    </div>
  );
}
