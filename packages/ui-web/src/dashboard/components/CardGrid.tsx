import React from "react";

interface CardGridProps {
  children: React.ReactNode;
}

export function CardGrid({ children }: CardGridProps) {
  return <div className="card-grid">{children}</div>;
}

interface ExpandableCardProps {
  title: string;
  subtitle?: string;
  badges?: React.ReactNode;
  children: React.ReactNode;
}

export function ExpandableCard({ title, subtitle, badges, children }: ExpandableCardProps) {
  return (
    <details className="expandable-card">
      <summary>
        <div className="expandable-card-head">
          <div>
            <div className="expandable-card-title">{title}</div>
            {subtitle && <div className="expandable-card-subtitle">{subtitle}</div>}
          </div>
          {badges && <div className="expandable-card-badges">{badges}</div>}
        </div>
      </summary>
      <div className="expandable-card-body">{children}</div>
    </details>
  );
}
