/**
 * useScheduleGenerator.js
 *
 * Batch asynchronous schedule generation hook.
 *
 * Strategy:
 * - Sections are grouped by section label (e.g. "BSCS-1A", "WMA-3C (EVE)")
 *   so that Lec+Lab pairs are always processed in the same batch — required
 *   for the Lec/Lab day-separation logic to work correctly.
 * - Groups are processed in batches of GROUPS_PER_BATCH (default 8).
 *   With ~50 section groups this gives ~6–7 batches.
 * - Between batches the event loop is yielded via setTimeout(0) so the UI
 *   can update and show progress without freezing.
 * - Each batch receives the accumulated assignments from all previous batches
 *   as existingAssignments, so room/instructor occupancy carries forward.
 * - Progress is reported after every batch via onProgress callback.
 */

import { useCallback, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useData } from "../context/DataContext";
import { useNotification } from "../context/NotificationContext";
import { runAutoSchedule } from "../utils/scheduleUtils";

// ── Tuneable constants ─────────────────────────────────────────────────────────
const GROUPS_PER_BATCH  = 8;   // section groups per batch (tune up/down as needed)
const BATCH_YIELD_MS    = 0;   // ms to yield between batches (0 = next microtask)

const ACTIVE_ACADEMIC_YEAR =
  import.meta.env.VITE_ACTIVE_ACADEMIC_YEAR ?? "2025-2026";
const ACTIVE_SEMESTER = import.meta.env.VITE_ACTIVE_SEMESTER ?? "2nd";

// ── Scheduling window & active days ───────────────────────────────────────────
// These match the TSU rules: 7 AM – 9 PM window, Mon–Sat active.
const DEFAULT_START_TIME  = "07:00";
const DEFAULT_END_TIME    = "21:00";
const DEFAULT_ACTIVE_DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT"];
const DEFAULT_PATTERN     = "MON,FRI";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Yield to the event loop so React can re-render between batches. */
function yieldToUI(ms = BATCH_YIELD_MS) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Groups sectionRows by their section label (e.g. "BSCS-1A").
 * Returns an ordered array of [sectionLabel, rows[]] pairs.
 */
function groupSectionsByLabel(sectionRows) {
  const map = new Map();
  (sectionRows ?? []).forEach((row) => {
    const label = String(row?.section ?? row?.sectionId ?? "").trim() || "UNKNOWN";
    if (!map.has(label)) map.set(label, []);
    map.get(label).push(row);
  });
  return Array.from(map.entries()); // [[label, rows], ...]
}

/**
 * Chunks an array into subarrays of at most `size` elements.
 */
function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/**
 * Flattens a batch result's scheduleAssignments back into a flat array
 * of rows that can be passed as existingAssignments to the next batch.
 */
function flattenBatchResult(result) {
  return Array.isArray(result?.scheduleAssignments)
    ? result.scheduleAssignments
    : [];
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} BatchProgress
 * @property {number} batchIndex    - 0-based current batch index
 * @property {number} totalBatches  - total number of batches
 * @property {number} pct           - completion percentage (0–100)
 * @property {number} assignedSoFar - running count of Assigned rows
 * @property {number} conflictsSoFar - running count of Conflict rows
 * @property {string[]} sectionLabels - section labels in this batch
 */

/**
 * useScheduleGenerator
 *
 * @param {Object} [options]
 * @param {number} [options.groupsPerBatch=8] - Section groups per batch
 * @param {Function} [options.onProgress]     - Called after each batch with BatchProgress
 *
 * @returns {{ generate, isGenerating, progress, result }}
 */
export function useScheduleGenerator(options = {}) {
  const {
    groupsPerBatch = GROUPS_PER_BATCH,
    onProgress,
  } = options;

  const {
    subjects,
    subjectSections,
    instructors,
    rooms,
    instructorSubjects,
    scheduleAssignments,
    setIsGenerationInProgress,
    resetAllData,
  } = useData();

  const { showNotification } = useNotification();

  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress]         = useState(null);
  const [result, setResult]             = useState(null);

  const generate = useCallback(async () => {
    setIsGenerating(true);
    setIsGenerationInProgress(true);
    setProgress(null);
    setResult(null);

    try {
      // ── 1. Determine which sections need scheduling ─────────────────────────
      const assignedSectionIds = new Set(
        scheduleAssignments
          .filter((a) => a.status === "Assigned")
          .map((a) => String(a.section_id ?? a.sectionId ?? "").trim())
          .filter(Boolean),
      );

      // Normalize subjectSections for runAutoSchedule
      const pendingSections = subjectSections
        .filter((sec) => {
          const id = String(sec.sectionId ?? sec.id ?? "").trim();
          return !assignedSectionIds.has(id);
        })
        .map((sec) => ({
          // Ensure fields runAutoSchedule expects are present
          sectionId:    sec.sectionId ?? sec.id,
          section_id:   sec.sectionId ?? sec.id,
          id:           sec.sectionId ?? sec.id,
          subject_id:   sec.subjectId ?? sec.subject_id,
          subjectId:    sec.subjectId ?? sec.subject_id,
          section:      sec.section,
          enrolled:     sec.enrolled ?? 0,
          status:       sec.status,
          academicYear: sec.academicYear ?? ACTIVE_ACADEMIC_YEAR,
          academic_year: sec.academicYear ?? ACTIVE_ACADEMIC_YEAR,
          semester:     sec.semester ?? ACTIVE_SEMESTER,
          // Room type + duration come from the subject — carry them if present
          roomType:     sec.roomType ?? sec.room_type,
          duration:     sec.duration,
          code:         sec.subjectCode ?? sec.code,
          subjectCode:  sec.subjectCode ?? sec.code,
        }));

      if (pendingSections.length === 0) {
        showNotification("All sections are already assigned.");
        return;
      }

      // Normalize subjects
      const normalizedSubjects = subjects.map((s) => ({
        id:        s.id,
        code:      s.code,
        title:     s.title,
        program:   s.program,
        year:      s.year,
        room_type: s.roomType ?? s.room_type ?? "Lecture",
        roomType:  s.roomType ?? s.room_type ?? "Lecture",
        duration:  s.duration ?? 1.5,
      }));

      // Normalize instructor subjects
      const normalizedInstructorSubjects = instructorSubjects.map((r) => ({
        instructor_id: r.instructor_id ?? r.instructorId,
        instructorId:  r.instructor_id ?? r.instructorId,
        subject_id:    r.subject_id ?? r.subjectId,
        subjectId:     r.subject_id ?? r.subjectId,
        section_id:    r.section_id ?? r.sectionId,
        sectionId:     r.section_id ?? r.sectionId,
      }));

      // Normalize existing Assigned rows (passed as existingAssignments to each batch)
      const normalizedExisting = scheduleAssignments
        .filter((a) => a.status === "Assigned")
        .map((a) => ({
          ...a,
          room:           a.room_number ?? a.room ?? "",
          instructor:     a.instructor_name ?? a.instructor ?? "",
          instructorId:   a.instructor_id ?? a.instructorId ?? "",
          instructor_id:  a.instructor_id ?? "",
        }));

      // ── 2. Group sections by section label and chunk into batches ───────────
      const sectionGroups = groupSectionsByLabel(pendingSections);
      const batches       = chunkArray(sectionGroups, groupsPerBatch);
      const totalBatches  = batches.length;

      console.log(
        `[useScheduleGenerator] ${pendingSections.length} pending sections | ` +
        `${sectionGroups.length} groups | ${totalBatches} batches of ${groupsPerBatch} groups each`,
      );

      // ── 3. Process batches sequentially ────────────────────────────────────
      let accumulatedAssignments = [...normalizedExisting];
      let totalAssigned   = 0;
      let totalConflicts  = 0;
      const allGenerated  = []; // all newly generated rows across batches

      for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
        const batchGroups   = batches[batchIdx];
        const batchRows     = batchGroups.flatMap(([, rows]) => rows);
        const sectionLabels = batchGroups.map(([label]) => label);

        console.log(
          `[useScheduleGenerator] Batch ${batchIdx + 1}/${totalBatches}: ` +
          `${batchRows.length} rows | sections: [${sectionLabels.join(", ")}]`,
        );

        // Run the synchronous scheduling algorithm for this batch
        const batchResult = runAutoSchedule({
          sectionRows:        batchRows,
          subjects:           normalizedSubjects,
          rooms,
          instructors,
          instructorSubjects: normalizedInstructorSubjects,
          scheduleAssignments: accumulatedAssignments,
          startTime:   DEFAULT_START_TIME,
          endTime:     DEFAULT_END_TIME,
          pattern:     DEFAULT_PATTERN,
          activeDays:  DEFAULT_ACTIVE_DAYS,
        });

        if (batchResult.error) {
          console.error(`[useScheduleGenerator] Batch ${batchIdx + 1} error:`, batchResult.error);
          showNotification(`⚠ Batch ${batchIdx + 1} failed: ${batchResult.error}`);
          break;
        }

        // Collect newly generated rows (not the pre-existing ones)
        const newlyGenerated = (batchResult.scheduleAssignments ?? []).filter(
          (a) => !assignedSectionIds.has(String(a.section_id ?? "").trim()),
        );
        allGenerated.push(...newlyGenerated);

        const batchAssigned  = batchResult.assigned  ?? 0;
        const batchConflicts = batchResult.conflicts ?? 0;
        totalAssigned  += batchAssigned;
        totalConflicts += batchConflicts;

        // Accumulate ALL assignments (existing + batch results) for the next batch
        accumulatedAssignments = flattenBatchResult(batchResult);

        // Report progress
        const pct = Math.round(((batchIdx + 1) / totalBatches) * 100);
        const progressInfo = {
          batchIndex:    batchIdx,
          totalBatches,
          pct,
          assignedSoFar:  totalAssigned,
          conflictsSoFar: totalConflicts,
          sectionLabels,
        };

        setProgress(progressInfo);
        onProgress?.(progressInfo);

        console.log(
          `[useScheduleGenerator] Batch ${batchIdx + 1} done: ` +
          `+${batchAssigned} assigned, +${batchConflicts} conflicts | ` +
          `Total: ${totalAssigned} assigned, ${totalConflicts} conflicts (${pct}%)`,
        );

        // ── Yield to event loop so React can re-render the progress bar ───────
        await yieldToUI();
      }

      if (allGenerated.length === 0) {
        showNotification("No sections could be scheduled.");
        return;
      }

      // ── 4. Persist to Supabase ───────────────────────────────────────────────
      // Strip internal-only fields before upserting
      const toSave = allGenerated.map(({ _conflict_reason, conflictReason, patternAdjusted, ...row }) => row);

      // Upsert in chunks of 100 to avoid request size limits
      const upsertChunks = chunkArray(toSave, 100);
      for (const chunk of upsertChunks) {
        const { error } = await supabase
          .from("schedule_assignments")
          .upsert(chunk, { onConflict: "section_id,academic_year,semester" });

        if (error) {
          console.error("[useScheduleGenerator] Upsert error:", error);
          showNotification(`⚠ Failed to save schedule: ${error.message}`);
          return;
        }
      }

      // ── 5. Log conflicts to conflict_log table ─────────────────────────────
      const conflictRows = allGenerated
        .filter((a) => a.status === "Conflict" && a.course_code)
        .map((a) => ({
          course_code:    a.course_code,
          conflict_type:  "SOFT_WARNING",
          type_label:     a.conflictReason ?? a._conflict_reason ?? "No slot available",
          resolved:       false,
        }));

      if (conflictRows.length > 0) {
        await supabase.from("conflict_log").insert(conflictRows);
      }

      // ── 6. Summarise and refresh ───────────────────────────────────────────
      const summary = {
        total:     allGenerated.length,
        assigned:  totalAssigned,
        conflicts: totalConflicts,
        batches:   totalBatches,
      };

      setResult(summary);

      showNotification(
        `✅ Schedule generated in ${totalBatches} batch${totalBatches !== 1 ? "es" : ""}: ` +
        `${totalAssigned} assigned, ${totalConflicts} conflict${totalConflicts !== 1 ? "s" : ""}.`,
      );

      resetAllData();
    } catch (err) {
      console.error("[useScheduleGenerator] Unexpected error:", err);
      showNotification(`⚠ Schedule generation failed: ${err.message}`);
    } finally {
      setIsGenerating(false);
      setIsGenerationInProgress(false);
    }
  }, [
    subjects, subjectSections, instructors, rooms,
    instructorSubjects, scheduleAssignments,
    setIsGenerationInProgress, resetAllData,
    showNotification, groupsPerBatch, onProgress,
  ]);

  return { generate, isGenerating, progress, result };
}