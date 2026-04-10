import { useData } from "../context/DataContext";
import { useConflicts } from "../context/ConflictContext";

export default function AnalyticsPage() {
  const { rooms, subjectSections, scheduleAssignments, assignments } =
    useData();
  const { detectConflicts } = useConflicts();

  const { hard } = detectConflicts();
  const hasSchedule = assignments.length > 0;

  // Room-by-room utilization: % of time slots occupied per room
  const utilData = rooms
    .map((room) => {
      const assignedToRoom = scheduleAssignments.filter(
        (c) => c.status === "Assigned" && c.room === room.number,
      ).length;
      const totalSlots = 10; // approx available daily slots
      const pct = Math.min(
        100,
        Math.round((assignedToRoom / totalSlots) * 100),
      );
      const color =
        pct >= 80
          ? "var(--green)"
          : pct >= 60
            ? "var(--accent2)"
            : "var(--orange)";
      return { label: room.number, pct: hasSchedule ? pct : 0, color };
    })
    .sort((a, b) => b.pct - a.pct);

  // Summary stat cards
  const occupiedRooms = rooms.filter((r) => r.status === "Occupied").length;
  const avgUtil =
    rooms.length > 0 ? Math.round((occupiedRooms / rooms.length) * 100) : 0;

  const totalSections = subjectSections.length;
  const assignedSections = assignments.length;
  const conflictRate =
    assignedSections > 0
      ? Math.round((hard.length / assignedSections) * 100)
      : 0;
  const conflictFree = 100 - conflictRate;

  const qualityData = [
    {
      attr: "Functional Suitability",
      method: "Black Box",
      result: hasSchedule
        ? `${Math.round((assignedSections / Math.max(totalSections, 1)) * 100)}%`
        : "No data yet",
      color: hasSchedule ? "green" : "orange",
    },
    {
      attr: "Performance Efficiency",
      method: "Benchmark",
      result: "< 10s target",
      color: "green",
    },
    {
      attr: "Compatibility",
      method: "Cross-platform",
      result: "Pass",
      color: "green",
    },
    {
      attr: "Usability",
      method: "User Testing",
      result: "Pending",
      color: "orange",
    },
    {
      attr: "Reliability",
      method: "Stress Test",
      result: "Pending",
      color: "orange",
    },
    {
      attr: "Security",
      method: "Auth Audit",
      result: "Pending",
      color: "orange",
    },
    {
      attr: "Maintainability",
      method: "Code Review",
      result: "Pass",
      color: "green",
    },
    {
      attr: "Portability",
      method: "Browser Test",
      result: "Pass",
      color: "green",
    },
  ];

  return (
    <div className="page-container">
      <div className="section-header">
        <div>
          <div className="section-title">Room Utilization Analytics</div>
          <div className="section-subtitle">
            ISO/IEC 25010 · Performance Efficiency &amp; Functional Suitability
          </div>
        </div>
      </div>

      <div
        className="stats-grid"
        style={{ gridTemplateColumns: "repeat(3, 1fr)" }}
      >
        <div className="stat-card blue">
          <div className="stat-label">Avg Room Utilization</div>
          <div className="stat-value">{avgUtil}%</div>
          <div className="stat-delta">
            {occupiedRooms} of {rooms.length} rooms occupied
          </div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">Conflict-Free Rate</div>
          <div className="stat-value">
            {hasSchedule ? `${conflictFree}%` : "—"}
          </div>
          <div className="stat-delta">
            {hasSchedule
              ? `${hard.length} conflict${hard.length !== 1 ? "s" : ""} in ${assignedSections} section assignments`
              : "Generate a schedule to see data"}
          </div>
        </div>
        <div className="stat-card purple">
          <div className="stat-label">Sections Scheduled</div>
          <div className="stat-value">
            {hasSchedule ? assignedSections : "—"}
          </div>
          <div className="stat-delta">
            {hasSchedule
              ? `${assignedSections} of ${totalSections} total sections`
              : "No schedule generated yet"}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Room-by-Room Utilization */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">📊 Room-by-Room Utilization Rate</div>
          </div>
          {!hasSchedule ? (
            <div
              style={{
                padding: "30px 20px",
                textAlign: "center",
                color: "var(--text3)",
                fontSize: 13,
              }}
            >
              Generate a schedule to see room utilization data.
            </div>
          ) : (
            utilData.map((row) => (
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
            ))
          )}
          <div
            style={{
              padding: "12px 20px",
              fontSize: 11,
              color: "var(--text3)",
              borderTop: "1px solid var(--border)",
            }}
          >
            International benchmark: 80–90% (CHED 2024)
          </div>
        </div>

        {/* ISO/IEC 25010 Quality Assessment */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              📋 ISO/IEC 25010 Quality Assessment
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Attribute</th>
                <th>Method</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {qualityData.map((row) => (
                <tr key={row.attr}>
                  <td>
                    <strong>{row.attr}</strong>
                  </td>
                  <td>
                    <span className="pill pill-blue" style={{ fontSize: 10 }}>
                      {row.method}
                    </span>
                  </td>
                  <td>
                    <span className={`pill pill-${row.color}`}>
                      {row.result}
                    </span>
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
