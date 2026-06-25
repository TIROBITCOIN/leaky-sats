import { NavLink, useLocation } from "react-router-dom";
import { isValidMonthKey } from "../../lib/month";
import "../../styles/tabbar.css";

interface TabDef {
  to: string;
  label: string;
  icon: string;
}

const TABS: TabDef[] = [
  { to: "/", label: "홈", icon: "M3 11l9-7 9 7 M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" },
  { to: "/add", label: "입력", icon: "M12 5v14 M5 12h14" },
  { to: "/stats", label: "통계", icon: "M4 20V10 M10 20V4 M16 20v-7 M3 20h18" },
  { to: "/settings", label: "설정", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 13.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V19.5a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.04-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.04H4.5a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.56-1.04 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h0a1.7 1.7 0 0 0 1.04-1.56V4.5a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.04 1.56h0a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v0a1.7 1.7 0 0 0 1.56 1.04h.09a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.56 1.04z" },
];

export default function TabBar() {
  const location = useLocation();
  const monthParam = new URLSearchParams(location.search).get("month");
  const selectedMonth = isValidMonthKey(monthParam) ? monthParam : null;
  const getTabTarget = (path: string) =>
    selectedMonth && path !== "/settings" ? `${path}?month=${selectedMonth}` : path;

  return (
    <nav className="ldg-tabbar">
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={getTabTarget(tab.to)}
          end={tab.to === "/"}
          className={({ isActive }) => `ldg-tab ${isActive ? "active" : ""}`}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d={tab.icon} />
          </svg>
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
