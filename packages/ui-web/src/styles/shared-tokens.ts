/**
 * Shared design tokens - single source for dashboard, SSR pages, and Migration Studio.
 * Elegant, refined palette inspired by Claude, Lovable, modern doc UIs.
 */

export const SHARED_TOKENS_LIGHT = `
:root {
  /* Page & layout */
  --bg: #f5f5f7;
  --bg-strong: #eef0f2;
  --bg-gradient: linear-gradient(180deg, #fafbfc 0%, #f5f5f7 100%);
  /* Surfaces - layered elevation */
  --surface: #f2f2f2;
  --surface-solid: #f2f2f2;
  --surface-soft: #f8f9fa;
  --surface-elevated: #f2f2f2;
  --surface-hover: #f0f2f5;
  --surface-active: #e8ebef;
  /* Borders */
  --border: rgba(0, 0, 0, 0.07);
  --border-subtle: rgba(0, 0, 0, 0.05);
  --border-focus: rgba(87, 96, 235, 0.4);
  /* Text */
  --text: #1a1a1e;
  --text-muted: #6b7280;
  --text-softer: #9ca3af;
  /* Accent */
  --accent: #525ee5;
  --accent-strong: #434cc7;
  --accent-hover: #636ef7;
  --accent-muted: rgba(82, 94, 229, 0.08);
  --accent-soft: rgba(82, 94, 229, 0.06);
  /* Semantic */
  --secondary: #0d9488;
  --secondary-muted: rgba(13, 148, 136, 0.08);
  --success: #0d9668;
  --success-muted: rgba(13, 150, 104, 0.1);
  --warning: #c17700;
  --warning-muted: rgba(193, 119, 0, 0.1);
  --danger: #c91c1c;
  --danger-muted: rgba(201, 28, 28, 0.1);
  /* Pills, badges, buttons */
  --pill-bg: rgba(0, 0, 0, 0.04);
  --pill-border: rgba(0, 0, 0, 0.06);
  --btn-ghost-bg: transparent;
  --btn-ghost-hover: rgba(0, 0, 0, 0.04);
  --btn-ghost-active: rgba(0, 0, 0, 0.07);
  --btn-secondary-bg: #f0f1f3;
  --btn-secondary-hover: #e4e6e9;
  /* Table */
  --table-header-bg: #f8f9fa;
  --table-row-hover: rgba(82, 94, 229, 0.04);
  --table-row-stripe: rgba(0, 0, 0, 0.02);
  /* Shadows */
  --shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.04);
  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04);
  --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04);
  --shadow-lg: 0 12px 40px rgba(0, 0, 0, 0.12), 0 4px 8px rgba(0, 0, 0, 0.06);
  /* Radius & spacing */
  --radius: 10px;
  --radius-lg: 12px;
  --radius-md: 8px;
  --radius-sm: 6px;
  --radius-pill: 9999px;
  --font-sans: "Geist", "Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  --font-mono: "Geist Mono", "ui-monospace", "Consolas", monospace;
  --text-size-base: 0.9375rem;
  --text-size-sm: 0.8125rem;
  --text-size-xs: 0.75rem;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
  --letter-tight: -0.01em;
  --letter-wide: 0.025em;
  --space-4: 4px;
  --space-8: 8px;
  --space-12: 12px;
  --space-16: 16px;
  --space-20: 20px;
  --space-24: 24px;
  --space-32: 32px;
}`;

export const SHARED_TOKENS_DARK = `
:root {
  --bg: #151517;
  --bg-strong: #141415;
  --bg-gradient: linear-gradient(180deg, #151517 0%, #151517 100%);
  --surface: #161618;
  --surface-solid: #161618;
  --surface-soft: #1c1c1f;
  --surface-elevated: #252528;
  --surface-hover: rgba(255, 255, 255, 0.04);
  --surface-active: rgba(255, 255, 255, 0.07);
  --border: rgba(255, 255, 255, 0.07);
  --border-subtle: rgba(255, 255, 255, 0.04);
  --border-focus: rgba(129, 140, 248, 0.5);
  --text: #f0f0f0;
  --text-muted: #a1a1aa;
  --text-softer: #71717a;
  --accent: #818cf8;
  --accent-strong: #6366f1;
  --accent-hover: #9ca3f8;
  --accent-muted: rgba(129, 140, 248, 0.12);
  --accent-soft: rgba(129, 140, 248, 0.08);
  --secondary: #2dd4bf;
  --secondary-muted: rgba(45, 212, 191, 0.12);
  --success: #34d399;
  --success-muted: rgba(52, 211, 153, 0.12);
  --warning: #fbbf24;
  --warning-muted: rgba(251, 191, 36, 0.12);
  --danger: #d49494;
  --danger-muted: rgba(212, 148, 148, 0.15);
  --pill-bg: rgba(255, 255, 255, 0.05);
  --pill-border: rgba(255, 255, 255, 0.08);
  --btn-ghost-bg: transparent;
  --btn-ghost-hover: rgba(255, 255, 255, 0.05);
  --btn-ghost-active: rgba(255, 255, 255, 0.09);
  --btn-secondary-bg: #252528;
  --btn-secondary-hover: #2d2d30;
  --table-header-bg: #1c1c1f;
  --table-row-hover: rgba(129, 140, 248, 0.06);
  --table-row-stripe: rgba(255, 255, 255, 0.02);
  --shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.2);
  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.25), 0 1px 2px rgba(0, 0, 0, 0.15);
  --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.3), 0 2px 4px rgba(0, 0, 0, 0.2);
  --shadow-lg: 0 12px 40px rgba(0, 0, 0, 0.4), 0 4px 8px rgba(0, 0, 0, 0.25);
  --radius: 10px;
  --radius-lg: 12px;
  --radius-md: 8px;
  --radius-sm: 6px;
  --radius-pill: 9999px;
  --font-sans: "Geist", "Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  --font-mono: "Geist Mono", "ui-monospace", "Consolas", monospace;
  --text-size-base: 0.9375rem;
  --text-size-sm: 0.8125rem;
  --text-size-xs: 0.75rem;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
  --letter-tight: -0.01em;
  --letter-wide: 0.025em;
  --space-4: 4px;
  --space-8: 8px;
  --space-12: 12px;
  --space-16: 16px;
  --space-20: 20px;
  --space-24: 24px;
  --space-32: 32px;
}`;

export const SHARED_TOKENS_CSS = SHARED_TOKENS_LIGHT + `
.dark {
  --bg: #151517;
  --bg-strong: #141415;
  --bg-gradient: linear-gradient(180deg, #141415 0%, #151517 100%);
  --surface: #161618;
  --surface-solid: #161618;
  --surface-soft: #1c1c1f;
  --surface-elevated: #252528;
  --surface-hover: rgba(255, 255, 255, 0.04);
  --surface-active: rgba(255, 255, 255, 0.07);
  --border: rgba(255, 255, 255, 0.07);
  --border-subtle: rgba(255, 255, 255, 0.04);
  --border-focus: rgba(129, 140, 248, 0.5);
  --text: #f0f0f0;
  --text-muted: #a1a1aa;
  --text-softer: #71717a;
  --accent: #818cf8;
  --accent-strong: #6366f1;
  --accent-hover: #9ca3f8;
  --accent-muted: rgba(129, 140, 248, 0.12);
  --accent-soft: rgba(129, 140, 248, 0.08);
  --secondary: #2dd4bf;
  --secondary-muted: rgba(45, 212, 191, 0.12);
  --success: #34d399;
  --success-muted: rgba(52, 211, 153, 0.12);
  --warning: #fbbf24;
  --warning-muted: rgba(251, 191, 36, 0.12);
  --danger: #d49494;
  --danger-muted: rgba(212, 148, 148, 0.15);
  --pill-bg: rgba(255, 255, 255, 0.05);
  --pill-border: rgba(255, 255, 255, 0.08);
  --btn-ghost-bg: transparent;
  --btn-ghost-hover: rgba(255, 255, 255, 0.05);
  --btn-ghost-active: rgba(255, 255, 255, 0.09);
  --btn-secondary-bg: #252528;
  --btn-secondary-hover: #2d2d30;
  --table-header-bg: #1c1c1f;
  --table-row-hover: rgba(129, 140, 248, 0.06);
  --table-row-stripe: rgba(255, 255, 255, 0.02);
  --shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.2);
  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.25), 0 1px 2px rgba(0, 0, 0, 0.15);
  --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.3), 0 2px 4px rgba(0, 0, 0, 0.2);
  --shadow-lg: 0 12px 40px rgba(0, 0, 0, 0.4), 0 4px 8px rgba(0, 0, 0, 0.25);
  --radius-lg: 12px;
  --radius-sm: 6px;
  --radius-pill: 9999px;
  --text-size-base: 0.9375rem;
  --text-size-sm: 0.8125rem;
  --text-size-xs: 0.75rem;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
  --letter-tight: -0.01em;
  --letter-wide: 0.025em;
  --space-4: 4px;
  --space-8: 8px;
  --space-12: 12px;
  --space-16: 16px;
  --space-20: 20px;
  --space-24: 24px;
  --space-32: 32px;
}`;
