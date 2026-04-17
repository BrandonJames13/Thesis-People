import { useState, useEffect, useMemo, useRef } from "react";
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

/**
 * ConflictSummary component displays conflicts from schedule generation results.
 * Shows count of conflicts and first 5-10 conflict reasons grouped by type.
 */
function ConflictSummary({ conflicts = [], onReview, onSaveAnyway }) {
  if (!Array.isArray(conflicts) || conflicts.length === 0) {
    return null;
  }

  // Group conflicts by type for better display
  const groupedConflicts = {};
  conflicts.slice(0, 10).forEach((conflict) => {
    const type = conflict.type || "Unknown";
    if (!groupedConflicts[type]) {
      groupedConflicts[type] = [];
    }
    groupedConflicts[type].push(conflict);
  });

  return (
    <div
      className="conflict-summary"
      style={{
        padding: "16px",
        marginBottom: "16px",
        backgroundColor: "#fff3cd",
        border: "1px solid #ffc107",
        borderRadius: "4px",
        color: "#333",
      }}
    >
      <h4 style={{ marginTop: 0, color: "#d9534f" }}>
        ⚠ {conflicts.length} Conflict{conflicts.length !== 1 ? "s" : ""}{" "}
        Detected
      </h4>
      <p style={{ marginBottom: "12px", fontSize: "14px", color: "#333" }}>
        Some sections could not be scheduled due to missing or invalid data. You
        can review these conflicts in the Conflicts page to manually resolve
        them.
      </p>

      <div
        style={{
          marginBottom: "12px",
          fontSize: "13px",
          maxHeight: "200px",
          overflowY: "auto",
          color: "#333",
        }}
      >
        {Object.entries(groupedConflicts).map(([type, items]) => (
          <div key={type} style={{ marginBottom: "8px" }}>
            <strong style={{ color: "#333" }}>{type}:</strong>
            <ul
              style={{
                marginTop: "4px",
                marginBottom: "8px",
                paddingLeft: "20px",
                color: "#333",
              }}
            >
              {items.map((conflict, idx) => (
                <li
                  key={idx}
                  style={{
                    marginBottom: "4px",
                    fontSize: "12px",
                    color: "#333",
                  }}
                >
                  {conflict.conflictReason ||
                    `${conflict.subject_code || conflict.course_code || ""} - Unable to assign`}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: "8px" }}>
        <button
          onClick={onReview}
          style={{
            flex: 1,
            padding: "8px 12px",
            backgroundColor: "#0066cc",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          Review in Conflicts Page
        </button>
        <button
          onClick={onSaveAnyway}
          style={{
            flex: 1,
            padding: "8px 12px",
            backgroundColor: "#6c757d",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          Save Anyway
        </button>
      </div>
    </div>
  );
}

export default function ScheduleModal({ onClose, onRunComplete }) {
  const {
    rooms,
    availableSubjects,
    availableSections,
    availableRooms,
    availableInstructors,
    instructorSubjects,
    scheduleAssignments,
    updateRooms,
    updateScheduleAssignments,
    clearScheduleAssignments,
    setIsGenerationInProgress,
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
  const [manualPattern, setManualPattern] = useState("MON,FRI");
  const [manualEntries, setManualEntries] = useState([]);
  const [conflictMsg, setConflictMsg] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // State for handling conflicts from auto-generation
  const [generationConflicts, setGenerationConflicts] = useState([]);
  const [showConflictSummary, setShowConflictSummary] = useState(false);
  const [pendingAssignments, setPendingAssignments] = useState(null);

  const isMountedRef = useRef(true);

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

    const rows = [];
    console.log(
      `[ScheduleModal] Starting sectionRows creation with ${availableSections.length} raw sections`,
    );

    availableSections.forEach((section) => {
      const subject = subjectByCode.get(section.subjectCode) ?? {};
      const sectionKey = getAssignmentIdentityKey(section);
      const importedAssignment = assignmentByKey.get(sectionKey) ?? {};

      // Store the base section_id before any Lec/Lab splitting
      const baseSectionId = section.sectionId;

      const baseRow = {
        ...section,
        code: section.subjectCode,
        section: section.section,
        sectionId: section.sectionId,
        baseSectionId, // Track the original DB section_id separately
        title: subject.title ?? "",
        program: subject.program ?? "",
        year: subject.year ?? "",
        duration:
          Number(
            section.duration ?? importedAssignment.duration ?? subject.duration,
          ) || 1.5,
        time: section.time || importedAssignment.time || "",
        pattern: section.pattern || importedAssignment.pattern || "",
        instructor: section.instructor || importedAssignment.instructor || "",
      };

      const roomType = section.roomType ?? subject.roomType ?? "Lecture";

      // Detect subjects that carry BOTH Lec and Lab components encoded in the
      // subject code (e.g. "DIGDESIG N Lab" / "DIGDESIG N Lec" are already
      // separate rows). Additionally, some imports store a single row with a
      // combined room_type like "Lec/Lab". Split those into two entries so
      // each gets assigned to the correct room type independently.
      const combinedRoomType = String(roomType).toLowerCase();
      if (
        combinedRoomType === "lec/lab" ||
        combinedRoomType === "lecture/lab" ||
        combinedRoomType === "lec & lab"
      ) {
        // Lecture component
        rows.push({
          ...baseRow,
          roomType: "Lecture",
          sectionId: `${section.sectionId}__LEC`,
          sectionIdentity: `${section.sectionIdentity ?? section.sectionId}__LEC`,
          baseSectionId, // Keep reference to the base DB section_id
          title: `${baseRow.title} (Lec)`,
          _splitComponent: "Lec",
        });
        // Lab component — typically uses computer lab room
        rows.push({
          ...baseRow,
          roomType: "Computer Lab",
          sectionId: `${section.sectionId}__LAB`,
          sectionIdentity: `${section.sectionIdentity ?? section.sectionId}__LAB`,
          baseSectionId, // Keep reference to the base DB section_id
          title: `${baseRow.title} (Lab)`,
          _splitComponent: "Lab",
        });
      } else {
        rows.push({ ...baseRow, roomType });
      }
    });

    console.log(
      `[ScheduleModal] sectionRows creation complete: ${availableSections.length} raw sections → ${rows.length} rows after Lec/Lab splitting`,
    );
    if (rows.length === 0) {
      console.warn(
        "[ScheduleModal] WARNING: sectionRows is empty after creation!",
      );
    }
    rows.forEach((row) => {
      console.debug(
        `  [ScheduleModal] Row: ${row.sectionId} | ${row.code} | ${row.section} | ${row.title} | RoomType: ${row.roomType}`,
      );
    });

    return rows;
  }, [availableSubjects, availableSections, scheduleAssignments]);

  const sectionRowsByIdentity = useMemo(
    () =>
      new Map(sectionRows.map((row) => [getAssignmentIdentityKey(row), row])),
    [sectionRows],
  );

  const instructorNameById = useMemo(() => {
    const map = new Map();

    availableInstructors.forEach((instructor) => {
      const id = String(instructor?.id ?? "").trim();
      const name = String(instructor?.name ?? "").trim();
      if (!id || !name) return;
      map.set(id, name);
    });

    return map;
  }, [availableInstructors]);

  const instructorIdByName = useMemo(() => {
    const map = new Map();

    availableInstructors.forEach((instructor) => {
      const id = String(instructor?.id ?? "").trim();
      const nameKey = String(instructor?.name ?? "")
        .trim()
        .toLowerCase();
      if (!id || !nameKey) return;
      if (!map.has(nameKey)) {
        map.set(nameKey, id);
      }
    });

    return map;
  }, [availableInstructors]);

  const eligibleInstructorIdsBySubjectId = useMemo(() => {
    const map = new Map();

    instructorSubjects.forEach((row) => {
      const subjectId = String(row?.subjectId ?? "").trim();
      const instructorId = String(row?.instructorId ?? "").trim();
      if (!subjectId || !instructorId) return;

      const ids = map.get(subjectId) ?? new Set();
      ids.add(instructorId);
      map.set(subjectId, ids);
    });

    return map;
  }, [instructorSubjects]);

  const selectedManualSection =
    sectionRowsByIdentity.get(manualSectionKey) || null;

  const eligibleInstructorIds = useMemo(() => {
    const subjectId = String(selectedManualSection?.subjectId ?? "").trim();
    if (!subjectId) return new Set();

    return new Set(
      instructorSubjects
        .filter((row) => String(row.subjectId ?? "").trim() === subjectId)
        .map((row) => String(row.instructorId ?? "").trim())
        .filter(Boolean),
    );
  }, [instructorSubjects, selectedManualSection]);

  const eligibleInstructors = useMemo(() => {
    if (eligibleInstructorIds.size === 0) return availableInstructors;

    return availableInstructors.filter((instructor) =>
      eligibleInstructorIds.has(String(instructor?.id ?? "").trim()),
    );
  }, [availableInstructors, eligibleInstructorIds]);

  const manualInstructorOptions = useMemo(() => {
    const options = eligibleInstructors
      .map((instructor) => ({
        id: String(instructor?.id ?? "").trim(),
        name: String(instructor?.name ?? "").trim(),
      }))
      .filter((option) => option.id && option.name);

    if (
      manualInstructor &&
      !options.some((option) => option.id === manualInstructor)
    ) {
      const fallbackName = instructorNameById.get(manualInstructor);
      if (fallbackName) {
        return [{ id: manualInstructor, name: fallbackName }, ...options];
      }
    }

    return options;
  }, [eligibleInstructors, instructorNameById, manualInstructor]);

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
    const nextPattern = String(source?.pattern ?? "").trim() || "MON,FRI";
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

    const existingInstructorId = String(
      existingAssignment?.instructor_id ??
        existingAssignment?.instructorId ??
        "",
    ).trim();
    if (existingInstructorId) {
      setManualInstructor(existingInstructorId);
      return;
    }

    const existingInstructorName = String(existingAssignment?.instructor ?? "")
      .trim()
      .toLowerCase();
    if (existingInstructorName) {
      const matchedId = instructorIdByName.get(existingInstructorName);
      setManualInstructor(matchedId ?? "");
      return;
    }

    const sectionInstructorName = String(
      selectedManualSection?.instructor ?? "",
    )
      .trim()
      .toLowerCase();
    if (sectionInstructorName) {
      const matchedId = instructorIdByName.get(sectionInstructorName);
      setManualInstructor(matchedId ?? "");
    }
  }, [instructorIdByName, selectedManualSection, scheduleAssignments]);

  useEffect(() => {
    if (!manualInstructor) return;
    if (manualInstructorOptions.length === 0) return;
    if (
      manualInstructorOptions.some((option) => option.id === manualInstructor)
    )
      return;
    setManualInstructor("");
  }, [manualInstructor, manualInstructorOptions]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

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

  const handleRunAuto = async () => {
    if (isGenerating) {
      return;
    }

    if (activeDays.length === 0) {
      alert("Please select at least one active day.");
      return;
    }

    // STEP 1: Clear existing schedules before generating new ones
    try {
      showNotification("Clearing existing schedules...");
      const clearResult = await clearScheduleAssignments();

      if (!clearResult.success) {
        const errorMsg = clearResult.error?.message || "Unknown error";
        showNotification(`⚠ Failed to clear existing schedules: ${errorMsg}`);
        return;
      }

      showNotification("Existing schedules cleared, generating new ones...");
    } catch (clearError) {
      showNotification(
        `⚠ Failed to clear existing schedules: ${clearError.message}`,
      );
      return;
    }

    // STEP 2: Set generation state and generate new schedule
    setIsGenerating(true);
    setIsGenerationInProgress(true);

    try {
      await new Promise((resolve) => {
        if (
          typeof window !== "undefined" &&
          typeof window.requestAnimationFrame === "function"
        ) {
          window.requestAnimationFrame(() => resolve());
          return;
        }

        setTimeout(resolve, 0);
      });

      const result = runAutoSchedule({
        sectionRows: [...sectionRows],
        subjects: [...availableSubjects],
        rooms: [...availableRooms],
        instructors: [...availableInstructors],
        instructorSubjects: [...instructorSubjects],
        scheduleAssignments: [...scheduleAssignments],
        startTime: autoStart,
        endTime: autoEnd,
        pattern: autoPattern,
        activeDays,
      });

      if (result.error) {
        console.error(
          `[ScheduleModal] Schedule generation error: ${result.error}`,
        );
        const diagnosticMessage = `${result.error}\n\nDiagnostics:\n- Sections before generation: ${sectionRows.length}\n- Check browser console (F12) for detailed logs starting with "[ScheduleModal]" and "[runAutoSchedule]"\n\nCommon causes:\n• No sections imported into the schedule\n• All active days are deselected\n• All sections have incompatible patterns (e.g., Lec/Lab split sections with no matching room types)\n• All sections have been assigned time conflicts`;
        alert(diagnosticMessage);
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

      // ─── Check for conflicts in the result ────────────────────────────────
      const hasConflicts =
        Array.isArray(result.scheduleAssignments) &&
        result.scheduleAssignments.some(
          (a) => String(a.status || "").trim() === "Conflict",
        );

      if (hasConflicts) {
        // Extract conflicts for display
        const conflictAssignments = result.scheduleAssignments.filter(
          (a) => String(a.status || "").trim() === "Conflict",
        );
        setGenerationConflicts(conflictAssignments);
        setPendingAssignments(result.scheduleAssignments);
        setShowConflictSummary(true);
        showNotification(
          `Generated schedule with ${conflictAssignments.length} conflict${conflictAssignments.length !== 1 ? "s" : ""}`,
        );
        return;
      }

      // ─── Safeguard: Prevent persisting assignments with UNKNOWN subjects ────
      const hasUnknownSubjects = result.scheduleAssignments.some((a) => {
        const code = String(a.subject_code ?? a.course_code ?? "")
          .trim()
          .toUpperCase();
        return code.startsWith("UNKNOWN");
      });

      if (hasUnknownSubjects) {
        alert(
          "⚠ Invalid assignments detected: Some assignments reference UNKNOWN subject codes. Schedule generation may have failed. Please check browser console and re-generate.",
        );
        return;
      }

      try {
        await updateScheduleAssignments(result.scheduleAssignments);
        showNotification("Schedule saved to database");
      } catch (persistError) {
        showNotification(`⚠ Failed to save schedule: ${persistError.message}`);
        return;
      }

      if (onRunComplete) onRunComplete();
      onClose();
      showNotification(result.message);
    } finally {
      if (isMountedRef.current) {
        setIsGenerating(false);
        setIsGenerationInProgress(false);
      }
    }
  };

  const handleSaveWithConflicts = async () => {
    if (!pendingAssignments) return;

    // Double-check for UNKNOWN subjects before saving
    const hasUnknownSubjects = pendingAssignments.some((a) => {
      const code = String(a.subject_code ?? a.course_code ?? "")
        .trim()
        .toUpperCase();
      return code.startsWith("UNKNOWN");
    });

    if (hasUnknownSubjects) {
      alert(
        "⚠ Cannot save: Assignments contain UNKNOWN subject codes. Please review and re-generate.",
      );
      return;
    }

    try {
      await updateScheduleAssignments(pendingAssignments);
      setShowConflictSummary(false);
      setGenerationConflicts([]);
      setPendingAssignments(null);
      showNotification(
        "Schedule saved to database with conflicts for manual review",
      );

      if (onRunComplete) onRunComplete();
      onClose();
    } catch (persistError) {
      showNotification(`⚠ Failed to save schedule: ${persistError.message}`);
    }
  };

  const handleReviewConflicts = () => {
    // Navigate to Conflicts page - signal parent to navigate
    setShowConflictSummary(false);
    setGenerationConflicts([]);
    setPendingAssignments(null);

    // Use onClose callback with a special marker to indicate navigation to conflicts page
    // The parent component should handle this by navigating to the ConflictsPage
    if (onClose && typeof onClose === "function") {
      onClose({ navigationTarget: "conflicts" });
    }
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

    const selectedInstructorName =
      instructorNameById.get(manualInstructor) ?? "";

    const assignmentKey = getAssignmentIdentityKey(selectedManualSection);
    setManualEntries((prev) => [
      ...prev,
      {
        assignmentKey,
        subjectSectionLabel: formatAssignmentLabel(selectedManualSection),
        roomName: manualRoom,
        instructor: selectedInstructorName,
        instructorId: manualInstructor,
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

  const handleSubmitManual = async () => {
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
        instructor: instructorNameById.get(manualInstructor) ?? "",
        instructorId: manualInstructor,
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

    // Hard-save validation: selected instructor must be eligible for section subject.
    for (const entry of toSave) {
      const selectedInstructorId = String(entry?.instructorId ?? "").trim();
      if (!selectedInstructorId) continue;

      const sectionRow = sectionRowsByIdentity.get(entry.assignmentKey);
      if (!sectionRow) {
        showNotification(
          `⚠ Unable to validate instructor for ${entry.subjectSectionLabel}. Please reselect the section.`,
        );
        return;
      }

      const subjectId = String(sectionRow?.subjectId ?? "").trim();
      if (!subjectId) continue;

      const eligibleIds = eligibleInstructorIdsBySubjectId.get(subjectId);
      if (!eligibleIds || eligibleIds.size === 0) continue;

      if (!eligibleIds.has(selectedInstructorId)) {
        const selectedInstructorName =
          instructorNameById.get(selectedInstructorId) ?? "Selected instructor";
        showNotification(
          `⚠ ${selectedInstructorName} is not eligible for ${entry.subjectSectionLabel}.`,
        );
        return;
      }
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

    try {
      await updateScheduleAssignments(result.scheduleAssignments);
      showNotification("Assignment saved to database");
    } catch (persistError) {
      showNotification(`⚠ Failed to save assignment: ${persistError.message}`);
      return;
    }

    if (onRunComplete) onRunComplete();
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
    <Modal isOpen={true} onClose={onClose} disableCloseWhileBusy={isGenerating}>
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
            disabled={isGenerating}
            style={{
              background: "none",
              border: "none",
              fontSize: 20,
              color: "var(--text3)",
              cursor: isGenerating ? "not-allowed" : "pointer",
              opacity: isGenerating ? 0.6 : 1,
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

        {showConflictSummary && (
          <div style={{ padding: "20px 28px" }}>
            <ConflictSummary
              conflicts={generationConflicts}
              onReview={handleReviewConflicts}
              onSaveAnyway={handleSaveWithConflicts}
            />
          </div>
        )}

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
                lineHeight: 1.7,
              }}
            >
              <strong>⚙ Smart Room Assignment Mode</strong>
              <br />
              The algorithm reads each section's{" "}
              <strong>imported time, day, and meeting pattern</strong> from the
              database and finds the best available room automatically.
              <br />
              If a room conflict is detected at the imported schedule, it will
              try <strong>alternative meeting patterns</strong> at the same time
              before scanning the full window. Sections that cannot be placed
              are flagged as{" "}
              <span style={{ color: "var(--red)" }}>Conflicts</span> for manual
              review.
            </div>

            {/* Fallback window — used only when a section has no imported time */}
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
                  Fallback Window Start
                  <span
                    style={{
                      fontWeight: 400,
                      color: "var(--text3)",
                      marginLeft: 4,
                    }}
                  >
                    (sections with no imported time)
                  </span>
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
                  Fallback Window End
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
                  Fallback Pattern
                  <span
                    style={{
                      fontWeight: 400,
                      color: "var(--text3)",
                      marginLeft: 4,
                    }}
                  >
                    (used when no imported pattern)
                  </span>
                </label>
                <select
                  value={autoPattern}
                  onChange={(e) => setAutoPattern(e.target.value)}
                  className="search-input"
                  style={{ width: "100%", boxSizing: "border-box" }}
                >
                  <option value="MON,FRI">MON,FRI (Mon · Fri)</option>
                  <option value="TTH">TTH (Tue · Thu)</option>
                  <option value="WF">WF (Wed · Fri)</option>
                  <option value="MON,SAT">MON,SAT (Mon · Sat)</option>
                  <option value="MW">MW (Mon · Wed)</option>
                  <option value="TF">TF (Tue · Fri)</option>
                  <option value="WED,FRI">WED,FRI (Wed · Fri)</option>
                  <option value="SAT">SAT (Saturday only)</option>
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
                Active Days{" "}
                <span style={{ fontWeight: 400, color: "var(--text3)" }}>
                  (patterns using inactive days will be skipped)
                </span>
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
              <button
                className="btn btn-secondary"
                onClick={onClose}
                disabled={isGenerating}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleRunAuto}
                disabled={isGenerating}
              >
                {isGenerating ? "Generating..." : "⚙ Run Auto-Generate"}
              </button>
            </div>
            {isGenerating && (
              <div className="loading-indicator" style={{ marginTop: 8 }}>
                <span className="loading-spinner"></span>
                <div className="loading-text">
                  <span className="loading-pulse">
                    Generating schedules, please wait...
                  </span>
                </div>
              </div>
            )}
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
                <select
                  value={manualInstructor}
                  onChange={(e) => setManualInstructor(e.target.value)}
                  className="search-input"
                  style={{ width: "100%", boxSizing: "border-box" }}
                >
                  <option value="">-- Select Instructor --</option>
                  {manualInstructorOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
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
                  <option value="MON,FRI">MON,FRI (Mon · Fri)</option>
                  <option value="TTH">TTH (Tue · Thu)</option>
                  <option value="WF">WF (Wed · Fri)</option>
                  <option value="MON,SAT">MON,SAT (Mon · Sat)</option>
                  <option value="MW">MW (Mon · Wed)</option>
                  <option value="TF">TF (Tue · Fri)</option>
                  <option value="WED,FRI">WED,FRI (Wed · Fri)</option>
                  <option value="SAT">SAT (Saturday only)</option>
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
