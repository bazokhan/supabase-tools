/**
 * Regex patterns for detecting Supabase SDK usage in frontend code.
 * Each pattern captures the resource identifier (table name, RPC name, etc.).
 */

export type ResourceType =
  | "table"
  | "rpc"
  | "auth"
  | "storage"
  | "edge_function"
  | "rest_api";

export interface UsageHit {
  type: ResourceType;
  resource: string;
  line: number;
  column: number;
  snippet: string;
}

export interface FrontendUsageData {
  components: Record<string, UsageHit[]>;
  byResource: Record<ResourceType, string[]>;
  stats: { type: ResourceType; count: number }[];
}

/** Match .from("name") or .from('name') - table or bucket; distinguish from storage.from */
const FROM_TABLE = /\.from\s*\(\s*["']([^"']+)["']\s*\)/g;

/** Match .rpc("name") or .rpc('name') */
const RPC = /\.rpc\s*\(\s*["']([^"']+)["']\s*\)/g;

/** Match .auth.* - any auth method */
const AUTH = /\.auth\.(getSession|getUser|onAuthStateChange|signInWithPassword|signInWithOAuth|signUp|signOut|verifyOtp|resetPasswordForEmail|updateUser)/g;

/** Match .storage.from("bucket") */
const STORAGE = /\.storage\.from\s*\(\s*["']([^"']+)["']\s*\)/g;

/** Match .functions.invoke("name") or .functions.invoke('name') */
const EDGE_FN_INVOKE = /\.functions\.invoke\s*\(\s*["']([^"']+)["']\s*\)/g;

/** Match fetch with /rest/v1/ in URL */
const REST_API = /fetch\s*\(\s*[`'"]([^`'"]*\/rest\/v1\/[^`'"]*)[`'"]\s*\)/g;

/** Match fetch with /functions/v1/ in URL */
const EDGE_FN_FETCH = /fetch\s*\(\s*[`'"]([^`'"]*\/functions\/v1\/[^`'"]*)[`'"]\s*\)/g;

/** Table from() - must NOT be preceded by .storage (storage.from is handled separately) */
function* matchFromTable(line: string): Generator<{ resource: string; col: number }> {
  let m: RegExpExecArray | null;
  const re = new RegExp(FROM_TABLE.source, "g");
  while ((m = re.exec(line)) !== null) {
    const before = line.substring(0, m.index);
    if (!before.includes(".storage")) {
      yield { resource: m[1], col: m.index };
    }
  }
}

function* matchRpc(line: string): Generator<{ resource: string; col: number }> {
  let m: RegExpExecArray | null;
  const re = new RegExp(RPC.source, "g");
  while ((m = re.exec(line)) !== null) {
    yield { resource: m[1], col: m.index };
  }
}

function* matchAuth(line: string): Generator<{ resource: string; col: number }> {
  let m: RegExpExecArray | null;
  const re = new RegExp(AUTH.source, "g");
  while ((m = re.exec(line)) !== null) {
    yield { resource: m[1], col: m.index };
  }
}

function* matchStorage(line: string): Generator<{ resource: string; col: number }> {
  let m: RegExpExecArray | null;
  const re = new RegExp(STORAGE.source, "g");
  while ((m = re.exec(line)) !== null) {
    yield { resource: m[1], col: m.index };
  }
}

function* matchEdgeFnInvoke(line: string): Generator<{ resource: string; col: number }> {
  let m: RegExpExecArray | null;
  const re = new RegExp(EDGE_FN_INVOKE.source, "g");
  while ((m = re.exec(line)) !== null) {
    yield { resource: m[1], col: m.index };
  }
}

function* matchRestApi(line: string): Generator<{ resource: string; col: number }> {
  let m: RegExpExecArray | null;
  const re = new RegExp(REST_API.source, "g");
  while ((m = re.exec(line)) !== null) {
    yield { resource: m[1], col: m.index };
  }
}

function* matchEdgeFnFetch(line: string): Generator<{ resource: string; col: number }> {
  let m: RegExpExecArray | null;
  const re = new RegExp(EDGE_FN_FETCH.source, "g");
  while ((m = re.exec(line)) !== null) {
    const url = m[1];
    const fnMatch = url.match(/\/functions\/v1\/([^/?#]+)/);
    yield { resource: fnMatch ? fnMatch[1] : url, col: m.index };
  }
}

export function scanLine(
  line: string,
  lineNum: number,
): UsageHit[] {
  const hits: UsageHit[] = [];
  const snippet = line.trim().slice(0, 80);

  for (const { resource, col } of matchFromTable(line)) {
    hits.push({ type: "table", resource, line: lineNum, column: col, snippet });
  }
  for (const { resource, col } of matchRpc(line)) {
    hits.push({ type: "rpc", resource, line: lineNum, column: col, snippet });
  }
  for (const { resource, col } of matchAuth(line)) {
    hits.push({ type: "auth", resource, line: lineNum, column: col, snippet });
  }
  for (const { resource, col } of matchStorage(line)) {
    hits.push({ type: "storage", resource, line: lineNum, column: col, snippet });
  }
  for (const { resource, col } of matchEdgeFnInvoke(line)) {
    hits.push({ type: "edge_function", resource, line: lineNum, column: col, snippet });
  }
  for (const { resource, col } of matchRestApi(line)) {
    hits.push({ type: "rest_api", resource, line: lineNum, column: col, snippet });
  }
  for (const { resource, col } of matchEdgeFnFetch(line)) {
    hits.push({ type: "edge_function", resource, line: lineNum, column: col, snippet });
  }

  return hits;
}
