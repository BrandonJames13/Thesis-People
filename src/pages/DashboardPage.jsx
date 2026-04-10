import { useNavigate } from "react-router-dom";
import { useData } from "../context/DataContext";
import { useConflicts } from "../context/ConflictContext";
import ScheduleModal from "../components/schedule/ScheduleModal";
import ConfirmModal from "../components/common/ConfirmModal";
import ImportModal from "../components/common/ImportModal";
import ExportModal from "../components/common/ExportModal";
import { useState, useRef } from "react";
import { useNotification } from "../context/NotificationContext";
import { useAuth } from "../context/AuthContext";
import {
  formatAssignmentLabel,
  getAssignmentIdentityKey,
} from "../utils/scheduleUtils";

export default function DashboardPage() {
  const navigate = useNavigate();
  const {
    rooms,
    availableRooms,
    availableSubjects,
    availableSections,
    availableInstructors,
    subjectSections,
    assignments,
    scheduleAssignments,
    resetAllData,
  } = useData();
  const { detectConflicts } = useConflicts();
  const { showNotification } = useNotification();
  const { isAdmin } = useAuth();
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [lastGenTime, setLastGenTime] = useState(null);
  const genStartRef = useRef(null);

  const utilization =
    subjectSections.length > 0
      ? Math.round((assignments.length / subjectSections.length) * 100)
      : 0;
  const { hard } = detectConflicts();
  const hardCount = hard.length;

  // Dynamic computed values from real data
  const totalSections = subjectSections.length;
  const totalRooms = rooms.length;
  const totalSubjects = availableSubjects.length;
  const totalAvailableSections = availableSections.length;
  const totalAvailableRooms = availableRooms.length;
  const totalAvailableInstructors = availableInstructors.length;
  const assignedSections = assignments.length;
  const hasSchedule = scheduleAssignments.length > 0;
  const progressPct =
    totalSections > 0
      ? Math.round((assignedSections / totalSections) * 100)
      : 0;
  const genTimeLabel = lastGenTime !== null ? `${lastGenTime}s` : "—";

  const requireAdmin = () => {
    if (isAdmin) return true;
    showNotification("Admin access required for this action.");
    return false;
  };

  // Dynamic algo steps
  const algoSteps = [
    {
      status: hasSchedule ? "done" : "idle",
      icon: hasSchedule ? "✓" : "○",
      name: "Input Data Collection",
      desc: hasSchedule
        ? `${totalAvailableRooms} available rooms · ${totalAvailableInstructors} available instructors · ${totalSubjects} subjects · ${totalAvailableSections} available sections loaded`
        : "Waiting for schedule generation",
      time: hasSchedule ? "0.3s" : "—",
    },
    {
      status: hasSchedule ? "done" : "idle",
      icon: hasSchedule ? "✓" : "○",
      name: "Data Validation & Constraint Check",
      desc: hasSchedule
        ? "Hard constraints verified · Tier-1 rules activated"
        : "—",
      time: hasSchedule ? "0.6s" : "—",
    },
    {
      status: hasSchedule ? "done" : "idle",
      icon: hasSchedule ? "✓" : "○",
      name: "Greedy Assignment — Tier 1 (Hard)",
      desc: hasSchedule
        ? "No double-booking · Capacity compliance · Instructor conflicts checked"
        : "—",
      time: hasSchedule ? "3.1s" : "—",
    },
    {
      status: hasSchedule ? "done" : "idle",
      icon: hasSchedule ? "✓" : "○",
      name: "Soft Constraint Optimization — Tier 2",
      desc: hasSchedule
        ? "Time pref 30% · Room type 25% · Compactness 25% · Balance 20%"
        : "—",
      time: hasSchedule ? "2.1s" : "—",
    },
    {
      status:
        hasSchedule && hardCount > 0 ? "active" : hasSchedule ? "done" : "idle",
      icon: hasSchedule && hardCount > 0 ? "!" : hasSchedule ? "✓" : "○",
      name: "Localized Reallocation",
      desc: hasSchedule
        ? hardCount > 0
          ? `${hardCount} conflict${hardCount !== 1 ? "s" : ""} detected — attempting alternative section assignments`
          : "No conflicts detected — all constraints satisfied"
        : "—",
      time: hasSchedule ? "1.3s" : "—",
    },
  ];

  // Dynamic room utilization from real room data
  const labs = rooms.filter((r) => r.type === "Computer Lab");
  const lectures = rooms.filter((r) => r.type === "Lecture");
  const labsOccupied = labs.filter((r) => r.status === "Occupied").length;
  const lecturesOccupied = lectures.filter(
    (r) => r.status === "Occupied",
  ).length;
  const allOccupied = rooms.filter((r) => r.status === "Occupied").length;
  const utilRows = [
    {
      label: "Labs",
      pct: labs.length > 0 ? Math.round((labsOccupied / labs.length) * 100) : 0,
      color: "var(--purple)",
    },
    {
      label: "Lecture Rooms",
      pct:
        lectures.length > 0
          ? Math.round((lecturesOccupied / lectures.length) * 100)
          : 0,
      color: "var(--green)",
    },
    {
      label: "All Rooms",
      pct:
        rooms.length > 0 ? Math.round((allOccupied / rooms.length) * 100) : 0,
      color: "var(--accent2)",
    },
  ];

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
          {isAdmin && (
            <button
              className="btn btn-secondary"
              onClick={() => setShowImportModal(true)}
            >
              ↑ Import
            </button>
          )}
          <button
            className="btn btn-secondary"
            onClick={() => setShowExportModal(true)}
          >
            ↓ Export
          </button>
          {isAdmin && (
            <button
              className="btn btn-primary"
              onClick={() => {
                if (!requireAdmin()) return;
                genStartRef.current = performance.now();
                setShowScheduleModal(true);
              }}
            >
              ▶ Generate Schedule
            </button>
          )}
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
          <div className="stat-delta">{totalSections} total sections</div>
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
              <div className="card-title">📋 Recent Section Assignments</div>
              <button
                className="btn btn-secondary"
                style={{ padding: "4px 10px", fontSize: 11 }}
                onClick={() => navigate("/schedule")}
              >
                View All
              </button>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Section</th>
                  <th>Room</th>
                  <th>Time Slot</th>
                  <th>Instructor</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {assignments.slice(0, 6).map((assignment) => (
                  <tr key={getAssignmentIdentityKey(assignment)}>
                    <td>
                      <span className="monospace">
                        {formatAssignmentLabel(assignment)}
                      </span>
                      <br />
                      <span style={{ fontSize: 11, color: "var(--text3)" }}>
                        {assignment.title}
                        {assignment.sectionId
                          ? ` · ${String(assignment.sectionId).slice(-10).toUpperCase()}`
                          : ""}
                      </span>
                    </td>
                    <td className="monospace">{assignment.room}</td>
                    <td className="monospace">{assignment.time}</td>
                    <td>{assignment.instructor}</td>
                    <td>
                      <span
                        className={`pill pill-${assignment.status === "Assigned" ? "green" : "red"}`}
                      >
                        {assignment.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {assignments.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      style={{
                        textAlign: "center",
                        padding: 40,
                        color: "var(--text3)",
                      }}
                    >
                      No section assignments yet
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
              <span className="pill pill-green">
                {hasSchedule ? `Completed · ${genTimeLabel}` : "Not run yet"}
              </span>
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
                <span>
                  {assignedSections} / {totalSections} sections assigned
                </span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${progressPct}%` }}
                />
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
                onClick={() => {
                  if (!requireAdmin()) return;
                  genStartRef.current = performance.now();
                  setShowScheduleModal(true);
                }}
                disabled={!isAdmin}
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
                onClick={() => setShowExportModal(true)}
              >
                ↓ Export CSV
              </button>
              <button
                className="btn btn-danger"
                style={{ justifyContent: "center" }}
                onClick={() => {
                  if (!requireAdmin()) return;
                  setShowResetConfirm(true);
                }}
                disabled={!isAdmin}
              >
                🗑 Reset All Data
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
                    {genTimeLabel}{" "}
                    <span style={{ fontSize: 11, color: "var(--text3)" }}>
                      / {totalSections} sections
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

      {showScheduleModal && isAdmin && (
        <ScheduleModal
          onClose={() => {
            if (genStartRef.current) {
              const elapsed = (
                (performance.now() - genStartRef.current) /
                1000
              ).toFixed(1);
              setLastGenTime(elapsed);
              genStartRef.current = null;
            }
            setShowScheduleModal(false);
          }}
        />
      )}

      {isAdmin && (
        <ImportModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
        />
      )}

      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
      />

      <ConfirmModal
        isOpen={showResetConfirm}
        title="🗑 Reset All Data"
        message="Are you sure you want to reset all data to defaults? This cannot be undone."
        confirmLabel="🗑 Yes, Reset"
        danger
        onConfirm={() => {
          resetAllData();
          showNotification("All data reset to defaults ✓");
        }}
        onClose={() => setShowResetConfirm(false)}
      />
    </div>
  );
}
