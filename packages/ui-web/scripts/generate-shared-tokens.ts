#!/usr/bin/env node
/**
 * Generate shared-tokens.css from shared-tokens.ts (canonical source).
 * Run before build so tokens.css imports the generated file.
 *
 * Usage: tsx packages/ui-web/scripts/generate-shared-tokens.ts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SHARED_TOKENS_CSS } from "../src/styles/shared-tokens.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.resolve(__dirname, "../src/styles/shared-tokens.css");
const header = `/* Generated from shared-tokens.ts - do not edit manually. Run: npm run generate:tokens */\n\n`;
fs.writeFileSync(outPath, header + SHARED_TOKENS_CSS.trim() + "\n", "utf8");
console.log("Generated shared-tokens.css");
