import React, { useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  className?: string;
  side?: "top" | "right";
}

export function Tooltip({ content, children, className, side = "top" }: TooltipProps) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);

  const show = useCallback(() => {
    if (!wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    if (side === "right") {
      setPos({ x: rect.right + 8, y: rect.top + rect.height / 2 });
    } else {
      setPos({ x: rect.left + rect.width / 2, y: rect.top - 8 });
    }
  }, [side]);

  const hide = useCallback(() => setPos(null), []);

  const tooltipStyle: React.CSSProperties =
    pos === null
      ? {}
      : side === "right"
        ? { left: pos.x, top: pos.y, transform: "translateY(-50%)" }
        : { left: pos.x, top: pos.y, transform: "translateX(-50%) translateY(-100%) translateY(-6px)" };

  return (
    <span
      ref={wrapRef}
      className={`tooltip-wrap ${className ?? ""}`.trim()}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocusCapture={show}
      onBlurCapture={hide}
    >
      {children}
      {pos !== null &&
        createPortal(
          <span className="tooltip-content" role="tooltip" style={tooltipStyle}>
            {content}
          </span>,
          document.body
        )}
    </span>
  );
}
