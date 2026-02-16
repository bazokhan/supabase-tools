/**
 * @sbtools/plugin-migration-studio
 *
 * Migration authoring UI: create migrations, analyze SQL, apply via core flow.
 * Consumes migration.analysis artifact when available; uses SDK analyzeMigrationSql
 * for live analysis. Apply path invokes sbt migrate (no duplicate migration engine).
 *
 * Activated in supabase-tools.config.json:
 *
 *   "plugins": [{ "path": "@sbtools/plugin-migration-studio", "config": {} }]
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import type { SbtPlugin, PluginContext } from "@sbtools/sdk";
import { ui, hasFlag, getArg, analyzeMigrationSql } from "@sbtools/sdk";

const require = createRequire(import.meta.url);
const PLUGIN_VERSION = (require("../package.json") as { version: string }).version;

const DEFAULT_PORT = 3335;

function generateMigrationFilename(): string {
  const now = new Date();
  const ts =
    now.getFullYear().toString().padStart(4, "0") +
    (now.getMonth() + 1).toString().padStart(2, "0") +
    now.getDate().toString().padStart(2, "0") +
    now.getHours().toString().padStart(2, "0") +
    now.getMinutes().toString().padStart(2, "0") +
    now.getSeconds().toString().padStart(2, "0");
  return `${ts}_migration.sql`;
}

function getStudioHtml(ctx: PluginContext): string {
  const migrationsDir = ctx.paths.migrations;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Migration Studio</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; padding: 24px; line-height: 1.5; }
  h1 { font-size: 1.5rem; margin-bottom: 8px; }
  .sub { color: #94a3b8; font-size: 0.9rem; margin-bottom: 24px; }
  .toolbar { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
  button { padding: 8px 16px; border-radius: 6px; font-weight: 500; cursor: pointer; border: 1px solid #334155; background: #1e293b; color: #e2e8f0; }
  button:hover { background: #334155; }
  button.primary { background: #3b82f6; border-color: #3b82f6; }
  button.danger { background: #dc2626; border-color: #dc2626; }
  textarea { width: 100%; min-height: 240px; padding: 12px; border-radius: 8px; border: 1px solid #334155; background: #1e293b; color: #e2e8f0; font-family: ui-monospace, monospace; font-size: 0.9rem; resize: vertical; }
  .panel { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
  .panel h3 { font-size: 0.9rem; color: #94a3b8; margin-bottom: 12px; }
  .chip { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; margin: 2px 4px 2px 0; background: #334155; }
  .chip.destructive { background: rgba(220,38,38,0.3); }
  .chip.safe { background: rgba(34,197,94,0.3); }
  .msg { padding: 12px; border-radius: 6px; margin-bottom: 12px; }
  .msg.success { background: rgba(34,197,94,0.2); border: 1px solid #22c55e; }
  .msg.error { background: rgba(220,38,38,0.2); border: 1px solid #dc2626; }
  code { font-family: ui-monospace, monospace; font-size: 0.85rem; }
</style>
</head>
<body>
<h1>Migration Studio</h1>
<p class="sub">Create and apply migrations. SQL-first workflow. Apply uses <code>sbt migrate</code>.</p>

<div class="toolbar">
  <button type="button" onclick="analyze()">Analyze SQL</button>
  <button type="button" class="primary" onclick="saveMigration()">Save as migration</button>
  <button type="button" class="danger" onclick="applyMigrations()">Apply migrations</button>
</div>

<div id="message"></div>

<div class="panel">
  <h3>SQL editor</h3>
  <textarea id="sql" placeholder="-- Write your migration SQL here\nCREATE TABLE IF NOT EXISTS public.example (\n  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n  created_at timestamptz DEFAULT now()\n);"> </textarea>
</div>

<div class="panel" id="analysis" style="display:none">
  <h3>Analysis</h3>
  <div id="analysis-content"></div>
</div>

<script>
const MIGRATIONS_DIR = ${JSON.stringify(migrationsDir)};

function showMsg(text, kind) {
  const el = document.getElementById('message');
  el.className = 'msg ' + (kind || '');
  el.textContent = text;
  el.style.display = 'block';
}

async function analyze() {
  const sql = document.getElementById('sql').value;
  try {
    const res = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sql }) });
    const data = await res.json();
    const el = document.getElementById('analysis');
    const content = document.getElementById('analysis-content');
    if (data.operations && data.operations.length > 0) {
      content.innerHTML = '<p>Operations: ' + data.operations.map(o => '<span class="chip">' + o.kind + '</span>').join(' ') + '</p>' +
        '<p>Risk: ' + (data.riskFlags.hasDestructive ? '<span class="chip destructive">Destructive</span>' : '') +
        (data.riskFlags.hasIfExists ? ' <span class="chip safe">IF EXISTS</span>' : '') +
        (data.riskFlags.hasIfNotExists ? ' <span class="chip safe">IF NOT EXISTS</span>' : '') + '</p>';
      el.style.display = 'block';
    } else {
      content.innerHTML = '<p>No DDL operations detected. Confidence: ' + (data.confidence || 'low') + '</p>';
      el.style.display = 'block';
    }
  } catch (e) {
    showMsg('Analysis failed: ' + e.message, 'error');
  }
}

async function saveMigration() {
  const sql = document.getElementById('sql').value.trim();
  if (!sql) { showMsg('Enter SQL first.', 'error'); return; }
  try {
    const res = await fetch('/api/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sql }) });
    const data = await res.json();
    if (data.filename) {
      showMsg('Saved to ' + data.filename, 'success');
      document.getElementById('sql').value = '';
    } else {
      showMsg(data.error || 'Save failed', 'error');
    }
  } catch (e) {
    showMsg('Save failed: ' + e.message, 'error');
  }
}

async function applyMigrations() {
  if (!confirm('Apply pending migrations via sbt migrate? This will execute SQL against the database.')) return;
  try {
    const res = await fetch('/api/apply', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showMsg('Apply completed. ' + (data.output || '').slice(-200), 'success');
    } else {
      showMsg('Apply failed: ' + (data.error || 'Unknown error'), 'error');
    }
  } catch (e) {
    showMsg('Apply failed: ' + e.message, 'error');
  }
}
</script>
</body>
</html>`;
}

async function migrationStudioCommand(args: string[], ctx: PluginContext): Promise<void> {
  if (hasFlag(args, "--help", "-h")) {
    console.log(`
migration-studio — Migration authoring UI

Usage:
  sbt migration-studio           Start the studio server (default port 3335)
  sbt migration-studio --port N  Use port N

Options:
  -h, --help   Show this help
  --port N     HTTP server port (default: 3335)
`);
    return;
  }

  const port = parseInt(getArg(args, "--port") ?? String(DEFAULT_PORT), 10) || DEFAULT_PORT;

  const server = http.createServer(async (req, res) => {
    const url = req.url ?? "/";
    const method = req.method ?? "GET";

    if (url === "/" || url === "/index.html") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(getStudioHtml(ctx));
      return;
    }

    if (url === "/api/analyze" && method === "POST") {
      let body = "";
      for await (const chunk of req) body += chunk;
      try {
        const { sql } = JSON.parse(body);
        const analysis = analyzeMigrationSql(sql || "");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(analysis));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: (e as Error).message }));
      }
      return;
    }

    if (url === "/api/save" && method === "POST") {
      let body = "";
      for await (const chunk of req) body += chunk;
      try {
        const { sql } = JSON.parse(body);
        if (!sql?.trim()) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "SQL is required" }));
          return;
        }
        const migrationsDir = ctx.paths.migrations;
        if (!fs.existsSync(migrationsDir)) fs.mkdirSync(migrationsDir, { recursive: true });
        const filename = generateMigrationFilename();
        const filePath = path.join(migrationsDir, filename);
        fs.writeFileSync(filePath, sql.trimEnd() + "\n", "utf8");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ filename, filePath }));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: (e as Error).message }));
      }
      return;
    }

    if (url === "/api/apply" && method === "POST") {
      try {
        const cliPath = path.join(ctx.toolsDir, "dist", "cli.js");
        const output = execSync(`node "${cliPath}" migrate`, { cwd: ctx.projectRoot, encoding: "utf8", maxBuffer: 1024 * 1024 });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, output }));
      } catch (e) {
        const err = e as { stdout?: string; stderr?: string };
        const msg = err.stderr || err.stdout || (e as Error).message;
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: String(msg).slice(-500) }));
      }
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  server.listen(port, () => {
    ui.success(`Migration Studio at http://localhost:${port}`);
    ui.detail("Press Ctrl+C to stop.");
  });
}

const plugin: SbtPlugin = {
  name: "@sbtools/plugin-migration-studio",
  version: PLUGIN_VERSION,
  artifactCapabilities: {
    produces: ["migration.studio.draft"],
    consumes: ["migration.analysis"],
  },
  commands: [
    {
      name: "migration-studio",
      description: "Migration authoring UI — create migrations, analyze SQL, apply via sbt migrate",
      run: migrationStudioCommand,
    },
  ],
};

export default plugin;
