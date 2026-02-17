import React from "react";

interface SidebarProps {
  dark: boolean;
  onToggleDark: () => void;
}

const NAV_ITEMS = [
  { path: "/", label: "Overview" },
  { path: "/migrations", label: "Migrations" },
  { path: "/depgraph", label: "Dependencies" },
  { path: "/logs", label: "Logs & Performance" },
  { path: "/frontend-usage", label: "Frontend Usage" },
];

export function Sidebar({ dark, onToggleDark }: SidebarProps) {
  const pathname = typeof window !== "undefined" ? window.location.pathname || "/" : "/";

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1 className="sidebar-title">SBT Dashboard</h1>
      </div>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <a
            key={item.path}
            href={item.path}
            className={`sidebar-link ${pathname === item.path || (item.path !== "/" && pathname.startsWith(item.path)) ? "active" : ""}`}
          >
            {item.label}
          </a>
        ))}
      </nav>
      <div className="sidebar-footer">
        <button
          type="button"
          className="sidebar-toggle"
          onClick={onToggleDark}
          title={dark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {dark ? "☀️ Light" : "🌙 Dark"}
        </button>
      </div>
    </aside>
  );
}
