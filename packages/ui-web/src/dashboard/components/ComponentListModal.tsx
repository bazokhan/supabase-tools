import React from "react";
import { Modal } from "./Modal";
import { IconCopy } from "./Icons";

interface ComponentListModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  components: string[];
}

export function ComponentListModal({ open, onClose, title, components }: ComponentListModalProps) {
  const [copiedIdx, setCopiedIdx] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!open) setCopiedIdx(null);
  }, [open]);

  const copyPath = async (path: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(path);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="modal-component-list">
        {components.map((path, i) => (
          <div key={i} className="modal-component-item">
            <span className="modal-component-path" title={path}>
              {path}
            </span>
            <button
              type="button"
              className={`modal-component-copy ${copiedIdx === i ? "copied" : ""}`}
              onClick={() => copyPath(path, i)}
            >
              <IconCopy size={12} />
              {copiedIdx === i ? "Copied" : "Copy"}
            </button>
          </div>
        ))}
      </div>
    </Modal>
  );
}
