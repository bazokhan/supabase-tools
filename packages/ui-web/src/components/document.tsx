import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SHARED_TOKENS_CSS } from "../styles/shared-tokens.js";

const baseCss = SHARED_TOKENS_CSS + `
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: var(--font-sans);
  color: var(--text);
  background: var(--bg);
}
.page {
  max-width: 1400px;
  margin: 0 auto;
  padding: clamp(16px, 2.5vw, 32px);
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
  color: var(--text-muted);
}
.surface {
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
}
.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
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
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.section { margin-bottom: 20px; }
.section h2 {
  font-size: 0.9rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin: 0 0 10px;
}
.input {
  width: 100%;
  max-width: 360px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
}
.table-scroll-wrap {
  position: relative;
}
.table-scroll-wrap::after {
  content: "";
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 24px;
  background: linear-gradient(to right, transparent, var(--bg));
  pointer-events: none;
}
.table-wrap { overflow: auto; }
table {
  width: 100%;
  border-collapse: collapse;
}
th, td {
  padding: 11px 12px;
  border-bottom: 1px solid var(--border-subtle);
  text-align: left;
  vertical-align: top;
}
th {
  font-size: 0.75rem;
  text-transform: uppercase;
  color: var(--text-muted);
  background: var(--surface-soft);
}
.badge {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  border: 1px solid var(--border-subtle);
  padding: 2px 8px;
  font-size: 0.72rem;
  margin: 0 4px 4px 0;
  white-space: nowrap;
}
.chip-bar, .chipbar {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.chip-bar button, .chipbar button {
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  padding: 6px 10px;
  cursor: pointer;
  font-family: inherit;
}
.chip-bar button.active, .chipbar button.active {
  border-color: var(--accent);
  color: var(--accent);
}
.toolbar, .cluster-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}
.tabs, .tab-row {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}
.tab, .tab-btn {
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 8px;
  padding: 6px 10px;
  cursor: pointer;
  font-family: inherit;
}
.tab.active, .tab-btn.active {
  border-color: var(--accent);
  color: var(--accent);
}
.pane { min-height: 420px; }
.log-wrap, .log-live-surface {
  height: 420px;
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 8px;
  background: var(--surface-soft);
}
.log-line {
  font-family: var(--font-mono);
  font-size: 12px;
  padding: 2px 0;
}
.svc.active { background: var(--accent-muted); }
code, pre {
  font-family: var(--font-mono);
}
pre {
  background: var(--surface-soft);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
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
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap"
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
  const color = props.tone === "good" ? "var(--success)" : props.tone === "warn" ? "var(--warning)" : props.tone === "bad" ? "var(--danger)" : "var(--accent)";
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
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <style>{baseCss + (opts.styles ?? "")}</style>
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
