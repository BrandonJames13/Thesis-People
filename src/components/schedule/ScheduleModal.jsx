import { useState, useEffect, useMemo } from "react";
import { useData } from "../../context/DataContext";
import { useNotification } from "../../context/NotificationContext";
import { formatTime, getEndTime } from "../../utils/timeUtils";
import {
  runAutoSchedule,
  checkManualConflict,
  formatAssignmentLabel,
  getAssignmentIdentityKey,
  extractStartTime24,
  applyManualAssignments,
} from "../../utils/scheduleUtils";
import Modal from "../common/Modal";

export default function ScheduleModal({ onClose }) {
  const {
    rooms,
    availableSubjects,
    availableSections,
    availableRooms,
    availableInstructors,
    scheduleAssignments,
    updateRooms,
    updateScheduleAssignments,
  } = useData();
  const { showNotification } = useNotification();

  const [mode, setMode] = useState("auto");

  // Auto mode state
  const [autoStart, setAutoStart] = useState("08:00");
  const [autoEnd, setAutoEnd] = useState("18:00");
  const [autoPattern, setAutoPattern] = useState("TTH");
  const [activeDays, setActiveDays] = useState([
    "MON",
    "TUE",
    "WED",
    "THU",
    "FRI",
  ]);

  // Manual mode state
  const [manualSectionKey, setManualSectionKey] = useState("");
  const [manualRoom, setManualRoom] = useState("");
  const [manualInstructor, setManualInstructor] = useState("");
  const [manualDurationH, setManualDurationH] = useState(1);
  const [manualDurationM, setManualDurationM] = useState(30);
  const [manualTime, setManualTime] = useState("07:00");
  const [manualPattern, setManualPattern] = useState("MWF");
  const [manualEntries, setManualEntries] = useState([]);
  const [conflictMsg, setConflictMsg] = useState(null);

  const sectionRows = useMemo(() => {
    const subjectByCode = new Map(
      availableSubjects.map((subject) => [subject.code, subject]),
    );
    const assignmentByKey = new Map(
      scheduleAssignments.map((assignment) => [
        getAssignmentIdentityKey(assignment),
        assignment,
      ]),
    );

    return availableSections.map((section) => {
      const subject = subjectByCode.get(section.subjectCode) ?? {};
      const sectionKey = getAssignmentIdentityKey(section);
      const importedAssignment = assignmentByKey.get(sectionKey) ?? {};
      return {
        ...section,
        code: section.subjectCode,
        section: section.section,
        sectionId: section.sectionId,
        title: subject.title ?? "",
        program: subject.program ?? "",
        year: subject.year ?? "",
        roomType: section.roomType ?? subject.roomType ?? "Lecture",
        duration:
          Number(
            section.duration ?? importedAssignment.duration ?? subject.duration,
          ) || 1.5,
        time: section.time || importedAssignment.time || "",
        pattern: section.pattern || importedAssignment.pattern || "",
        instructor: section.instructor || importedAssignment.instructor || "",
      };
    });
  }, [availableSubjects, availableSections, scheduleAssignments]);

  const sectionRowsByIdentity = useMemo(
    () =>
      new Map(sectionRows.map((row) => [getAssignmentIdentityKey(row), row])),
    [sectionRows],
  );

  const selectedManualSection =
    sectionRowsByIdentity.get(manualSectionKey) || null;

  useEffect(() => {
    if (!selectedManualSection) return;

    const assignmentKey = getAssignmentIdentityKey(selectedManualSection);
    const existingAssignment = scheduleAssignments.find(
      (assignment) => getAssignmentIdentityKey(assignment) === assignmentKey,
    );

    const source = existingAssignment || selectedManualSection;
    const duration =
      Number(source?.duration ?? selectedManualSection.duration ?? 1.5) || 1.5;
    const nextHours = Math.floor(duration);
    const nextMinutes = Math.round((duration - nextHours) * 60);
    const nextPattern = String(source?.pattern ?? "").trim() || "MWF";
    const importedStart = extractStartTime24(source, "");

    setManualDurationH(nextHours);
    setManualDurationM(nextMinutes);
    setManualPattern(nextPattern);

    if (importedStart) {
      setManualTime(importedStart);
    }

    if (existingAssignment?.room) {
      setManualRoom(existingAssignment.room);
    }

    if (existingAssignment?.instructor) {
      setManualInstructor(existingAssignment.instructor);
    } else if (selectedManualSection?.instructor) {
      setManualInstructor(selectedManualSection.instructor);
    }
  }, [selectedManualSection, scheduleAssignments]);

  const toggleDay = (day) => {
    setActiveDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  // Generate time options for dropdowns
  const timeOptions = [];
  for (let h = 7; h <= 21; h++) {
    ["00", "30"].forEach((m) => {
      if (h === 21 && m === "30") return;
      const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
      timeOptions.push({
        value: `${String(h).padStart(2, "0")}:${m}`,
        label: `${h12}:${m} ${h >= 12 ? "PM" : "AM"}`,
      });
    });
  }

  const handleRunAuto = () => {
    if (activeDays.length === 0) {
      alert("Please select at least one active day.");
      return;
    }

    const result = runAutoSchedule({
      sectionRows: [...sectionRows],
      rooms: [...availableRooms],
      instructors: [...availableInstructors],
      scheduleAssignments: [...scheduleAssignments],
      startTime: autoStart,
      endTime: autoEnd,
      pattern: autoPattern,
      activeDays,
    });

    if (result.error) {
      alert(result.error);
      return;
    }

    const roomUpdatesByNumber = new Map(
      result.rooms.map((room) => [room.number, room]),
    );
    const mergedRooms = rooms.map((room) => {
      const next = roomUpdatesByNumber.get(room.number);
      return next ? { ...room, ...next } : { ...room };
    });

    updateRooms(mergedRooms);
    updateScheduleAssignments(result.scheduleAssignments);
    onClose();
    showNotification(result.message);
  };

  // Auto-check conflicts whenever relevant fields change
  useEffect(() => {
    if (!selectedManualSection || !manualRoom || !manualTime) {
      setConflictMsg(null);
      return;
    }
    const duration = manualDurationH + manualDurationM / 60;
    const result = checkManualConflict({
      assignmentTarget: selectedManualSection,
      roomName: manualRoom,
      startTime: manualTime,
      duration,
      pattern: manualPattern,
      scheduleAssignments,
    });
    setConflictMsg(result);
  }, [
    manualSectionKey,
    manualRoom,
    manualTime,
    manualDurationH,
    manualDurationM,
    manualPattern,
    scheduleAssignments,
    selectedManualSection,
  ]);

  const handleAddEntry = () => {
    if (!selectedManualSection || !manualRoom || !manualTime) {
      alert("Please fill in Subject/Section, Room, and Start Time.");
      return;
    }
    const duration = manualDurationH + manualDurationM / 60;

    const assignmentKey = getAssignmentIdentityKey(selectedManualSection);
    setManualEntries((prev) => [
      ...prev,
      {
        assignmentKey,
        subjectSectionLabel: formatAssignmentLabel(selectedManualSection),
        roomName: manualRoom,
        instructor: manualInstructor,
        startTime: manualTime,
        endTime: getEndTime(manualTime, duration),
        duration,
        pattern: manualPattern,
      },
    ]);
    setManualSectionKey("");
    setManualRoom("");
    setManualInstructor("");
    setConflictMsg(null);
  };

  const handleRemoveEntry = (i) => {
    setManualEntries((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleSubmitManual = () => {
    const toSave = [...manualEntries];
    if (selectedManualSection && manualRoom && manualTime) {
      const duration = manualDurationH + manualDurationM / 60;
      if (duration <= 0) {
        alert("Please enter a valid duration (at least 1 minute).");
        return;
      }
      toSave.push({
        assignmentKey: getAssignmentIdentityKey(selectedManualSection),
        subjectSectionLabel: formatAssignmentLabel(selectedManualSection),
        roomName: manualRoom,
        instructor: manualInstructor,
        startTime: manualTime,
        endTime: getEndTime(manualTime, duration),
        duration,
        pattern: manualPattern,
      });
    }
    if (toSave.length === 0) {
      alert("Please fill in at least one assignment.");
      return;
    }

    const result = applyManualAssignments({
      entries: toSave,
      sectionRowsByIdentity,
      scheduleAssignments,
      rooms: [...availableRooms],
      startTime: "07:00",
      endTime: "21:00",
    });

    if (result.error) {
      showNotification(`⚠ ${result.error}`);
      return;
    }

    updateScheduleAssignments(result.scheduleAssignments);
    onClose();

    const movedCount = (result.moved ?? []).length;
    if (movedCount > 0) {
      showNotification(
        `${toSave.length} assignment${toSave.length > 1 ? "s" : ""} saved. Relocated ${movedCount} conflicted assignment${movedCount > 1 ? "s" : ""}.`,
      );
      return;
    }

    showNotification(
      `${toSave.length} assignment${toSave.length > 1 ? "s" : ""} saved!`,
    );
  };

  return (
    <Modal isOpen={true} onClose={onClose}>
      <div style={{ width: "100%" }}>
        {/* Header */}
        <div
          style={{
            padding: "24px 28px 20px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div
              style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}
            >
              ▶ Generate Schedule
            </div>
            <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>
              Manual entry or auto-generate · Section-level durations · Mon–Sat
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: 20,
              color: "var(--text3)",
              cursor: "pointer",
              padding: 0,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Mode Toggle */}
        <div style={{ padding: "20px 28px 0", display: "flex", gap: 8 }}>
          <button
            className={
              mode === "auto" ? "btn btn-primary" : "btn btn-secondary"
            }
            style={{ flex: 1, justifyContent: "center", fontSize: 13 }}
            onClick={() => setMode("auto")}
          >
            ⚙ Auto-Generate
          </button>
          <button
            className={
              mode === "manual" ? "btn btn-primary" : "btn btn-secondary"
            }
            style={{ flex: 1, justifyContent: "center", fontSize: 13 }}
            onClick={() => setMode("manual")}
          >
            ✏ Manual Entry
          </button>
        </div>

        {/* AUTO MODE */}
        {mode === "auto" && (
          <div
            style={{
              padding: "20px 28px",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div
              style={{
                background: "var(--surface2)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: "14px 16px",
                fontSize: 12,
                color: "var(--text2)",
                lineHeight: 1.6,
              }}
            >
              ⚙ The algorithm will assign rooms and time slots to all{" "}
              <strong>Pending</strong> subject/sections automatically using the
              Constraint-Based Greedy method and each section's imported
              duration.
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 14,
              }}
            >
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text2)",
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  Start Time (Earliest Slot)
                </label>
                <select
                  value={autoStart}
                  onChange={(e) => setAutoStart(e.target.value)}
                  className="search-input"
                  style={{ width: "100%", boxSizing: "border-box" }}
                >
                  <option value="07:00">7:00 AM</option>
                  <option value="07:30">7:30 AM</option>
                  <option value="08:00">8:00 AM</option>
                  <option value="08:30">8:30 AM</option>
                  <option value="09:00">9:00 AM</option>
                </select>
              </div>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text2)",
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  End Time (Latest Slot)
                </label>
                <select
                  value={autoEnd}
                  onChange={(e) => setAutoEnd(e.target.value)}
                  className="search-input"
                  style={{ width: "100%", boxSizing: "border-box" }}
                >
                  <option value="17:00">5:00 PM</option>
                  <option value="18:00">6:00 PM</option>
                  <option value="19:00">7:00 PM</option>
                  <option value="20:00">8:00 PM</option>
                  <option value="21:00">9:00 PM</option>
                </select>
              </div>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text2)",
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  Meeting Pattern
                </label>
                <select
                  value={autoPattern}
                  onChange={(e) => setAutoPattern(e.target.value)}
                  className="search-input"
                  style={{ width: "100%", boxSizing: "border-box" }}
                >
                  <option value="MWF">MWF (Mon · Wed · Fri)</option>
                  <option value="TTH">TTH (Tue · Thu)</option>
                  <option value="MW">MW (Mon · Wed)</option>
                  <option value="TF">TF (Tue · Fri)</option>
                  <option value="SAT">SAT (Saturday only)</option>
                  <option value="DAILY">Daily (Mon–Sat)</option>
                </select>
              </div>
            </div>
            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text2)",
                  marginBottom: 8,
                  display: "block",
                }}
              >
                Active Days
              </label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {["MON", "TUE", "WED", "THU", "FRI", "SAT"].map((day) => (
                  <label
                    key={day}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12,
                      cursor: "pointer",
                      background: "var(--surface2)",
                      padding: "6px 12px",
                      borderRadius: 6,
                      border: "1px solid var(--border)",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={activeDays.includes(day)}
                      onChange={() => toggleDay(day)}
                    />
                    {day.charAt(0) + day.slice(1).toLowerCase()}
                  </label>
                ))}
              </div>
            </div>
            <div
              style={{
                display: "flex",
                gap: 10,
                justifyContent: "flex-end",
                paddingTop: 8,
                borderTop: "1px solid var(--border)",
              }}
            >
              <button className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleRunAuto}>
                ⚙ Run Auto-Generate
              </button>
            </div>
          </div>
        )}

        {/* MANUAL MODE */}
        {mode === "manual" && (
          <div
            style={{
              padding: "20px 28px",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 14,
              }}
            >
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text2)",
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  Subject / Section *
                </label>
                <select
                  value={manualSectionKey}
                  onChange={(e) => setManualSectionKey(e.target.value)}
                  className="search-input"
                  style={{ width: "100%", boxSizing: "border-box" }}
                >
                  <option value="">-- Select Subject / Section --</option>
                  {sectionRows.map((sectionRow) => {
                    const identityKey = getAssignmentIdentityKey(sectionRow);
                    return (
                      <option key={identityKey} value={identityKey}>
                        {formatAssignmentLabel(sectionRow)} — {sectionRow.title}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text2)",
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  Room *
                </label>
                <select
                  value={manualRoom}
                  onChange={(e) => setManualRoom(e.target.value)}
                  className="search-input"
                  style={{ width: "100%", boxSizing: "border-box" }}
                >
                  <option value="">-- Select Room --</option>

                  {availableRooms.map((r) => (
                    <option key={r.number} value={r.number}>
                      {r.number} ({r.type} · Cap: {r.capacity})
                      {r.status === "Maintenance" ? " — Under Maintenance" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text2)",
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  Instructor
                </label>
                <input
                  type="text"
                  value={manualInstructor}
                  onChange={(e) => setManualInstructor(e.target.value)}
                  className="search-input"
                  placeholder="e.g. Dela Cruz, J."
                  style={{ width: "100%", boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text2)",
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  Duration
                </label>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    type="number"
                    min={0}
                    max={8}
                    value={manualDurationH}
                    onChange={(e) =>
                      setManualDurationH(parseInt(e.target.value) || 0)
                    }
                    className="search-input"
                    style={{ width: 70, boxSizing: "border-box" }}
                  />
                  <span style={{ fontSize: 12, color: "var(--text3)" }}>h</span>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    step={5}
                    value={manualDurationM}
                    onChange={(e) =>
                      setManualDurationM(parseInt(e.target.value) || 0)
                    }
                    className="search-input"
                    style={{ width: 70, boxSizing: "border-box" }}
                  />
                  <span style={{ fontSize: 12, color: "var(--text3)" }}>
                    min
                  </span>
                </div>
              </div>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text2)",
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  Start Time *
                </label>
                <select
                  value={manualTime}
                  onChange={(e) => setManualTime(e.target.value)}
                  className="search-input"
                  style={{ width: "100%", boxSizing: "border-box" }}
                >
                  {timeOptions.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text2)",
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  Meeting Pattern *
                </label>
                <select
                  value={manualPattern}
                  onChange={(e) => setManualPattern(e.target.value)}
                  className="search-input"
                  style={{ width: "100%", boxSizing: "border-box" }}
                >
                  <option value="MWF">MWF (Mon · Wed · Fri)</option>
                  <option value="TTH">TTH (Tue · Thu)</option>
                  <option value="MW">MW (Mon · Wed)</option>
                  <option value="TF">TF (Tue · Fri)</option>
                  <option value="SAT">SAT (Saturday only)</option>
                  <option value="DAILY">Daily (Mon–Sat)</option>
                  <option value="MON">Monday only</option>
                  <option value="TUE">Tuesday only</option>
                  <option value="WED">Wednesday only</option>
                  <option value="THU">Thursday only</option>
                  <option value="FRI">Friday only</option>
                </select>
              </div>
            </div>

            {conflictMsg && (
              <div
                style={{
                  display: "block",
                  padding: "10px 14px",
                  borderRadius: 8,
                  fontSize: 12,
                  background:
                    conflictMsg.type === "error"
                      ? "rgba(248,81,73,0.1)"
                      : "rgba(63,185,80,0.1)",
                  border: `1px solid var(--${conflictMsg.type === "error" ? "red" : "green"})`,
                  color: `var(--${conflictMsg.type === "error" ? "red" : "green"})`,
                }}
              >
                {conflictMsg.text}
              </div>
            )}

            {manualEntries.length > 0 && (
              <div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text2)",
                    marginBottom: 8,
                  }}
                >
                  📋 Queued Assignments
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    maxHeight: 160,
                    overflowY: "auto",
                  }}
                >
                  {manualEntries.map((e, i) => {
                    const dh = Math.floor(e.duration);
                    const dm = Math.round((e.duration - dh) * 60);
                    return (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "8px 12px",
                          background: "var(--surface2)",
                          borderRadius: 6,
                          border: "1px solid var(--border)",
                          fontSize: 12,
                        }}
                      >
                        <span>
                          <strong>{e.subjectSectionLabel}</strong> ·{" "}
                          {e.roomName} · {e.pattern} · {formatTime(e.startTime)}
                          –{formatTime(e.endTime)} (
                          {dm > 0 ? `${dh}h ${dm}m` : `${dh}h`})
                          {e.instructor ? ` · ${e.instructor}` : ""}
                        </span>
                        <button
                          onClick={() => handleRemoveEntry(i)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--red)",
                            cursor: "pointer",
                            fontSize: 14,
                            padding: 0,
                            lineHeight: 1,
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div
              style={{
                display: "flex",
                gap: 8,
                justifyContent: "space-between",
                paddingTop: 8,
                borderTop: "1px solid var(--border)",
              }}
            >
              <button className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-secondary" onClick={handleAddEntry}>
                  + Add Another
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleSubmitManual}
                  title={
                    conflictMsg?.type === "error"
                      ? "Conflicts will be relocated on save when possible"
                      : ""
                  }
                >
                  ✓ Save Assignment
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
