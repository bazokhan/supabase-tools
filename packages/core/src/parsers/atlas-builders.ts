/**
 * Atlas data category builders. Each parses snapshot SQL files into typed items.
 */
import path from "node:path";
import { readText } from "@sbtools/sdk";
import type { FunctionItem, ViewItem, TriggerItem, PolicyItem, TypeItem, EnumItem } from "@sbtools/sdk";
import { listSqlFiles } from "../utils/index.js";
import {
  parseHeader,
  parseArgs,
  parseReturns,
  parseVolatility,
  parseTriggerDetails,
  parsePolicyBlocks,
  parsePolicyDetail,
  parseEnumValues,
  extractDescription,
} from "./index.js";

export function buildFunctions(snapshotDir: string): FunctionItem[] {
  const functionsDir = path.join(snapshotDir, "functions");
  return listSqlFiles(functionsDir).map((filePath) => {
    const sql = readText(filePath).trim();
    const schema = parseHeader(sql, "Schema");
    const signatureLine = parseHeader(sql, "Function");
    const openIdx = signatureLine.indexOf("(");
    const name = openIdx >= 0 ? signatureLine.slice(0, openIdx).trim() : signatureLine.trim();
    const argsText = openIdx >= 0 ? signatureLine.slice(openIdx + 1, signatureLine.lastIndexOf(")")) : "";
    const args = parseArgs(argsText);
    const returns = parseReturns(sql);
    const volatility = parseVolatility(sql);
    const securityDefiner = /\bSECURITY\s+DEFINER\b/i.test(sql);
    const description = extractDescription(sql);

    return {
      id: `${schema}.${name}(${argsText})`,
      kind: "function" as const,
      schema,
      name,
      signature: signatureLine,
      args,
      returns,
      volatility,
      security_definer: securityDefiner,
      sql,
      description: description ?? undefined,
    };
  });
}

export function buildViews(snapshotDir: string): { views: ViewItem[]; materializedViews: ViewItem[] } {
  const viewsDir = path.join(snapshotDir, "views");
  const views: ViewItem[] = [];
  const materializedViews: ViewItem[] = [];

  for (const filePath of listSqlFiles(viewsDir)) {
    const sql = readText(filePath).trim();
    const schema = parseHeader(sql, "Schema");
    const viewName = parseHeader(sql, "View");
    const matName = parseHeader(sql, "Materialized View");
    const name = viewName || matName;
    const kind = matName ? "materialized_view" : "view";
    const item: ViewItem = { id: `${schema}.${name}`, kind, schema, name, sql };
    if (kind === "materialized_view") materializedViews.push(item);
    else views.push(item);
  }

  return { views, materializedViews };
}

export function buildTriggers(snapshotDir: string): TriggerItem[] {
  const triggersDir = path.join(snapshotDir, "triggers");
  return listSqlFiles(triggersDir).map((filePath) => {
    const sql = readText(filePath).trim();
    const schema = parseHeader(sql, "Schema");
    const table = parseHeader(sql, "Table");
    const name = parseHeader(sql, "Trigger");
    const details = parseTriggerDetails(sql);
    return {
      id: `${schema}.${table}.${name}`,
      kind: "trigger" as const,
      schema,
      name,
      table,
      timing: details.timing,
      events: details.events,
      function_name: details.function_name,
      sql,
    };
  });
}

export function buildPolicies(snapshotDir: string): PolicyItem[] {
  const policiesDir = path.join(snapshotDir, "policies");
  const policies: PolicyItem[] = [];

  for (const filePath of listSqlFiles(policiesDir)) {
    const sql = readText(filePath).trim();
    const tableMatch = sql.match(/current RLS policies for\s+([^\s]+)/i);
    const tableFull = tableMatch ? tableMatch[1].trim() : "";
    const [schema, table] = tableFull.includes(".") ? tableFull.split(".") : ["", tableFull];
    const blocks = parsePolicyBlocks(sql);
    for (const block of blocks) {
      const detail = parsePolicyDetail(block.sql);
      policies.push({
        id: `${schema}.${table}.${block.name}`,
        kind: "policy" as const,
        schema,
        name: block.name,
        table,
        permissive: detail.permissive,
        command: detail.command,
        roles: detail.roles,
        using: detail.using,
        with_check: detail.with_check,
        sql: block.sql,
      });
    }
  }

  return policies;
}

export function buildTypes(snapshotDir: string): TypeItem[] {
  const typesDir = path.join(snapshotDir, "types");
  return listSqlFiles(typesDir).map((filePath) => {
    const sql = readText(filePath).trim();
    const schema = parseHeader(sql, "Schema");
    const typeLine = parseHeader(sql, "Type");
    const name = typeLine.split("(")[0].trim();
    const typeKindMatch = typeLine.match(/\(([^)]+)\)/);
    const typeKind = typeKindMatch ? typeKindMatch[1].trim() : "";
    return { id: `${schema}.${name}`, kind: "type" as const, schema, name, type_kind: typeKind, sql };
  });
}

export function buildEnums(snapshotDir: string): EnumItem[] {
  const enumsDir = path.join(snapshotDir, "enums");
  return listSqlFiles(enumsDir).map((filePath) => {
    const sql = readText(filePath).trim();
    const schema = parseHeader(sql, "Schema");
    const name = parseHeader(sql, "Enum");
    const values = parseEnumValues(sql);
    return { id: `${schema}.${name}`, kind: "enum" as const, schema, name, values, sql };
  });
}
