/**
 * CSS for Migration Studio. Aligned with ui-web dashboard look and components.
 */
import { SHARED_TOKENS_DARK } from "@sbtools/ui-web";

export function getStyles(): string {
  return SHARED_TOKENS_DARK + `

  * { box-sizing: border-box; }

  body {
    margin: 0;
    font-family: var(--font-sans);
    color: var(--text);
    background: var(--bg);
    padding: clamp(14px, 2vw, 22px);
  }

  code, pre {
    font-family: var(--font-mono);
  }

  .content-stack {
    display: grid;
    gap: 12px;
  }

  .migration-studio-root {
    max-width: 1400px;
    margin: 0 auto;
  }

  .panel {
    border: 1px solid var(--border-subtle);
    background: var(--surface);
    border-radius: var(--radius-md);
    padding: 12px;
  }

  .panel-accent {
    border-color: color-mix(in srgb, var(--accent) 30%, var(--border-subtle));
    background: color-mix(in srgb, var(--surface) 92%, var(--accent-muted) 8%);
  }

  .panel-head {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 10px;
  }

  .panel-head h2 {
    margin: 0;
    font-size: 1rem;
    line-height: 1.3;
  }

  .panel-head p {
    margin: 2px 0 0;
    color: var(--text-muted);
    font-size: 0.86rem;
  }

  .cluster-row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
  }

  .btn {
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
    border-radius: var(--radius-sm);
    padding: 7px 11px;
    font-family: inherit;
    font-size: 0.84rem;
    cursor: pointer;
    transition: background-color 0.15s ease, border-color 0.15s ease;
  }

  .btn:hover {
    background: var(--surface-soft);
    border-color: var(--border);
  }

  .btn-primary {
    background: var(--accent);
    color: #fff;
    border-color: transparent;
  }

  .btn-primary:hover {
    background: var(--accent-hover);
  }

  .btn-danger {
    background: color-mix(in srgb, var(--danger) 14%, var(--surface));
    border-color: color-mix(in srgb, var(--danger) 35%, transparent);
    color: var(--danger);
  }

  .tab-row {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
  }

  .tab-btn {
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text-muted);
    border-radius: var(--radius-sm);
    padding: 6px 10px;
    font-family: inherit;
    font-size: 0.8rem;
    cursor: pointer;
  }

  .tab-btn.active {
    border-color: var(--accent);
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 8%, var(--surface));
  }

  .migration-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 8px;
  }

  .migration-stat {
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    background: var(--surface-soft);
    padding: 9px 10px;
  }

  .migration-stat .stat-label {
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-size: 0.68rem;
  }

  .migration-stat .stat-value {
    font-size: 1.1rem;
    line-height: 1.2;
    font-weight: 700;
    margin-top: 3px;
  }

  .migration-stat.stat-applied .stat-value { color: var(--success); }
  .migration-stat.stat-pending .stat-value { color: var(--warning); }
  .migration-stat.stat-missing .stat-value { color: var(--danger); }

  .schema-status {
    color: var(--text-muted);
    font-size: 0.76rem;
    white-space: nowrap;
    align-self: center;
  }

  .template-bar {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .template-chip {
    border: 1px solid var(--border-subtle);
    border-radius: 999px;
    background: var(--surface);
    color: var(--text-muted);
    padding: 5px 10px;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.75rem;
  }

  .template-chip:hover {
    background: var(--surface-soft);
    color: var(--text);
  }

  .main-layout {
    display: grid;
    grid-template-columns: minmax(0, 2fr) 320px;
    gap: 12px;
  }

  .editor-column,
  .context-sidebar {
    min-width: 0;
  }

  .panel h3 {
    margin: 0 0 8px;
    font-size: 0.82rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .panel h3 .hint {
    text-transform: none;
    letter-spacing: 0;
    font-weight: 400;
    color: var(--text-muted);
    font-size: 0.74rem;
  }

  #editor-wrap {
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    overflow: hidden;
    min-height: 340px;
    background: var(--bg-strong);
  }

  .cm-editor {
    height: 100%;
    font-family: var(--font-mono) !important;
  }

  .cm-scroller,
  .cm-editor .cm-content {
    font-family: var(--font-mono) !important;
    font-size: 0.84rem;
  }

  .cm-content {
    min-height: 320px;
    padding: 10px;
  }

  .cm-gutters {
    background: var(--bg);
    border-right: 1px solid var(--border-subtle);
  }

  #analysis-content {
    font-size: 0.86rem;
    line-height: 1.45;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    border-radius: 999px;
    border: 1px solid var(--border-subtle);
    padding: 2px 8px;
    margin: 0 4px 4px 0;
    font-size: 0.72rem;
    background: var(--accent-muted);
  }

  .chip.destructive,
  .chip.drop { background: color-mix(in srgb, var(--danger) 14%, var(--surface)); }
  .chip.safe,
  .chip.create { background: color-mix(in srgb, var(--success) 14%, var(--surface)); }

  .msg {
    display: none;
    padding: 10px 12px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-subtle);
    font-size: 0.84rem;
  }

  .msg.success {
    border-color: color-mix(in srgb, var(--success) 44%, transparent);
    background: color-mix(in srgb, var(--success) 10%, var(--surface));
  }

  .msg.error {
    border-color: color-mix(in srgb, var(--danger) 44%, transparent);
    background: color-mix(in srgb, var(--danger) 10%, var(--surface));
  }

  .validation-error { color: var(--danger); margin-bottom: 8px; font-size: 0.84rem; }
  .validation-warn { color: var(--warning); margin-bottom: 8px; font-size: 0.84rem; }

  .context-list {
    max-height: 440px;
    overflow-y: auto;
  }

  .context-item {
    padding: 8px 10px;
    font-size: 0.78rem;
    cursor: pointer;
    border-radius: var(--radius-sm);
    border: 1px solid transparent;
    margin-bottom: 5px;
    background: transparent;
  }

  .context-item:hover {
    background: var(--surface-soft);
    border-color: var(--border-subtle);
  }

  .context-item code { font-size: 0.74rem; }

  .badge-applied,
  .badge-pending,
  .badge-missing {
    border-radius: 999px;
    padding: 2px 8px;
    font-size: 0.72rem;
    border: 1px solid transparent;
  }

  .badge-applied {
    color: var(--success);
    background: color-mix(in srgb, var(--success) 12%, transparent);
    border-color: color-mix(in srgb, var(--success) 35%, transparent);
  }

  .badge-pending {
    color: var(--warning);
    background: color-mix(in srgb, var(--warning) 12%, transparent);
    border-color: color-mix(in srgb, var(--warning) 35%, transparent);
  }

  .badge-missing {
    color: var(--danger);
    background: color-mix(in srgb, var(--danger) 12%, transparent);
    border-color: color-mix(in srgb, var(--danger) 35%, transparent);
  }

  .cm-tooltip-schema-hover .cm-schema-tooltip {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text);
  }

  @media (max-width: 1140px) {
    .main-layout {
      grid-template-columns: 1fr;
    }
  }
  `;
}
