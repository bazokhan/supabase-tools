import React from "react";

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  className?: string;
}

export function Tooltip({ content, children, className }: TooltipProps) {
  return (
    <span className={`tooltip-wrap ${className ?? ""}`.trim()}>
      {children}
      <span className="tooltip-content" role="tooltip">
        {content}
      </span>
    </span>
  );
}
