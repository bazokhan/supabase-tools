/**
 * Additional CSS for Edge Function cards in Backend Atlas.
 * Adds method badge colors and edge-function-specific styling.
 */
export function edgeFunctionStyles(): string {
  return `
    .badge.method-post {
      background: rgba(34, 197, 94, 0.2);
      color: #166534;
    }

    .badge.method-get {
      background: rgba(59, 130, 246, 0.2);
      color: #1e40af;
    }

    .badge.method-put, .badge.method-patch {
      background: rgba(249, 115, 22, 0.2);
      color: #9a3412;
    }

    .badge.method-delete {
      background: rgba(239, 68, 68, 0.2);
      color: #991b1b;
    }

    .badge.auth-jwt {
      background: rgba(139, 92, 246, 0.2);
      color: #5b21b6;
    }

    .badge.auth-service-role {
      background: rgba(249, 115, 22, 0.2);
      color: #9a3412;
    }

    .badge.auth-public {
      background: rgba(34, 197, 94, 0.2);
      color: #166534;
    }

    .ef-field-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.8rem;
      margin-top: 6px;
    }

    .ef-field-table th {
      text-align: left;
      font-weight: 600;
      color: var(--muted);
      padding: 4px 8px;
      border-bottom: 1px solid var(--line);
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .ef-field-table td {
      padding: 4px 8px;
      border-bottom: 1px solid var(--line);
      font-family: "JetBrains Mono", "SFMono-Regular", Consolas, monospace;
      font-size: 0.78rem;
    }

    .ef-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 6px;
    }

    .ef-tag {
      background: #f1f5f9;
      border-radius: 6px;
      padding: 2px 8px;
      font-size: 0.72rem;
      color: var(--muted);
      font-family: "JetBrains Mono", "SFMono-Regular", Consolas, monospace;
    }
  `;
}
