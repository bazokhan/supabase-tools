import type { ArgInfo } from "@sbtools/sdk";
import { normalizeWhitespace, splitArgs } from "./string-utils.js";

export function parseHeader(content: string, label: string): string {
    const match = content.match(new RegExp(`^--\\s*${label}:\\s*(.+)$`, "m"));
    return match ? match[1].trim() : "";
}

export function parseArgs(argsText: string): ArgInfo[] {
    if (!argsText.trim()) return [];
    const parts = splitArgs(argsText);
    return parts.map((part, index) => {
        let cleaned = normalizeWhitespace(part);
        let mode = "";
        const modeMatch = cleaned.match(/^(INOUT|IN|OUT|VARIADIC)\s+/i);
        if (modeMatch) {
            mode = modeMatch[1].toUpperCase();
            cleaned = cleaned.slice(modeMatch[0].length).trim();
        }
        const tokens = cleaned.split(" ");
        if (tokens.length === 1) {
            return { name: `arg${index + 1}`, type: tokens[0], mode: mode || undefined };
        }
        const name = tokens[0];
        const type = tokens.slice(1).join(" ");
        return { name, type, mode: mode || undefined };
    });
}

export function extractDescription(sql: string): string {
    const lines = sql.split(/\r?\n/);
    const startIdx = lines.findIndex((line) => line.trim().toUpperCase().startsWith("CREATE "));
    if (startIdx === -1) return "";
    for (let i = startIdx + 1; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (trimmed.startsWith("--")) {
            const text = trimmed.replace(/^--\s?/, "").trim();
            if (text && !text.toUpperCase().startsWith("GENERATED")) return text;
        }
    }
    return "";
}

export function parseReturns(sql: string): string {
    const match = sql.match(/RETURNS\s+([\s\S]+?)\s+LANGUAGE/i);
    if (!match) return "";
    return normalizeWhitespace(match[1]);
}

export function parseVolatility(sql: string): string {
    const match = sql.match(/\b(IMMUTABLE|STABLE|VOLATILE)\b/i);
    return match ? match[1].toUpperCase() : "";
}
