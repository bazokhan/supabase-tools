import React from "react";

export type BadgeTone = "default" | "good" | "warn" | "bad" | "accent";

interface BadgeProps {
  children: React.ReactNode;
  tone?: BadgeTone;
}

const TONE_CLASS: Record<BadgeTone, string> = {
  default: "badge-tone-default",
  good: "badge-tone-good",
  warn: "badge-tone-warn",
  bad: "badge-tone-bad",
  accent: "badge-tone-accent",
};

export function Badge({ children, tone = "default" }: BadgeProps) {
  return <span className={`badge-ui ${TONE_CLASS[tone]}`}>{children}</span>;
}
