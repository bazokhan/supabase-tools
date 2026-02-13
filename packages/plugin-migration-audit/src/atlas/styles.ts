/**
 * Additional CSS for Migration Audit section in Backend Atlas.
 */
export function migrationAuditStyles(): string {
  return `
    /* Migration Audit summary stats */
    .ma-stats {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 16px;
    }
    .ma-stat {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 12px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-width: 100px;
    }
    .ma-stat-value {
      font-size: 1.5rem;
      font-weight: 700;
      color: #e2e8f0;
    }
    .ma-stat-label {
      font-size: 0.75rem;
      color: #94a3b8;
      margin-top: 2px;
      text-transform: capitalize;
    }
    .ma-stat.ma-applied .ma-stat-value { color: #22c55e; }
    .ma-stat.ma-pending .ma-stat-value { color: #f59e0b; }
    .ma-stat.ma-missing .ma-stat-value { color: #ef4444; }
    .ma-link {
      display: inline-block;
      margin-top: 8px;
      color: #3b82f6;
      text-decoration: none;
      font-size: 0.85rem;
      font-weight: 500;
    }
    .ma-link:hover {
      text-decoration: underline;
    }

    /* Migration status badges */
    .badge.ma-badge { font-weight: 500; }
    .badge.ma-badge.ma-status-applied {
      background: rgba(34, 197, 94, 0.2);
      color: #4ade80;
    }
    .badge.ma-badge.ma-status-pending {
      background: rgba(245, 158, 11, 0.2);
      color: #fbbf24;
    }
    .badge.ma-badge.ma-status-missing {
      background: rgba(239, 68, 68, 0.2);
      color: #f87171;
    }
  `;
}
