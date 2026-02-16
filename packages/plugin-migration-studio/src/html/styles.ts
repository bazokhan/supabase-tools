/**
 * CSS for Migration Studio. Dark theme, CodeMirror overrides.
 */
export function getStyles(): string {
  return `
  :root {
    --bg: #0f172a;
    --surface: #1e293b;
    --border: #334155;
    --text: #e2e8f0;
    --text-muted: #94a3b8;
    --text-dim: #64748b;
    --accent: #3b82f6;
    --green: #22c55e;
    --amber: #f59e0b;
    --red: #ef4444;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', system-ui, sans-serif; background: var(--bg); color: var(--text); padding: 24px; line-height: 1.5; }
  h1 { font-size: 1.5rem; margin-bottom: 8px; }
  .sub { color: var(--text-muted); font-size: 0.9rem; margin-bottom: 24px; }
  .toolbar { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
  button { padding: 8px 16px; border-radius: 6px; font-weight: 500; cursor: pointer; border: 1px solid var(--border); background: var(--surface); color: var(--text); }
  button:hover { background: #334155; }
  button.primary { background: var(--accent); border-color: var(--accent); }
  button.danger { background: var(--red); border-color: var(--red); }
  .panel { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 16px; margin-bottom: 16px; }
  .panel h3 { font-size: 0.9rem; color: var(--text-muted); margin-bottom: 12px; }
  .panel h3 .hint { font-weight: 400; color: var(--text-dim); font-size: 0.8rem; }
  .chip { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; margin: 2px 4px 2px 0; background: var(--border); }
  .chip.destructive { background: rgba(239,68,68,0.3); }
  .chip.safe { background: rgba(34,197,94,0.3); }
  .chip.create { background: rgba(34,197,94,0.3); }
  .chip.drop { background: rgba(239,68,68,0.3); }
  .chip.alter { background: rgba(59,130,246,0.3); }
  .msg { padding: 12px; border-radius: 6px; margin-bottom: 12px; }
  .msg.success { background: rgba(34,197,94,0.2); border: 1px solid var(--green); }
  .msg.error { background: rgba(239,68,68,0.2); border: 1px solid var(--red); }
  .validation-error { color: var(--red); margin-bottom: 8px; font-size: 0.9rem; }
  .validation-warn { color: var(--amber); margin-bottom: 8px; font-size: 0.85rem; }
  code { font-family: ui-monospace, monospace; font-size: 0.85rem; }
  #editor-wrap { border: 1px solid var(--border); border-radius: 8px; overflow: hidden; min-height: 280px; }
  .cm-editor { height: 100%; }
  .cm-scroller { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 0.9rem; }
  .cm-content { min-height: 260px; padding: 12px; }
  .cm-gutters { background: var(--bg); border-right: 1px solid var(--border); }
  .schema-status { font-size: 0.8rem; color: var(--text-dim); margin-left: auto; align-self: center; }
  .template-bar { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
  .template-chip { padding: 6px 12px; border-radius: 6px; font-size: 0.8rem; cursor: pointer; background: var(--surface); border: 1px solid var(--border); color: var(--text-muted); }
  .template-chip:hover { background: #334155; color: var(--text); }
  .main-layout { display: flex; gap: 24px; margin-top: 16px; }
  .editor-column { flex: 1; min-width: 0; }
  .context-sidebar { width: 280px; flex-shrink: 0; }
  .context-tabs { display: flex; gap: 8px; margin-bottom: 12px; }
  .context-tab { padding: 6px 12px; border-radius: 6px; font-size: 0.85rem; cursor: pointer; background: transparent; border: 1px solid var(--border); color: var(--text-muted); }
  .context-tab.active { background: var(--accent); border-color: var(--accent); color: white; }
  .context-list { max-height: 320px; overflow-y: auto; }
  .context-item { padding: 6px 10px; font-size: 0.8rem; cursor: pointer; border-radius: 4px; }
  .context-item:hover { background: #334155; }
  .context-item code { font-size: 0.75rem; }
  .badge-applied { color: var(--green); }
  .badge-pending { color: var(--amber); }
  .badge-missing { color: var(--red); }
  .cm-tooltip-schema-hover .cm-schema-tooltip { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; }
  `;
}
