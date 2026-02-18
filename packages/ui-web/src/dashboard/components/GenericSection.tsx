import React from "react";
import type { DashboardSectionDef, DashboardTone } from "@sbtools/sdk";
import { resolve } from "../lib/field-resolver";

function getItems(data: Record<string, unknown[]>, section: DashboardSectionDef): unknown[] {
  const raw = data[section.dataKey];
  if (!raw) return [];
  let arr: unknown[];
  if (section.itemsPath) {
    const v = resolve<unknown>(raw, section.itemsPath);
    arr = Array.isArray(v) ? v : [];
  } else {
    arr = Array.isArray(raw) ? raw : [];
  }
  const start = section.itemsStartIndex ?? 0;
  return start > 0 ? arr.slice(start) : arr;
}
import { Badge } from "./Badge";
import { StatCard } from "./StatCard";
import { Tooltip } from "./Tooltip";
import { DataTable } from "./DataTable";
import { CardGrid, ExpandableCard } from "./CardGrid";
import { ValueRenderer } from "./ValueRenderer";

interface GenericSectionProps {
  section: DashboardSectionDef;
  data: Record<string, unknown[]>;
}

function getBadgeTooltip(field: string, value: string): string {
  const f = field.toLowerCase();
  if (f === "volatility") return value === "volatile" ? "Volatile: result may change between calls" : value;
  if (f === "status") return `Status: ${value}`;
  if (f === "type" || f === "type_kind") return `Type: ${value}`;
  if (f === "command") return `SQL command: ${value}`;
  if (f === "timing") return `Timing: ${value}`;
  return value ? `${field}: ${value}` : field;
}

function formatFieldValue(value: unknown, format?: string): string {
  if (value == null) return "—";
  if (Array.isArray(value)) {
    return value
      .map((v) => (v && typeof v === "object" && "type" in v && "resource" in v
        ? `${(v as { type: string; resource: string }).type}: ${(v as { type: string; resource: string }).resource}`
        : String(v)))
      .join(", ");
  }
  switch (format) {
    case "date":
      return new Date(String(value)).toISOString().replace("T", " ").slice(0, 19);
    case "bytes": {
      const n = Number(value);
      if (n < 1024) return `${n} B`;
      if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
      return `${(n / (1024 * 1024)).toFixed(1)} MB`;
    }
    case "ms":
      return `${Number(value).toFixed(2)} ms`;
    case "number":
      return Number(value).toLocaleString();
    default:
      return String(value);
  }
}

export function GenericSection({ section, data }: GenericSectionProps) {
  const items = getItems(data as Record<string, unknown[]>, section);
  const raw = data[section.dataKey];
  const firstItem = Array.isArray(raw) && raw.length > 0 ? raw[0] : null;
  const listItems = items;
  const isSummary = section.layout === "summary-only" || (section.stats && !section.card && !section.table);

  return (
    <section className="dashboard-section">
      <h2 className="dashboard-section-title">{section.title}</h2>
      <p className="dashboard-section-desc">{section.description}</p>

      {section.stats && firstItem && (
        <div className="dashboard-stats">
          {section.stats.map((stat, i) => {
            const val = resolve<unknown>(firstItem, stat.field) ?? resolve<unknown>(items, stat.field);
            const display = typeof val === "number" || typeof val === "string" ? val : formatFieldValue(val);
            return (
              <StatCard key={i} label={stat.label} value={String(display)} tone={stat.tone as "default" | "good" | "warn" | "bad"} />
            );
          })}
        </div>
      )}

      {section.link && (
        <a href={section.link.href} target="_blank" rel="noopener noreferrer" className="dashboard-link">
          {section.link.label} →
        </a>
      )}

      {section.layout === "cards" && section.card && (
        <CardGrid>
          {listItems.map((item: Record<string, unknown>, i) => {
            const title = String(resolve(item, section.card!.titleField) ?? "—");
            const subtitle = section.card!.subtitleField
              ? String(resolve(item, section.card!.subtitleField) ?? "")
              : undefined;
            const searchText = section.card!.searchFields
              .map((f) => resolve(item, f))
              .join(" ")
              .toLowerCase();
            const badges = section.card!.badges?.map((b, j) => {
              const v = String(resolve(item, b.field) ?? "");
              const tone = (b.toneMap?.[v] ?? "default") as DashboardTone;
              const tooltip = getBadgeTooltip(b.field, v);
              return (
                <Tooltip key={j} content={tooltip}>
                  <span>
                    <Badge tone={tone}>{v}</Badge>
                  </span>
                </Tooltip>
              );
            });
            return (
              <ExpandableCard key={i} title={title} subtitle={subtitle} badges={badges}>
                <div className="detail-grid">
                  {section.card!.details?.map((d, k) => {
                    const val = resolve(item, d.field);
                    return (
                      <div key={k} className="detail-item">
                        <h4>{d.label}</h4>
                        <ValueRenderer
                          value={val}
                          field={d.field}
                          format={d.format === "code" ? "code" : "auto"}
                        />
                      </div>
                    );
                  })}
                </div>
              </ExpandableCard>
            );
          })}
        </CardGrid>
      )}

      {section.layout === "table" && section.table && (
        <DataTable
          columns={section.table.columns.map((c) => ({
            key: c.field,
            header: c.header,
            format: c.format,
          }))}
          data={items as Record<string, unknown>[]}
          searchFields={section.table.columns.map((c) => c.field) as (keyof Record<string, unknown>)[]}
          searchPlaceholder={`Search ${section.title.toLowerCase()}...`}
        />
      )}

      {items.length === 0 && !isSummary && (
        <p className="dashboard-empty">No {section.dataKey.replace(/_/g, " ")} found.</p>
      )}
    </section>
  );
}
