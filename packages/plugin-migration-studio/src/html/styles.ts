/**
 * CSS for Migration Studio. Uses shared dark tokens from ui-web.
 */
import { SHARED_TOKENS_DARK } from "@sbtools/ui-web";

export function getStyles(): string {
  return SHARED_TOKENS_DARK + `

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: var(--font-sans);
    background: var(--bg);
    color: var(--text);
    padding: 20px;
    line-height: 1.45;
  }

  h1 { font-size: 1.42rem; margin-bottom: 6px; }
  .sub { color: var(--text-muted); font-size: 0.88rem; margin-bottom: 16px; }

  .toolbar {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 14px;
    padding: 12px;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius);
    background: var(--surface);
  }

  button {
    padding: 8px 12px;
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
    transition: background 0.15s ease, border-color 0.15s ease;
  }

  button:hover {
    background: var(--surface-soft);
    border-color: var(--border);
  }

  button.primary {
    background: var(--accent);
    border-color: transparent;
    color: #fff;
  }

  button.primary:hover {
    background: #6366f1;
  }

  button.danger {
    background: color-mix(in srgb, var(--danger) 20%, var(--surface));
    border-color: color-mix(in srgb, var(--danger) 38%, transparent);
    color: #fca5a5;
  }

  .panel {
    background: var(--surface);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius);
    padding: 14px;
    margin-bottom: 12px;
  }

  .panel h3 { font-size: 0.86rem; color: var(--text-muted); margin-bottom: 10px; }
  .panel h3 .hint { font-weight: 400; color: color-mix(in srgb, var(--text-muted) 78%, transparent); font-size: 0.75rem; }

  .chip {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 0.72rem;
    margin: 2px 4px 2px 0;
    border: 1px solid var(--border-subtle);
    background: var(--accent-muted);
  }

  .chip.destructive,
  .chip.drop { background: color-mix(in srgb, var(--danger) 18%, var(--surface)); }
  .chip.safe,
  .chip.create { background: color-mix(in srgb, var(--success) 16%, var(--surface)); }
  .chip.alter { background: var(--accent-muted); }

  .msg {
    padding: 10px 12px;
    border-radius: 8px;
    margin-bottom: 10px;
    border: 1px solid var(--border);
  }

  .msg.success { border-color: color-mix(in srgb, var(--success) 44%, transparent); background: color-mix(in srgb, var(--success) 14%, var(--surface)); }
  .msg.error { border-color: color-mix(in srgb, var(--danger) 44%, transparent); background: color-mix(in srgb, var(--danger) 14%, var(--surface)); }
  .validation-error { color: var(--danger); margin-bottom: 8px; font-size: 0.84rem; }
  .validation-warn { color: var(--warning); margin-bottom: 8px; font-size: 0.84rem; }

  code { font-family: var(--font-mono); font-size: 0.82rem; }

  #editor-wrap {
    border: 1px solid var(--border-subtle);
    border-radius: 8px;
    overflow: hidden;
    min-height: 320px;
    background: var(--bg-strong);
  }

  .cm-editor { height: 100%; }
  .cm-scroller { font-family: var(--font-mono); font-size: 0.86rem; }
  .cm-content { min-height: 300px; padding: 12px; }
  .cm-gutters { background: #09090b; border-right: 1px solid var(--border-subtle); }

  .schema-status { font-size: 0.76rem; color: var(--text-muted); margin-left: auto; align-self: center; }

  .template-bar {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }

  .template-chip {
    padding: 6px 10px;
    border-radius: 999px;
    font-size: 0.74rem;
    cursor: pointer;
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text-muted);
  }

  .template-chip:hover { background: var(--surface-soft); color: var(--text); }

  .main-layout { display: flex; gap: 14px; margin-top: 12px; }
  .editor-column { flex: 1; min-width: 0; }
  .context-sidebar { width: 300px; flex-shrink: 0; }

  .context-tabs { display: flex; gap: 8px; margin-bottom: 10px; }

  .context-tab {
    padding: 6px 10px;
    border-radius: 999px;
    font-size: 0.78rem;
    cursor: pointer;
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-muted);
  }

  .context-tab.active {
    background: var(--accent-muted);
    border-color: color-mix(in srgb, var(--accent) 45%, transparent);
    color: var(--accent);
  }

  .context-list { max-height: 360px; overflow-y: auto; }

  .context-item {
    padding: 8px 10px;
    font-size: 0.78rem;
    cursor: pointer;
    border-radius: 8px;
    border: 1px solid transparent;
    margin-bottom: 4px;
  }

  .context-item:hover {
    background: var(--surface-soft);
    border-color: var(--border-subtle);
  }

  .context-item code { font-size: 0.74rem; }
  .badge-applied { color: var(--success); }
  .badge-pending { color: var(--warning); }
  .badge-missing { color: var(--danger); }

  .cm-tooltip-schema-hover .cm-schema-tooltip {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text);
  }

  @media (max-width: 1080px) {
    .main-layout { flex-direction: column; }
    .context-sidebar { width: 100%; }
  }
  `;
}
