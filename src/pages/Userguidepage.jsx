import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import OnboardingTour from "../components/onboarding/OnboardingTour";
import styles from "./UserGuidePage.module.css";

// ── Small reusable pieces ──────────────────────────────────────────────────

function SectionHeader({ num, icon, iconColor, title }) {
  return (
    <div className={styles.sectionHeader}>
      <div className={`${styles.sectionIcon} ${styles[iconColor]}`}>{icon}</div>
      <div>
        <div className={styles.sectionNum}>{num}</div>
        <h2 className={styles.sectionTitle}>{title}</h2>
      </div>
    </div>
  );
}

function Callout({ type = "info", icon, title, children }) {
  return (
    <div className={`${styles.callout} ${styles[`callout${type}`]}`}>
      <span className={styles.calloutIcon}>{icon}</span>
      <div>
        {title && <div className={styles.calloutTitle}>{title}</div>}
        <div>{children}</div>
      </div>
    </div>
  );
}

function Steps({ items }) {
  return (
    <div className={styles.steps}>
      {items.map((item, i) => (
        <div className={styles.step} key={i}>
          <div className={styles.stepNum}>{i + 1}</div>
          <div className={styles.stepBody}>
            <div className={styles.stepTitle}>{item.title}</div>
            <div className={styles.stepDesc}>{item.desc}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Badge({ type, children }) {
  return (
    <span className={`${styles.badge} ${styles[`badge${type}`]}`}>
      {children}
    </span>
  );
}

function TableWrap({ children }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>{children}</table>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function UserGuidePage() {
  const { currentUser } = useAuth();
  const [showTour, setShowTour] = useState(false);

  const handleRestartTour = () => {
    if (currentUser) {
      localStorage.removeItem(`tour_done_${currentUser.id ?? "guest"}`);
    }
    setShowTour(true);
  };

  const handleTourDone = () => {
    if (currentUser) {
      localStorage.setItem(`tour_done_${currentUser.id ?? "guest"}`, "true");
    }
    setShowTour(false);
  };
  const sections = [
    { id: "overview", icon: "🗺", label: "Overview" },
    { id: "login", icon: "🔐", label: "Logging In" },
    { id: "roles", icon: "👥", label: "User Roles" },
    { id: "navigation", icon: "🧭", label: "Navigation" },
    { id: "dashboard", icon: "⊞", label: "Dashboard" },
    { id: "schedule", icon: "📆", label: "Schedule View" },
    { id: "conflicts", icon: "⚠️", label: "Conflicts" },
    { id: "rooms", icon: "🏫", label: "Rooms" },
    { id: "faculty", icon: "👤", label: "Faculty" },
    { id: "subjects", icon: "📚", label: "Subjects" },
    { id: "users", icon: "👑", label: "Users" },
    { id: "algorithm", icon: "⚙️", label: "Algorithm" },
    { id: "analytics", icon: "📊", label: "Analytics" },
    { id: "importexport", icon: "↕️", label: "Import / Export" },
    { id: "csvformats", icon: "📄", label: "CSV Formats" },
    { id: "faq", icon: "❓", label: "FAQ" },
  ];

  return (
    <div className={styles.shell}>
      {showTour && <OnboardingTour onDone={handleTourDone} />}

      {/* ── SIDEBAR TOC ── */}
      <nav className={styles.toc}>
        <div className={styles.tocBrand}>
          <div className={styles.tocBrandLogo}>📅 CCS Schedule</div>
          <div className={styles.tocBrandSub}>User Guide · v1.0</div>
        </div>

        <div className={styles.tocGroupLabel}>Getting Started</div>
        {sections.slice(0, 4).map((s) => (
          <a key={s.id} href={`#${s.id}`} className={styles.tocLink}>
            <span className={styles.tocIcon}>{s.icon}</span>
            {s.label}
          </a>
        ))}

        <div className={styles.tocGroupLabel}>Core Features</div>
        {sections.slice(4, 7).map((s) => (
          <a key={s.id} href={`#${s.id}`} className={styles.tocLink}>
            <span className={styles.tocIcon}>{s.icon}</span>
            {s.label}
            {s.id === "conflicts" && (
              <span className={`${styles.tocBadge} ${styles.tocBadgeAdmin}`}>
                Admin
              </span>
            )}
          </a>
        ))}

        <div className={styles.tocGroupLabel}>Management</div>
        {sections.slice(7, 11).map((s) => (
          <a key={s.id} href={`#${s.id}`} className={styles.tocLink}>
            <span className={styles.tocIcon}>{s.icon}</span>
            {s.label}
            <span className={`${styles.tocBadge} ${styles.tocBadgeAdmin}`}>
              Admin
            </span>
          </a>
        ))}

        <div className={styles.tocGroupLabel}>System</div>
        {sections.slice(11).map((s) => (
          <a key={s.id} href={`#${s.id}`} className={styles.tocLink}>
            <span className={styles.tocIcon}>{s.icon}</span>
            {s.label}
            {(s.id === "algorithm" || s.id === "analytics") && (
              <span className={`${styles.tocBadge} ${styles.tocBadgeAdmin}`}>
                Admin
              </span>
            )}
          </a>
        ))}
      </nav>

      {/* ── MAIN CONTENT ── */}
      <main className={styles.main}>
        {/* HERO */}
        <div className={styles.hero}>
          <div className={styles.heroEyebrow}>Official Documentation</div>
          <h1 className={styles.heroTitle}>
            TSU · CCS
            <br />
            <em>Room Scheduling</em>
            <br />
            System
          </h1>
          <p className={styles.heroDesc}>
            A complete guide for using the College of Computer Studies
            scheduling platform — from logging in to generating conflict-free
            class timetables.
          </p>
          <div className={styles.heroMeta}>
            <span>📅 AY 2025–2026</span>
            <span>·</span>
            <span>v1.0 BETA</span>
            <span>·</span>
            <span>React + Supabase</span>
          </div>
          <button
            onClick={handleRestartTour}
            style={{
              marginTop: 20,
              background: "var(--accent)",
              border: "none",
              color: "var(--bg, #1a0505)",
              fontWeight: 700,
              fontSize: 13,
              padding: "9px 20px",
              borderRadius: 8,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
            }}
          >
            🎯 Restart Interactive Tour
          </button>
        </div>

        {/* ── 01 OVERVIEW ── */}
        <section className={styles.section} id="overview">
          <SectionHeader
            num="01 — OVERVIEW"
            icon="🗺"
            iconColor="blue"
            title="What is this system?"
          />
          <p>
            The <strong>CCS Room Scheduling System</strong> is a web-based
            application for Tarlac State University's College of Computer
            Studies. It automates the assignment of class sections to rooms and
            time slots, detects scheduling conflicts, and provides analytics on
            room utilization.
          </p>
          <div className={styles.cards}>
            {[
              {
                icon: "⚙️",
                title: "Auto-scheduling",
                desc: "Algorithm-driven assignment of sections, rooms, and instructors with configurable weights.",
              },
              {
                icon: "⚠️",
                title: "Conflict Detection",
                desc: "Real-time hard and soft conflict detection with localized reallocation tools.",
              },
              {
                icon: "📊",
                title: "Analytics",
                desc: "Room utilization rates, scheduling quality metrics, and system performance data.",
              },
              {
                icon: "↕️",
                title: "Import / Export",
                desc: "CSV-based bulk import for rooms, faculty, subjects, and schedules. PDF and CSV export.",
              },
            ].map((c) => (
              <div className={styles.card} key={c.title}>
                <div className={styles.cardIcon}>{c.icon}</div>
                <div className={styles.cardTitle}>{c.title}</div>
                <div className={styles.cardDesc}>{c.desc}</div>
              </div>
            ))}
          </div>
          <Callout type="Info" icon="ℹ️" title="Access Requirements">
            You need a valid institutional account to use this system. Contact
            your system administrator to get credentials.
          </Callout>
        </section>

        {/* ── 02 LOGIN ── */}
        <section className={styles.section} id="login">
          <SectionHeader
            num="02 — GETTING STARTED"
            icon="🔐"
            iconColor="blue"
            title="Logging In"
          />
          <p>
            Access the system through your browser. The login page is the
            default landing page for unauthenticated users.
          </p>
          <Steps
            items={[
              {
                title: "Open the application URL",
                desc: "Navigate to the system URL provided by your administrator in any modern browser (Chrome, Firefox, Edge, Safari).",
              },
              {
                title: "Enter your credentials",
                desc: "Type your institutional email address and password in the respective fields.",
              },
              {
                title: 'Click "Sign In →"',
                desc: 'You\'ll be redirected to the Dashboard on success. If you see "⚠ Incorrect email or password," double-check your credentials and try again.',
              },
            ]}
          />
          <Callout type="Warn" icon="⚠️" title="Forgot your password?">
            Contact your system administrator. The current version does not have
            a self-service password reset feature.
          </Callout>
        </section>

        {/* ── 03 ROLES ── */}
        <section className={styles.section} id="roles">
          <SectionHeader
            num="03 — ACCESS CONTROL"
            icon="👥"
            iconColor="purple"
            title="User Roles"
          />
          <p>
            The system has two roles. Your role determines which pages and
            actions you can access.
          </p>

          <div className={`${styles.roleBlock} ${styles.roleAdmin}`}>
            <div className={styles.roleBlockHeader}>
              <span>👑</span>
              <span>Administrator</span>
              <Badge type="Admin">Admin</Badge>
            </div>
            <ul className={styles.roleList}>
              {[
                "Full access to all pages and features",
                "Manage rooms, faculty, subjects, and users",
                "Run and configure the scheduling algorithm",
                "View and resolve scheduling conflicts",
                "Access analytics and performance reports",
                "Import and export data via CSV",
                "Reset all schedule data",
              ].map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </div>

          <div className={`${styles.roleBlock} ${styles.roleUser}`}>
            <div className={styles.roleBlockHeader}>
              <span>👤</span>
              <span>Regular User (Viewer)</span>
              <Badge type="User">User</Badge>
            </div>
            <ul className={styles.roleList}>
              {[
                "View the Dashboard with summary statistics",
                "Browse the Schedule page (read-only timetable view)",
                "Cannot modify data, run algorithms, or manage records",
              ].map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── 04 NAVIGATION ── */}
        <section className={styles.section} id="navigation">
          <SectionHeader
            num="04 — INTERFACE"
            icon="🧭"
            iconColor="teal"
            title="Navigation"
          />
          <p>
            The interface has a persistent <strong>sidebar</strong> on the left
            and a <strong>top header</strong> bar. The sidebar is organized into
            three sections:
          </p>
          <TableWrap>
            <thead>
              <tr>
                <th>Group</th>
                <th>Page</th>
                <th>Access</th>
                <th>Purpose</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td rowSpan={3}>
                  <strong>Main</strong>
                </td>
                <td>⊞ Dashboard</td>
                <td>
                  <Badge type="Ok">All users</Badge>
                </td>
                <td>Overview stats, quick actions</td>
              </tr>
              <tr>
                <td>📆 Schedule</td>
                <td>
                  <Badge type="Ok">All users</Badge>
                </td>
                <td>Timetable grid view</td>
              </tr>
              <tr>
                <td>⚠️ Conflicts</td>
                <td>
                  <Badge type="Admin">Admin</Badge>
                </td>
                <td>Conflict list with resolution tools</td>
              </tr>
              <tr>
                <td rowSpan={4}>
                  <strong>Management</strong>
                </td>
                <td>🏫 Rooms</td>
                <td>
                  <Badge type="Admin">Admin</Badge>
                </td>
                <td>Room registry</td>
              </tr>
              <tr>
                <td>👤 Faculty</td>
                <td>
                  <Badge type="Admin">Admin</Badge>
                </td>
                <td>Instructor registry</td>
              </tr>
              <tr>
                <td>📚 Subjects</td>
                <td>
                  <Badge type="Admin">Admin</Badge>
                </td>
                <td>Subject/course registry</td>
              </tr>
              <tr>
                <td>👑 Users</td>
                <td>
                  <Badge type="Admin">Admin</Badge>
                </td>
                <td>Account management</td>
              </tr>
              <tr>
                <td rowSpan={2}>
                  <strong>System</strong>
                </td>
                <td>⚙️ Algorithm</td>
                <td>
                  <Badge type="Admin">Admin</Badge>
                </td>
                <td>Run scheduler, tune weights</td>
              </tr>
              <tr>
                <td>📊 Analytics</td>
                <td>
                  <Badge type="Admin">Admin</Badge>
                </td>
                <td>Utilization &amp; quality metrics</td>
              </tr>
            </tbody>
          </TableWrap>
          <Callout type="Tip" icon="💡" title="Sidebar Style">
            The sidebar can be toggled between full-text and icon-only mode via
            Theme Settings in the header.
          </Callout>
        </section>

        {/* ── 05 DASHBOARD ── */}
        <section className={styles.section} id="dashboard">
          <SectionHeader
            num="05 — CORE FEATURES"
            icon="⊞"
            iconColor="blue"
            title="Dashboard"
          />
          <p>
            The Dashboard is the home screen. It shows a real-time summary of
            scheduling progress and provides quick access to the most common
            actions.
          </p>
          <TableWrap>
            <thead>
              <tr>
                <th>Stat Card</th>
                <th>What it means</th>
              </tr>
            </thead>
            <tbody>
              {[
                [
                  "Total Sections",
                  "Number of subject-sections requiring a room/time slot",
                ],
                [
                  "Assigned Sections",
                  "Sections that have been successfully scheduled",
                ],
                [
                  "Scheduling Progress",
                  "Percentage of sections assigned (assigned ÷ total)",
                ],
                ["Available Rooms", "Active rooms in the system"],
                ["Instructors", "Available faculty members"],
                [
                  "Hard Conflicts",
                  "Critical scheduling violations requiring resolution",
                ],
                [
                  "Generation Time",
                  "How long the last algorithm run took (in seconds)",
                ],
              ].map(([k, v]) => (
                <tr key={k}>
                  <td>{k}</td>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          <p>
            <strong>Quick actions (Admin only):</strong>
          </p>
          <div className={styles.steps}>
            {[
              {
                icon: "▶",
                title: "Generate Schedule",
                desc: "Opens the Schedule Generation modal. Runs the scheduling algorithm over all subject-sections. Existing assignments are replaced.",
              },
              {
                icon: "↑",
                title: "Import Data",
                desc: "Opens the Import modal to bulk-load rooms, faculty, subjects, or schedule data from CSV files.",
              },
              {
                icon: "↓",
                title: "Export Schedule",
                desc: "Opens the Export modal to download the current schedule as a PDF or CSV.",
              },
              {
                icon: "✕",
                title: "Reset All Data",
                desc: "Clears all schedule assignments after a confirmation prompt. This action cannot be undone.",
              },
            ].map((item) => (
              <div className={styles.step} key={item.title}>
                <div className={`${styles.stepNum} ${styles.stepNumIcon}`}>
                  {item.icon}
                </div>
                <div className={styles.stepBody}>
                  <div className={styles.stepTitle}>{item.title}</div>
                  <div className={styles.stepDesc}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 06 SCHEDULE ── */}
        <section className={styles.section} id="schedule">
          <SectionHeader
            num="06 — SCHEDULE VIEW"
            icon="📆"
            iconColor="blue"
            title="Schedule Page"
          />
          <p>
            The Schedule page displays the generated timetable as a grid with{" "}
            <strong>time slots on the vertical axis</strong> and{" "}
            <strong>days of the week on the horizontal axis</strong>.
          </p>
          <TableWrap>
            <thead>
              <tr>
                <th>Filter</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Room</td>
                <td>Show only the schedule for a specific room</td>
              </tr>
              <tr>
                <td>Instructor</td>
                <td>Show only classes assigned to a specific faculty member</td>
              </tr>
              <tr>
                <td>Section / Course</td>
                <td>Show only classes for a specific section or course code</td>
              </tr>
            </tbody>
          </TableWrap>
          <Callout type="Tip" icon="💡" title="Color Coding">
            Each course is assigned a distinct color based on its course code to
            help you quickly identify different subjects across the timetable
            grid.
          </Callout>
          <p>
            Admins can click any scheduled cell to open the{" "}
            <strong>Schedule Edit modal</strong>, allowing manual reassignment
            of a section to a different room or time slot.
          </p>
        </section>

        {/* ── 07 CONFLICTS ── */}
        <section className={styles.section} id="conflicts">
          <SectionHeader
            num="07 — CONFLICT MANAGEMENT"
            icon="⚠️"
            iconColor="red"
            title="Conflicts"
          />
          <p>
            The Conflicts page (Admin only) lists all detected scheduling
            violations and provides tools to resolve them.
          </p>
          <TableWrap>
            <thead>
              <tr>
                <th>Type</th>
                <th>Severity</th>
                <th>Examples</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>Hard Conflict</strong>
                </td>
                <td>
                  <Badge type="Hard">Critical</Badge>
                </td>
                <td>
                  Two sections in the same room at the same time; instructor
                  double-booked
                </td>
              </tr>
              <tr>
                <td>
                  <strong>Soft Conflict</strong>
                </td>
                <td>
                  <Badge type="Soft">Warning</Badge>
                </td>
                <td>
                  Room type mismatch; instructor preference not met; schedule
                  compactness violated
                </td>
              </tr>
            </tbody>
          </TableWrap>
          <Steps
            items={[
              {
                title: "Auto-Resolve All",
                desc: "Runs Localized Reallocation across all hard conflicts simultaneously. The algorithm finds conflict-free alternatives for each affected section.",
              },
              {
                title: "Resolve Individual Conflict",
                desc: "Click the Resolve button on a specific conflict. The system suggests better room alternatives and lets you confirm the reassignment.",
              },
              {
                title: "Dismiss Soft Conflict",
                desc: "For warning-level conflicts, you can dismiss them if the constraint violation is acceptable.",
              },
            ]}
          />
          <Callout type="Info" icon="ℹ️" title="Reallocation Log">
            Every auto-resolution action is logged and visible at the bottom of
            the Conflicts page so you can review what was changed.
          </Callout>
        </section>

        {/* ── 08 ROOMS ── */}
        <section className={styles.section} id="rooms">
          <SectionHeader
            num="08 — MANAGEMENT"
            icon="🏫"
            iconColor="green"
            title="Rooms"
          />
          <p>
            The Rooms page (Admin only) manages the physical spaces available
            for scheduling. Rooms are displayed as cards with capacity gauges.
          </p>
          <TableWrap>
            <thead>
              <tr>
                <th>Field</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Room Number", "Unique identifier (e.g., CCS-101)"],
                ["Type", "Lecture, Laboratory, Computer Laboratory, etc."],
                ["Capacity", "Maximum number of students"],
                ["Wing / Building", "Physical location grouping"],
                [
                  "Status",
                  "Active or Inactive (inactive rooms are excluded from scheduling)",
                ],
              ].map(([k, v]) => (
                <tr key={k}>
                  <td>
                    <code>{k}</code>
                  </td>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          <Steps
            items={[
              {
                title: "Adding a Room",
                desc: "Click Add Room. Fill in the required fields (Room Number, Type, Capacity). Click Save.",
              },
              {
                title: "Editing a Room",
                desc: "Hover over a room card to reveal the edit (pencil) icon. Click it, modify fields, and save.",
              },
              {
                title: "Deleting a Room",
                desc: "Hover over a room card and click the delete icon. Confirm in the prompt. Rooms with active assignments cannot be deleted.",
              },
              {
                title: "Viewing Room Schedule",
                desc: "Click the calendar icon on any room card to open a detailed schedule view for that specific room.",
              },
            ]}
          />
        </section>

        {/* ── 09 FACULTY ── */}
        <section className={styles.section} id="faculty">
          <SectionHeader
            num="09 — MANAGEMENT"
            icon="👤"
            iconColor="green"
            title="Faculty"
          />
          <p>
            The Faculty page (Admin only) maintains the instructor registry.
            Instructor data influences how the scheduler assigns sections.
          </p>
          <TableWrap>
            <thead>
              <tr>
                <th>Field</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Name", "Full name of the instructor"],
                ["Department", "Academic department"],
                ["Availability", "Preferred teaching pattern (e.g., MWF, TTH)"],
                ["Employment Status", "Full-time, Part-time, etc."],
                ["Max Units", "Maximum teaching load in units per semester"],
                [
                  "Allow Night Class",
                  "Whether the instructor can be assigned to evening time slots",
                ],
                ["Status", "Active or Inactive"],
              ].map(([k, v]) => (
                <tr key={k}>
                  <td>
                    <code>{k}</code>
                  </td>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          <Callout type="Tip" icon="💡" title="Export Faculty Schedule">
            On the Faculty page, you can export an individual instructor's
            schedule as a CSV directly from the faculty list.
          </Callout>
        </section>

        {/* ── 10 SUBJECTS ── */}
        <section className={styles.section} id="subjects">
          <SectionHeader
            num="10 — MANAGEMENT"
            icon="📚"
            iconColor="green"
            title="Subjects"
          />
          <p>
            The Subjects page (Admin only) manages the subject catalogue.
            Subjects are linked to sections to form the full list of{" "}
            <em>subject-sections</em> that the scheduler assigns.
          </p>
          <p>
            Subjects store information like subject code, descriptive title,
            number of units, and whether the subject requires a specific room
            type (lecture vs. laboratory).
          </p>
          <Callout type="Info" icon="ℹ️" title="Note on the Current Version">
            The Subjects page UI form is under active development. Use the CSV
            import workflow to bulk-load subjects in the meantime.
          </Callout>
        </section>

        {/* ── 11 USERS ── */}
        <section className={styles.section} id="users">
          <SectionHeader
            num="11 — MANAGEMENT"
            icon="👑"
            iconColor="purple"
            title="User Management"
          />
          <p>
            The Users page (Admin only) manages system accounts. Authentication
            is handled via Supabase Auth.
          </p>
          <Steps
            items={[
              {
                title: "Adding a User",
                desc: "Click Add User. Enter the email address, password, and assign a role (admin or user). Click Save.",
              },
              {
                title: "Editing a User",
                desc: "Click the Edit button on any user row to update their email, role, or password.",
              },
              {
                title: "Deleting a User",
                desc: "Click Delete and confirm. A logged-in admin cannot delete their own account.",
              },
            ]}
          />
          <Callout type="Danger" icon="⛔" title="Admin-only Feature">
            User management requires Admin role. Regular users do not see this
            page in the sidebar.
          </Callout>
        </section>

        {/* ── 12 ALGORITHM ── */}
        <section className={styles.section} id="algorithm">
          <SectionHeader
            num="12 — SYSTEM"
            icon="⚙️"
            iconColor="amber"
            title="Algorithm Configuration"
          />
          <p>
            The Algorithm page (Admin only) lets you configure the scheduling
            algorithm's soft-constraint weights before running a generation.
          </p>
          <TableWrap>
            <thead>
              <tr>
                <th>Weight</th>
                <th>Default</th>
                <th>What it optimizes</th>
              </tr>
            </thead>
            <tbody>
              {[
                [
                  "Time Preference",
                  "30%",
                  "Assigns sections within instructor's preferred time windows",
                ],
                [
                  "Room Type Match",
                  "25%",
                  "Assigns lecture subjects to lecture rooms, lab subjects to lab rooms",
                ],
                [
                  "Compactness",
                  "25%",
                  "Minimizes gaps between classes for instructors and sections",
                ],
                [
                  "Balance",
                  "20%",
                  "Distributes classes evenly across rooms and instructors",
                ],
              ].map(([k, d, v]) => (
                <tr key={k}>
                  <td>{k}</td>
                  <td>
                    <code>{d}</code>
                  </td>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          <Steps
            items={[
              {
                title: "Adjust the sliders",
                desc: "Drag each weight slider or type a value. The total must equal exactly 100% before saving.",
              },
              {
                title: 'Click "Save Configuration"',
                desc: "Weights are saved to local storage and will be used for all future algorithm runs until changed.",
              },
              {
                title: "Generate from Dashboard",
                desc: "Go back to the Dashboard and click Generate Schedule to run the scheduler with your new weights.",
              },
            ]}
          />
          <Callout type="Warn" icon="⚠️" title="Weights Must Total 100%">
            If the combined weights do not equal 100%, the system will show a
            warning and refuse to save.
          </Callout>
        </section>

        {/* ── 13 ANALYTICS ── */}
        <section className={styles.section} id="analytics">
          <SectionHeader
            num="13 — SYSTEM"
            icon="📊"
            iconColor="amber"
            title="Analytics"
          />
          <p>
            The Analytics page (Admin only) provides post-scheduling metrics for
            evaluating schedule quality and room utilization.
          </p>
          <TableWrap>
            <thead>
              <tr>
                <th>Metric</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {[
                [
                  "Average Room Utilization",
                  "Percentage of rooms actively used in the current schedule",
                ],
                [
                  "Section Assignment Rate",
                  "Percentage of all subject-sections that have been assigned",
                ],
                [
                  "Conflict Rate",
                  "Ratio of hard conflicts to total assigned sections",
                ],
                [
                  "Conflict-Free Rate",
                  "Inverse of conflict rate; higher is better",
                ],
                [
                  "Room Utilization Chart",
                  "Per-room bar chart sorted by utilization percentage",
                ],
                [
                  "Quality Attributes Table",
                  "ISO 25010-inspired functional suitability, reliability, and efficiency metrics",
                ],
              ].map(([k, v]) => (
                <tr key={k}>
                  <td>{k}</td>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          <Callout type="Info" icon="ℹ️" title="Data Dependency">
            Analytics only appears after a schedule has been generated. If no
            schedule exists, all metrics will show "No data yet."
          </Callout>
        </section>

        {/* ── 14 IMPORT / EXPORT ── */}
        <section className={styles.section} id="importexport">
          <SectionHeader
            num="14 — DATA OPERATIONS"
            icon="↕️"
            iconColor="teal"
            title="Import & Export"
          />
          <p>
            The system supports bulk data operations via CSV. Access the
            Import/Export modals from the Dashboard (Admin only).
          </p>
          <p>
            <strong>Importing Data</strong>
          </p>
          <Steps
            items={[
              {
                title: "Select Import Type",
                desc: "Choose what you're importing: Full List, Rooms, Instructors, Subjects, or Schedule.",
              },
              {
                title: "Choose your source",
                desc: "Upload: Select a CSV file from your computer. Repository: Pick from the pre-built sample CSV files.",
              },
              {
                title: "Preview & Validate",
                desc: "The system parses and validates the file, showing matched, skipped, and errored rows before writing. Review the validation log.",
              },
              {
                title: "Confirm Import",
                desc: "Click Import to write valid rows to the database. Duplicate and invalid rows are automatically skipped.",
              },
            ]}
          />
          <Callout type="Tip" icon="💡" title="Download Templates">
            In the Import modal, click <strong>Download Template</strong> for
            the selected import type to get a blank CSV with the correct column
            headers.
          </Callout>
          <p>
            <strong>Exporting Data</strong>
          </p>
          <TableWrap>
            <thead>
              <tr>
                <th>Format</th>
                <th>Contents</th>
                <th>Use case</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>PDF</td>
                <td>Formatted timetable printout</td>
                <td>Posting on bulletin boards, distribution</td>
              </tr>
              <tr>
                <td>CSV (Schedule)</td>
                <td>Raw assignment data with room, time, instructor</td>
                <td>Further analysis in Excel/Sheets</td>
              </tr>
              <tr>
                <td>CSV (Faculty)</td>
                <td>Individual instructor's schedule</td>
                <td>Per-faculty timetable distribution</td>
              </tr>
            </tbody>
          </TableWrap>
        </section>

        {/* ── 15 CSV FORMATS ── */}
        <section className={styles.section} id="csvformats">
          <SectionHeader
            num="15 — REFERENCE"
            icon="📄"
            iconColor="teal"
            title="CSV File Formats"
          />
          <p>
            Use these column headers exactly when preparing CSV files for
            import. Column names are case-insensitive.
          </p>

          {[
            {
              label: "Full List (rooms + subjects + sections combined)",
              headers:
                "room_number, subject_code, subject_title, section, instructor, units, room_type",
              example:
                "CCS-101, CS101, Intro to Computing, BSCS-1A, Juan dela Cruz, 3, Lecture",
            },
            {
              label: "Rooms only",
              headers: "room_number, type, capacity, wing, status",
              example: "CCS-101, Lecture, 40, A, Active",
            },
            {
              label: "Instructors / Faculty",
              headers:
                "name, department, availability, employment_status, max_units, allow_night_class",
              example: "Juan dela Cruz, CCS, MWF, Full-Time, 21, false",
            },
            {
              label: "Subjects",
              headers:
                "subject_code, subject_title, units, room_type, department",
              example: "CS101, Intro to Computing, 3, Lecture, CCS",
            },
          ].map((f) => (
            <div key={f.label} className={styles.csvBlock}>
              <div className={styles.csvLabel}>{f.label}</div>
              <div className={styles.csvHeader}>{f.headers}</div>
              <div className={styles.csvBody}>{f.example}</div>
            </div>
          ))}

          <Callout type="Warn" icon="⚠️" title="CSV Tips">
            Use hyphens in room numbers (e.g., <code>CCS-101</code>). Enclose
            fields containing commas in double quotes. Always download the
            template first to ensure correct formatting.
          </Callout>
        </section>

        {/* ── 16 FAQ ── */}
        <section className={styles.section} id="faq">
          <SectionHeader
            num="16 — TROUBLESHOOTING"
            icon="❓"
            iconColor="purple"
            title="FAQ"
          />

          {[
            {
              q: "The schedule generation shows 0 assignments. What happened?",
              a: "Make sure you have rooms, instructors, and subject-sections imported before running the algorithm. All three data types must exist for the scheduler to assign sections.",
            },
            {
              q: "My CSV import skipped all rows. Why?",
              a: "The most common cause is mismatched column headers. Download the template for that import type and ensure your file uses the exact same headers.",
            },
            {
              q: "The Conflicts badge shows a number but the page says no conflicts.",
              a: "The badge counts hard conflicts. If you see it but the page shows only soft warnings, the hard conflicts may have already been resolved. Try refreshing the browser.",
            },
            {
              q: "Can I undo a schedule generation?",
              a: "Not directly. The system doesn't maintain a history of previous schedules. If you need to revert, re-import your previous data or contact an administrator.",
            },
            {
              q: "The algorithm weights don't save. What should I do?",
              a: "Ensure the weights total exactly 100%. The system will reject the save if they don't. Also check that your browser is not blocking localStorage.",
            },
            {
              q: "I can't see the admin pages even though I have an account.",
              a: "Your account may have been created with the user role instead of admin. Ask an existing administrator to update your role in the Users page.",
            },
          ].map((item) => (
            <Callout key={item.q} type="Info" icon="Q" title={item.q}>
              {item.a}
            </Callout>
          ))}

          <Callout type="Tip" icon="💡" title="Still stuck?">
            Contact your system administrator or the development team. Provide a
            description of the issue and a screenshot of any error messages if
            possible.
          </Callout>
        </section>

        {/* FOOTER */}
        <hr className={styles.hr} />
        <p className={styles.footer}>
          TSU · CCS Room Scheduling System · User Guide v1.0 · AY 2025–2026
          <br />
          Generated for thesis documentation. Internal use only.
        </p>
      </main>
    </div>
  );
}
