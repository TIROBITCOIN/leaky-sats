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
  { to: "/settings", label: "설정", icon: "M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5z M19.43 12.98c.04-.32.07-.65.07-.98s-.02-.66-.07-.98l2.11-1.65a.5.5 0 0 0 .12-.64l-2-3.46a.5.5 0 0 0-.6-.22l-2.49 1a7.3 7.3 0 0 0-1.69-.98L14.5 2.42A.5.5 0 0 0 14 2h-4a.5.5 0 0 0-.5.42L9.12 5.07c-.61.24-1.18.56-1.69.98l-2.49-1a.5.5 0 0 0-.6.22l-2 3.46a.5.5 0 0 0 .12.64l2.11 1.65c-.04.32-.07.65-.07.98s.02.66.07.98l-2.11 1.65a.5.5 0 0 0-.12.64l2 3.46a.5.5 0 0 0 .6.22l2.49-1c.51.4 1.08.73 1.69.98l.38 2.65a.5.5 0 0 0 .5.42h4a.5.5 0 0 0 .5-.42l.38-2.65c.61-.24 1.18-.56 1.69-.98l2.49 1a.5.5 0 0 0 .6-.22l2-3.46a.5.5 0 0 0-.12-.64l-2.11-1.65z" },
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
