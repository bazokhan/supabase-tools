import fs from "node:fs";
import path from "node:path";

export interface ColumnInfo {
  column_name: string;
  data_type: string;
  udt_name: string;
  is_nullable: string;
  is_primary_key: boolean;
  is_foreign_key: boolean;
}

export interface ForeignKeyInfo {
  column_name: string;
  foreign_table_schema: string;
  foreign_table_name: string;
  foreign_column_name: string;
  delete_rule: string;
  is_nullable: string;
}

export interface ReferencedColumn {
  column_name: string;
  is_primary_key: boolean;
  is_foreign_key: boolean;
  data_type: string;
  udt_name: string;
}

const ERD_HEADING = "## Entity Relationship Diagram";

/** Map Postgres data_type / udt_name to a short Mermaid-friendly type. */
export function mapType(dataType: string, udtName: string): string {
  if (dataType === "uuid") return "uuid";
  if (dataType === "text" || dataType === "character varying") return "text";
  if (dataType === "boolean") return "boolean";
  if (dataType === "integer" || dataType === "bigint" || dataType === "smallint") return dataType;
  if (dataType === "numeric" || dataType === "double precision") return "numeric";
  if (dataType === "jsonb" || dataType === "json") return dataType;
  if (dataType === "date") return "date";
  if (dataType === "timestamp with time zone" || dataType === "timestamp without time zone") return "timestamp";
  if (dataType === "ARRAY") return `${udtName.replace(/^_/, "")}[]`;
  if (dataType === "USER-DEFINED") return udtName;
  return dataType;
}

function toTitle(tableName: string): string {
  return tableName.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

export function buildMermaid(
  tableName: string,
  columns: ColumnInfo[],
  foreignKeys: ForeignKeyInfo[],
  referencedEntities: Map<string, ReferencedColumn[]>,
): string {
  const lines: string[] = [];
  lines.push("```mermaid");
  lines.push("erDiagram");

  for (const fk of foreignKeys) {
    const nullable = fk.is_nullable === "YES";
    const cardinality = nullable ? "}o--o|" : "}o--||";
    const targetEntity =
      fk.foreign_table_schema !== "public"
        ? `${fk.foreign_table_schema}_${fk.foreign_table_name}`
        : fk.foreign_table_name;
    lines.push(`    ${tableName} ${cardinality} ${targetEntity} : ${fk.column_name}`);
  }

  if (foreignKeys.length > 0) lines.push("");

  lines.push(`    ${tableName} {`);
  for (const col of columns) {
    const type = mapType(col.data_type, col.udt_name);
    const annotations: string[] = [];
    if (col.is_primary_key) annotations.push("PK");
    if (col.is_foreign_key) annotations.push("FK");
    const suffix = annotations.length > 0 ? ` ${annotations.join(",")}` : "";
    lines.push(`        ${type} ${col.column_name}${suffix}`);
  }
  lines.push("    }");

  const emittedEntities = new Set<string>();
  for (const fk of foreignKeys) {
    const entityKey = `${fk.foreign_table_schema}.${fk.foreign_table_name}`;
    if (emittedEntities.has(entityKey)) continue;
    emittedEntities.add(entityKey);

    const entityName =
      fk.foreign_table_schema !== "public"
        ? `${fk.foreign_table_schema}_${fk.foreign_table_name}`
        : fk.foreign_table_name;

    if (entityName === tableName) continue;

    const refCols = referencedEntities.get(entityKey);
    if (!refCols || refCols.length === 0) continue;

    lines.push("");
    lines.push(`    ${entityName} {`);
    for (const rc of refCols) {
      const type = mapType(rc.data_type, rc.udt_name);
      const annotations: string[] = [];
      if (rc.is_primary_key) annotations.push("PK");
      if (rc.is_foreign_key) annotations.push("FK");
      const suffix = annotations.length > 0 ? ` ${annotations.join(",")}` : "";
      lines.push(`        ${type} ${rc.column_name}${suffix}`);
    }
    lines.push("    }");
  }

  lines.push("```");
  return lines.join("\n");
}

export function updateMarkdown(outDir: string, tableName: string, mermaidBlock: string): void {
  const filePath = path.join(outDir, `${tableName}.md`);
  const erdSection = `${ERD_HEADING}\n\n${mermaidBlock}\n`;

  if (fs.existsSync(filePath)) {
    const existing = fs.readFileSync(filePath, "utf8");
    const headingIdx = existing.indexOf(ERD_HEADING);
    if (headingIdx >= 0) {
      const before = existing.slice(0, headingIdx);
      fs.writeFileSync(filePath, before + erdSection, "utf8");
    } else {
      const separator = existing.endsWith("\n") ? "\n" : "\n\n";
      fs.writeFileSync(filePath, existing + separator + erdSection, "utf8");
    }
  } else {
    const title = toTitle(tableName);
    const content = `# ${title} Entity Relations\n\nThis document describes the entity relationships for the \`${tableName}\` table.\n\n${erdSection}`;
    fs.writeFileSync(filePath, content, "utf8");
  }
}
