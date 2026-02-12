/**
 * Additional CSS for the Dependency Graph section in Backend Atlas.
 */
export function depgraphStyles(): string {
  return `
    /* Dependency Graph summary stats */
    .depgraph-stats {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 16px;
    }
    .depgraph-stat {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 12px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-width: 100px;
    }
    .depgraph-stat-value {
      font-size: 1.5rem;
      font-weight: 700;
      color: #e2e8f0;
    }
    .depgraph-stat-label {
      font-size: 0.75rem;
      color: #94a3b8;
      margin-top: 2px;
      text-transform: capitalize;
    }
    .depgraph-link {
      display: inline-block;
      margin-top: 8px;
      color: #3b82f6;
      text-decoration: none;
      font-size: 0.85rem;
      font-weight: 500;
    }
    .depgraph-link:hover {
      text-decoration: underline;
    }

    /* Relationship badge */
    .badge.dg-rel {
      background: rgba(59, 130, 246, 0.2);
      color: #93c5fd;
    }
  `;
}
