import React from "react";
import { EmptyState } from "./EmptyState";

interface EmptyPanelProps {
  title: string;
  message: string;
  hint?: string;
}

export function EmptyPanel({ title, message, hint }: EmptyPanelProps) {
  return (
    <section className="panel">
      <EmptyState
        title={title}
        message={hint ? `${message} ${hint}`.trim() : message}
        iconType="alert"
      />
    </section>
  );
}
