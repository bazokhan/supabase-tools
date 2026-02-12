/**
 * Design tokens, reset, body, page layout, hero, meta, controls, and responsive styles.
 */
export function atlasStyles(): string {
  return `
    :root {
      --ink: #0f172a;
      --muted: #64748b;
      --line: #e2e8f0;
      --panel: #ffffff;
      --accent: #0ea5e9;
      --accent-2: #f97316;
      --accent-3: #22c55e;
      --shadow: 0 16px 40px rgba(15, 23, 42, 0.08);
      --radius: 18px;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      font-family: "Inter", sans-serif;
      color: var(--ink);
      background: radial-gradient(circle at top, #e0f2fe 0%, #f8fafc 45%, #f1f5f9 100%);
    }

    .page {
      max-width: 1200px;
      margin: 0 auto;
      padding: 32px 24px 80px;
    }

    .hero {
      background: linear-gradient(135deg, #ffffff 0%, #f8fafc 60%, #eef2ff 100%);
      border: 1px solid var(--line);
      border-radius: 24px;
      padding: 28px 32px;
      box-shadow: var(--shadow);
      position: relative;
      overflow: hidden;
    }

    .hero::after {
      content: "";
      position: absolute;
      top: -80px;
      right: -120px;
      width: 280px;
      height: 280px;
      background: radial-gradient(circle, rgba(14, 165, 233, 0.2) 0%, rgba(14, 165, 233, 0) 70%);
      pointer-events: none;
    }

    .hero-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 24px;
      flex-wrap: wrap;
    }

    .eyebrow {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.2em;
      color: var(--muted);
      font-weight: 600;
    }

    h1 {
      margin: 8px 0 8px;
      font-size: 2.4rem;
      letter-spacing: -0.02em;
    }

    .hero p {
      margin: 0;
      color: var(--muted);
      max-width: 560px;
    }

    .meta-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 12px;
      margin-top: 18px;
    }

    .meta-pill {
      background: #f1f5f9;
      border-radius: 999px;
      padding: 8px 14px;
      font-size: 0.8rem;
      color: var(--muted);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .meta-pill span {
      color: var(--ink);
      font-weight: 600;
    }

    .hero-actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }

    .button {
      border: 1px solid var(--line);
      background: var(--panel);
      color: var(--ink);
      padding: 10px 14px;
      border-radius: 999px;
      font-weight: 600;
      font-size: 0.85rem;
      cursor: pointer;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .button:hover {
      transform: translateY(-1px);
      box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
    }

    .stats {
      margin-top: 24px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 12px;
    }

    .stat-card {
      background: #ffffff;
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .stat-card span {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--muted);
    }

    .stat-card strong {
      font-size: 1.4rem;
    }

    .controls {
      margin-top: 28px;
      display: grid;
      grid-template-columns: minmax(220px, 1fr) minmax(180px, 240px);
      gap: 12px;
      align-items: center;
    }

    .controls input,
    .controls select {
      width: 100%;
      padding: 12px 14px;
      border-radius: 12px;
      border: 1px solid var(--line);
      background: #ffffff;
      font-size: 0.9rem;
    }

    .kind-filters {
      margin-top: 14px;
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .kind-chip {
      border-radius: 999px;
      border: 1px solid var(--line);
      padding: 8px 12px;
      font-size: 0.78rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      cursor: pointer;
      background: #ffffff;
      color: var(--muted);
      transition: all 0.2s ease;
    }

    .kind-chip.active {
      background: var(--ink);
      color: #ffffff;
      border-color: var(--ink);
    }

    .loading,
    .error {
      margin-top: 40px;
      padding: 18px;
      background: #ffffff;
      border-radius: 14px;
      border: 1px solid var(--line);
      color: var(--muted);
    }

    @media (max-width: 900px) {
      .hero {
        padding: 22px;
      }

      .hero-header {
        flex-direction: column;
        align-items: flex-start;
      }

      .controls {
        grid-template-columns: 1fr;
      }

      details.card summary {
        grid-template-columns: 1fr;
      }

      .badge-group {
        justify-content: flex-start;
      }
    }
  `;
}
