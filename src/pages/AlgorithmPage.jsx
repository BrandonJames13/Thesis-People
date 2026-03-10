export default function AlgorithmPage() {
  return (
    <div className="page-container">
      <div className="section-header">
        <div>
          <div className="section-title">Algorithm Configuration</div>
          <div className="section-subtitle">
            Constraint-Based Greedy · Tier 1 (Hard) + Tier 2 (Soft) ·
            Transparent &amp; customizable
          </div>
        </div>
        <button className="btn btn-primary">💾 Save Config</button>
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
                ["No Double Booking", "Room ≠ 2 courses at same slot"],
                ["Room Capacity", "Capacity ≥ Enrollment count"],
                ["Instructor Conflict", "Faculty ≠ 2 courses simultaneously"],
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

        {/* Soft Constraints */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              🟡 Tier 2 — Soft Constraint Weights
            </div>
            <span className="pill pill-orange">Total = 100%</span>
          </div>
          {[
            {
              name: "⏰ Instructor Time Preference",
              pct: 30,
              color: "var(--accent2)",
            },
            { name: "🏫 Room Type Matching", pct: 25, color: "var(--green)" },
            {
              name: "🗜 Schedule Compactness",
              pct: 25,
              color: "var(--purple)",
            },
            {
              name: "⚖ Balanced Time Utilization",
              pct: 20,
              color: "var(--orange)",
            },
          ].map((w) => (
            <div className="weight-item" key={w.name}>
              <div className="weight-header">
                <span className="weight-name">{w.name}</span>
                <span className="weight-pct">{w.pct}%</span>
              </div>
              <div className="weight-bar">
                <div
                  className="weight-fill"
                  style={{ width: `${w.pct}%`, background: w.color }}
                />
              </div>
            </div>
          ))}
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

        {/* Performance Benchmarks */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              ⚡ Performance Benchmarks vs. Target
            </div>
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
                  "Schedule Generation (127 courses)",
                  "< 10s",
                  "7.4s ✓",
                  "green",
                ],
                [
                  "Localized Reallocation (4 courses)",
                  "< 30s",
                  "8.1s ✓",
                  "green",
                ],
                ["Conflict Rate", "< 5%", "2.4% ✓", "green"],
                ["Room Utilization", "> 80%", "78% ≈", "orange"],
                ["Admin Time per Semester", "< 1h", "~0.8h ✓", "green"],
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
