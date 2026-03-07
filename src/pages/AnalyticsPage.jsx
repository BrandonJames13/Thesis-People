export default function AnalyticsPage() {
  const utilData = [
    { label: "Lab 01", pct: 92, color: "var(--purple)" },
    { label: "Room 201", pct: 87, color: "var(--green)" },
    { label: "Room 101", pct: 83, color: "var(--green)" },
    { label: "Room 103", pct: 78, color: "var(--accent2)" },
    { label: "Lab 02", pct: 72, color: "var(--accent2)" },
    { label: "Room 302", pct: 64, color: "var(--orange)" },
    { label: "Room 102", pct: 57, color: "var(--orange)" },
  ];

  const qualityData = [
    {
      attr: "Functional Suitability",
      method: "Black Box",
      result: "97.4%",
      color: "green",
    },
    {
      attr: "Performance Efficiency",
      method: "Benchmark",
      result: "7.4s gen",
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
        <button className="btn btn-secondary">↓ Export PDF Report</button>
      </div>

      <div
        className="stats-grid"
        style={{ gridTemplateColumns: "repeat(3, 1fr)" }}
      >
        <div className="stat-card blue">
          <div className="stat-label">Avg Utilization</div>
          <div className="stat-value">78%</div>
          <div className="stat-delta">↑ +20% vs manual (58%)</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">Conflict Reduction</div>
          <div className="stat-value">96%</div>
          <div className="stat-delta">from 18 → 0.7 conflicts/semester</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-label">Admin Time Saved</div>
          <div className="stat-value">29h</div>
          <div className="stat-delta">30h manual → &lt;1h automated</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Room-by-Room Utilization */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">📊 Room-by-Room Utilization Rate</div>
          </div>
          {utilData.map((row) => (
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
