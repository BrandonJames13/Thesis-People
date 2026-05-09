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
      {
        to: "/schedule",
        icon: "📆",
        label: "Schedule",
        tourId: "nav-schedule",
      },
      {
        to: "/conflicts",
        icon: "⚠",
        label: "Conflicts",
        hasBadge: true,
        adminOnly: true,
        tourId: "nav-conflicts",
      },
    ],
  },
  {
    section: "Management",
    items: [
      {
        to: "/rooms",
        icon: "🏫",
        label: "Rooms",
        adminOnly: true,
        tourId: "nav-rooms",
      },
      { to: "/faculty", icon: "👤", label: "Faculty", adminOnly: true },
      { to: "/subjects", icon: "📚", label: "Subjects", adminOnly: true },
      { to: "/users", icon: "👑", label: "Users", adminOnly: true },
    ],
  },
  {
    section: "System",
    items: [
      {
        to: "/algorithm",
        icon: "⚙",
        label: "Algorithm",
        adminOnly: true,
        tourId: "nav-algorithm",
      },
      { to: "/analytics", icon: "📊", label: "Analytics", adminOnly: true },
    ],
  },
  {
    section: "Help",
    items: [{ to: "/user-guide", icon: "📖", label: "User Guide" }],
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
              data-tour={item.tourId}
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
