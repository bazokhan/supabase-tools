/**
 * CSS for Migration Studio. Dark elegant theme aligned with dashboard.
 */
export function getStyles(): string {
  return `
  :root {
    --bg: #050607;
    --bg-soft: #0b0d10;
    --surface: #121519;
    --surface-alt: #191e25;
    --border: rgba(169, 183, 214, 0.2);
    --text: #edf2fa;
    --text-muted: #99a7bf;
    --accent: #7fa9ff;
    --accent-strong: #5a8dff;
    --good: #56d5a8;
    --warn: #f2bf69;
    --bad: #ff8b99;
    --shadow: 0 24px 48px rgba(0, 0, 0, 0.48);
    --radius: 12px;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: "Sora", "Avenir Next", "Segoe UI", sans-serif;
    background:
      radial-gradient(circle at 10% 5%, rgba(89, 129, 217, 0.2), transparent 30%),
      radial-gradient(circle at 90% 10%, rgba(97, 193, 170, 0.12), transparent 24%),
      linear-gradient(165deg, var(--bg) 0%, var(--bg-soft) 100%);
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
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: rgba(18, 21, 25, 0.8);
    box-shadow: var(--shadow);
  }

  button {
    padding: 8px 12px;
    border-radius: 10px;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
    transition: background .15s ease, border-color .15s ease;
  }

  button:hover {
    background: var(--surface-alt);
    border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
  }

  button.primary {
    background: linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%);
    border-color: transparent;
    color: #f9fbff;
  }

  button.danger {
    background: color-mix(in srgb, var(--bad) 20%, var(--surface));
    border-color: color-mix(in srgb, var(--bad) 38%, var(--border));
    color: #ffd7de;
  }

  .panel {
    background: rgba(18, 21, 25, 0.82);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 14px;
    margin-bottom: 12px;
    box-shadow: var(--shadow);
  }

  .panel h3 { font-size: 0.86rem; color: var(--text-muted); margin-bottom: 10px; }
  .panel h3 .hint { font-weight: 400; color: color-mix(in srgb, var(--text-muted) 78%, transparent); font-size: 0.75rem; }

  .chip {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 0.72rem;
    margin: 2px 4px 2px 0;
    border: 1px solid var(--border);
    background: color-mix(in srgb, var(--accent) 12%, var(--surface));
  }

  .chip.destructive,
  .chip.drop { background: color-mix(in srgb, var(--bad) 18%, var(--surface)); }
  .chip.safe,
  .chip.create { background: color-mix(in srgb, var(--good) 16%, var(--surface)); }
  .chip.alter { background: color-mix(in srgb, var(--accent) 16%, var(--surface)); }

  .msg {
    padding: 10px 12px;
    border-radius: 10px;
    margin-bottom: 10px;
    border: 1px solid var(--border);
  }

  .msg.success { border-color: color-mix(in srgb, var(--good) 44%, var(--border)); background: color-mix(in srgb, var(--good) 14%, var(--surface)); }
  .msg.error { border-color: color-mix(in srgb, var(--bad) 44%, var(--border)); background: color-mix(in srgb, var(--bad) 14%, var(--surface)); }
  .validation-error { color: var(--bad); margin-bottom: 8px; font-size: 0.84rem; }
  .validation-warn { color: var(--warn); margin-bottom: 8px; font-size: 0.84rem; }

  code { font-family: "IBM Plex Mono", ui-monospace, monospace; font-size: 0.82rem; }

  #editor-wrap {
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
    min-height: 320px;
    background: #0f1319;
  }

  .cm-editor { height: 100%; }
  .cm-scroller { font-family: "IBM Plex Mono", ui-monospace, monospace; font-size: 0.86rem; }
  .cm-content { min-height: 300px; padding: 12px; }
  .cm-gutters { background: #090d13; border-right: 1px solid var(--border); }

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

  .template-chip:hover { background: var(--surface-alt); color: var(--text); }

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
    background: color-mix(in srgb, var(--accent) 18%, var(--surface));
    border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
    color: #eaf1ff;
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
    background: var(--surface-alt);
    border-color: var(--border);
  }

  .context-item code { font-size: 0.74rem; }
  .badge-applied { color: var(--good); }
  .badge-pending { color: var(--warn); }
  .badge-missing { color: var(--bad); }

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
