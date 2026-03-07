let currentUser = null;

function initAuth() {
  try {
    const stored = sessionStorage.getItem("rss_user");
    if (!stored) {
      window.location.href = "login.html";
      return false;
    }
    currentUser = JSON.parse(stored);
    document.getElementById("header-username").textContent = currentUser.name;
    document.getElementById("header-avatar").textContent = currentUser.initials;
    document.getElementById("menu-name").textContent = currentUser.name;
    document.getElementById("menu-role").textContent =
      currentUser.role === "admin" ? "Administrator" : "Faculty";
    return true;
  } catch (e) {
    window.location.href = "login.html";
    return false;
  }
}

function doLogout() {
  try {
    sessionStorage.removeItem("rss_user");
  } catch (e) {}
  window.location.href = "login.html";
}

function showUserMenu(e) {
  if (e) e.stopPropagation();
  const m = document.getElementById("user-menu");
  const caret = document.getElementById("user-menu-caret");
  const isOpen = m.style.display === "block";
  m.style.display = isOpen ? "none" : "block";
  if (caret) caret.style.transform = isOpen ? "rotate(0deg)" : "rotate(180deg)";
}

function openChangePassword() {
  document.getElementById("user-menu").style.display = "none";
  ["pw-current", "pw-new", "pw-confirm"].forEach(
    (id) => (document.getElementById(id).value = ""),
  );
  document.getElementById("pw-error").style.display = "none";
  document.getElementById("pw-modal").style.display = "flex";
}

function closePwModal() {
  document.getElementById("pw-modal").style.display = "none";
}

function submitChangePw() {
  const cur = document.getElementById("pw-current").value;
  const nw = document.getElementById("pw-new").value;
  const conf = document.getElementById("pw-confirm").value;
  const errEl = document.getElementById("pw-error");
  const DEMO_PASSWORDS = {
    admin: "admin123",
    faculty: "faculty123",
    reyes: "reyes2025",
    lim: "lim2025",
    santos: "santos2025",
    garcia: "garcia2025",
    cruz: "cruz2025",
  };
  const expected = DEMO_PASSWORDS[currentUser.username] || "admin123";
  if (cur !== expected) {
    errEl.textContent = "⚠ Current password is incorrect.";
    errEl.style.display = "block";
    return;
  }
  if (nw.length < 6) {
    errEl.textContent = "⚠ New password must be at least 6 characters.";
    errEl.style.display = "block";
    return;
  }
  if (nw !== conf) {
    errEl.textContent = "⚠ Passwords do not match.";
    errEl.style.display = "block";
    return;
  }
  closePwModal();
  showNotification("Password changed successfully!");
}

// ============ DATA ============

let courses = [
  {
    code: "CS101",
    title: "Intro to Computer Science",
    program: "CS",
    year: "1st",
    enrolled: 42,
    roomType: "Lecture",
    status: "Assigned",
    instructor: "Dela Cruz, J.",
    room: "Room 101",
    time: "MWF 8:00 AM",
    duration: 1.5,
    pattern: "MWF",
  },
  {
    code: "CS202",
    title: "Object-Oriented Programming",
    program: "CS",
    year: "2nd",
    enrolled: 38,
    roomType: "Lab",
    status: "Assigned",
    instructor: "Lim, K.",
    room: "Room 103",
    time: "MWF 1:00 PM",
    duration: 1.5,
    pattern: "MWF",
  },
  {
    code: "CS301",
    title: "Data Structures",
    program: "CS",
    year: "3rd",
    enrolled: 35,
    roomType: "Lecture",
    status: "Assigned",
    instructor: "Reyes, A.",
    room: "Room 201",
    time: "MWF 9:00 AM",
    duration: 1.5,
    pattern: "MWF",
  },
  {
    code: "CS401",
    title: "Algorithms",
    program: "CS",
    year: "4th",
    enrolled: 38,
    roomType: "Lecture",
    status: "Conflict",
    instructor: "Reyes, A.",
    room: "Room 101",
    time: "MWF 11:00 AM",
    duration: 1.5,
    pattern: "MWF",
  },
  {
    code: "IT204",
    title: "Web Development",
    program: "IT",
    year: "2nd",
    enrolled: 18,
    roomType: "Lab",
    status: "Assigned",
    instructor: "Santos, M.",
    room: "Lab 01",
    time: "TTH 10:00 AM",
    duration: 1.5,
    pattern: "TTH",
  },
  {
    code: "IT301",
    title: "Computer Networks",
    program: "IT",
    year: "3rd",
    enrolled: 30,
    roomType: "Lab",
    status: "Assigned",
    instructor: "Cruz, P.",
    room: "Lab 02",
    time: "TTH 8:00 AM",
    duration: 1.5,
    pattern: "TTH",
  },
  {
    code: "IS201",
    title: "Information Systems",
    program: "IS",
    year: "2nd",
    enrolled: 28,
    roomType: "Lecture",
    status: "Assigned",
    instructor: "Garcia, L.",
    room: "Room 102",
    time: "TTH 9:00 AM",
    duration: 1.5,
    pattern: "TTH",
  },
  {
    code: "IS301",
    title: "Systems Analysis & Design",
    program: "IS",
    year: "3rd",
    enrolled: 32,
    roomType: "Lecture",
    status: "Assigned",
    instructor: "Garcia, L.",
    room: "Room 302",
    time: "TTH 1:00 PM",
    duration: 1.5,
    pattern: "TTH",
  },
  {
    code: "IS402",
    title: "IS Capstone Project",
    program: "IS",
    year: "4th",
    enrolled: 22,
    roomType: "Lab",
    status: "Pending",
    instructor: "",
    room: "",
    time: "",
    duration: 0,
    pattern: "",
  },
];

let rooms = [
  { number: "Room 101", type: "Lecture", capacity: 40, status: "Available" },
  { number: "Room 102", type: "Lecture", capacity: 35, status: "Occupied" },
  { number: "Room 103", type: "Lecture", capacity: 45, status: "Occupied" },
  { number: "Room 201", type: "Lecture", capacity: 50, status: "Occupied" },
  { number: "Room 302", type: "Lecture", capacity: 40, status: "Available" },
  { number: "Lab 01", type: "Computer Lab", capacity: 45, status: "Occupied" },
  { number: "Lab 02", type: "Computer Lab", capacity: 25, status: "Available" },
  {
    number: "Lab 03",
    type: "Computer Lab",
    capacity: 30,
    status: "Maintenance",
  },
];

let instructors = [];
let scheduleAssignments = [];
let assignments = courses.filter((c) => c.status === "Assigned");
let conflicts = courses.filter((c) => c.status === "Conflict");

// ============ NAVIGATION ============

function switchPage(id, el) {
  document
    .querySelectorAll(".nav-item")
    .forEach((n) => n.classList.remove("active"));
  if (el) el.classList.add("active");
  switchTab(id);
}

function switchTab(id) {
  document
    .querySelectorAll(".page")
    .forEach((p) => p.classList.remove("active"));
  document
    .querySelectorAll(".tab")
    .forEach((t) => t.classList.remove("active"));
  document.getElementById("page-" + id)?.classList.add("active");
  document.getElementById("tab-" + id)?.classList.add("active");
  document.querySelectorAll(".nav-item").forEach((n) => {
    if (n.getAttribute("onclick")?.includes("'" + id + "'"))
      n.classList.add("active");
  });
}

// ============ RENDER DASHBOARD ============

function renderDashboard() {
  document.querySelector(".stat-card.blue .stat-value").textContent =
    rooms.length;
  document.querySelector(".stat-card.green .stat-value").textContent =
    assignments.length;
  document.querySelector(".stat-card.red .stat-value").textContent =
    conflicts.length;
  document.querySelector(".stat-card.purple .stat-value").textContent =
    Math.round((assignments.length / courses.length) * 100) + "%";

  const tbody = document.querySelector("#page-dashboard table tbody");
  if (tbody) {
    tbody.innerHTML = assignments
      .slice(0, 6)
      .map(
        (c) => `
      <tr>
        <td><span class="monospace">${c.code}</span><br/><span style="font-size:11px;color:var(--text3)">${c.title}</span></td>
        <td class="monospace">${c.room}</td>
        <td class="monospace">${c.time}</td>
        <td>${c.instructor}</td>
        <td><span class="pill pill-${c.status === "Assigned" ? "green" : "red"}">${c.status}</span></td>
      </tr>`,
      )
      .join("");
  }

  document.querySelector("#tab-schedule .tab-count").textContent =
    assignments.length;
  document.querySelector("#tab-conflicts .tab-count").textContent =
    conflicts.length;
  document.querySelector("#tab-conflicts .tab-count").style.color =
    "var(--red)";

  const resolveBtn = document.getElementById("dashboard-resolve-btn");
  if (resolveBtn) {
    const { hard } = detectConflicts();
    resolveBtn.textContent =
      hard.length > 0
        ? `⚠ Resolve ${hard.length} Conflict${hard.length !== 1 ? "s" : ""}`
        : "✓ No Conflicts";
    resolveBtn.className =
      hard.length > 0 ? "btn btn-danger" : "btn btn-success";
    resolveBtn.style.justifyContent = "center";
  }
}

// ============ RENDER SCHEDULE ============

// Fix #5 & #6: track current week offset and active room filter
let scheduleWeekOffset = 0;
let scheduleRoomFilter = "";

function renderSchedule() {
  const timeSlots = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
  const days = ["MON", "TUE", "WED", "THU", "FRI", "SAT"];

  const colorMap = {
    MWF: "blue",
    TTH: "green",
    MW: "purple",
    TF: "purple",
    SAT: "orange",
    DAILY: "blue",
    MON: "blue",
    TUE: "green",
    WED: "blue",
    THU: "green",
    FRI: "blue",
  };

  // Fix #6: filter assignments by selected room
  const visibleAssignments = scheduleRoomFilter
    ? scheduleAssignments.filter((c) => c.room === scheduleRoomFilter)
    : scheduleAssignments;

  // Fix #5: compute the week label and update the subtitle
  const baseDate = new Date();
  baseDate.setDate(
    baseDate.getDate() - baseDate.getDay() + 1 + scheduleWeekOffset * 7,
  );
  const endDate = new Date(baseDate);
  endDate.setDate(baseDate.getDate() + 5);
  const fmt = (d) =>
    d.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
  const weekLabel = `${fmt(baseDate)} – ${fmt(endDate)}, ${baseDate.getFullYear()}`;
  const subtitle = document.querySelector("#page-schedule .section-subtitle");
  if (subtitle)
    subtitle.textContent = `AY 2025–2026 · 1st Semester · Week of ${weekLabel}`;

  const grid = {};
  days.forEach((d) => {
    grid[d] = {};
  });

  visibleAssignments.forEach((course) => {
    if (!course.time || !course.pattern) return;
    const timeMatch = course.time.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!timeMatch) return;
    let h = parseInt(timeMatch[1]);
    const ampm = timeMatch[3].toUpperCase();
    if (ampm === "PM" && h !== 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    const spanCount = Math.max(
      1,
      Math.ceil(Math.round((course.duration || 1.5) * 60) / 60),
    );
    const assignedDays = patternDaysMap[course.pattern] || [];
    assignedDays.forEach((day) => {
      for (let s = 0; s < spanCount; s++) {
        const slotH = h + s;
        if (!timeSlots.includes(slotH)) continue;
        grid[day][slotH] =
          s === 0
            ? {
                course,
                span: spanCount,
                color: colorMap[course.pattern] || "blue",
              }
            : "blocked";
      }
    });
  });

  const tbody = document.getElementById("schedule-tbody");
  if (!tbody) return;

  if (scheduleAssignments.length === 0) {
    tbody.innerHTML = `<tr>
      <td colspan="7" class="schedule-empty-state">
        <div class="empty-icon">📅</div>
        <div class="empty-title">No schedule generated yet</div>
        <div class="empty-sub">Click <strong>▶ Generate Schedule</strong> on the Dashboard to auto-assign or manually add courses.</div>
      </td></tr>`;
    return;
  }

  if (scheduleRoomFilter && visibleAssignments.length === 0) {
    tbody.innerHTML = `<tr>
      <td colspan="7" class="schedule-empty-state">
        <div class="empty-icon">🏫</div>
        <div class="empty-title">No classes in this room</div>
        <div class="empty-sub">${scheduleRoomFilter} has no assignments in the current schedule.</div>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = timeSlots
    .map((h) => {
      const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
      const ampm = h >= 12 ? "PM" : "AM";
      let row = `<tr><td class="time-col-cell">${displayH}:00<br/><span style="font-size:10px">${ampm}</span></td>`;
      days.forEach((day) => {
        const cell = grid[day][h];
        if (cell === "blocked") return;
        if (!cell) {
          row += `<td class="sched-td empty-slot"></td>`;
          return;
        }
        const c = cell.course;
        const dh = Math.floor(c.duration);
        const dm = Math.round((c.duration - dh) * 60);
        row += `<td class="sched-td occupied-${cell.color}${c.status === "Conflict" ? " conflict-slot" : ""}" rowspan="${cell.span}">
        <div class="sched-course${c.status === "Conflict" ? " conflict-text" : ""}">${c.code}${c.status === "Conflict" ? " ⚠" : ""}</div>
        <div class="sched-room">${c.room}</div>
        <div class="sched-prof">${c.instructor}</div>
        <div class="sched-dur">${dm > 0 ? `${dh}h ${dm}m` : `${dh}h`} · ${c.pattern}</div>
      </td>`;
      });
      return row + `</tr>`;
    })
    .join("");
}

// ============ CONFLICT DETECTION ============

let reallocationLog = [];
let dismissedSoftConflicts = new Set();

const patternDaysMap = {
  MWF: ["MON", "WED", "FRI"],
  TTH: ["TUE", "THU"],
  MW: ["MON", "WED"],
  TF: ["TUE", "FRI"],
  SAT: ["SAT"],
  DAILY: ["MON", "TUE", "WED", "THU", "FRI", "SAT"],
  MON: ["MON"],
  TUE: ["TUE"],
  WED: ["WED"],
  THU: ["THU"],
  FRI: ["FRI"],
};

function parseCourseTime(course) {
  if (!course.time) return null;
  const match = course.time.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return null;
  let h = parseInt(match[1]);
  const ampm = match[3].toUpperCase();
  if (ampm === "PM" && h !== 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  const startMin = h * 60 + parseInt(match[2]);
  return {
    startMin,
    endMin: startMin + Math.round((course.duration || 1.5) * 60),
  };
}

function coursesOverlap(a, b) {
  const ta = parseCourseTime(a),
    tb = parseCourseTime(b);
  if (!ta || !tb) return false;
  if (ta.endMin <= tb.startMin || tb.endMin <= ta.startMin) return false;
  const daysA = patternDaysMap[a.pattern] || [];
  const daysB = patternDaysMap[b.pattern] || [];
  return daysA.some((d) => daysB.includes(d));
}

function sharedDays(a, b) {
  const daysA = patternDaysMap[a.pattern] || [];
  const daysB = patternDaysMap[b.pattern] || [];
  return daysA.filter((d) => daysB.includes(d));
}

function detectConflicts() {
  const hard = [],
    soft = [];
  const seen = new Set();

  for (let i = 0; i < scheduleAssignments.length; i++) {
    for (let j = i + 1; j < scheduleAssignments.length; j++) {
      const a = scheduleAssignments[i],
        b = scheduleAssignments[j];
      if (!coursesOverlap(a, b)) continue;
      const pairKey = [a.code, b.code].sort().join("|");

      if (a.room && b.room && a.room === b.room) {
        const id = `DOUBLE_BOOK|${pairKey}`;
        if (!seen.has(id)) {
          seen.add(id);
          const days = sharedDays(a, b);
          const ta = parseCourseTime(a);
          const slot = `${days[0]}-${String(Math.floor(ta.startMin / 60)).padStart(2, "0")}${String(ta.startMin % 60).padStart(2, "0")}`;
          hard.push({
            id,
            type: "DOUBLE_BOOKING",
            severity: "HARD",
            courses: [a, b],
            room: a.room,
            days,
            title: `Double Booking — ${a.room} · ${days.join("/")} ${formatTimeFromMin(ta.startMin)}`,
            desc: `<strong>${a.code}</strong> (${a.title}${a.instructor ? " · " + a.instructor : ""}${a.enrolled ? " · " + a.enrolled + " enrolled" : ""}) and <strong>${b.code}</strong> (${b.title}${b.instructor ? " · " + b.instructor : ""}${b.enrolled ? " · " + b.enrolled + " enrolled" : ""}) are both assigned to ${a.room} at the same time.`,
            meta: `TYPE: DOUBLE_BOOKING · SEVERITY: HARD · ROOM: ${a.room} · SLOT: ${slot}`,
          });
        }
      }

      if (
        a.instructor &&
        b.instructor &&
        a.instructor.trim().toLowerCase() ===
          b.instructor.trim().toLowerCase() &&
        a.room !== b.room
      ) {
        const id = `INSTRUCTOR|${pairKey}`;
        if (!seen.has(id)) {
          seen.add(id);
          const days = sharedDays(a, b);
          const ta = parseCourseTime(a);
          const slot = `${days[0]}-${String(Math.floor(ta.startMin / 60)).padStart(2, "0")}${String(ta.startMin % 60).padStart(2, "0")}`;
          hard.push({
            id,
            type: "INSTRUCTOR_CONFLICT",
            severity: "HARD",
            courses: [a, b],
            days,
            title: `Instructor Conflict — ${a.instructor} · ${days.join("/")} ${formatTimeFromMin(ta.startMin)}`,
            desc: `Instructor <strong>${a.instructor}</strong> is simultaneously scheduled for <strong>${a.code}</strong> (${a.room}) and <strong>${b.code}</strong> (${b.room}) on ${days.join("/")} at ${formatTimeFromMin(ta.startMin)}.`,
            meta: `TYPE: INSTRUCTOR_CONFLICT · SEVERITY: HARD · INSTRUCTOR: ${a.instructor.replace(/[^a-zA-Z]/g, "_").toUpperCase()} · SLOT: ${slot}`,
          });
        }
      }
    }

    const course = scheduleAssignments[i];
    const room = rooms.find((r) => r.number === course.room);
    if (room && course.enrolled > 0) {
      const utilization = course.enrolled / room.capacity;
      if (utilization < 0.6) {
        const id = `UNDERUTIL|${course.code}`;
        if (!dismissedSoftConflicts.has(id)) {
          const pct = Math.round(utilization * 100);
          const betterRoom = rooms.find(
            (r) =>
              r.number !== room.number &&
              r.type === room.type &&
              r.capacity >= course.enrolled &&
              r.capacity < room.capacity &&
              r.status !== "Maintenance",
          );
          soft.push({
            id,
            type: "ROOM_UNDERUTILIZATION",
            severity: "SOFT",
            courses: [course],
            title: `Room Underutilization — ${course.code} in ${course.room} (${room.capacity} seats)`,
            desc: `<strong>${course.code}</strong> (${course.title} · ${course.enrolled} enrolled) is in ${course.room} (capacity ${room.capacity}) at ${pct}% utilization.${betterRoom ? ` ${betterRoom.number} (${betterRoom.capacity} seats) would be more appropriate.` : ""}`,
            meta: `TYPE: ROOM_UNDERUTILIZATION · SEVERITY: SOFT · WEIGHT: 25% · UTILIZATION: ${pct}%`,
            betterRoom: betterRoom || null,
          });
        }
      }
    }
  }

  return { hard, soft };
}

function formatTimeFromMin(totalMin) {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

// ============ RENDER CONFLICTS ============

function renderConflicts() {
  const { hard, soft } = detectConflicts();
  const totalHard = hard.length,
    totalSoft = soft.length,
    total = totalHard + totalSoft;

  const subtitle = document.getElementById("conflicts-subtitle");
  if (scheduleAssignments.length === 0) {
    subtitle.textContent =
      "No schedule generated yet · Generate a schedule to detect conflicts";
  } else if (total === 0) {
    subtitle.textContent =
      "✓ No conflicts detected — all constraints satisfied";
  } else {
    subtitle.textContent = `${totalHard} hard violation${totalHard !== 1 ? "s" : ""} · ${totalSoft} soft warning${totalSoft !== 1 ? "s" : ""} · Localized Reallocation available`;
  }

  const navBadge = document.querySelector(".nav-item .nav-badge");
  if (navBadge) navBadge.textContent = totalHard;

  const tabCount = document.querySelector("#tab-conflicts .tab-count");
  if (tabCount) {
    tabCount.textContent = totalHard;
    tabCount.style.color = totalHard > 0 ? "var(--red)" : "var(--text3)";
  }

  const conflictStatVal = document.querySelector(".stat-card.red .stat-value");
  if (conflictStatVal) conflictStatVal.textContent = totalHard;

  const emptyState = document.getElementById("conflicts-empty-state");
  const hardSection = document.getElementById("hard-conflicts-section");
  const softSection = document.getElementById("soft-conflicts-section");

  if (scheduleAssignments.length === 0) {
    emptyState.style.display = "block";
    hardSection.style.display = "none";
    softSection.style.display = "none";
    return;
  }
  if (total === 0) {
    emptyState.style.display = "block";
    hardSection.style.display = "none";
    softSection.style.display = "none";
    emptyState.querySelector(".empty-title").textContent =
      "✓ No conflicts found";
    emptyState.querySelector(".empty-sub").textContent =
      "All assignments satisfy hard and soft constraints.";
    return;
  }

  emptyState.style.display = "none";
  hardSection.style.display = totalHard > 0 ? "block" : "none";
  document.getElementById("hard-conflicts-label").textContent =
    `🔴 Hard Constraint Violations (${totalHard})`;
  document.getElementById("hard-conflicts-list").innerHTML = hard
    .map(
      (cf) => `
    <div class="conflict-card" id="conflict-${cf.id.replace(/[|]/g, "-")}">
      <div class="conflict-icon">🔴</div>
      <div style="flex:1">
        <div class="conflict-title">${cf.title}</div>
        <div class="conflict-desc">${cf.desc}</div>
        <div class="conflict-meta">${cf.meta}</div>
        <div class="conflict-actions">
          <button class="btn btn-danger" onclick="resolveConflict(${JSON.stringify(cf.id)})">⚙ Localized Reallocation</button>
          <button class="btn btn-secondary" onclick="switchTab('schedule')">👁 View in Schedule</button>
          ${cf.type === "INSTRUCTOR_CONFLICT" ? `<button class="btn btn-secondary" onclick="switchTab('faculty')">📋 Faculty Schedule</button>` : ""}
        </div>
      </div>
    </div>`,
    )
    .join("");

  softSection.style.display = totalSoft > 0 ? "block" : "none";
  document.getElementById("soft-conflicts-label").textContent =
    `🟡 Soft Constraint Warnings (${totalSoft})`;
  document.getElementById("soft-conflicts-list").innerHTML = soft
    .map(
      (cf) => `
    <div class="conflict-card warning" id="conflict-${cf.id.replace(/[|]/g, "-")}">
      <div class="conflict-icon">🟡</div>
      <div style="flex:1">
        <div class="conflict-title">${cf.title}</div>
        <div class="conflict-desc">${cf.desc}</div>
        <div class="conflict-meta">${cf.meta}</div>
        <div class="conflict-actions">
          ${cf.betterRoom ? `<button class="btn btn-secondary" onclick="suggestBetterRoom(${JSON.stringify(cf.id)})">💡 Suggest Alternative</button>` : ""}
          <button class="btn btn-secondary" onclick="dismissSoftConflict(${JSON.stringify(cf.id)})">↷ Dismiss Warning</button>
        </div>
      </div>
    </div>`,
    )
    .join("");

  const logCard = document.getElementById("reallocation-log-card");
  logCard.style.display = reallocationLog.length > 0 ? "block" : "none";
  document.getElementById("reallocation-log-count").textContent =
    `${reallocationLog.length} resolved this session`;
  document.getElementById("reallocation-log-tbody").innerHTML = [
    ...reallocationLog,
  ]
    .reverse()
    .map(
      (entry) => `
    <tr>
      <td class="monospace">${entry.code}</td>
      <td class="monospace" style="font-size:12px">${entry.from}</td>
      <td class="monospace" style="font-size:12px">${entry.to}</td>
      <td><span class="pill pill-${entry.type === "DOUBLE_BOOKING" ? "red" : entry.type === "INSTRUCTOR_CONFLICT" ? "orange" : "blue"}" style="font-size:10px">${entry.typeLabel}</span></td>
      <td><span class="pill pill-green">Resolved</span></td>
    </tr>`,
    )
    .join("");
}

// ============ CONFLICT ACTIONS ============

function resolveConflict(conflictId) {
  const { hard } = detectConflicts();
  const cf = hard.find((c) => c.id === conflictId);
  if (!cf) {
    showNotification("Conflict already resolved.");
    return;
  }

  const courseToMove = cf.courses[1];
  const neededType =
    courseToMove.roomType === "Lab" ? "Computer Lab" : "Lecture";
  const target = scheduleAssignments.find((s) => s.code === courseToMove.code);
  if (!target) return;

  const freeRoom = rooms.find(
    (r) =>
      r.number !== courseToMove.room &&
      r.type === neededType &&
      r.status !== "Maintenance" &&
      r.capacity >= (courseToMove.enrolled || 0) &&
      !scheduleAssignments.some(
        (s) =>
          s.code !== courseToMove.code &&
          s.room === r.number &&
          coursesOverlap(s, courseToMove),
      ),
  );

  if (freeRoom) {
    const oldRoom = target.room;
    target.room = freeRoom.number;
    const c = courses.find((x) => x.code === target.code);
    if (c) c.room = freeRoom.number;
    reallocationLog.push({
      code: target.code,
      from: `${oldRoom} · ${target.time}`,
      to: `${freeRoom.number} · ${target.time}`,
      type: cf.type,
      typeLabel: cf.type === "DOUBLE_BOOKING" ? "Double Book" : "Instructor",
    });
    showNotification(`${target.code} reallocated to ${freeRoom.number} ✓`);
  } else {
    const slots = [
      "08:00",
      "09:00",
      "10:00",
      "11:00",
      "13:00",
      "14:00",
      "15:00",
      "16:00",
    ];
    let moved = false;
    for (const slot of slots) {
      const testCourse = {
        ...target,
        time: `${target.pattern} ${formatTime(slot)}`,
      };
      const hasConflict = scheduleAssignments.some(
        (s) =>
          s.code !== target.code &&
          (s.room === target.room ||
            (s.instructor && s.instructor === target.instructor)) &&
          coursesOverlap(s, testCourse),
      );
      if (!hasConflict) {
        const oldTime = target.time;
        target.time = testCourse.time;
        const c = courses.find((x) => x.code === target.code);
        if (c) c.time = target.time;
        reallocationLog.push({
          code: target.code,
          from: `${target.room} · ${oldTime}`,
          to: `${target.room} · ${target.time}`,
          type: cf.type,
          typeLabel:
            cf.type === "DOUBLE_BOOKING" ? "Double Book" : "Instructor",
        });
        showNotification(`${target.code} rescheduled to ${target.time} ✓`);
        moved = true;
        break;
      }
    }
    if (!moved)
      showNotification("Could not auto-resolve — try Manual Override.");
  }

  assignments = courses.filter((c) => c.status === "Assigned");
  conflicts = courses.filter((c) => c.status === "Conflict");
  renderConflicts();
  renderDashboard();
  renderSchedule();
}

function autoResolveAll() {
  if (scheduleAssignments.length === 0) {
    alert("No schedule generated yet. Please generate a schedule first.");
    return;
  }
  const { hard } = detectConflicts();
  if (hard.length === 0) {
    showNotification("No hard conflicts to resolve!");
    return;
  }
  let attempts = 0;
  while (detectConflicts().hard.length > 0 && attempts < 20) {
    resolveConflict(detectConflicts().hard[0].id);
    attempts++;
  }
  renderConflicts();
  renderDashboard();
  renderSchedule();
}

function suggestBetterRoom(conflictId) {
  const { soft } = detectConflicts();
  const cf = soft.find((c) => c.id === conflictId);
  if (!cf?.betterRoom) return;
  const target = scheduleAssignments.find((s) => s.code === cf.courses[0].code);
  if (!target) return;
  const oldRoom = target.room;
  target.room = cf.betterRoom.number;
  const c = courses.find((x) => x.code === target.code);
  if (c) c.room = cf.betterRoom.number;
  reallocationLog.push({
    code: target.code,
    from: `${oldRoom} · ${target.time}`,
    to: `${cf.betterRoom.number} · ${target.time}`,
    type: "ROOM_UNDERUTILIZATION",
    typeLabel: "Underutil",
  });
  showNotification(`${target.code} moved to ${cf.betterRoom.number} ✓`);
  renderConflicts();
  renderSchedule();
}

function dismissSoftConflict(conflictId) {
  dismissedSoftConflicts.add(conflictId);
  renderConflicts();
  showNotification("Warning dismissed.");
}

// ============ RENDER ROOMS ============

function renderRooms(filterSearch = "", filterType = "", filterStatus = "") {
  const grid = document.querySelector(".rooms-grid");
  if (!grid) return;

  const filtered = rooms.filter((room) => {
    const matchSearch = room.number
      .toLowerCase()
      .includes(filterSearch.toLowerCase());
    const matchType = !filterType || room.type === filterType;
    const matchStatus = !filterStatus || room.status === filterStatus;
    return matchSearch && matchType && matchStatus;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text3);font-size:13px;">No rooms match your search.</div>`;
    return;
  }

  grid.innerHTML = filtered
    .map((room) => {
      const index = rooms.indexOf(room);
      const statusColor =
        room.status === "Available"
          ? "green"
          : room.status === "Maintenance"
            ? "orange"
            : "blue";
      return `<div class="room-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div class="room-number">${room.number}</div>
        <button onclick="deleteRoom(${index})" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:16px;line-height:1;padding:0;" title="Delete">✕</button>
      </div>
      <div class="room-type">${room.type}</div>
      <div style="margin-bottom:10px"><span class="pill pill-${statusColor}">${room.status}</span></div>
      <div class="room-capacity">
        <span style="font-size:11px;color:var(--text3)">Cap:</span>
        <div class="cap-bar"><div class="cap-fill" style="width:${Math.round((room.capacity / 50) * 100)}%"></div></div>
        <span class="monospace">${room.capacity}</span>
      </div>
    </div>`;
    })
    .join("");
}

// ============ RENDER COURSES ============

function renderCourses() {
  const tbody = document.querySelector("#page-courses table tbody");
  if (!tbody) return;
  tbody.innerHTML = courses
    .map(
      (c) => `
    <tr>
      <td class="monospace">${c.code}</td><td>${c.title}</td><td>${c.program}</td>
      <td>${c.year}</td><td>${c.enrolled}</td><td>${c.roomType}</td>
      <td><span class="pill pill-${c.status === "Assigned" ? "green" : c.status === "Conflict" ? "red" : "orange"}">${c.status}</span></td>
    </tr>`,
    )
    .join("");
}

// ============ RENDER FACULTY ============

function renderFaculty() {
  const tbody = document.getElementById("faculty-tbody");
  if (!tbody) return;
  if (instructors.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text3)">No instructors added yet. Click "+ Add Instructor" to add one.</td></tr>`;
    return;
  }
  tbody.innerHTML = instructors
    .map(
      (inst) => `
    <tr>
      <td><strong>${inst.name}</strong></td>
      <td class="monospace" style="font-size:12px">${inst.courses.length > 0 ? inst.courses.join(", ") : '<span style="color:var(--text3)">None</span>'}</td>
      <td>${inst.courses.length} course${inst.courses.length !== 1 ? "s" : ""}</td>
      <td style="font-size:12px">${inst.availability}</td>
      <td><span class="pill pill-${inst.status === "Active" ? "green" : "red"}">${inst.status}</span></td>
    </tr>`,
    )
    .join("");
}

// ============ ROOM ACTIONS ============

function deleteRoom(index) {
  if (confirm(`Delete ${rooms[index].number}? This cannot be undone.`)) {
    rooms.splice(index, 1);
    renderRooms();
    renderDashboard();
  }
}

function addRoom() {
  document.getElementById("add-room-modal").style.display = "flex";
  document.getElementById("room-number").focus();
}

function submitAddRoom() {
  const number = document.getElementById("room-number").value.trim();
  const type = document.getElementById("room-type").value;
  const capacity = parseInt(document.getElementById("room-capacity").value);
  const status = document.getElementById("room-status").value;
  if (!number || !type || isNaN(capacity) || capacity <= 0) {
    alert("Please fill in all fields correctly.");
    return;
  }
  rooms.push({ number, type, capacity, status });
  renderRooms();
  closeModal();
  showNotification("Room added successfully!");
}

function closeModal() {
  document.getElementById("add-room-modal").style.display = "none";
  document.getElementById("add-room-form").reset();
}

// ============ FIX #4: EXPORT TO EXCEL ============

function exportToExcel() {
  if (scheduleAssignments.length === 0) {
    alert("No schedule to export. Please generate a schedule first.");
    return;
  }

  // Build CSV content (opens in Excel)
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

// ============ SCHEDULE MODAL ============

let manualEntries = [];

function openScheduleModal() {
  populateManualDropdowns();
  manualEntries = [];
  renderManualEntries();
  document.getElementById("manual-conflict-msg").style.display = "none";
  document.getElementById("schedule-modal").style.display = "flex";
  setScheduleMode("auto");
}

function closeScheduleModal() {
  document.getElementById("schedule-modal").style.display = "none";
}

function setScheduleMode(mode) {
  const isAuto = mode === "auto";
  document.getElementById("schedule-mode-auto").style.display = isAuto
    ? "flex"
    : "none";
  document.getElementById("schedule-mode-manual").style.display = isAuto
    ? "none"
    : "flex";
  document.getElementById("mode-auto-btn").className = isAuto
    ? "btn btn-primary"
    : "btn btn-secondary";
  document.getElementById("mode-manual-btn").className = isAuto
    ? "btn btn-secondary"
    : "btn btn-primary";
}

function populateManualDropdowns() {
  const cs = document.getElementById("manual-course");
  cs.innerHTML =
    '<option value="">-- Select Course --</option>' +
    courses
      .map((c) => `<option value="${c.code}">${c.code} — ${c.title}</option>`)
      .join("");

  const rs = document.getElementById("manual-room");
  rs.innerHTML =
    '<option value="">-- Select Room --</option>' +
    rooms
      .map(
        (r) =>
          `<option value="${r.number}">${r.number} (${r.type} · Cap: ${r.capacity})${r.status === "Maintenance" ? " ⚠ Maintenance" : ""}</option>`,
      )
      .join("");

  const ts = document.getElementById("manual-time");
  ts.innerHTML = "";
  for (let h = 7; h <= 21; h++) {
    ["00", "30"].forEach((m) => {
      if (h === 21 && m === "30") return;
      const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
      ts.innerHTML += `<option value="${String(h).padStart(2, "0")}:${m}">${h12}:${m} ${h >= 12 ? "PM" : "AM"}</option>`;
    });
  }
}

function getDuration(hId, mId) {
  return (
    (parseInt(document.getElementById(hId).value) || 0) +
    (parseInt(document.getElementById(mId).value) || 0) / 60
  );
}

function formatTime(t24) {
  const [h, m] = t24.split(":").map(Number);
  return `${h > 12 ? h - 12 : h === 0 ? 12 : h}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function getEndTime(start24, durationHours) {
  const [h, m] = start24.split(":").map(Number);
  const total = h * 60 + m + Math.round(durationHours * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function checkManualConflict() {
  const courseCode = document.getElementById("manual-course").value;
  const roomName = document.getElementById("manual-room").value;
  const startTime = document.getElementById("manual-time").value;
  const duration = getDuration("manual-duration-h", "manual-duration-m");
  const pattern = document.getElementById("manual-pattern").value;
  const msgEl = document.getElementById("manual-conflict-msg");

  const errorStyle =
    "display:block;padding:10px 14px;border-radius:8px;font-size:12px;background:rgba(248,81,73,0.1);border:1px solid var(--red);color:var(--red)";
  const successStyle =
    "display:block;padding:10px 14px;border-radius:8px;font-size:12px;background:rgba(63,185,80,0.1);border:1px solid var(--green);color:var(--green)";

  if (!courseCode || !roomName || !startTime) {
    msgEl.style.cssText = errorStyle;
    msgEl.textContent = "⚠ Please fill in Course, Room, and Start Time first.";
    return false;
  }
  const testCourse = {
    time: `${pattern} ${formatTime(startTime)}`,
    duration,
    pattern,
    room: roomName,
  };
  const conflicting = scheduleAssignments.filter(
    (a) => a.room === roomName && coursesOverlap(a, testCourse),
  );
  if (conflicting.length > 0) {
    msgEl.style.cssText = errorStyle;
    msgEl.textContent =
      "⚠ Room conflict with: " + conflicting.map((a) => a.code).join(", ");
    return false;
  }
  msgEl.style.cssText = successStyle;
  msgEl.textContent = `✓ No conflicts · ${pattern} ${formatTime(startTime)}–${formatTime(getEndTime(startTime, duration))} in ${roomName}`;
  return true;
}

function addManualEntry() {
  const courseCode = document.getElementById("manual-course").value;
  const roomName = document.getElementById("manual-room").value;
  const instructor = document.getElementById("manual-instructor").value.trim();
  const startTime = document.getElementById("manual-time").value;
  const duration = getDuration("manual-duration-h", "manual-duration-m");
  const pattern = document.getElementById("manual-pattern").value;
  if (!courseCode || !roomName || !startTime) {
    alert("Please fill in Course, Room, and Start Time.");
    return;
  }
  manualEntries.push({
    courseCode,
    roomName,
    instructor,
    startTime,
    endTime: getEndTime(startTime, duration),
    duration,
    pattern,
  });
  renderManualEntries();
  ["manual-course", "manual-room", "manual-instructor"].forEach(
    (id) => (document.getElementById(id).value = ""),
  );
  document.getElementById("manual-conflict-msg").style.display = "none";
}

function removeManualEntry(i) {
  manualEntries.splice(i, 1);
  renderManualEntries();
}

function renderManualEntries() {
  const wrap = document.getElementById("manual-entries-wrap");
  const list = document.getElementById("manual-entries-list");
  if (manualEntries.length === 0) {
    wrap.style.display = "none";
    return;
  }
  wrap.style.display = "block";
  list.innerHTML = manualEntries
    .map((e, i) => {
      const dh = Math.floor(e.duration),
        dm = Math.round((e.duration - dh) * 60);
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:var(--surface2);border-radius:6px;border:1px solid var(--border);font-size:12px;">
      <span><strong>${e.courseCode}</strong> · ${e.roomName} · ${e.pattern} · ${formatTime(e.startTime)}–${formatTime(e.endTime)} (${dm > 0 ? `${dh}h ${dm}m` : `${dh}h`})${e.instructor ? " · " + e.instructor : ""}</span>
      <button onclick="removeManualEntry(${i})" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:14px;padding:0;line-height:1">✕</button>
    </div>`;
    })
    .join("");
}

function submitManualSchedule() {
  const courseCode = document.getElementById("manual-course").value;
  const roomName = document.getElementById("manual-room").value;
  const instructor = document.getElementById("manual-instructor").value.trim();
  const startTime = document.getElementById("manual-time").value;
  const duration = getDuration("manual-duration-h", "manual-duration-m");
  const pattern = document.getElementById("manual-pattern").value;

  const toSave = [...manualEntries];
  if (courseCode && roomName && startTime) {
    toSave.push({
      courseCode,
      roomName,
      instructor,
      startTime,
      endTime: getEndTime(startTime, duration),
      duration,
      pattern,
    });
  }
  if (toSave.length === 0) {
    alert("Please fill in at least one assignment.");
    return;
  }

  toSave.forEach((entry) => {
    const course = courses.find((c) => c.code === entry.courseCode);
    if (!course) return;
    Object.assign(course, {
      room: entry.roomName,
      time: `${entry.pattern} ${formatTime(entry.startTime)}`,
      instructor: entry.instructor || course.instructor,
      duration: entry.duration,
      pattern: entry.pattern,
      status: "Assigned",
    });
    const idx = scheduleAssignments.findIndex((s) => s.code === course.code);
    if (idx >= 0) scheduleAssignments[idx] = { ...course };
    else scheduleAssignments.push({ ...course });
  });

  assignments = courses.filter((c) => c.status === "Assigned");
  conflicts = courses.filter((c) => c.status === "Conflict");
  instructors.forEach((inst) => {
    inst.courses = scheduleAssignments
      .filter(
        (s) =>
          s.instructor &&
          s.instructor.trim().toLowerCase() === inst.name.trim().toLowerCase(),
      )
      .map((s) => s.code);
  });

  renderDashboard();
  renderSchedule();
  renderCourses();
  renderFaculty();
  closeScheduleModal();
  showNotification(
    `${toSave.length} assignment${toSave.length > 1 ? "s" : ""} saved!`,
  );
}

function runAutoSchedule() {
  const duration = getDuration("auto-duration-h", "auto-duration-m");
  if (duration <= 0) {
    alert("Please enter a valid duration.");
    return;
  }

  const startTime = document.getElementById("auto-start").value;
  const endTime = document.getElementById("auto-end").value;
  const pattern = document.getElementById("auto-pattern").value;
  const activeDays = [
    ...document.querySelectorAll("#auto-days input:checked"),
  ].map((cb) => cb.value);
  if (activeDays.length === 0) {
    alert("Please select at least one active day.");
    return;
  }

  const stepMins = Math.round(duration * 60);
  const slots = [];
  let [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const endMins = eh * 60 + em;
  while (sh * 60 + sm + stepMins <= endMins) {
    slots.push(`${String(sh).padStart(2, "0")}:${String(sm).padStart(2, "0")}`);
    const next = sh * 60 + sm + stepMins;
    sh = Math.floor(next / 60);
    sm = next % 60;
  }
  if (slots.length === 0) {
    alert("No valid time slots in that range for the selected duration.");
    return;
  }

  rooms.forEach((r) => {
    const isUsed = scheduleAssignments.some((s) => s.room === r.number);
    if (!isUsed && r.status === "Occupied") r.status = "Available";
  });

  const pending = courses.filter((c) => c.status === "Pending");
  if (pending.length === 0) {
    scheduleAssignments = courses
      .filter((c) => c.status === "Assigned" || c.status === "Conflict")
      .map((c) => ({ ...c }));
    assignments = courses.filter((c) => c.status === "Assigned");
    conflicts = courses.filter((c) => c.status === "Conflict");
    instructors.forEach((inst) => {
      inst.courses = scheduleAssignments
        .filter(
          (s) =>
            s.instructor &&
            s.instructor.trim().toLowerCase() ===
              inst.name.trim().toLowerCase(),
        )
        .map((s) => s.code);
    });
    renderDashboard();
    renderSchedule();
    renderCourses();
    renderFaculty();
    closeScheduleModal();
    showNotification("Schedule generated — all assigned courses loaded!");
    return;
  }

  let slotIdx = 0,
    assigned = 0;
  pending.forEach((course) => {
    const avail = rooms.find(
      (r) =>
        r.status === "Available" &&
        (course.roomType === "Lab"
          ? r.type === "Computer Lab"
          : r.type === "Lecture"),
    );
    if (avail && slotIdx < slots.length) {
      Object.assign(course, {
        room: avail.number,
        time: `${pattern} ${formatTime(slots[slotIdx % slots.length])}`,
        duration,
        pattern,
        status: "Assigned",
      });
      avail.status = "Occupied";
      slotIdx++;
      assigned++;
    }
  });

  scheduleAssignments = courses
    .filter((c) => c.status === "Assigned" || c.status === "Conflict")
    .map((c) => ({ ...c }));
  assignments = courses.filter((c) => c.status === "Assigned");
  conflicts = courses.filter((c) => c.status === "Conflict");
  instructors.forEach((inst) => {
    inst.courses = scheduleAssignments
      .filter(
        (s) =>
          s.instructor &&
          s.instructor.trim().toLowerCase() === inst.name.trim().toLowerCase(),
      )
      .map((s) => s.code);
  });

  renderDashboard();
  renderSchedule();
  renderCourses();
  renderFaculty();
  closeScheduleModal();
  showNotification(
    `Auto-generated ${assigned} assignment${assigned !== 1 ? "s" : ""}!`,
  );
}

// ============ ADD COURSE MODAL ============

function openAddCourseModal() {
  document.getElementById("add-course-modal")?.remove();
  const modal = document.createElement("div");
  modal.id = "add-course-modal";
  modal.style.cssText =
    "position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:1000;display:flex;align-items:center;justify-content:center;";
  modal.innerHTML = `<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:24px;width:480px;display:flex;flex-direction:column;gap:16px;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <div style="font-size:16px;font-weight:700;color:var(--text)">+ Add New Course</div>
      <button onclick="closeAddCourseModal()" style="background:none;border:none;font-size:20px;color:var(--text3);cursor:pointer;padding:0;line-height:1">✕</button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div><label style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:4px;display:block">Course Code *</label>
        <input id="course-code" class="search-input" type="text" placeholder="e.g. CS401" style="width:100%;box-sizing:border-box"/></div>
      <div><label style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:4px;display:block">Title *</label>
        <input id="course-title" class="search-input" type="text" placeholder="e.g. Algorithms" style="width:100%;box-sizing:border-box"/></div>
      <div><label style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:4px;display:block">Program *</label>
        <select id="course-program" class="search-input" style="width:100%;box-sizing:border-box">
          <option value="">-- Select --</option><option value="CS">CS</option><option value="IT">IT</option><option value="IS">IS</option>
        </select></div>
      <div><label style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:4px;display:block">Year Level *</label>
        <select id="course-year" class="search-input" style="width:100%;box-sizing:border-box">
          <option value="1st">1st Year</option><option value="2nd">2nd Year</option><option value="3rd">3rd Year</option><option value="4th">4th Year</option>
        </select></div>
      <div><label style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:4px;display:block">Enrolled Students *</label>
        <input id="course-enrolled" class="search-input" type="number" min="1" placeholder="e.g. 35" style="width:100%;box-sizing:border-box"/></div>
      <div><label style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:4px;display:block">Room Type Required *</label>
        <select id="course-roomtype" class="search-input" style="width:100%;box-sizing:border-box">
          <option value="Lecture">Lecture</option><option value="Lab">Lab</option>
        </select></div>
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end;padding-top:4px;border-top:1px solid var(--border);">
      <button class="btn btn-secondary" onclick="closeAddCourseModal()">Cancel</button>
      <button class="btn btn-primary" onclick="submitAddCourse()">+ Add Course</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
  setTimeout(() => document.getElementById("course-code").focus(), 100);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeAddCourseModal();
  });
}

function closeAddCourseModal() {
  document.getElementById("add-course-modal")?.remove();
}

function submitAddCourse() {
  const code = document
    .getElementById("course-code")
    .value.trim()
    .toUpperCase();
  const title = document.getElementById("course-title").value.trim();
  const program = document.getElementById("course-program").value;
  const year = document.getElementById("course-year").value;
  const enrolled = parseInt(document.getElementById("course-enrolled").value);
  const roomType = document.getElementById("course-roomtype").value;
  if (!code || !title || !program || isNaN(enrolled) || enrolled <= 0) {
    alert("Please fill in all required fields correctly.");
    return;
  }
  if (courses.find((c) => c.code === code)) {
    alert(`Course code "${code}" already exists.`);
    return;
  }
  courses.push({
    code,
    title,
    program,
    year,
    enrolled,
    roomType,
    status: "Pending",
    instructor: "",
    room: "",
    time: "",
    duration: 0,
    pattern: "",
  });
  closeAddCourseModal();
  renderCourses();
  renderDashboard();
  showNotification(`Course ${code} added successfully!`);
}

// ============ INSTRUCTOR MODAL ============

function openAddInstructorModal() {
  document.getElementById("add-instructor-modal")?.remove();
  const modal = document.createElement("div");
  modal.id = "add-instructor-modal";
  modal.style.cssText =
    "position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:1000;display:flex;align-items:center;justify-content:center;";
  modal.innerHTML = `<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:24px;width:420px;display:flex;flex-direction:column;gap:16px;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <div style="font-size:16px;font-weight:700;color:var(--text)">+ Add New Instructor</div>
      <button onclick="closeInstructorModal()" style="background:none;border:none;font-size:20px;color:var(--text3);cursor:pointer;padding:0;line-height:1">✕</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:12px;">
      <div><label style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:4px;display:block">Full Name *</label>
        <input id="instructor-name" class="search-input" type="text" placeholder="e.g. Reyes, A." style="width:100%;box-sizing:border-box"/></div>
      <div><label style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:4px;display:block">Department</label>
        <select id="instructor-dept" class="search-input" style="width:100%;box-sizing:border-box">
          <option value="">-- Select Department --</option>
          <option value="CS">Computer Science (CS)</option><option value="IT">Information Technology (IT)</option><option value="IS">Information Systems (IS)</option>
        </select></div>
      <div><label style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:4px;display:block">Availability</label>
        <textarea id="instructor-availability" class="search-input" placeholder="e.g. MWF All Day, TTH Morning" style="width:100%;height:70px;resize:none;box-sizing:border-box"></textarea></div>
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end">
      <button class="btn btn-secondary" onclick="closeInstructorModal()">Cancel</button>
      <button class="btn btn-primary" onclick="submitAddInstructor()">+ Add Instructor</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
  setTimeout(() => document.getElementById("instructor-name").focus(), 100);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeInstructorModal();
  });
}

function closeInstructorModal() {
  document.getElementById("add-instructor-modal")?.remove();
}

function submitAddInstructor() {
  const name = document.getElementById("instructor-name").value.trim();
  const dept = document.getElementById("instructor-dept").value;
  const availability = document
    .getElementById("instructor-availability")
    .value.trim();
  if (!name) {
    alert("Please enter the instructor name.");
    document.getElementById("instructor-name").focus();
    return;
  }
  instructors.push({
    name,
    department: dept || "TBD",
    availability: availability || "TBD",
    courses: [],
    status: "Active",
  });
  closeInstructorModal();
  renderFaculty();
  showNotification("Instructor added successfully!");
}

// ============ NOTIFICATION ============

function showNotification(message) {
  const n = document.createElement("div");
  n.style.cssText =
    "position:fixed;bottom:30px;right:30px;background:var(--green);color:white;padding:14px 20px;border-radius:8px;font-size:13px;font-weight:500;z-index:1002;box-shadow:0 4px 12px rgba(0,0,0,0.2);";
  n.textContent = "✓ " + message;
  document.body.appendChild(n);
  setTimeout(() => {
    n.style.transition = "all 0.3s ease";
    n.style.opacity = "0";
    n.style.transform = "translateY(10px)";
    setTimeout(() => n.remove(), 300);
  }, 3000);
}

// ============ INIT ============

document.addEventListener("DOMContentLoaded", () => {
  initAuth();
  renderDashboard();
  renderSchedule();
  renderConflicts();
  renderRooms();
  renderCourses();
  renderFaculty();

  // Wire room search and filter inputs
  const roomSearch = document.getElementById("room-search-input");
  const roomTypeFilter = document.getElementById("room-type-filter");
  const roomStatFilter = document.getElementById("room-status-filter");
  function applyRoomFilters() {
    const search = roomSearch?.value || "";
    const type =
      roomTypeFilter?.value === "All Types" ? "" : roomTypeFilter?.value || "";
    const status =
      roomStatFilter?.value === "All Status" ? "" : roomStatFilter?.value || "";
    renderRooms(search, type, status);
  }
  roomSearch?.addEventListener("input", applyRoomFilters);
  roomTypeFilter?.addEventListener("change", applyRoomFilters);
  roomStatFilter?.addEventListener("change", applyRoomFilters);

  //Wire all Export to Excel buttons
  document
    .querySelectorAll(".export-excel-btn")
    .forEach((btn) => btn.addEventListener("click", exportToExcel));

  //Wire Prev / Next week buttons
  document
    .getElementById("schedule-prev-btn")
    ?.addEventListener("click", () => {
      scheduleWeekOffset--;
      renderSchedule();
    });
  document
    .getElementById("schedule-next-btn")
    ?.addEventListener("click", () => {
      scheduleWeekOffset++;
      renderSchedule();
    });

  //Wire room filter dropdown on Schedule page
  const scheduleRoomSelect = document.getElementById("schedule-room-filter");
  scheduleRoomSelect?.addEventListener("change", () => {
    scheduleRoomFilter =
      scheduleRoomSelect.value === "All Rooms" ? "" : scheduleRoomSelect.value;
    renderSchedule();
  });

  //schedule room dropdown
  if (scheduleRoomSelect) {
    scheduleRoomSelect.innerHTML =
      "<option>All Rooms</option>" +
      rooms
        .map((r) => `<option value="${r.number}">${r.number}</option>`)
        .join("");
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeModal();
      closeScheduleModal();
      closeInstructorModal();
      closePwModal();
      closeAddCourseModal();
    }
  });

  document.addEventListener("click", (e) => {
    const menu = document.getElementById("user-menu");
    const caret = document.getElementById("user-menu-caret");
    if (
      menu &&
      !menu.closest("div[style*='position:relative']")?.contains(e.target)
    ) {
      menu.style.display = "none";
      if (caret) caret.style.transform = "rotate(0deg)";
    }
  });

  const themeBtn = document.getElementById("theme-toggle");
  function setTheme(light) {
    document.body.classList.toggle("light", light);
    themeBtn.textContent = light ? "🌞" : "🌙";
    themeBtn.title = light ? "Switch to dark mode" : "Switch to light mode";
    try {
      localStorage.setItem("theme", light ? "light" : "dark");
    } catch (e) {}
  }
  let savedTheme = false;
  try {
    savedTheme = localStorage.getItem("theme") === "light";
  } catch (e) {}
  setTheme(savedTheme);
  themeBtn.addEventListener("click", () =>
    setTheme(!document.body.classList.contains("light")),
  );
});