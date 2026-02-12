/**
 * Additional CSS for Query Performance and Service Health cards in Backend Atlas.
 */
export function logsStyles(): string {
  return `
    /* Query Performance badges */
    .badge.qp-calls {
      background: rgba(59, 130, 246, 0.2);
      color: #1e40af;
    }
    .badge.qp-slow {
      background: rgba(239, 68, 68, 0.2);
      color: #991b1b;
    }

    /* Service Health badges */
    .badge.sh-running {
      background: rgba(34, 197, 94, 0.2);
      color: #166534;
    }
    .badge.sh-stopped {
      background: rgba(239, 68, 68, 0.2);
      color: #991b1b;
    }
  `;
}
