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
          time: "MWF 8:00",
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
          time: "MWF 1:00",
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
          time: "MWF 9:00",
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
          time: "MWF 11:00",
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
          time: "TTH 10:00",
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
          time: "TTH 8:00",
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
          time: "TTH 9:00",
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
          time: "TTH 1:00",
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
        },
      ];

      let rooms = [
        {
          number: "Room 101",
          type: "Lecture",
          capacity: 40,
          status: "Available",
        },
        {
          number: "Room 102",
          type: "Lecture",
          capacity: 35,
          status: "Occupied",
        },
        {
          number: "Room 103",
          type: "Lecture",
          capacity: 45,
          status: "Occupied",
        },
        {
          number: "Room 201",
          type: "Lecture",
          capacity: 50,
          status: "Occupied",
        },
        {
          number: "Room 302",
          type: "Lecture",
          capacity: 40,
          status: "Available",
        },
        {
          number: "Lab 01",
          type: "Computer Lab",
          capacity: 45,
          status: "Occupied",
        },
        {
          number: "Lab 02",
          type: "Computer Lab",
          capacity: 25,
          status: "Available",
        },
        {
          number: "Lab 03",
          type: "Computer Lab",
          capacity: 30,
          status: "Maintenance",
        },
      ];

      let instructors = [];
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
        const page = document.getElementById("page-" + id);
        if (page) page.classList.add("active");
        const tab = document.getElementById("tab-" + id);
        if (tab) tab.classList.add("active");
        document.querySelectorAll(".nav-item").forEach((n) => {
          if (
            n.getAttribute("onclick") &&
            n.getAttribute("onclick").includes("'" + id + "'")
          )
            n.classList.add("active");
        });
      }

      // ============ RENDER FUNCTIONS ============
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
          tbody.innerHTML = "";
          assignments.slice(0, 6).forEach((course) => {
            tbody.innerHTML += `<tr>
        <td><span class="monospace">${course.code}</span><br /><span style="font-size:11px;color:var(--text3)">${course.title}</span></td>
        <td class="monospace">${course.room}</td>
        <td class="monospace">${course.time}</td>
        <td>${course.instructor}</td>
        <td><span class="pill pill-${course.status === "Assigned" ? "green" : "red"}">${course.status}</span></td>
      </tr>`;
          });
        }

        document.querySelector("#tab-schedule .tab-count").textContent =
          assignments.length;
        document.querySelector("#tab-conflicts .tab-count").textContent =
          conflicts.length;
        document.querySelector("#tab-conflicts .tab-count").style.color =
          "var(--red)";
      }

      function renderSchedule() {
        const cells = document.querySelectorAll(".sched-cell");
        cells.forEach((cell) => (cell.className = "sched-cell empty"));
        assignments.forEach((course) => {
          let row, col;
          if (course.time.includes("7:00")) row = 1;
          else if (course.time.includes("9:00")) row = 2;
          if (course.time.includes("MON")) col = 1;
          if (row && col) {
            const cell = document.querySelector(
              `.schedule-grid .sched-cell:nth-child(${row * 7 + col})`,
            );
            if (cell) {
              cell.className = "sched-cell occupied-blue";
              cell.innerHTML = `<div class="sched-course">${course.code}</div><div class="sched-room">${course.room}</div><div class="sched-prof">${course.instructor}</div>`;
            }
          }
        });
      }

      function renderConflicts() {
        const container = document.getElementById("page-conflicts");
        container
          .querySelectorAll(".conflict-card")
          .forEach((card) => card.remove());
        conflicts.forEach((conflict) => {
          container.insertAdjacentHTML(
            "beforeend",
            `<div class="conflict-card">
      <div class="conflict-icon">🔴</div>
      <div style="flex:1">
        <div class="conflict-title">${conflict.code} Conflict</div>
        <div class="conflict-desc">${conflict.title} assigned to ${conflict.room} at ${conflict.time}.</div>
        <div class="conflict-actions">
          <button class="btn btn-danger" onclick="resolveConflict('${conflict.code}')">⚙ Localized Reallocation</button>
        </div>
      </div>
    </div>`,
          );
        });
      }

      function renderRooms() {
        const grid = document.querySelector(".rooms-grid");
        grid.innerHTML = "";
        rooms.forEach((room, index) => {
          const statusColor =
            room.status === "Available"
              ? "green"
              : room.status === "Maintenance"
                ? "orange"
                : "blue";
          grid.innerHTML += `<div class="room-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div class="room-number">${room.number}</div>
        <button onclick="deleteRoom(${index})" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:16px;line-height:1;padding:0;" title="Delete room">✕</button>
      </div>
      <div class="room-type">${room.type}</div>
      <div style="margin-bottom:10px"><span class="pill pill-${statusColor}">${room.status}</span></div>
      <div class="room-capacity">
        <span style="font-size:11px;color:var(--text3)">Cap:</span>
        <div class="cap-bar"><div class="cap-fill" style="width:${Math.round((room.capacity / 50) * 100)}%"></div></div>
        <span class="monospace">${room.capacity}</span>
      </div>
    </div>`;
        });
      }

      function renderCourses() {
        const tbody = document.querySelector("#page-courses table tbody");
        tbody.innerHTML = "";
        courses.forEach((course) => {
          tbody.innerHTML += `<tr>
      <td class="monospace">${course.code}</td>
      <td>${course.title}</td>
      <td>${course.program}</td>
      <td>${course.year}</td>
      <td>${course.enrolled}</td>
      <td>${course.roomType}</td>
      <td><span class="pill pill-${course.status === "Assigned" ? "green" : course.status === "Conflict" ? "red" : "orange"}">${course.status}</span></td>
    </tr>`;
        });
      }

      function renderFaculty() {
        const tbody = document.getElementById("faculty-tbody");
        if (!tbody) return;
        tbody.innerHTML = "";
        if (instructors.length === 0) {
          tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text3);">No instructors added yet. Click "+ Add Instructor" to add one.</td></tr>`;
          return;
        }
        instructors.forEach((instructor) => {
          const coursesList =
            instructor.courses.length > 0
              ? instructor.courses.join(", ")
              : '<span style="color:var(--text3)">None</span>';
          const row = document.createElement("tr");
          row.innerHTML = `
      <td><strong>${instructor.name}</strong></td>
      <td class="monospace" style="font-size:12px">${coursesList}</td>
      <td>${instructor.courses.length} course${instructor.courses.length !== 1 ? "s" : ""}</td>
      <td style="font-size:12px">${instructor.availability}</td>
      <td><span class="pill pill-${instructor.status === "Active" ? "green" : "red"}">${instructor.status}</span></td>
    `;
          tbody.appendChild(row);
        });
      }

      // ============ ACTIONS ============
      function runAlgorithm() {
        courses.forEach((course) => {
          if (course.status === "Pending") {
            const availableRoom = rooms.find(
              (r) => r.status === "Available" && r.type === course.roomType,
            );
            if (availableRoom) {
              course.room = availableRoom.number;
              course.time = "MWF 10:00";
              course.status = "Assigned";
              availableRoom.status = "Occupied";
            }
          }
        });
        assignments = courses.filter((c) => c.status === "Assigned");
        conflicts = courses.filter((c) => c.status === "Conflict");
        renderDashboard();
        renderSchedule();
        alert("Schedule generated! Updated assignments.");
      }

      function resolveConflict(code) {
        const conflict = courses.find((c) => c.code === code);
        if (conflict) {
          conflict.room = "Room 103";
          conflict.time = "WED 3PM";
          conflict.status = "Assigned";
        }
        assignments = courses.filter((c) => c.status === "Assigned");
        conflicts = courses.filter((c) => c.status === "Conflict");
        renderConflicts();
        renderDashboard();
      }

      function deleteRoom(index) {
        const room = rooms[index];
        if (confirm(`Delete ${room.number}? This cannot be undone.`)) {
          rooms.splice(index, 1);
          renderRooms();
          renderDashboard();
        }
      }

      // ============ ROOM MODAL ============
      function addRoom() {
        document.getElementById("add-room-modal").style.display = "flex";
        document.getElementById("room-number").focus();
      }

      function submitAddRoom() {
        const number = document.getElementById("room-number").value.trim();
        const type = document.getElementById("room-type").value;
        const capacity = parseInt(
          document.getElementById("room-capacity").value,
        );
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

      // ============ INSTRUCTOR MODAL ============
      function openAddInstructorModal() {
        const existing = document.getElementById("add-instructor-modal");
        if (existing) existing.remove();

        const modal = document.createElement("div");
        modal.id = "add-instructor-modal";
        modal.style.cssText =
          "position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:1000;display:flex;align-items:center;justify-content:center;";
        modal.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:24px;width:420px;display:flex;flex-direction:column;gap:16px;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div style="font-size:16px;font-weight:700;color:var(--text);">+ Add New Instructor</div>
        <button onclick="closeInstructorModal()" style="background:none;border:none;font-size:20px;color:var(--text3);cursor:pointer;padding:0;line-height:1;">✕</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div>
          <label style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:4px;display:block;">Full Name *</label>
          <input id="instructor-name" class="search-input" type="text" placeholder="e.g. Reyes, A." style="width:100%;box-sizing:border-box;" />
        </div>
        <div>
          <label style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:4px;display:block;">Department</label>
          <select id="instructor-dept" class="search-input" style="width:100%;box-sizing:border-box;">
            <option value="">-- Select Department --</option>
            <option value="CS">Computer Science (CS)</option>
            <option value="IT">Information Technology (IT)</option>
            <option value="IS">Information Systems (IS)</option>
          </select>
        </div>
        <div>
          <label style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:4px;display:block;">Availability</label>
          <textarea id="instructor-availability" class="search-input" placeholder="e.g. MWF All Day, TTH Morning" style="width:100%;height:70px;resize:none;box-sizing:border-box;"></textarea>
        </div>
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end;">
        <button class="btn btn-secondary" onclick="closeInstructorModal()">Cancel</button>
        <button class="btn btn-primary" onclick="submitAddInstructor()">+ Add Instructor</button>
      </div>
    </div>
  `;
        document.body.appendChild(modal);
        setTimeout(
          () => document.getElementById("instructor-name").focus(),
          100,
        );
        modal.addEventListener("click", (e) => {
          if (e.target === modal) closeInstructorModal();
        });
      }

      function closeInstructorModal() {
        const modal = document.getElementById("add-instructor-modal");
        if (modal) modal.remove();
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
        renderDashboard();
        renderSchedule();
        renderConflicts();
        renderRooms();
        renderCourses();
        renderFaculty();

        document.addEventListener("keydown", (e) => {
          if (e.key === "Escape") closeModal();
        });

        const themeBtn = document.getElementById("theme-toggle");
        function setTheme(light) {
          document.body.classList.toggle("light", light);
          themeBtn.textContent = light ? "🌞" : "🌙";
          themeBtn.title = light
            ? "Switch to dark mode"
            : "Switch to light mode";
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