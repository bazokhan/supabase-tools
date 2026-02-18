import React from "react";
import { IconAlert, IconInfo, IconSearch } from "./Icons";
import { Tooltip } from "./Tooltip";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  message?: string;
  action?: { label: string; onClick: () => void };
  iconType?: "search" | "alert";
  infoTooltip?: string;
}

const DEFAULT_ICONS = {
  search: IconSearch,
  alert: IconAlert,
};

export function EmptyState({
  icon,
  title,
  message,
  action,
  iconType = "search",
  infoTooltip,
}: EmptyStateProps) {
  const DefaultIcon = DEFAULT_ICONS[iconType];
  return (
    <div className="empty-state-panel">
      <div className="empty-state-icon">
        {icon ?? <DefaultIcon size={32} />}
      </div>
      <h3 className="empty-state-title">
        {title}
        {infoTooltip ? (
          <Tooltip content={infoTooltip}>
            <span className="empty-state-info-icon" aria-label={infoTooltip}>
              <IconInfo size={14} />
            </span>
          </Tooltip>
        ) : null}
      </h3>
      {message ? <p className="empty-state-message">{message}</p> : null}
      {action ? (
        <button type="button" className="btn" onClick={action.onClick}>
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
