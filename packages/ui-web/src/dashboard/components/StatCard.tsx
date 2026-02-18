import React from "react";

export type StatTone = "default" | "good" | "warn" | "bad" | "accent";

interface StatCardProps {
  label: string;
  value: string | number;
  tone?: StatTone;
  onClick?: () => void;
}

const TONE_CLASS: Record<StatTone, string> = {
  default: "stat-tone-default",
  good: "stat-tone-good",
  warn: "stat-tone-warn",
  bad: "stat-tone-bad",
  accent: "stat-tone-accent",
};

export function StatCard({ label, value, tone = "default", onClick }: StatCardProps) {
  return (
    <div
      className={`stat-card ${TONE_CLASS[tone]} ${onClick ? "stat-card-clickable" : ""}`}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="stat-card-value">{value}</div>
      <div className="stat-card-label">{label}</div>
    </div>
  );
}
