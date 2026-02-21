import type * as http from "node:http";
import { getArg, hasFlag } from "@sbtools/sdk";

export class HttpRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = "HttpRequestError";
  }
}

export async function readRequestBody(req: http.IncomingMessage): Promise<string> {
  let body = "";
  for await (const chunk of req) body += chunk;
  return body;
}

export async function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  const body = await readRequestBody(req);
  if (!body.trim()) return {};
  return JSON.parse(body);
}

export function requiredArg(args: string[], flag: string, msg?: string): string {
  const value = getArg(args, flag);
  if (!value) throw new Error(msg ?? `${flag} is required`);
  return value;
}

export function optionalArg(args: string[], flag: string): string | undefined {
  return getArg(args, flag) ?? undefined;
}

export function flag(args: string[], name: string): boolean {
  return hasFlag(args, name);
}

export function parseParams(paramsStr?: string): Array<{ name: string; type: string }> {
  const params: Array<{ name: string; type: string }> = [];
  if (!paramsStr) return params;
  for (const part of paramsStr.split(",").map((s) => s.trim())) {
    const [n, t] = part.split(/\s+/);
    if (n && t) params.push({ name: n, type: t });
  }
  return params;
}

