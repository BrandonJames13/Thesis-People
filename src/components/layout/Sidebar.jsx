import { NavLink } from "react-router-dom";
import { useConflicts } from "../../context/ConflictContext";
import styles from "./Sidebar.module.css";

const navItems = [
  {
    section: "Main",
    items: [
      { to: "/", icon: "⊞", label: "Dashboard" },
      { to: "/schedule", icon: "📆", label: "Schedule" },
      { to: "/conflicts", icon: "⚠", label: "Conflicts", hasBadge: true },
    ],
  },
  {
    section: "Management",
    items: [
      { to: "/rooms", icon: "🏫", label: "Rooms" },
      { to: "/faculty", icon: "👤", label: "Faculty" },
      { to: "/courses", icon: "📚", label: "Courses" },
    ],
  },
  {
    section: "System",
    items: [
      { to: "/algorithm", icon: "⚙", label: "Algorithm" },
      { to: "/analytics", icon: "📊", label: "Analytics" },
    ],
  },
];

export default function Sidebar() {
  const { detectConflicts } = useConflicts();
  const { hard } = detectConflicts();
  const hardCount = hard.length;

  return (
    <nav className={styles.nav}>
      {navItems.map((group) => (
        <div key={group.section}>
          <div className={styles.section}>{group.section}</div>
          {group.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.active : ""}`
              }
            >
              <span className={styles.icon}>{item.icon}</span>
              {item.label}
              {item.hasBadge && (
                <span className={styles.badge}>{hardCount}</span>
              )}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );
}
