import React from "react";
import {
  IconBack,
  IconExternal,
  IconFile,
  IconFrontend,
  IconGraph,
  IconHome,
  IconLogs,
  IconMigrations,
  IconMoon,
  IconSearch,
  IconSun,
} from "./components/Icons";
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
import { DetailsPage } from "./pages/Details";
import { DependenciesPage } from "./pages/Depgraph";
import { FrontendPage } from "./pages/FrontendUsage";
import { LogsPage } from "./pages/Logs";
import { MigrationsPage } from "./pages/Migrations";
import { OverviewPage } from "./pages/Overview";

const DARK_STORAGE_KEY = "sbt-dashboard-dark";

function ShellLoading() {
  return (
    <div className="app-shell">
      <aside className="sidebar-modern" />
      <main className="main-area">
        <section className="panel"><p>Loading dashboard data...</p></section>
      </main>
    </div>
  );
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
  const [searchQuery, setSearchQuery] = React.useState("");

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

  const navigate = (path: string) => {
    window.history.pushState({}, "", path);
    setRoute(normalizePath(new URL(path, window.location.origin).pathname));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openDetail = (section: string, key: string) => {
    navigate(`/details?section=${encodeURIComponent(section)}&key=${encodeURIComponent(key)}`);
  };

  const activeNav = navItems.find((item) => item.route === route);
  const title = activeNav?.label ?? "Details";
  const subtitle = activeNav?.subtitle ?? "Detailed object view";
  const searchParams = new URLSearchParams(window.location.search);

  return (
    <div className="app-shell">
      <aside className="sidebar-modern">
        <div className="brand-block">
          <h1>Supabase Tools</h1>
          <p>Operational Dashboard</p>
        </div>

        <nav className="sidebar-nav-modern">
          {navItems.map((item) => (
            <button
              key={item.path}
              type="button"
              disabled={!item.enabled}
              className={`nav-link-modern ${route === item.route ? "active" : ""}`}
              onClick={() => navigate(item.path)}
            >
              <div className="nav-icon-row">
                <NavIcon item={item} />
                <strong>{item.label}</strong>
              </div>
              <span>{item.enabled ? item.subtitle : "Plugin inactive"}</span>
            </button>
          ))}
        </nav>

        <Tooltip content={dark ? "Switch to light mode" : "Switch to dark mode"} className="tooltip-theme">
          <button type="button" className="theme-toggle" onClick={() => setDark((value) => !value)}>
            {dark ? <IconSun size={14} /> : <IconMoon size={14} />}
            <span>{dark ? "Light" : "Dark"}</span>
          </button>
        </Tooltip>
      </aside>

      <main className="main-area">
        <header className="topbar">
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
            <div className="global-search-wrap">
              <div className="search-input-wrap">
                <IconSearch size={14} />
                <input
                  type="search"
                  className="ui-input"
                  placeholder="Search anything in atlas"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
              </div>
              {globalMatches.length > 0 ? (
                <div className="search-popover">
                  {globalMatches.map((hit) => (
                    <button key={hit.id} type="button" onClick={() => openDetail(hit.section, hit.keyField)}>
                      <div className="search-item-title-row">
                        <IconFile size={13} />
                        <strong>{hit.title}</strong>
                      </div>
                      <span>{prettyLabel(hit.section)} {hit.subtitle ? `- ${hit.subtitle}` : ""}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <span className="timestamp-pill">Snapshot {formatDate(atlas.data?.meta?.timestamp)}</span>

            <div className="header-actions">
              {routeActions(route).map((action) => (
                <a key={action.label} className="header-action-link" href={action.href} target="_blank" rel="noreferrer">
                  {action.icon}
                  <span>{action.label}</span>
                </a>
              ))}
            </div>
          </div>
        </header>

        {atlas.error ? (
          <section className="panel">
            <h2>Data Error</h2>
            <p className="empty-state">{atlas.error}</p>
          </section>
        ) : null}

        {!atlas.error && route === "overview" ? (
          <OverviewPage categories={categories} sections={dashboard.sections} onOpenDetail={openDetail} />
        ) : null}
        {!atlas.error && route === "migrations" ? (
          <MigrationsPage categories={categories} onOpenDetail={openDetail} enabled={availability.migrations} />
        ) : null}
        {!atlas.error && route === "depgraph" ? (
          <DependenciesPage categories={categories} onOpenDetail={openDetail} enabled={availability.depgraph} />
        ) : null}
        {!atlas.error && route === "logs" ? <LogsPage categories={categories} enabled={availability.logs} /> : null}
        {!atlas.error && route === "frontend" ? (
          <FrontendPage categories={categories} onOpenDetail={openDetail} enabled={availability.frontend} />
        ) : null}
        {!atlas.error && route === "details" ? (
          <DetailsPage categories={categories} search={searchParams} sections={dashboard.sections} />
        ) : null}
      </main>
    </div>
  );
}
