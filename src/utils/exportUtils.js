export function exportToExcel(scheduleAssignments, showNotification) {
  if (scheduleAssignments.length === 0) {
    alert("No schedule to export. Please generate a schedule first.");
    return;
  }

  const headers = [
    "Course Code",
    "Course Title",
    "Program",
    "Year",
    "Enrolled",
    "Room",
    "Type Required",
    "Pattern",
    "Time",
    "Duration (hrs)",
    "Instructor",
    "Status",
  ];
  const rows = scheduleAssignments.map((c) => [
    c.code,
    c.title,
    c.program,
    c.year,
    c.enrolled,
    c.room,
    c.roomType,
    c.pattern,
    c.time,
    c.duration,
    c.instructor || "—",
    c.status,
  ]);

  const csvContent = [headers, ...rows]
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
        .join(","),
    )
    .join("\n");

  const blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `TSU_CCS_Schedule_AY2025-2026.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showNotification("Schedule exported to Excel (CSV) ✓");
}
