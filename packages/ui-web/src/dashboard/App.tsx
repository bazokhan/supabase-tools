import React from "react";
import { Sidebar } from "./components/Sidebar";
import { Overview } from "./pages/Overview";
import { Migrations } from "./pages/Migrations";
import { Depgraph } from "./pages/Depgraph";
import { Logs } from "./pages/Logs";
import { FrontendUsage } from "./pages/FrontendUsage";

const DARK_STORAGE_KEY = "sbt-dashboard-dark";

function getInitialDark(): boolean {
  if (typeof window === "undefined") return false;
  const stored = localStorage.getItem(DARK_STORAGE_KEY);
  if (stored !== null) return stored === "1";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function CurrentPage() {
  const pathname = typeof window !== "undefined" ? window.location.pathname || "/" : "/";
  if (pathname.startsWith("/migrations")) return <Migrations />;
  if (pathname.startsWith("/depgraph")) return <Depgraph />;
  if (pathname.startsWith("/logs")) return <Logs />;
  if (pathname.startsWith("/frontend-usage")) return <FrontendUsage />;
  return <Overview />;
}

export function App() {
  const [dark, setDark] = React.useState(getInitialDark);

  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem(DARK_STORAGE_KEY, dark ? "1" : "0");
  }, [dark]);

  return (
    <div className="app-layout">
      <Sidebar dark={dark} onToggleDark={() => setDark((d) => !d)} />
      <main className="app-main">
        <CurrentPage />
      </main>
    </div>
  );
}
