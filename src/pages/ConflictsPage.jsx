import { useNavigate } from "react-router-dom";
import { useData } from "../context/DataContext";
import { useConflicts } from "../context/ConflictContext";
import { useNotification } from "../context/NotificationContext";

export default function ConflictsPage() {
  const navigate = useNavigate();
  const { scheduleAssignments } = useData();
  const {
    detectConflicts,
    resolveConflict,
    autoResolveAll,
    suggestBetterRoom,
    dismissSoftConflict,
    reallocationLog,
  } = useConflicts();
  const { showNotification } = useNotification();

  const { hard, soft } = detectConflicts();
  const totalHard = hard.length;
  const totalSoft = soft.length;
  const total = totalHard + totalSoft;

  let subtitleText;
  if (scheduleAssignments.length === 0) {
    subtitleText =
      "No schedule generated yet · Generate a schedule to detect conflicts";
  } else if (total === 0) {
    subtitleText = "✓ No conflicts detected — all constraints satisfied";
  } else {
    subtitleText = `${totalHard} hard violation${totalHard !== 1 ? "s" : ""} · ${totalSoft} soft warning${totalSoft !== 1 ? "s" : ""} · Localized Reallocation available`;
  }

  const handleAutoResolve = () => {
    if (scheduleAssignments.length === 0) {
      showNotification(
        "⚠ No schedule generated yet. Please generate a schedule first.",
      );
      return;
    }
    autoResolveAll();
  };

  return (
    <div className="page-container">
      <div className="section-header">
        <div>
          <div className="section-title">Conflict Detection</div>
          <div className="section-subtitle">{subtitleText}</div>
        </div>
        <button className="btn btn-primary" onClick={handleAutoResolve}>
          ⚙ Auto-Resolve All
        </button>
      </div>

      {/* Empty State */}
      {(scheduleAssignments.length === 0 || total === 0) && (
        <div className="conflicts-empty">
          <div className="empty-icon">
            {total === 0 && scheduleAssignments.length > 0 ? "✓" : "🔍"}
          </div>
          <div className="empty-title">
            {total === 0 && scheduleAssignments.length > 0
              ? "✓ No conflicts found"
              : "No conflicts to show"}
          </div>
          <div className="empty-sub">
            {total === 0 && scheduleAssignments.length > 0
              ? "All assignments satisfy hard and soft constraints."
              : "Generate a schedule first — conflicts detected from your assignments will appear here automatically."}
          </div>
        </div>
      )}

      {/* Hard Conflicts */}
      {totalHard > 0 && (
        <div>
          <div className="conflict-section-label">
            🔴 Hard Constraint Violations ({totalHard})
          </div>
          {hard.map((cf) => (
            <div className="conflict-card" key={cf.id}>
              <div className="conflict-icon">🔴</div>
              <div style={{ flex: 1 }}>
                <div className="conflict-title">{cf.title}</div>
                <div
                  className="conflict-desc"
                  dangerouslySetInnerHTML={{ __html: cf.desc }}
                />
                <div className="conflict-meta">{cf.meta}</div>
                <div className="conflict-actions">
                  <button
                    className="btn btn-danger"
                    onClick={() => resolveConflict(cf.id)}
                  >
                    ⚙ Localized Reallocation
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => navigate("/schedule")}
                  >
                    👁 View in Schedule
                  </button>
                  {cf.type === "INSTRUCTOR_CONFLICT" && (
                    <button
                      className="btn btn-secondary"
                      onClick={() => navigate("/faculty")}
                    >
                      📋 Faculty Schedule
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Soft Conflicts */}
      {totalSoft > 0 && (
        <div style={{ marginTop: 24 }}>
          <div className="conflict-section-label">
            🟡 Soft Constraint Warnings ({totalSoft})
          </div>
          {soft.map((cf) => (
            <div className="conflict-card warning" key={cf.id}>
              <div className="conflict-icon">🟡</div>
              <div style={{ flex: 1 }}>
                <div className="conflict-title">{cf.title}</div>
                <div
                  className="conflict-desc"
                  dangerouslySetInnerHTML={{ __html: cf.desc }}
                />
                <div className="conflict-meta">{cf.meta}</div>
                <div className="conflict-actions">
                  {cf.betterRoom && (
                    <button
                      className="btn btn-secondary"
                      onClick={() => suggestBetterRoom(cf.id)}
                    >
                      💡 Suggest Alternative
                    </button>
                  )}
                  <button
                    className="btn btn-secondary"
                    onClick={() => dismissSoftConflict(cf.id)}
                  >
                    ↷ Dismiss Warning
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reallocation Log */}
      {reallocationLog.length > 0 && (
        <div className="card" style={{ marginTop: 24 }}>
          <div className="card-header">
            <div className="card-title">📋 Reallocation Log</div>
            <span className="pill pill-green">
              {reallocationLog.length} resolved this session
            </span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Course</th>
                <th>Original Assignment</th>
                <th>Reallocated To</th>
                <th>Conflict Type</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {[...reallocationLog].reverse().map((entry, i) => (
                <tr key={i}>
                  <td className="monospace">{entry.code}</td>
                  <td className="monospace" style={{ fontSize: 12 }}>
                    {entry.from}
                  </td>
                  <td className="monospace" style={{ fontSize: 12 }}>
                    {entry.to}
                  </td>
                  <td>
                    <span
                      className={`pill pill-${entry.type === "DOUBLE_BOOKING" ? "red" : entry.type === "INSTRUCTOR_CONFLICT" ? "orange" : "blue"}`}
                      style={{ fontSize: 10 }}
                    >
                      {entry.typeLabel}
                    </span>
                  </td>
                  <td>
                    <span className="pill pill-green">Resolved</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
