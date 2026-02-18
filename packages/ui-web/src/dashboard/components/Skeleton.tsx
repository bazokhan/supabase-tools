import React from "react";

interface SkeletonProps {
  className?: string;
  variant?: "text" | "heading" | "stat" | "table-row" | "nav-item";
}

export function Skeleton({ className = "", variant = "text" }: SkeletonProps) {
  const base = "skeleton";
  const variantClass = `skeleton-${variant}`;
  return <div className={`${base} ${variantClass} ${className}`.trim()} aria-hidden />;
}

export function ShellLoadingSkeleton() {
  return (
    <div className="app-shell">
      <aside className="sidebar-modern">
        <div className="brand-block">
          <Skeleton variant="heading" />
          <Skeleton variant="text" />
        </div>
        <nav className="sidebar-nav-modern">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} variant="nav-item" />
          ))}
        </nav>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div>
            <Skeleton variant="heading" />
            <Skeleton variant="text" />
          </div>
        </header>
        <section className="panel">
          <div className="skeleton-stat-grid">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} variant="stat" />
            ))}
          </div>
          <div className="skeleton-table">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <Skeleton key={i} variant="table-row" />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
