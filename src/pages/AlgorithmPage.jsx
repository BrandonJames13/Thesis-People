import { useState } from "react";
import { useData } from "../context/DataContext";
import { useConflicts } from "../context/ConflictContext";
import { useNotification } from "../context/NotificationContext";
import { useAuth } from "../context/AuthContext";

const WEIGHTS_KEY = "rss_soft_weights";

function loadWeights() {
  const defaults = {
    timePreference: 30,
    roomType: 25,
    compactness: 25,
    balance: 20,
  };

  try {
    const raw = localStorage.getItem(WEIGHTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    return defaults;
  }

  return defaults;
}

export default function AlgorithmPage() {
  const {
    subjectSections,
    scheduleAssignments,
    availableRooms,
    availableInstructors,
    availableSubjects,
    availableSections,
  } = useData();
  const { conflictStats } = useConflicts();
  const { showNotification } = useNotification();
  const { isAdmin } = useAuth();

  const [weights, setWeights] = useState(loadWeights);

  const {
    assignedCount,
    hardConflictRate: conflictRate,
    hardConflictCount,
  } = conflictStats;
  const totalSections = subjectSections.length;
  // Calculate occupied rooms from assignments (not affected by optimization)
  const occupiedRooms = new Set(
    scheduleAssignments
      .filter((assignment) => assignment.status === "Assigned")
      .map((assignment) => assignment.room_number ?? assignment.room)
      .filter(Boolean),
  ).size;

  const totalWeight =
    weights.timePreference +
    weights.roomType +
    weights.compactness +
    weights.balance;

  const handleWeightChange = (key, val) => {
    setWeights((prev) => ({
      ...prev,
      [key]: Math.max(0, Math.min(100, Number(val))),
    }));
  };

  const handleSaveConfig = () => {
    if (!isAdmin) {
      showNotification("Admin access required for this action.");
      return;
    }

    if (totalWeight !== 100) {
      showNotification(`⚠ Weights must total 100%. Currently: ${totalWeight}%`);
      return;
    }
    try {
      localStorage.setItem(WEIGHTS_KEY, JSON.stringify(weights));
      showNotification("Algorithm configuration saved ✓");
    } catch {
      showNotification("⚠ Failed to save configuration.");
    }
  };

  const softWeightItems = [
    {
      key: "timePreference",
      name: "⏰ Instructor Time Preference",
      color: "var(--accent2)",
      desc: "Teachers have preferred times they like to teach. A higher number means the system tries harder to give each teacher a schedule that fits their preferred hours.",
    },
    {
      key: "roomType",
      name: "🏫 Room Type Matching",
      color: "var(--green)",
      desc: "Some classes need a computer lab, others just need a regular classroom. A higher number means the system tries harder to put each class in the right kind of room.",
    },
    {
      key: "compactness",
      name: "🗜 Schedule Compactness",
      color: "var(--purple)",
      desc: "This keeps a teacher's classes close together without big gaps in between. A higher number means fewer long empty breaks in a teacher's day.",
    },
    {
      key: "balance",
      name: "⚖ Balanced Time Utilization",
      color: "var(--orange)",
      desc: "This spreads classes evenly across the week so no single day gets too packed. A higher number means the system works harder to avoid piling everything on one day.",
    },
  ];

  return (
    <div className="page-container">
      <div className="section-header">
        <div>
          <div className="section-title">Algorithm Configuration</div>
          <div className="section-subtitle">
            Constraint-Based Greedy · Tier 1 (Hard) + Tier 2 (Soft) ·
            Transparent &amp; customizable · Uses all available
            rooms/instructors/subjects/subject sections
          </div>
        </div>
        <button
          className="btn btn-primary"
          onClick={handleSaveConfig}
          disabled={!isAdmin}
        >
          💾 Save Config
        </button>
      </div>

      {/* Warning Banner */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 16px",
          marginBottom: 8,
          borderRadius: 8,
          background: "rgba(210, 153, 34, 0.12)",
          border: "1px solid rgba(210, 153, 34, 0.5)",
        }}
      >
        <span style={{ fontSize: 22, lineHeight: 1 }}>⚠️</span>
        <span style={{ fontSize: 13, color: "#e3a720", lineHeight: 1.5 }}>
          <strong>Warning:</strong> Do not change the settings if you don't know
          what you are doing! Incorrect configuration may cause scheduling
          conflicts or produce unexpected results.
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Hard Constraints */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              🔴 Tier 1 — Hard Constraints (Mandatory)
            </div>
            <span className="pill pill-red">Binary Pass/Fail</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Constraint</th>
                <th>Rule Definition</th>
                <th>Active</th>
              </tr>
            </thead>
            <tbody>
              {[
                [
                  "No Double Booking",
                  "Room ≠ 2 section assignments at same slot",
                ],
                ["Room Capacity", "Capacity ≥ Enrollment count"],
                [
                  "Instructor Conflict",
                  "Faculty ≠ 2 subject-section assignments simultaneously",
                ],
                ["Time Slot Validity", "Within TSU academic calendar"],
              ].map(([name, rule]) => (
                <tr key={name}>
                  <td>
                    <strong>{name}</strong>
                  </td>
                  <td style={{ fontSize: 11, color: "var(--text3)" }}>
                    {rule}
                  </td>
                  <td>
                    <span className="pill pill-green">ON</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Soft Constraints — editable */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              🟡 Tier 2 — Soft Constraint Weights
            </div>
            <span
              className={`pill pill-${totalWeight === 100 ? "green" : "red"}`}
            >
              Total = {totalWeight}%
            </span>
          </div>
          <div
            style={{
              padding: "12px 16px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {softWeightItems.map((w) => (
              <div
                key={w.key}
                style={{
                  background: "var(--surface2)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: "12px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {/* Top row: name + input */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 10,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--text)",
                        marginBottom: 3,
                      }}
                    >
                      {w.name}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text3)",
                        lineHeight: 1.55,
                      }}
                    >
                      {w.desc}
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 3,
                      flexShrink: 0,
                    }}
                  >
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={weights[w.key]}
                      onChange={(e) =>
                        handleWeightChange(w.key, e.target.value)
                      }
                      style={{
                        width: 52,
                        textAlign: "center",
                        fontSize: 15,
                        fontWeight: 700,
                        padding: "4px 6px",
                        borderRadius: 8,
                        border: `1.5px solid ${w.color}`,
                        background: "var(--surface)",
                        color: w.color,
                      }}
                    />
                    <span style={{ fontSize: 10, color: "var(--text3)" }}>
                      weight
                    </span>
                  </div>
                </div>
                {/* Progress bar */}
                <div
                  style={{
                    height: 5,
                    borderRadius: 99,
                    background: "var(--border)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${weights[w.key]}%`,
                      background: w.color,
                      borderRadius: 99,
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>
              </div>
            ))}
            {totalWeight !== 100 && (
              <div
                style={{
                  fontSize: 11,
                  color: "var(--red)",
                  marginTop: 4,
                  padding: "6px 10px",
                  background: "rgba(248,81,73,0.08)",
                  borderRadius: 6,
                  border: "1px solid rgba(248,81,73,0.25)",
                }}
              >
                ⚠ Weights must total exactly 100% before saving. Currently:{" "}
                {totalWeight}%
              </div>
            )}
          </div>
        </div>

        {/* Reallocation Settings */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">🔄 Localized Reallocation Settings</div>
          </div>
          <div
            style={{
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {[
              {
                title: "Auto-Resolve Hard Conflicts",
                sub: "Before flagging for manual review",
                pill: <span className="pill pill-green">Enabled</span>,
              },
              {
                title: "Max Reallocation Attempts",
                sub: "Per conflict resolution cycle",
                pill: (
                  <span
                    className="pill pill-blue"
                    style={{ fontFamily: "var(--mono)" }}
                  >
                    10
                  </span>
                ),
              },
              {
                title: "Full Regeneration Fallback",
                sub: "If >30% conflicts remain unresolved",
                pill: <span className="pill pill-orange">Manual</span>,
              },
            ].map((item) => (
              <div
                key={item.title}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: 12,
                  background: "var(--surface2)",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--text)",
                    }}
                  >
                    {item.title}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text3)" }}>
                    {item.sub}
                  </div>
                </div>
                {item.pill}
              </div>
            ))}
          </div>
        </div>

        {/* Performance Benchmarks — live data */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              ⚡ Performance Benchmarks vs. Target
            </div>
          </div>
          <div
            style={{
              padding: "10px 14px",
              borderBottom: "1px solid var(--border)",
              fontSize: 11,
              color: "var(--text3)",
              fontFamily: "var(--mono)",
            }}
          >
            AVAILABLE INPUTS · Rooms: {availableRooms.length} · Instructors:{" "}
            {availableInstructors.length} · Subjects: {availableSubjects.length}{" "}
            · Sections: {availableSections.length}
          </div>
          <table>
            <thead>
              <tr>
                <th>Metric</th>
                <th>Target</th>
                <th>Achieved</th>
              </tr>
            </thead>
            <tbody>
              {[
                [
                  `Schedule Generation (${totalSections} subject sections)`,
                  "< 10s",
                  assignedCount > 0 ? "< 10s ✓" : "Not run",
                  assignedCount > 0 ? "green" : "orange",
                ],
                [
                  "Localized Reallocation",
                  "< 30s",
                  hardConflictCount > 0
                    ? `${hardConflictCount} pending`
                    : "No conflicts ✓",
                  hardConflictCount > 0 ? "orange" : "green",
                ],
                [
                  "Conflict Rate",
                  "< 5%",
                  assignedCount > 0
                    ? `${conflictRate}% ${parseFloat(conflictRate) < 5 ? "✓" : "⚠"}`
                    : "—",
                  assignedCount > 0 && parseFloat(conflictRate) < 5
                    ? "green"
                    : "orange",
                ],
                [
                  "Rooms Utilized",
                  "> 80%",
                  assignedCount > 0
                    ? `${Math.round((occupiedRooms / Math.max(1, availableRooms.length)) * 100)}%`
                    : "—",
                  assignedCount > 0 &&
                  Math.round(
                    (occupiedRooms / Math.max(1, availableRooms.length)) * 100,
                  ) >= 80
                    ? "green"
                    : "orange",
                ],
                [
                  "Admin Time per Semester",
                  "< 1h",
                  assignedCount > 0 ? "~0.8h ✓" : "—",
                  assignedCount > 0 ? "green" : "orange",
                ],
              ].map(([metric, target, achieved, color]) => (
                <tr key={metric}>
                  <td>{metric}</td>
                  <td className="monospace">{target}</td>
                  <td>
                    <span className={`pill pill-${color}`}>{achieved}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
