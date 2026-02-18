import React from "react";
import { autocompletion, completionKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { sql as sqlLanguage, PostgreSQL, schemaCompletionSource, keywordCompletionSource } from "@codemirror/lang-sql";
import { linter, type Diagnostic } from "@codemirror/lint";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, hoverTooltip, keymap, lineNumbers } from "@codemirror/view";
import { oneDark } from "@codemirror/theme-one-dark";
import { CheckCircle2, Database, Link2Off, Loader2, Play, Save, Sparkles, Unplug } from "lucide-react";
import { AppDataTable } from "../components/AppDataTable";
import { EmptyPanel } from "../components/EmptyPanel";
import { STUDIO_URL_STORAGE_KEY, DEFAULT_STUDIO_URL, type AtlasRow } from "../lib/model";
import type { PageProps } from "./page-types";

interface MigrationStudioPageProps extends PageProps {
  enabled: boolean;
}

interface StudioTemplate {
  id: string;
  name: string;
  description?: string;
  sql: string;
}

interface StudioMigration {
  filename: string;
  status: string;
  sizeBytes?: number;
}

interface StudioSchema {
  source?: string;
  tables?: Record<string, string[]>;
  schemas?: string[];
  functions?: string[];
  types?: string[];
  enums?: Record<string, string[]>;
  views?: string[];
}

interface AnalyzeResult {
  operations?: unknown[];
  warnings?: unknown[];
  complexity?: unknown;
}

function normalizedStudioUrl(raw: string): string {
  const value = raw.trim() || DEFAULT_STUDIO_URL;
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export function MigrationStudioPage({ enabled }: MigrationStudioPageProps) {
  if (!enabled) {
    return (
      <EmptyPanel
        title="Migration Studio Not Available"
        message="Migration Studio is not enabled for this dashboard."
        hint="Enable @sbtools/plugin-migration-studio and refresh."
      />
    );
  }
  return <MigrationStudioEnabled />;
}

function MigrationStudioEnabled() {
  const [studioUrlInput, setStudioUrlInput] = React.useState(
    () => localStorage.getItem(STUDIO_URL_STORAGE_KEY) || DEFAULT_STUDIO_URL
  );
  const [studioUrl, setStudioUrl] = React.useState(() => normalizedStudioUrl(studioUrlInput));
  const [connecting, setConnecting] = React.useState(false);
  const [connected, setConnected] = React.useState(false);
  const [connectionError, setConnectionError] = React.useState<string>("");

  const [sqlText, setSqlText] = React.useState(`-- Write your migration SQL here
CREATE TABLE IF NOT EXISTS public.example (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now()
);`);
  const [templates, setTemplates] = React.useState<StudioTemplate[]>([]);
  const [migrations, setMigrations] = React.useState<StudioMigration[]>([]);
  const [schema, setSchema] = React.useState<StudioSchema>({});
  const [analysis, setAnalysis] = React.useState<AnalyzeResult | null>(null);
  const [output, setOutput] = React.useState("");
  const [activeTab, setActiveTab] = React.useState<"migrations" | "schema">("migrations");
  const [currentMigrationFilename, setCurrentMigrationFilename] = React.useState<string | null>(null);
  const [currentMigrationStatus, setCurrentMigrationStatus] = React.useState<string | null>(null);
  const [flashMessage, setFlashMessage] = React.useState("");
  const editorHostRef = React.useRef<HTMLDivElement | null>(null);
  const editorViewRef = React.useRef<EditorView | null>(null);
  const schemaRef = React.useRef<StudioSchema>({});
  const apiUrlRef = React.useRef(studioUrl);
  const languageCompartmentRef = React.useRef(new Compartment());
  const themeCompartmentRef = React.useRef(new Compartment());

  const apiUrl = React.useCallback((path: string) => `${studioUrl}${path}`, [studioUrl]);
  const readSql = React.useCallback(() => editorViewRef.current?.state.doc.toString() ?? sqlText, [sqlText]);

  React.useEffect(() => {
    schemaRef.current = schema;
  }, [schema]);

  React.useEffect(() => {
    apiUrlRef.current = studioUrl;
  }, [studioUrl]);

  const toNestedSchema = React.useCallback((tables: Record<string, string[]> = {}) => {
    const nested: Record<string, Record<string, string[]> | string[]> = {};
    for (const [key, cols] of Object.entries(tables)) {
      const parts = key.includes(".") ? key.split(".") : ["public", key];
      let cursor = nested;
      for (let idx = 0; idx < parts.length - 1; idx += 1) {
        const part = parts[idx];
        const existing = cursor[part];
        if (!existing || Array.isArray(existing)) {
          cursor[part] = {};
        }
        cursor = cursor[part] as Record<string, Record<string, string[]> | string[]>;
      }
      cursor[parts[parts.length - 1]] = cols;
    }
    return nested;
  }, []);

  const createSqlExtension = React.useCallback((schemaData: StudioSchema) => {
    const tables = schemaData.tables ?? {};
    const sqlConfig: {
      dialect: typeof PostgreSQL;
      schema?: Record<string, Record<string, string[]> | string[]>;
      defaultSchema?: string;
    } = { dialect: PostgreSQL };
    if (Object.keys(tables).length > 0) {
      sqlConfig.schema = toNestedSchema(tables);
      if ((schemaData.schemas ?? []).includes("public")) {
        sqlConfig.defaultSchema = "public";
      }
    }

    const dbObjectsCompletionSource = (context: any) => {
      const word = context.matchBefore(/[\w.]*/);
      if (!word) return null;
      const prefix = (word.text || "").toLowerCase();
      const functions = (schemaRef.current.functions ?? []).filter((item) => item.toLowerCase().startsWith(prefix));
      const types = (schemaRef.current.types ?? []).filter((item) => item.toLowerCase().startsWith(prefix));
      const views = (schemaRef.current.views ?? []).filter((item) => item.toLowerCase().startsWith(prefix));
      const options = [
        ...functions.map((label) => ({ label, type: "function" })),
        ...types.map((label) => ({ label, type: "type" })),
        ...views.map((label) => ({ label, type: "class" })),
      ];
      if (options.length === 0) return null;
      return { from: word.from, options, validFor: /^[\w.]*$/ };
    };

    return [
      sqlLanguage(sqlConfig),
      autocompletion({
        override: [
          keywordCompletionSource(PostgreSQL),
          schemaCompletionSource(sqlConfig),
          dbObjectsCompletionSource,
        ],
      }),
    ];
  }, [toNestedSchema]);

  React.useEffect(() => {
    if (!editorHostRef.current || editorViewRef.current) return;
    const hover = hoverTooltip((view, pos) => {
      const doc = view.state.doc;
      const line = doc.lineAt(pos);
      const before = pos - line.from;
      const prefix = (line.text.slice(0, before).match(/([\w."]+)$/) || [])[1] || "";
      const suffix = (line.text.slice(before).match(/^([\w."]*)/) || [])[1] || "";
      const word = (prefix + suffix).replace(/"/g, "");
      if (!word || !/^[a-zA-Z_][\w.]*$/.test(word)) return null;

      const schemaData = schemaRef.current;
      const tableColumns = schemaData.tables?.[word] ?? schemaData.tables?.[word.replace(/^public\./, "")];
      const isView = (schemaData.views ?? []).includes(word);
      const isFunction = (schemaData.functions ?? []).includes(word);
      const isType = (schemaData.types ?? []).includes(word);
      const enumValues = schemaData.enums?.[word];
      if (!tableColumns && !isView && !isFunction && !isType && !enumValues) return null;

      const title = tableColumns
        ? `Table ${word}`
        : isView
          ? `View ${word}`
          : isFunction
            ? `Function ${word}()`
            : isType
              ? `Type ${word}`
              : `Enum ${word}`;
      const body = tableColumns?.join(", ") || enumValues?.join(", ") || "";
      const from = pos - prefix.length;
      return {
        pos: from,
        end: from + word.length,
        above: true,
        create: () => {
          const dom = document.createElement("div");
          dom.className = "studio-tooltip";
          dom.innerHTML = `<strong>${title}</strong>${body ? `<div>${body.replace(/</g, "&lt;")}</div>` : ""}`;
          return { dom };
        },
      };
    });

    const validateLinter = linter(async (view): Promise<Diagnostic[]> => {
      const body = view.state.doc.toString();
      if (!body.trim()) return [];
      try {
        const response = await fetch(`${apiUrlRef.current}/api/validate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sql: body }),
        });
        if (!response.ok) return [];
        const result = (await response.json()) as { valid?: boolean; error?: string; line?: number; dbConnected?: boolean };
        if (result.valid !== false || !result.dbConnected) return [];
        const lineNumber = Math.max(1, result.line ?? 1);
        if (lineNumber > view.state.doc.lines) {
          return [{ from: 0, to: 1, severity: "error", message: result.error ?? "SQL validation failed", source: "PostgreSQL" }];
        }
        const line = view.state.doc.line(lineNumber);
        return [
          {
            from: line.from,
            to: Math.min(line.to, line.from + 120),
            severity: "error",
            message: result.error ?? "SQL validation failed",
            source: "PostgreSQL",
          },
        ];
      } catch {
        return [];
      }
    }, { delay: 400 });

    const extensions = [
      lineNumbers(),
      history(),
      languageCompartmentRef.current.of(createSqlExtension(schemaRef.current)),
      validateLinter,
      keymap.of([...defaultKeymap, ...historyKeymap, ...completionKeymap]),
      hover,
      themeCompartmentRef.current.of(document.documentElement.classList.contains("dark") ? oneDark : []),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          setSqlText(update.state.doc.toString());
        }
      }),
    ];

    const view = new EditorView({
      state: EditorState.create({ doc: sqlText, extensions }),
      parent: editorHostRef.current,
    });
    editorViewRef.current = view;

    return () => {
      view.destroy();
      editorViewRef.current = null;
    };
  }, [createSqlExtension, sqlText]);

  React.useEffect(() => {
    const view = editorViewRef.current;
    if (!view) return;
    view.dispatch({
      effects: languageCompartmentRef.current.reconfigure(createSqlExtension(schema)),
    });
  }, [createSqlExtension, schema]);

  React.useEffect(() => {
    const view = editorViewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === sqlText) return;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: sqlText },
    });
  }, [sqlText]);

  const loadSchema = React.useCallback(async () => {
    const data = await requestJson<StudioSchema>(apiUrl("/api/schema"));
    setSchema(data ?? {});
  }, [apiUrl]);

  const loadTemplates = React.useCallback(async () => {
    const data = await requestJson<{ templates: StudioTemplate[] }>(apiUrl("/api/templates"));
    setTemplates(data.templates ?? []);
  }, [apiUrl]);

  const loadMigrations = React.useCallback(async () => {
    const data = await requestJson<{ migrations: StudioMigration[] }>(apiUrl("/api/migrations"));
    setMigrations(data.migrations ?? []);
  }, [apiUrl]);

  const probeServer = React.useCallback(async () => {
    setConnecting(true);
    setConnectionError("");
    try {
      await requestJson<{ ok: boolean }>(apiUrl("/api/health"));
      setConnected(true);
      await Promise.all([loadSchema(), loadTemplates(), loadMigrations()]);
    } catch (error) {
      setConnected(false);
      setConnectionError((error as Error).message || "Unable to connect.");
    } finally {
      setConnecting(false);
    }
  }, [apiUrl, loadMigrations, loadSchema, loadTemplates]);

  React.useEffect(() => {
    probeServer().catch(() => undefined);
  }, [probeServer]);

  React.useEffect(() => {
    if (!connected) return;
    const events = new EventSource(apiUrl("/api/events"));
    events.onmessage = () => {
      loadSchema().catch(() => undefined);
      loadMigrations().catch(() => undefined);
    };
    events.onerror = () => {
      events.close();
    };
    return () => events.close();
  }, [apiUrl, connected, loadMigrations, loadSchema]);

  React.useEffect(() => {
    if (!flashMessage) return;
    const timeout = setTimeout(() => setFlashMessage(""), 3500);
    return () => clearTimeout(timeout);
  }, [flashMessage]);

  const schemaStatus = schema.source === "database" ? "Database" : schema.source === "atlas-data" ? "Cached atlas" : "Fallback";
  const appliedCount = migrations.filter((item) => item.status === "applied").length;
  const pendingCount = migrations.filter((item) => item.status !== "applied").length;
  const canOverwrite = Boolean(currentMigrationFilename && currentMigrationStatus === "pending");
  const tableRows = Object.entries(schema.tables ?? {}).map(([name, columns]) => ({
    name,
    columns: columns.slice(0, 3).join(", "),
    total_columns: columns.length,
  }));
  const migrationRows = migrations as unknown as AtlasRow[];
  const schemaRows = tableRows as unknown as AtlasRow[];

  const runAnalyze = async () => {
    if (!connected) return;
    const currentSql = readSql();
    const result = await requestJson<AnalyzeResult>(apiUrl("/api/analyze"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sql: currentSql }),
    });
    setAnalysis(result);
  };

  const wrapTx = () => {
    const current = readSql();
    const trimmed = current.trim();
    if (!trimmed) return;
    if (/^\s*BEGIN\s*;/i.test(trimmed)) return;
    setSqlText(`BEGIN;\n${trimmed.endsWith(";") ? trimmed : `${trimmed};`}\nCOMMIT;`);
  };

  const saveMigration = async (asNew: boolean) => {
    if (!connected) return;
    const currentSql = readSql();
    const body: { sql: string; description: string; filename?: string } = {
      sql: currentSql,
      description: "studio_update",
    };
    if (!asNew && canOverwrite && currentMigrationFilename) body.filename = currentMigrationFilename;
    const result = await requestJson<{ filename: string }>(apiUrl("/api/save"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setCurrentMigrationFilename(result.filename);
    setCurrentMigrationStatus("pending");
    setFlashMessage(`Saved ${result.filename}`);
    await loadMigrations();
  };

  const applyMigrations = async () => {
    if (!connected) return;
    const result = await requestJson<{ success: boolean; output?: string; error?: string }>(apiUrl("/api/apply"), {
      method: "POST",
    });
    setOutput(result.success ? result.output ?? "Applied." : result.error ?? "Apply failed.");
    await loadMigrations();
  };

  const loadMigration = async (filename: string, status: string) => {
    const result = await requestJson<{ sql: string }>(apiUrl(`/api/migration/${encodeURIComponent(filename)}`));
    setSqlText(result.sql ?? "");
    setCurrentMigrationFilename(filename);
    setCurrentMigrationStatus(status);
  };

  const updateStudioUrl = () => {
    const next = normalizedStudioUrl(studioUrlInput);
    localStorage.setItem(STUDIO_URL_STORAGE_KEY, next);
    setStudioUrl(next);
  };

  return (
    <div className="content-stack">
      <section className="panel panel-accent studio-top-panel">
        <div className="panel-head studio-head">
          <div>
            <h2>Migration Studio</h2>
            <p>Server-driven workflow for SQL authoring, analysis, save, and apply.</p>
          </div>
          <div className={`studio-connection-pill ${connected ? "is-up" : "is-down"}`}>
            {connecting ? <Loader2 size={14} className="studio-spin" /> : connected ? <CheckCircle2 size={14} /> : <Link2Off size={14} />}
            <span>{connecting ? "Connecting..." : connected ? "Connected" : "Disconnected"}</span>
          </div>
        </div>
        <div className="studio-server-row">
          <input
            type="url"
            className="ui-input"
            value={studioUrlInput}
            onChange={(event) => setStudioUrlInput(event.target.value)}
            placeholder="http://localhost:3335"
            aria-label="Migration studio server URL"
          />
          <button type="button" className="btn" onClick={updateStudioUrl}>
            Use URL
          </button>
          <button type="button" className="btn" onClick={() => probeServer()}>
            Reconnect
          </button>
          <span className="studio-meta-pill"><Database size={13} /> Schema: {schemaStatus}</span>
          <span className="studio-meta-pill">Applied {appliedCount}</span>
          <span className="studio-meta-pill">Pending {pendingCount}</span>
        </div>
        {connectionError ? <p className="studio-error-line"><Unplug size={13} /> {connectionError}</p> : null}
        {flashMessage ? <p className="studio-flash-line">{flashMessage}</p> : null}
      </section>

      <section className="panel">
        <div className="toolbar cluster-row">
          <button type="button" className="btn" onClick={runAnalyze} disabled={!connected}>
            <Sparkles size={14} /> Analyze SQL
          </button>
          <button type="button" className="btn" onClick={wrapTx} disabled={!connected}>
            Wrap in transaction
          </button>
          <button type="button" className="btn btn-primary" onClick={() => saveMigration(false)} disabled={!connected}>
            <Save size={14} /> {canOverwrite ? "Update migration" : "Save as migration"}
          </button>
          <button type="button" className="btn" onClick={() => saveMigration(true)} disabled={!connected}>
            Save as new
          </button>
          <button type="button" className="btn btn-danger" onClick={applyMigrations} disabled={!connected}>
            <Play size={14} /> Apply migrations
          </button>
        </div>
        <div className="chip-bar studio-template-bar">
          {templates.map((template) => (
            <button
              key={template.id}
              type="button"
              className="template-chip"
              title={template.description || ""}
              onClick={() => setSqlText((value) => `${value.trimEnd()}\n\n${template.sql}\n`)}
            >
              {template.name}
            </button>
          ))}
        </div>
      </section>

      <section className="studio-main-grid">
        <article className="panel">
          <div className="panel-head">
            <h3>SQL Editor</h3>
            <span className="hint">{currentMigrationFilename || "Draft"}</span>
          </div>
          <div ref={editorHostRef} className="studio-editor-host" aria-label="Migration SQL editor" />
        </article>

        <article className="panel">
          <div className="tab-row">
            <button
              type="button"
              className={`tab-btn ${activeTab === "migrations" ? "active" : ""}`}
              onClick={() => setActiveTab("migrations")}
            >
              Migrations
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === "schema" ? "active" : ""}`}
              onClick={() => setActiveTab("schema")}
            >
              Schema
            </button>
          </div>
          {activeTab === "migrations" ? (
            <AppDataTable
              rows={migrationRows}
              columns={["filename", "status", "sizeBytes"]}
              onRowClick={(row) => loadMigration(String(row.filename ?? ""), String(row.status ?? "pending"))}
            />
          ) : (
            <AppDataTable rows={schemaRows} columns={["name", "columns", "total_columns"]} />
          )}
        </article>
      </section>

      <section className="studio-bottom-grid">
        <article className="panel">
          <h3>Analysis</h3>
          <pre className="code-block">{analysis ? JSON.stringify(analysis, null, 2) : "Run Analyze SQL to inspect operations and warnings."}</pre>
        </article>
        <article className="panel">
          <h3>Apply output</h3>
          <pre className="code-block">{output || "Apply output will appear here."}</pre>
        </article>
      </section>
    </div>
  );
}
