/**
 * Additional CSS for Frontend Usage section in Backend Atlas.
 */
export function frontendUsageStyles(): string {
  return `
    .frontend-usage-stats {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 16px;
    }
    .fw-stat {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 10px 16px;
      font-size: 0.8rem;
    }
    .fw-stat-value { font-weight: 700; color: #3b82f6; }
    .fw-stat-label { color: #94a3b8; margin-left: 4px; }
    .badge.fw-res {
      background: rgba(59, 130, 246, 0.2);
      color: #93c5fd;
    }
  `;
}
