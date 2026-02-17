import React from "react";

export type StatTone = "default" | "good" | "warn" | "bad" | "accent";

interface StatCardProps {
  label: string;
  value: string | number;
  tone?: StatTone;
}

const TONE_CLASS: Record<StatTone, string> = {
  default: "stat-tone-default",
  good: "stat-tone-good",
  warn: "stat-tone-warn",
  bad: "stat-tone-bad",
  accent: "stat-tone-accent",
};

export function StatCard({ label, value, tone = "default" }: StatCardProps) {
  return (
    <div className={`stat-card ${TONE_CLASS[tone]}`}>
      <div className="stat-card-value">{value}</div>
      <div className="stat-card-label">{label}</div>
    </div>
  );
}
