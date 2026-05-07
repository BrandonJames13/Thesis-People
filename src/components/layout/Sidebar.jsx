import { NavLink } from "react-router-dom";
import { useConflicts } from "../../context/ConflictContext";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import styles from "./Sidebar.module.css";

const navGroups = [
  {
    section: "Main",
    items: [
      { to: "/", icon: "⊞", label: "Dashboard" },
      { to: "/schedule", icon: "📆", label: "Schedule" },
      {
        to: "/conflicts",
        icon: "⚠",
        label: "Conflicts",
        hasBadge: true,
        adminOnly: true,
      },
    ],
  },
  {
    section: "Management",
    items: [
      { to: "/rooms", icon: "🏫", label: "Rooms", adminOnly: true },
      { to: "/faculty", icon: "👤", label: "Faculty", adminOnly: true },
      { to: "/subjects", icon: "📚", label: "Subjects", adminOnly: true },
      { to: "/users", icon: "👑", label: "Users", adminOnly: true },
    ],
  },
  {
    section: "System",
    items: [
      { to: "/algorithm", icon: "⚙", label: "Algorithm", adminOnly: true },
      { to: "/analytics", icon: "📊", label: "Analytics", adminOnly: true },
    ],
  },
];

export default function Sidebar() {
  const { isAdmin } = useAuth();
  const { hardConflictCount } = useConflicts();
  const { sidebarStyle } = useTheme();
  const isIcons = sidebarStyle === "icons";

  const visibleNavItems = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.adminOnly || isAdmin),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <nav className={`${styles.nav} ${isIcons ? styles.navIcons : ""}`}>
      {visibleNavItems.map((group) => (
        <div key={group.section}>
          {!isIcons && <div className={styles.section}>{group.section}</div>}
          {isIcons && <div className={styles.sectionDivider} />}
          {group.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              title={isIcons ? item.label : undefined}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.active : ""}`
              }
            >
              <span className={styles.icon}>{item.icon}</span>
              {!isIcons && item.label}
              {item.hasBadge && (
                <span
                  className={`${styles.badge} ${isIcons ? styles.badgeIcons : ""}`}
                >
                  {hardConflictCount}
                </span>
              )}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );
}
