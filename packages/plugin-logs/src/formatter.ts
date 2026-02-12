/**
 * Log line parsing and ANSI colorization per service type.
 *
 * Each Supabase service emits logs in a different format. This module
 * normalises them into a consistent coloured output with:
 *   [SERVICE]  TIMESTAMP  LEVEL  message
 */

// ---------------------------------------------------------------------------
// ANSI helpers
// ---------------------------------------------------------------------------

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";

const FG = {
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
  brightRed: "\x1b[91m",
  brightGreen: "\x1b[92m",
  brightYellow: "\x1b[93m",
  brightCyan: "\x1b[96m",
} as const;

const BG = {
  red: "\x1b[41m",
  green: "\x1b[42m",
  yellow: "\x1b[43m",
  blue: "\x1b[44m",
  magenta: "\x1b[45m",
} as const;

// ---------------------------------------------------------------------------
// Service colours
// ---------------------------------------------------------------------------

const SERVICE_COLORS: Record<string, string> = {
  functions: FG.cyan,
  db: FG.yellow,
  rest: FG.green,
  auth: FG.magenta,
  kong: FG.blue,
  storage: FG.white,
  realtime: FG.red,
  studio: FG.brightGreen,
  meta: FG.brightCyan,
  inbucket: FG.gray,
};

// HTML-safe service colours (for the viewer)
export const SERVICE_HTML_COLORS: Record<string, string> = {
  functions: "#22d3ee",
  db: "#facc15",
  rest: "#4ade80",
  auth: "#c084fc",
  kong: "#60a5fa",
  storage: "#e2e8f0",
  realtime: "#f87171",
  studio: "#34d399",
  meta: "#67e8f9",
  inbucket: "#94a3b8",
};

// ---------------------------------------------------------------------------
// Level colours
// ---------------------------------------------------------------------------

type LogLevel = "error" | "warn" | "info" | "debug" | "notice" | "unknown";

const LEVEL_COLORS: Record<LogLevel, string> = {
  error: `${BG.red}${FG.white}${BOLD}`,
  warn: `${FG.brightYellow}${BOLD}`,
  info: FG.brightGreen,
  debug: FG.gray,
  notice: FG.cyan,
  unknown: "",
};

const LEVEL_LABELS: Record<LogLevel, string> = {
  error: "ERR",
  warn: "WRN",
  info: "INF",
  debug: "DBG",
  notice: "NTC",
  unknown: "---",
};

// ---------------------------------------------------------------------------
// Level detection
// ---------------------------------------------------------------------------

function detectLevel(line: string): LogLevel {
  const lower = line.toLowerCase();
  if (
    lower.includes("error") ||
    lower.includes("fatal") ||
    lower.includes("panic")
  )
    return "error";
  if (lower.includes("warn")) return "warn";
  if (lower.includes("debug") || lower.includes("trace")) return "debug";
  if (lower.includes("notice")) return "notice";
  if (
    lower.includes("info") ||
    lower.includes("log:") ||
    lower.includes("log ")
  )
    return "info";
  return "unknown";
}

// ---------------------------------------------------------------------------
// Timestamp extraction
// ---------------------------------------------------------------------------

// Docker --timestamps prefix: 2026-02-10T23:00:00.000000000Z
const DOCKER_TS_RE = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z?)\s*/;

// PostgreSQL timestamp: 2026-02-10 23:00:00.000 UTC
const PG_TS_RE = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d+ \w+)\s*/;

// ISO-ish: 2026-02-10T23:00:00
const ISO_TS_RE = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[^\s]*)\s*/;

function extractTimestamp(line: string): { ts: string; rest: string } {
  for (const re of [DOCKER_TS_RE, PG_TS_RE, ISO_TS_RE]) {
    const m = line.match(re);
    if (m) {
      const raw = m[1];
      // Normalise to HH:MM:SS
      const d = new Date(raw);
      const ts = isNaN(d.getTime())
        ? raw.substring(11, 19) || raw.substring(0, 19)
        : d.toISOString().substring(11, 19);
      return { ts, rest: line.slice(m[0].length) };
    }
  }
  return { ts: "", rest: line };
}

// ---------------------------------------------------------------------------
// JSON detection / pretty-print
// ---------------------------------------------------------------------------

function tryPrettyJson(text: string): string | null {
  const trimmed = text.trim();
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      const obj = JSON.parse(trimmed);
      return JSON.stringify(obj, null, 2);
    } catch {
      return null;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Service-specific parsers
// ---------------------------------------------------------------------------

function parsePgLine(rest: string): { level: LogLevel; message: string } {
  // PostgreSQL: LOG:  statement: SELECT ...
  const pgMatch = rest.match(
    /^(LOG|ERROR|WARNING|NOTICE|FATAL|PANIC|DEBUG\d?):\s*(.*)/s,
  );
  if (pgMatch) {
    const pgLevel = pgMatch[1].toLowerCase();
    let level: LogLevel = "info";
    if (pgLevel.startsWith("error") || pgLevel === "fatal" || pgLevel === "panic")
      level = "error";
    else if (pgLevel === "warning") level = "warn";
    else if (pgLevel === "notice") level = "notice";
    else if (pgLevel.startsWith("debug")) level = "debug";
    return { level, message: pgMatch[2] };
  }
  return { level: detectLevel(rest), message: rest };
}

function parseKongLine(rest: string): { level: LogLevel; message: string } {
  // Kong access log: <ip> - - [date] "METHOD /path HTTP/1.1" <status> <size>
  const accessMatch = rest.match(
    /"\s*(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s+(\S+)\s+HTTP\/[\d.]+".*?\s(\d{3})\s/,
  );
  if (accessMatch) {
    const status = parseInt(accessMatch[3], 10);
    let level: LogLevel = "info";
    if (status >= 500) level = "error";
    else if (status >= 400) level = "warn";
    const message = `${accessMatch[1]} ${accessMatch[2]} -> ${status}`;
    return { level, message };
  }
  return { level: detectLevel(rest), message: rest };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface FormattedLog {
  service: string;
  level: LogLevel;
  timestamp: string;
  message: string;
}

/**
 * Parse and extract structured fields from a raw log line.
 * Used by the viewer SSE stream.
 */
export function parseLogLine(service: string, raw: string): FormattedLog {
  const { ts, rest } = extractTimestamp(raw);

  let level: LogLevel;
  let message: string;

  switch (service) {
    case "db":
      ({ level, message } = parsePgLine(rest));
      break;
    case "kong":
      ({ level, message } = parseKongLine(rest));
      break;
    default:
      level = detectLevel(rest);
      message = rest;
  }

  return { service, level, timestamp: ts, message: message.trimEnd() };
}

/**
 * Format a raw log line with ANSI colours for terminal output.
 */
export function formatLogLine(
  service: string,
  raw: string,
  opts: { noColor?: boolean } = {},
): string {
  const parsed = parseLogLine(service, raw);

  if (opts.noColor) {
    const tag = `[${service.toUpperCase().padEnd(10)}]`;
    const ts = parsed.timestamp ? ` ${parsed.timestamp}` : "";
    const lvl = ` ${LEVEL_LABELS[parsed.level]} `;
    return `${tag}${ts}${lvl}${parsed.message}`;
  }

  const color = SERVICE_COLORS[service] ?? "";
  const tag = `${color}${BOLD}[${service.toUpperCase().padEnd(10)}]${RESET}`;
  const ts = parsed.timestamp ? ` ${DIM}${parsed.timestamp}${RESET}` : "";
  const lvlColor = LEVEL_COLORS[parsed.level];
  const lvlLabel = LEVEL_LABELS[parsed.level];
  const lvl = lvlColor
    ? ` ${lvlColor} ${lvlLabel} ${RESET} `
    : ` ${lvlLabel} `;

  // Pretty-print JSON payloads from edge functions
  if (service === "functions" || service === "rest" || service === "auth") {
    const pretty = tryPrettyJson(parsed.message);
    if (pretty) {
      return `${tag}${ts}${lvl}${DIM}${pretty}${RESET}`;
    }
  }

  return `${tag}${ts}${lvl}${parsed.message}`;
}
