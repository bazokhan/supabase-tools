import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const baseCss = `
:root {
  --color-bg: #f7f8fa;
  --color-surface: #ffffff;
  --color-surface-muted: #f3f4f6;
  --color-border: #e5e7eb;
  --color-text: #111827;
  --color-text-muted: #6b7280;
  --color-accent: #2563eb;
  --color-good: #16a34a;
  --color-warn: #d97706;
  --color-bad: #dc2626;
  --radius: 12px;
  --font-sans: "Inter", system-ui, -apple-system, sans-serif;
  --font-mono: "JetBrains Mono", Consolas, monospace;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: var(--font-sans);
  color: var(--color-text);
  background: radial-gradient(circle at top left, #ffffff, #f5f7fb 40%, #eef2f7 100%);
}
.page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
}
.header {
  margin-bottom: 20px;
}
.title {
  font-size: 1.8rem;
  line-height: 1.2;
  margin: 0 0 6px;
}
.subtitle {
  margin: 0;
  color: var(--color-text-muted);
}
.surface {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}
.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}
.stat {
  padding: 14px;
}
.stat-value {
  font-size: 1.35rem;
  font-weight: 700;
}
.stat-label {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.section { margin-bottom: 20px; }
.section h2 {
  font-size: 0.9rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-text-muted);
  margin: 0 0 10px;
}
.input {
  width: 100%;
  max-width: 360px;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface);
}
.table-wrap { overflow: auto; }
table {
  width: 100%;
  border-collapse: collapse;
}
th, td {
  padding: 11px 12px;
  border-bottom: 1px solid var(--color-border);
  text-align: left;
  vertical-align: top;
}
th {
  font-size: 0.75rem;
  text-transform: uppercase;
  color: var(--color-text-muted);
  background: var(--color-surface-muted);
}
.badge {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  padding: 2px 8px;
  font-size: 0.72rem;
  margin: 0 4px 4px 0;
  white-space: nowrap;
}
code, pre {
  font-family: var(--font-mono);
}
pre {
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 10px;
  overflow: auto;
}
.hidden { display: none !important; }
`;

export interface PageFrameProps {
  title: string;
  subtitle?: string;
  body: React.ReactNode;
  pageCss?: string;
  script?: string;
}

export function renderPageFrame({ title, subtitle, body, pageCss, script }: PageFrameProps): string {
  const html = renderToStaticMarkup(
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <style>{baseCss + (pageCss ?? "")}</style>
      </head>
      <body>
        <main className="page">
          <header className="header">
            <h1 className="title">{title}</h1>
            {subtitle ? <p className="subtitle">{subtitle}</p> : null}
          </header>
          {body}
        </main>
        {script ? <script dangerouslySetInnerHTML={{ __html: script }} /> : null}
      </body>
    </html>
  );

  return "<!DOCTYPE html>\n" + html;
}

export function Section(props: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`section ${props.className ?? ""}`.trim()}>
      <h2>{props.title}</h2>
      {props.children}
    </section>
  );
}

export function StatCard(props: { label: string; value: string | number; tone?: "default" | "good" | "warn" | "bad" }) {
  const color = props.tone === "good" ? "var(--color-good)" : props.tone === "warn" ? "var(--color-warn)" : props.tone === "bad" ? "var(--color-bad)" : "var(--color-accent)";
  return (
    <div className="surface stat">
      <div className="stat-value" style={{ color }}>{props.value}</div>
      <div className="stat-label">{props.label}</div>
    </div>
  );
}

export function scriptJsonVar(name: string, data: unknown): string {
  const json = JSON.stringify(data).replace(/<\//g, "<\\/");
  return `window.${name} = ${json};`;
}

export function renderRawDocument(opts: {
  title: string;
  styles?: string;
  bodyHtml: string;
  headHtml?: string;
  scriptJs?: string;
  scriptType?: "text/javascript" | "module";
}): string {
  const html = renderToStaticMarkup(
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{opts.title}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <style>{(opts.styles ?? "") + baseCss}</style>
        {opts.headHtml ? <meta name="x-extra-head" content="" /> : null}
      </head>
      <body>
        <div dangerouslySetInnerHTML={{ __html: opts.bodyHtml }} />
        {opts.scriptJs ? (
          <script
            type={opts.scriptType === "module" ? "module" : "text/javascript"}
            dangerouslySetInnerHTML={{ __html: opts.scriptJs }}
          />
        ) : null}
      </body>
    </html>
  );

  const withHead = opts.headHtml
    ? html.replace('<meta name="x-extra-head" content="">', opts.headHtml)
    : html.replace('<meta name="x-extra-head" content="">', "");
  return "<!DOCTYPE html>\n" + withHead;
}
