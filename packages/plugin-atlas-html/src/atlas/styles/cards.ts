/**
 * Card component styles: details/summary cards, badges, card body, detail grid, code blocks.
 */
export function cardStyles(): string {
  return `
    details.card {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.05);
      overflow: hidden;
    }

    details.card summary {
      list-style: none;
      cursor: pointer;
      padding: 16px 18px;
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 12px;
      align-items: center;
    }

    details.card summary::-webkit-details-marker {
      display: none;
    }

    .card-title {
      font-weight: 600;
      font-size: 1rem;
    }

    .card-sub {
      color: var(--muted);
      font-size: 0.82rem;
      margin-top: 4px;
    }

    .badge-group {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      justify-content: flex-end;
    }

    .badge {
      border-radius: 999px;
      background: #e2e8f0;
      color: #0f172a;
      padding: 4px 10px;
      font-size: 0.65rem;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      font-weight: 600;
    }

    .badge.accent {
      background: rgba(14, 165, 233, 0.2);
      color: #0369a1;
    }

    .badge.warn {
      background: rgba(249, 115, 22, 0.2);
      color: #9a3412;
    }

    .badge.good {
      background: rgba(34, 197, 94, 0.2);
      color: #166534;
    }

    .card-body {
      padding: 0 18px 18px;
      border-top: 1px solid var(--line);
      background: #fafafa;
    }

    .detail-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 12px;
      margin: 16px 0;
    }

    .detail {
      background: #ffffff;
      border-radius: 14px;
      border: 1px solid var(--line);
      padding: 12px 14px;
    }

    .detail h4 {
      margin: 0 0 6px;
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--muted);
    }

    .detail code {
      font-family: "JetBrains Mono", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      font-size: 0.8rem;
      color: #0f172a;
      white-space: pre-wrap;
    }

    pre.code {
      background: #0f172a;
      color: #e2e8f0;
      padding: 14px;
      border-radius: 14px;
      font-size: 0.78rem;
      overflow-x: auto;
      margin: 12px 0 0;
    }
  `;
}
