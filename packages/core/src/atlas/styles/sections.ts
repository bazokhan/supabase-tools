/**
 * Section and cards-grid styles, plus the empty-state style.
 */
export function sectionStyles(): string {
  return `
    .section {
      margin-top: 36px;
    }

    .section h2 {
      margin: 0 0 14px;
      font-size: 1.4rem;
    }

    .section p.section-sub {
      margin: 0 0 18px;
      color: var(--muted);
    }

    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 16px;
    }

    .empty {
      padding: 18px;
      background: #ffffff;
      border-radius: 14px;
      border: 1px dashed var(--line);
      color: var(--muted);
    }
  `;
}
