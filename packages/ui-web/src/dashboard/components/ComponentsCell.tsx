import React from "react";
import { ComponentListModal } from "./ComponentListModal";

interface ComponentsCellProps {
  components: string[];
  resourceLabel?: string;
}

const MAX_SHOW = 5;

export function ComponentsCell({ components, resourceLabel }: ComponentsCellProps) {
  const [modalOpen, setModalOpen] = React.useState(false);
  const names = components.filter((v): v is string => typeof v === "string" && v.length > 0);
  const extra = names.length - MAX_SHOW;
  const shown = names.slice(0, MAX_SHOW);

  if (names.length === 0) {
    return <span className="value-empty">—</span>;
  }

  const title = resourceLabel
    ? `Components using ${resourceLabel}`
    : `Components (${names.length})`;

  return (
    <>
      <span className="value-component-list">
        {shown.join(", ")}
        {extra > 0 ? (
          <button
            type="button"
            className="value-more-btn"
            onClick={(e) => {
              e.stopPropagation();
              setModalOpen(true);
            }}
          >
            +{extra} more
          </button>
        ) : (
          <button
            type="button"
            className="value-copy-link"
            onClick={(e) => {
              e.stopPropagation();
              setModalOpen(true);
            }}
          >
            Copy paths
          </button>
        )}
      </span>
      <ComponentListModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={title}
        components={names}
      />
    </>
  );
}
