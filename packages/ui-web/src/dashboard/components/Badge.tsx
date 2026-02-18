import React from "react";

export type BadgeTone = "default" | "good" | "warn" | "bad" | "accent";

interface BadgeProps {
  children: React.ReactNode;
  tone?: BadgeTone;
  icon?: React.ReactNode;
}

const TONE_CLASS: Record<BadgeTone, string> = {
  default: "badge-tone-default",
  good: "badge-tone-good",
  warn: "badge-tone-warn",
  bad: "badge-tone-bad",
  accent: "badge-tone-accent",
};

export function inferBadgeTone(value: string, field: string): BadgeTone {
  const v = value.toLowerCase();
  if (v === "applied" || v === "running" || v === "active" || v === "true") return "good";
  if (v === "pending" || v === "warn" || v === "warning") return "warn";
  if (v === "missing" || v === "error" || v === "failed" || v === "false") return "bad";
  if (field === "type" || field === "volatility" || field === "command") return "accent";
  return "default";
}

export function Badge({ children, tone = "default", icon }: BadgeProps) {
  return (
    <span className={`badge-ui ${TONE_CLASS[tone]}`}>
      {icon ? <span className="badge-icon">{icon}</span> : null}
      {children}
    </span>
  );
}
