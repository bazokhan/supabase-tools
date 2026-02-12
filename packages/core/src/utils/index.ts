import fs from "node:fs";
import path from "node:path";
import { ensureDir } from "@sbtools/sdk";

export function clearDir(p: string): void {
    if (fs.existsSync(p)) {
        fs.rmSync(p, { recursive: true, force: true });
    }
    ensureDir(p);
}

export function listSqlFiles(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
        .filter((f: string) => f.endsWith(".sql"))
        .map((f: string) => path.join(dir, f));
}

export function sanitizeDbUrl(url: string): string {
    try {
        const parsed = new URL(url);
        if (parsed.password) parsed.password = "***";
        return parsed.toString();
    } catch {
        return url.replace(/:[^:@]+@/, ":***@");
    }
}

export function parseSchemaArgs(argv: string[]): string[] | null {
    if (argv.length === 0) return ["public"];
    if (argv[0] === "all") return null;
    return argv;
}

export function getSchemaFilter(schemas: string[] | null, column: "nspname" | "schemaname"): string {
    if (schemas === null) return "";
    const col = column === "nspname" ? "n.nspname" : "schemaname";
    if (schemas.length === 0) return `AND ${col} = 'public'`;
    const list = schemas.map((s) => `'${String(s).replace(/'/g, "''")}'`).join(", ");
    return `AND ${col} IN (${list})`;
}

export function normalizeWhitespace(value: string): string {
    return value.replace(/\s+/g, " ").trim();
}

export function splitArgs(input: string): string[] {
    const parts: string[] = [];
    let current = "";
    let depth = 0;
    let inSingle = false;
    let inDouble = false;
    for (let i = 0; i < input.length; i++) {
        const ch = input[i];
        const prev = i > 0 ? input[i - 1] : "";
        if (ch === "'" && !inDouble && prev !== "\\") inSingle = !inSingle;
        if (ch === '"' && !inSingle && prev !== "\\") inDouble = !inDouble;
        if (!inSingle && !inDouble) {
            if (ch === "(") { depth += 1; }
            else if (ch === ")") { depth = Math.max(0, depth - 1); }
            else if (ch === "," && depth === 0) {
                if (current.trim()) parts.push(current.trim());
                current = "";
                continue;
            }
        }
        current += ch;
    }
    if (current.trim()) parts.push(current.trim());
    return parts.filter(Boolean);
}
