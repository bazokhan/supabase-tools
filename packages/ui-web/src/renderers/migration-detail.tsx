import React from "react";
import { renderPageFrame, Section } from "../components/document.js";

export interface MigrationDetailRisk {
  hasDestructive?: boolean;
  hasTruncate?: boolean;
  hasTransaction?: boolean;
  hasIfExists?: boolean;
  hasIfNotExists?: boolean;
}

export interface MigrationDetailOperation {
  kind: string;
  objectKey: string;
}

export interface MigrationDetailInput {
  filename: string;
  status: string;
  appliedAt: string | null;
  fileModifiedAt: string | null;
  sizeBytes: number;
  parserConfidence?: string;
  operations: MigrationDetailOperation[];
  touchedObjectKeys: string[];
  risk?: MigrationDetailRisk;
  sql: string;
  indexUrl: string;
}

function fmt(d: string | null): string {
  if (!d) return "-";
  return new Date(d).toISOString().replace("T", " ").slice(0, 19);
}

export function renderMigrationDetailPage(input: MigrationDetailInput): string {
  const riskList: string[] = [];
  if (input.risk?.hasDestructive) riskList.push("Destructive operations detected.");
  if (input.risk?.hasTruncate) riskList.push("TRUNCATE statements detected.");
  if (input.risk?.hasTransaction) riskList.push("Explicit transaction boundaries detected.");
  if (input.risk?.hasIfExists) riskList.push("Contains IF EXISTS guards.");
  if (input.risk?.hasIfNotExists) riskList.push("Contains IF NOT EXISTS guards.");

  return renderPageFrame({
    title: `Migration: ${input.filename}`,
    subtitle: `Status: ${input.status}${input.parserConfidence ? ` | Confidence: ${input.parserConfidence}` : ""}`,
    pageCss: `.meta{display:flex;gap:14px;flex-wrap:wrap;color:var(--text-muted);font-size:.9rem}.ops{display:flex;gap:6px;flex-wrap:wrap}.risk li{margin-left:18px}.sql{white-space:pre-wrap;word-break:break-word}`,
    body: (
      <>
        <a href={input.indexUrl} style={{ color: "var(--accent)", display: "inline-block", marginBottom: 12 }}>
          Back to Migration Audit
        </a>

        <div className="meta">
          <span>Applied: {fmt(input.appliedAt)}</span>
          <span>Modified: {fmt(input.fileModifiedAt)}</span>
          <span>Size: {input.sizeBytes} B</span>
        </div>

        <Section title="Operations">
          <div className="ops">
            {input.operations.length
              ? input.operations.map((op, i) => (
                  <span className="badge" key={`${op.kind}-${op.objectKey}-${i}`} title={op.objectKey}>
                    {op.kind.replace(/_/g, " ")}
                  </span>
                ))
              : <span className="subtitle">No parsed operations.</span>}
          </div>
        </Section>

        <Section title="Risk Indicators">
          {riskList.length ? (
            <ul className="risk">
              {riskList.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          ) : (
            <p className="subtitle">No risk indicators detected.</p>
          )}
        </Section>

        <Section title={`Touched Objects (${input.touchedObjectKeys.length})`}>
          <div className="ops">
            {input.touchedObjectKeys.length
              ? input.touchedObjectKeys.map((k) => (
                  <code className="badge" key={k}>{k}</code>
                ))
              : <span className="subtitle">No touched objects detected.</span>}
          </div>
        </Section>

        <Section title="SQL">
          <pre className="sql">{input.sql || "-- (Empty or unreadable)"}</pre>
        </Section>
      </>
    ),
  });
}
