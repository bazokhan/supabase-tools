import React from "react";
import {
  IconBack,
  IconChevronLeft,
  IconChevronRight,
  IconErd,
  IconExternal,
  IconFrontend,
  IconGraph,
  IconHome,
  IconLogs,
  IconMenu,
  IconMigrations,
  IconMoon,
  IconSearch,
  IconSun,
} from "./components/Icons";
import { Dropdown } from "./components/Dropdown";
import { ShellLoadingSkeleton } from "./components/Skeleton";
import { Tooltip } from "./components/Tooltip";
import { useAtlasData } from "./hooks/useAtlasData";
import { useDashboardConfig } from "./hooks/useDashboardConfig";
import {
  buildSearchIndex,
  formatDate,
  getInitialDark,
  getNavItems,
  inferPluginAvailability,
  normalizePath,
  prettyLabel,
  type CategoryMap,
  type NavItem,
  type RouteName,
} from "./lib/model";
import { getSectionIcon } from "./lib/section-icons";
import { DetailsPage } from "./pages/Details";
import { DependenciesPage } from "./pages/Depgraph";
import { FrontendPage } from "./pages/FrontendUsage";
import { LogsPage } from "./pages/Logs";
import { MigrationsPage } from "./pages/Migrations";
import { ErdPage } from "./pages/Erd";
import { OverviewPage } from "./pages/Overview";

const DARK_STORAGE_KEY = "sbt-dashboard-dark";
const SIDEBAR_COLLAPSED_KEY = "sbt-sidebar-collapsed";

function ShellLoading() {
  return <ShellLoadingSkeleton />;
}

function NavIcon({ item }: { item: NavItem }) {
  switch (item.icon) {
    case "migrations":
      return <IconMigrations size={15} />;
    case "graph":
      return <IconGraph size={15} />;
    case "logs":
      return <IconLogs size={15} />;
    case "frontend":
      return <IconFrontend size={15} />;
    case "erd":
      return <IconErd size={15} />;
    default:
      return <IconHome size={15} />;
  }
}

function routeActions(route: RouteName): Array<{ label: string; href: string; icon: React.ReactNode }> {
  if (route === "migrations") {
    return [
      { label: "Audit HTML", href: "/migration-audit.html", icon: <IconExternal size={14} /> },
      { label: "Studio", href: "http://localhost:3335", icon: <IconExternal size={14} /> },
    ];
  }
  if (route === "depgraph") {
    return [{ label: "Graph HTML", href: "/dependency-graph.html", icon: <IconExternal size={14} /> }];
  }
  if (route === "logs") {
    return [{ label: "Open Logs Plugin Viewer", href: "http://localhost:3333", icon: <IconExternal size={14} /> }];
  }
  return [];
}

export function App() {
  const atlas = useAtlasData();
  const dashboard = useDashboardConfig();

  const [dark, setDark] = React.useState(getInitialDark);
  const [route, setRoute] = React.useState<RouteName>(() => normalizePath(window.location.pathname));
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(
    () => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1"
  );
  const toggleCollapse = () => {
    setSidebarCollapsed((v) => {
      const next = !v;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      return next;
    });
  };
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchHighlightIndex, setSearchHighlightIndex] = React.useState(0);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const searchWrapRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setSearchQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem(DARK_STORAGE_KEY, dark ? "1" : "0");
  }, [dark]);

  React.useEffect(() => {
    const onPopState = () => setRoute(normalizePath(window.location.pathname));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  if (atlas.loading || dashboard.loading) return <ShellLoading />;

  const categories = (atlas.data?.categories ?? {}) as CategoryMap;
  const availability = inferPluginAvailability(categories, dashboard.sections);
  const navItems = getNavItems(availability);

  const globalSearch = buildSearchIndex(categories, dashboard.sections);
  const globalMatches = searchQuery.trim()
    ? globalSearch
        .filter((hit) => `${hit.title} ${hit.subtitle} ${hit.section}`.toLowerCase().includes(searchQuery.toLowerCase()))
        .slice(0, 10)
    : [];
  const clampedHighlight = Math.min(
    Math.max(0, searchHighlightIndex),
    Math.max(0, globalMatches.length - 1)
  );

  const navigate = (path: string) => {
    window.history.pushState({}, "", path);
    setRoute(normalizePath(new URL(path, window.location.origin).pathname));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openDetail = (section: string, key: string) => {
    setSearchQuery("");
    navigate(`/details?section=${encodeURIComponent(section)}&key=${encodeURIComponent(key)}`);
  };

  const activeNav = navItems.find((item) => item.route === route);
  const title = activeNav?.label ?? "Details";
  const subtitle = activeNav?.subtitle ?? "Detailed object view";
  const searchParams = new URLSearchParams(window.location.search);

  return (
    <div className={`app-shell${sidebarCollapsed ? " sidebar-collapsed" : ""}`}>
      <a href="#main" className="skip-link">Skip to content</a>
      <div className="sidebar-wrapper">
        <aside className={`sidebar-modern ${sidebarOpen ? "open" : ""}`}>
        <div className="brand-block">
          <h1>Supabase Tools</h1>
          <p>Operational Dashboard</p>
        </div>

        <nav className="sidebar-nav-modern">
          {navItems.map((item) => (
            <Tooltip key={item.path} content={item.enabled ? item.subtitle : "Plugin inactive"}>
              <button
                type="button"
                disabled={!item.enabled}
                className={`nav-link-modern ${route === item.route ? "active" : ""}`}
                onClick={() => {
                  navigate(item.path);
                  setSidebarOpen(false);
                }}
                aria-label={item.label}
              >
                <div className="nav-icon-row">
                  <NavIcon item={item} />
                  <strong>{item.label}</strong>
                </div>
                <span>{item.enabled ? item.subtitle : "Plugin inactive"}</span>
              </button>
            </Tooltip>
          ))}
        </nav>

        <Tooltip content={dark ? "Switch to light mode" : "Switch to dark mode"} className="tooltip-theme">
          <button type="button" className="theme-toggle" onClick={() => setDark((value) => !value)} aria-label="Toggle dark mode">
            {dark ? <IconSun size={14} /> : <IconMoon size={14} />}
            <span>{dark ? "Light" : "Dark"}</span>
          </button>
        </Tooltip>
        </aside>

        <Tooltip content={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
          <button
            type="button"
            className="sidebar-collapse-btn"
            onClick={toggleCollapse}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? (
              <IconChevronRight size={18} />
            ) : (
              <IconChevronLeft size={18} />
            )}
          </button>
        </Tooltip>
      </div>

      {sidebarOpen ? (
        <div
          className="sidebar-backdrop"
          role="button"
          tabIndex={-1}
          onClick={() => setSidebarOpen(false)}
          onKeyDown={(e) => e.key === "Escape" && setSidebarOpen(false)}
          aria-hidden
        />
      ) : null}

      <main id="main" className="main-area">
        <header className="topbar">
          <button
            type="button"
            className="mobile-menu-toggle ghost-btn"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="Toggle navigation menu"
            aria-expanded={sidebarOpen}
          >
            <IconMenu size={18} />
            <span>Menu</span>
          </button>
          <div>
            {route === "details" ? (
              <button type="button" className="ghost-btn" onClick={() => window.history.back()}>
                <IconBack size={14} />
                <span>Back</span>
              </button>
            ) : null}
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>

          <div className="topbar-actions">
            <div className="global-search-wrap" ref={searchWrapRef}>
              <div className="search-input-wrap">
                <IconSearch size={14} />
                <input
                  ref={searchInputRef}
                  type="search"
                  className="ui-input"
                  placeholder="Search anything in atlas"
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    setSearchHighlightIndex(0);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setSearchQuery("");
                      return;
                    }
                    if (globalMatches.length === 0) return;
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setSearchHighlightIndex((i) => Math.min(i + 1, globalMatches.length - 1));
                      return;
                    }
                    if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setSearchHighlightIndex((i) => Math.max(i - 1, 0));
                      return;
                    }
                    if (e.key === "Enter" && globalMatches[clampedHighlight]) {
                      e.preventDefault();
                      openDetail(globalMatches[clampedHighlight].section, globalMatches[clampedHighlight].keyField);
                    }
                  }}
                  aria-label="Global search"
                  aria-activedescendant={globalMatches[clampedHighlight] ? `search-hit-${clampedHighlight}` : undefined}
                />
                {!searchQuery && (
                  <span className="search-hint-badge" aria-hidden>
                    Ctrl+K
                  </span>
                )}
              </div>
              {globalMatches.length > 0 ? (
                <div className="search-popover" role="listbox">
                  {globalMatches.map((hit, index) => (
                    <button
                      key={hit.id}
                      id={`search-hit-${index}`}
                      type="button"
                      role="option"
                      aria-selected={index === clampedHighlight}
                      className={index === clampedHighlight ? "search-item-highlighted" : ""}
                      onClick={() => openDetail(hit.section, hit.keyField)}
                    >
                      <div className="search-item-title-row">
                        {React.createElement(getSectionIcon(hit.section), { size: 13 })}
                        <strong>{hit.title}</strong>
                      </div>
                      <span>{prettyLabel(hit.section)} {hit.subtitle ? `- ${hit.subtitle}` : ""}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <Tooltip content="When atlas data was last generated">
              <span className="timestamp-pill">Snapshot {formatDate(atlas.data?.meta?.timestamp)}</span>
            </Tooltip>

            <div className="header-actions">
              {(() => {
                const actions = routeActions(route);
                if (actions.length === 0) return null;
                if (actions.length === 1) {
                  return (
                    <Tooltip content="Opens in new tab">
                      <a className="header-action-link" href={actions[0].href} target="_blank" rel="noreferrer">
                        {actions[0].icon}
                        <span>{actions[0].label}</span>
                      </a>
                    </Tooltip>
                  );
                }
                return (
                  <Dropdown trigger={<button type="button" className="header-action-link">Actions ▾</button>} align="right">
                    <div className="dropdown-service-list">
                      {actions.map((action) => (
                        <a
                          key={action.label}
                          className="dropdown-service-item"
                          href={action.href}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {action.icon}
                          <span>{action.label}</span>
                        </a>
                      ))}
                    </div>
                  </Dropdown>
                );
              })()}
            </div>
          </div>
        </header>

        {atlas.error ? (
          <section className="panel">
            <h2>Data Error</h2>
            <p className="empty-state">{atlas.error}</p>
          </section>
        ) : null}

        {!atlas.error ? (
          <div key={route} className="route-content-transition">
            {route === "overview" ? (
              <OverviewPage categories={categories} sections={dashboard.sections} onOpenDetail={openDetail} />
            ) : route === "migrations" ? (
              <MigrationsPage categories={categories} onOpenDetail={openDetail} enabled={availability.migrations} />
            ) : route === "depgraph" ? (
              <DependenciesPage categories={categories} onOpenDetail={openDetail} enabled={availability.depgraph} />
            ) : route === "logs" ? (
              <LogsPage categories={categories} enabled={availability.logs} />
            ) : route === "frontend" ? (
              <FrontendPage categories={categories} onOpenDetail={openDetail} enabled={availability.frontend} />
            ) : route === "erd" ? (
              <ErdPage categories={categories} />
            ) : route === "details" ? (
              <DetailsPage
                categories={categories}
                search={searchParams}
                sections={dashboard.sections}
                onOpenDetail={openDetail}
              />
            ) : null}
          </div>
        ) : null}
      </main>
    </div>
  );
}
