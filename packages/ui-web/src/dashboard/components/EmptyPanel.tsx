import React from "react";

interface EmptyPanelProps {
  title: string;
  message: string;
  hint?: string;
}

export function EmptyPanel({ title, message, hint }: EmptyPanelProps) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      <p className="empty-state">{message}</p>
      {hint ? <p className="empty-state">{hint}</p> : null}
    </section>
  );
}
