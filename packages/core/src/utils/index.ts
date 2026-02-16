import fs from "node:fs";
import path from "node:path";
import type { SchemaFilter } from "@sbtools/sdk";
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

export function getSchemaFilter(schemas: string[] | null, column: "nspname" | "schemaname"): SchemaFilter {
    if (schemas === null) return { clause: "", params: [] };
    const col = column === "nspname" ? "n.nspname" : "schemaname";
    if (schemas.length === 0) return { clause: `AND ${col} = $1`, params: ["public"] };
    const placeholders = schemas.map((_, i) => `$${i + 1}`).join(", ");
    return { clause: `AND ${col} IN (${placeholders})`, params: schemas };
}

