/**
 * Shared design tokens - single source for dashboard, SSR pages, and Migration Studio.
 */

export const SHARED_TOKENS_LIGHT = `
:root {
  --bg: #f8fafc;
  --bg-strong: #f1f5f9;
  --surface: #ffffff;
  --surface-solid: #ffffff;
  --surface-soft: #f8fafc;
  --surface-elevated: #ffffff;
  --border: rgba(15, 23, 42, 0.08);
  --border-subtle: rgba(15, 23, 42, 0.05);
  --text: #0f172a;
  --text-muted: #64748b;
  --accent: #4f46e5;
  --accent-strong: #4338ca;
  --accent-hover: #6366f1;
  --accent-muted: rgba(79, 70, 229, 0.12);
  --secondary: #0d9488;
  --secondary-muted: rgba(13, 148, 136, 0.12);
  --success: #059669;
  --warning: #d97706;
  --danger: #dc2626;
  --radius: 12px;
  --radius-md: 8px;
  --font-sans: "Sora", "Avenir Next", "Segoe UI", sans-serif;
  --font-mono: "IBM Plex Mono", "Consolas", monospace;
}`;

export const SHARED_TOKENS_DARK = `
:root {
  --bg: #09090b;
  --bg-strong: #0c0c0e;
  --surface: #18181b;
  --surface-solid: #18181b;
  --surface-soft: #1f1f23;
  --surface-elevated: #27272a;
  --surface-alt: #27272a;
  --border: rgba(255, 255, 255, 0.08);
  --border-subtle: rgba(255, 255, 255, 0.04);
  --text: #fafafa;
  --text-muted: #a1a1aa;
  --accent: #818cf8;
  --accent-strong: #6366f1;
  --accent-hover: #a5b4fc;
  --accent-muted: rgba(129, 140, 248, 0.15);
  --secondary: #2dd4bf;
  --secondary-muted: rgba(45, 212, 191, 0.12);
  --success: #34d399;
  --warning: #fbbf24;
  --danger: #f87171;
  --radius: 12px;
  --radius-md: 8px;
  --font-sans: "Sora", "Avenir Next", "Segoe UI", sans-serif;
  --font-mono: "IBM Plex Mono", "Consolas", monospace;
}`;

export const SHARED_TOKENS_CSS = SHARED_TOKENS_LIGHT + `
.dark {
  --bg: #09090b;
  --bg-strong: #0c0c0e;
  --surface: #18181b;
  --surface-solid: #18181b;
  --surface-soft: #1f1f23;
  --surface-elevated: #27272a;
  --border: rgba(255, 255, 255, 0.08);
  --border-subtle: rgba(255, 255, 255, 0.04);
  --text: #fafafa;
  --text-muted: #a1a1aa;
  --accent: #818cf8;
  --accent-strong: #6366f1;
  --accent-hover: #a5b4fc;
  --accent-muted: rgba(129, 140, 248, 0.15);
  --secondary: #2dd4bf;
  --secondary-muted: rgba(45, 212, 191, 0.12);
  --success: #34d399;
  --warning: #fbbf24;
  --danger: #f87171;
}`;
