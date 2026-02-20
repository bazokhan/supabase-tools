/**
 * Schema Builder page — visual forms for creating tables and RLS policies.
 * Calls scaffold HTTP routes on the studio server (port 3335).
 */
import React from "react";
import { AlertTriangle, CheckCircle2, Loader2, Plus, ShieldAlert, Trash2, XCircle } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Column {
  id: string;
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  default: string;
}

type PolicyCommand = "SELECT" | "INSERT" | "UPDATE" | "DELETE" | "ALL";

interface PolicyDef {
  name: string;
  command: PolicyCommand;
  roles: string;
  using: string;
  withCheck: string;
  permissive: boolean;
}

// ---------------------------------------------------------------------------
// SQL preview functions (client-side, mirrors backend logic)
// ---------------------------------------------------------------------------

function buildTableSqlPreview(schema: string, name: string, columns: Column[], enableRls: boolean): string {
  if (!schema || !name || columns.length === 0) return "";
  const pkCols = columns.filter((c) => c.primaryKey).map((c) => c.name);
  const isSinglePk = pkCols.length === 1;

  const colDefs = columns.map((col) => {
    const isPk = pkCols.includes(col.name);
    const colName = col.name || "<name>";
    const colType = col.type || "text";
    let def = `  ${colName} ${colType}`;
    if (isPk && isSinglePk) {
      if (colType === "uuid") {
        def += " PRIMARY KEY DEFAULT gen_random_uuid()";
      } else if (colType === "integer" || colType === "bigint" || colType === "serial" || colType === "bigserial") {
        def += " PRIMARY KEY GENERATED ALWAYS AS IDENTITY";
      } else {
        def += " PRIMARY KEY";
      }
    } else {
      if (!col.nullable) def += " NOT NULL";
      if (col.default) def += ` DEFAULT ${col.default}`;
    }
    return def;
  });

  if (!isSinglePk && pkCols.length > 1) {
    colDefs.push(`  PRIMARY KEY (${pkCols.join(", ")})`);
  }

  let sql = `CREATE TABLE ${schema}.${name} (\n${colDefs.join(",\n")}\n);`;
  if (enableRls) sql += `\nALTER TABLE ${schema}.${name} ENABLE ROW LEVEL SECURITY;`;
  return sql;
}

function buildPolicySqlPreview(entityId: string, policy: PolicyDef): string {
  if (!entityId || !policy.name) return "";
  const parts = entityId.split(".");
  const schema = parts.length >= 2 ? parts[0] : "public";
  const table = parts.length >= 2 ? parts[1] : entityId;
  const permissive = policy.permissive ? "PERMISSIVE" : "RESTRICTIVE";
  const roles = policy.roles
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);

  let sql = `CREATE POLICY "${policy.name}"\n  ON ${schema}.${table}\n  AS ${permissive}\n  FOR ${policy.command}`;
  if (roles.length > 0) sql += `\n  TO ${roles.join(", ")}`;
  if (policy.using && policy.command !== "INSERT") sql += `\n  USING (${policy.using})`;
  if (policy.withCheck && (policy.command === "INSERT" || policy.command === "UPDATE" || policy.command === "ALL")) {
    sql += `\n  WITH CHECK (${policy.withCheck})`;
  }
  sql += ";";
  return sql;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function studioBase(): string {
  return `${window.location.protocol}//${window.location.hostname}:3335`;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const json = (await res.json()) as { error?: string } & T;
    if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
    return json;
  } finally {
    clearTimeout(timeout);
  }
}

let colIdSeq = 0;
function newColId() {
  return `col-${++colIdSeq}`;
}

const SQL_PREVIEW_STYLE: React.CSSProperties = {
  background: "var(--bg-surface, rgba(0,0,0,0.15))",
  padding: "0.75rem 1rem",
  borderRadius: "var(--radius, 6px)",
  fontSize: "0.8rem",
  fontFamily: "var(--font-mono)",
  overflowX: "auto",
  margin: 0,
  border: "1px solid var(--border-muted, rgba(128,128,128,0.2))",
  lineHeight: 1.6,
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: "0.8rem",
  display: "block",
  marginBottom: "0.25rem",
  opacity: 0.65,
};

const COMMON_TYPES = [
  "uuid",
  "text",
  "varchar",
  "integer",
  "bigint",
  "boolean",
  "timestamptz",
  "timestamp",
  "date",
  "numeric",
  "jsonb",
  "json",
];

// ---------------------------------------------------------------------------
// Table Builder
// ---------------------------------------------------------------------------

function SqlPreview({ sql }: { sql: string }) {
  if (!sql) return null;
  return (
    <div style={{ marginTop: "1rem" }}>
      <p style={{ fontSize: "0.8rem", opacity: 0.65, marginBottom: "0.4rem" }}>SQL preview (live)</p>
      <pre style={SQL_PREVIEW_STYLE}>{sql}</pre>
    </div>
  );
}

function SuccessBadge({ message }: { message: string }) {
  return (
    <span className="timestamp-pill" style={{ color: "var(--success, #22c55e)" }}>
      <CheckCircle2 size={12} style={{ display: "inline", marginRight: 4 }} />
      {message}
    </span>
  );
}

function ErrorLine({ message }: { message: string }) {
  return (
    <p className="studio-error-line">
      <XCircle size={13} /> {message}
    </p>
  );
}

function TableBuilder({ base }: { base: string }) {
  const [schema, setSchema] = React.useState("public");
  const [tableName, setTableName] = React.useState("");
  const [columns, setColumns] = React.useState<Column[]>([
    { id: newColId(), name: "id", type: "uuid", nullable: false, primaryKey: true, default: "" },
    { id: newColId(), name: "created_at", type: "timestamptz", nullable: true, primaryKey: false, default: "now()" },
  ]);
  const [enableRls, setEnableRls] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [success, setSuccess] = React.useState("");
  const [error, setError] = React.useState("");

  const sql = buildTableSqlPreview(schema, tableName, columns, enableRls);

  const addColumn = () => {
    setColumns((prev) => [
      ...prev,
      { id: newColId(), name: "", type: "text", nullable: true, primaryKey: false, default: "" },
    ]);
    setSuccess("");
  };

  const removeColumn = (id: string) => {
    setColumns((prev) => prev.filter((c) => c.id !== id));
    setSuccess("");
  };

  const updateColumn = (id: string, field: keyof Column, value: string | boolean) => {
    setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
    setSuccess("");
  };

  const handleGenerate = async () => {
    if (!tableName) {
      setError("Table name is required");
      return;
    }
    if (columns.length === 0) {
      setError("At least one column is required");
      return;
    }
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const result = await requestJson<{ filename: string }>(`${base}/api/studio/scaffold/create-table`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schema,
          name: tableName,
          columns: columns.map((c) => ({
            name: c.name,
            type: c.type,
            nullable: c.nullable,
            primaryKey: c.primaryKey,
            default: c.default || undefined,
          })),
          enableRls,
        }),
      });
      setSuccess(`Written: ${result.filename}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>New Table</h2>
          <p>Design columns and generate a CREATE TABLE migration.</p>
        </div>
        <div className="cluster-row">
          {success ? <SuccessBadge message={success} /> : null}
          <button type="button" className="btn btn-primary" onClick={handleGenerate} disabled={busy || !tableName}>
            {busy ? "Generating…" : "Generate Migration"}
          </button>
        </div>
      </div>

      {error ? <ErrorLine message={error} /> : null}

      <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
        <div>
          <label style={LABEL_STYLE}>Schema</label>
          <input
            className="ui-input"
            value={schema}
            onChange={(e) => {
              setSchema(e.target.value);
              setSuccess("");
            }}
            placeholder="public"
            style={{ width: "100%" }}
          />
        </div>
        <div>
          <label style={LABEL_STYLE}>Table Name</label>
          <input
            className="ui-input"
            value={tableName}
            onChange={(e) => {
              setTableName(e.target.value);
              setSuccess("");
            }}
            placeholder="users"
            style={{ width: "100%" }}
          />
        </div>
      </div>

      <div className="panel-head" style={{ marginBottom: "0.5rem" }}>
        <h3 style={{ margin: 0 }}>Columns</h3>
        <button type="button" className="btn" onClick={addColumn}>
          <Plus size={13} /> Add Column
        </button>
      </div>

      <table className="data-table" style={{ marginBottom: "1rem" }}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th style={{ textAlign: "center" }}>Nullable</th>
            <th style={{ textAlign: "center" }}>Primary Key</th>
            <th>Default</th>
            <th style={{ width: "2.5rem" }}></th>
          </tr>
        </thead>
        <tbody>
          {columns.map((col) => (
            <tr key={col.id}>
              <td>
                <input
                  className="ui-input"
                  value={col.name}
                  onChange={(e) => updateColumn(col.id, "name", e.target.value)}
                  placeholder="column_name"
                  style={{ width: "100%" }}
                />
              </td>
              <td>
                <select
                  className="ui-input"
                  value={col.type}
                  onChange={(e) => updateColumn(col.id, "type", e.target.value)}
                  style={{ width: "100%" }}
                >
                  {COMMON_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </td>
              <td style={{ textAlign: "center" }}>
                <input
                  type="checkbox"
                  checked={col.nullable}
                  onChange={(e) => updateColumn(col.id, "nullable", e.target.checked)}
                />
              </td>
              <td style={{ textAlign: "center" }}>
                <input
                  type="checkbox"
                  checked={col.primaryKey}
                  onChange={(e) => updateColumn(col.id, "primaryKey", e.target.checked)}
                />
              </td>
              <td>
                <input
                  className="ui-input"
                  value={col.default}
                  onChange={(e) => updateColumn(col.id, "default", e.target.value)}
                  placeholder="optional"
                  style={{ width: "100%" }}
                />
              </td>
              <td>
                <button
                  type="button"
                  className="btn"
                  onClick={() => removeColumn(col.id)}
                  style={{ padding: "0.2rem 0.4rem" }}
                  aria-label="Remove column"
                >
                  <Trash2 size={13} />
                </button>
              </td>
            </tr>
          ))}
          {columns.length === 0 ? (
            <tr>
              <td colSpan={6} className="empty-state">
                No columns. Click "Add Column" to begin.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem", fontSize: "0.9rem" }}>
        <input type="checkbox" checked={enableRls} onChange={(e) => setEnableRls(e.target.checked)} />
        Enable Row Level Security
      </label>

      <SqlPreview sql={sql} />
    </section>
  );
}

// ---------------------------------------------------------------------------
// RLS Policy Builder
// ---------------------------------------------------------------------------

function PolicyBuilder({ base }: { base: string }) {
  const [entityId, setEntityId] = React.useState("");
  const [policy, setPolicy] = React.useState<PolicyDef>({
    name: "",
    command: "SELECT",
    roles: "authenticated",
    using: "auth.uid() = id",
    withCheck: "",
    permissive: true,
  });
  const [busy, setBusy] = React.useState(false);
  const [success, setSuccess] = React.useState("");
  const [error, setError] = React.useState("");

  const sql = buildPolicySqlPreview(entityId, policy);
  const showUsing = policy.command !== "INSERT";
  const showWithCheck =
    policy.command === "INSERT" || policy.command === "UPDATE" || policy.command === "ALL";

  const updatePolicy = (field: keyof PolicyDef, value: string | boolean) => {
    setPolicy((prev) => ({ ...prev, [field]: value }));
    setSuccess("");
  };

  const handleGenerate = async () => {
    if (!entityId) {
      setError("Table is required (e.g. public.users)");
      return;
    }
    if (!policy.name) {
      setError("Policy name is required");
      return;
    }
    const roles = policy.roles
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean);
    if (roles.length === 0) {
      setError("At least one role is required");
      return;
    }
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const result = await requestJson<{ filename: string }>(`${base}/api/studio/scaffold/add-rls-policy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId,
          policy: {
            name: policy.name,
            command: policy.command,
            roles,
            using: policy.using || undefined,
            withCheck: policy.withCheck || undefined,
            permissive: policy.permissive,
          },
        }),
      });
      setSuccess(`Written: ${result.filename}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Add RLS Policy</h2>
          <p>Define a row-level security policy and generate a CREATE POLICY migration.</p>
        </div>
        <div className="cluster-row">
          {success ? <SuccessBadge message={success} /> : null}
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleGenerate}
            disabled={busy || !entityId || !policy.name}
          >
            {busy ? "Generating…" : "Generate Migration"}
          </button>
        </div>
      </div>

      {error ? <ErrorLine message={error} /> : null}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
        <div>
          <label style={LABEL_STYLE}>Table (e.g. public.users)</label>
          <input
            className="ui-input"
            value={entityId}
            onChange={(e) => {
              setEntityId(e.target.value);
              setSuccess("");
            }}
            placeholder="public.users"
            style={{ width: "100%" }}
          />
        </div>
        <div>
          <label style={LABEL_STYLE}>Policy Name</label>
          <input
            className="ui-input"
            value={policy.name}
            onChange={(e) => updatePolicy("name", e.target.value)}
            placeholder="users_select_authenticated"
            style={{ width: "100%" }}
          />
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "150px 1fr auto",
          gap: "0.75rem",
          alignItems: "end",
          marginBottom: "0.75rem",
        }}
      >
        <div>
          <label style={LABEL_STYLE}>Command</label>
          <select
            className="ui-input"
            value={policy.command}
            onChange={(e) => updatePolicy("command", e.target.value as PolicyCommand)}
            style={{ width: "100%" }}
          >
            {(["SELECT", "INSERT", "UPDATE", "DELETE", "ALL"] as PolicyCommand[]).map((cmd) => (
              <option key={cmd} value={cmd}>
                {cmd}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={LABEL_STYLE}>Roles (comma-separated)</label>
          <input
            className="ui-input"
            value={policy.roles}
            onChange={(e) => updatePolicy("roles", e.target.value)}
            placeholder="authenticated"
            style={{ width: "100%" }}
          />
        </div>
        <div style={{ paddingBottom: "0.15rem" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.9rem" }}>
            <input
              type="checkbox"
              checked={policy.permissive}
              onChange={(e) => updatePolicy("permissive", e.target.checked)}
            />
            Permissive
          </label>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: showUsing && showWithCheck ? "1fr 1fr" : "1fr",
          gap: "0.75rem",
          marginBottom: "0.75rem",
        }}
      >
        {showUsing ? (
          <div>
            <label style={LABEL_STYLE}>USING expression</label>
            <input
              className="ui-input"
              value={policy.using}
              onChange={(e) => updatePolicy("using", e.target.value)}
              placeholder="auth.uid() = user_id"
              style={{ width: "100%" }}
            />
          </div>
        ) : null}
        {showWithCheck ? (
          <div>
            <label style={LABEL_STYLE}>WITH CHECK expression</label>
            <input
              className="ui-input"
              value={policy.withCheck}
              onChange={(e) => updatePolicy("withCheck", e.target.value)}
              placeholder="auth.uid() = user_id"
              style={{ width: "100%" }}
            />
          </div>
        ) : null}
      </div>

      <SqlPreview sql={sql} />
    </section>
  );
}

// ---------------------------------------------------------------------------
// Function / RPC Builder
// ---------------------------------------------------------------------------

interface FnParam {
  id: string;
  name: string;
  type: string;
}

let paramIdSeq = 0;
function newParamId() {
  return `param-${++paramIdSeq}`;
}

function buildFunctionSqlPreview(
  schema: string,
  name: string,
  params: FnParam[],
  returnType: string,
  language: string,
  security: string,
  body: string
): string {
  if (!name || !returnType) return "";
  const paramStr = params
    .filter((p) => p.name && p.type)
    .map((p) => `  ${p.name} ${p.type}`)
    .join(",\n");
  const secLabel = security === "definer" ? "SECURITY DEFINER" : "SECURITY INVOKER";
  const bodyContent = body.trim() || "-- function body";
  return `CREATE OR REPLACE FUNCTION ${schema || "public"}.${name}(\n${paramStr || "  -- no parameters"}\n)\nRETURNS ${returnType || "void"}\nLANGUAGE ${language}\n${secLabel}\nAS $$\n${bodyContent}\n$$;`;
}

function buildViewSqlPreview(schema: string, name: string, query: string): string {
  if (!name || !query.trim()) return "";
  return `CREATE OR REPLACE VIEW ${schema || "public"}.${name} AS\n${query.trim()};`;
}

function FunctionBuilder({ base, rpcMode }: { base: string; rpcMode?: boolean }) {
  const [schema, setSchema] = React.useState("public");
  const [fnName, setFnName] = React.useState("");
  const [params, setParams] = React.useState<FnParam[]>([]);
  const [returnType, setReturnType] = React.useState("void");
  const [language, setLanguage] = React.useState<"sql" | "plpgsql">("plpgsql");
  const [security, setSecurity] = React.useState<"invoker" | "definer">("invoker");
  const [body, setBody] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [success, setSuccess] = React.useState("");
  const [error, setError] = React.useState("");

  const sql = buildFunctionSqlPreview(rpcMode ? "public" : schema, fnName, params, returnType, language, security, body);
  const route = rpcMode ? "/api/studio/scaffold/create-rpc" : "/api/studio/scaffold/add-function";
  const title = rpcMode ? "Create RPC Function" : "Add Function";

  const addParam = () => {
    setParams((prev) => [...prev, { id: newParamId(), name: "", type: "text" }]);
    setSuccess("");
  };
  const removeParam = (id: string) => {
    setParams((prev) => prev.filter((p) => p.id !== id));
    setSuccess("");
  };
  const updateParam = (id: string, field: "name" | "type", value: string) => {
    setParams((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
    setSuccess("");
  };

  const handleGenerate = async () => {
    if (!fnName) {
      setError("Function name is required");
      return;
    }
    if (!body.trim()) {
      setError("Function body is required");
      return;
    }
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const payload: Record<string, unknown> = {
        name: fnName,
        params: params.filter((p) => p.name && p.type).map((p) => ({ name: p.name, type: p.type })),
        returnType,
        language,
        body,
        security,
      };
      if (!rpcMode) payload.schema = schema;
      const result = await requestJson<{ filename: string }>(`${base}${route}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setSuccess(`Written: ${result.filename}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>{title}</h2>
          <p>
            {rpcMode
              ? "Design a public-schema RPC function for PostgREST and generate a CREATE OR REPLACE FUNCTION migration."
              : "Design a stored function and generate a CREATE OR REPLACE FUNCTION migration."}
          </p>
        </div>
        <div className="cluster-row">
          {success ? <SuccessBadge message={success} /> : null}
          <button type="button" className="btn btn-primary" onClick={handleGenerate} disabled={busy || !fnName || !body.trim()}>
            {busy ? "Generating…" : "Generate Migration"}
          </button>
        </div>
      </div>

      {error ? <ErrorLine message={error} /> : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: rpcMode ? "1fr 1fr" : "140px 1fr 1fr",
          gap: "0.75rem",
          marginBottom: "0.75rem",
        }}
      >
        {!rpcMode && (
          <div>
            <label style={LABEL_STYLE}>Schema</label>
            <input
              className="ui-input"
              value={schema}
              onChange={(e) => { setSchema(e.target.value); setSuccess(""); }}
              placeholder="public"
              style={{ width: "100%" }}
            />
          </div>
        )}
        <div>
          <label style={LABEL_STYLE}>Function Name</label>
          <input
            className="ui-input"
            value={fnName}
            onChange={(e) => { setFnName(e.target.value); setSuccess(""); }}
            placeholder={rpcMode ? "get_user_profile" : "compute_stats"}
            style={{ width: "100%" }}
          />
        </div>
        <div>
          <label style={LABEL_STYLE}>Returns</label>
          <input
            className="ui-input"
            value={returnType}
            onChange={(e) => { setReturnType(e.target.value); setSuccess(""); }}
            placeholder="void"
            style={{ width: "100%" }}
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
        <div>
          <label style={LABEL_STYLE}>Language</label>
          <select
            className="ui-input"
            value={language}
            onChange={(e) => { setLanguage(e.target.value as "sql" | "plpgsql"); setSuccess(""); }}
            style={{ width: "100%" }}
          >
            <option value="plpgsql">plpgsql</option>
            <option value="sql">sql</option>
          </select>
        </div>
        <div>
          <label style={LABEL_STYLE}>Security</label>
          <select
            className="ui-input"
            value={security}
            onChange={(e) => { setSecurity(e.target.value as "invoker" | "definer"); setSuccess(""); }}
            style={{ width: "100%" }}
          >
            <option value="invoker">SECURITY INVOKER (recommended)</option>
            <option value="definer">SECURITY DEFINER</option>
          </select>
        </div>
      </div>

      <div className="panel-head" style={{ marginBottom: "0.5rem" }}>
        <h3 style={{ margin: 0 }}>Parameters</h3>
        <button type="button" className="btn" onClick={addParam}>
          <Plus size={13} /> Add Parameter
        </button>
      </div>

      {params.length > 0 ? (
        <table className="data-table" style={{ marginBottom: "0.75rem" }}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th style={{ width: "2.5rem" }}></th>
            </tr>
          </thead>
          <tbody>
            {params.map((p) => (
              <tr key={p.id}>
                <td>
                  <input
                    className="ui-input"
                    value={p.name}
                    onChange={(e) => updateParam(p.id, "name", e.target.value)}
                    placeholder="param_name"
                    style={{ width: "100%" }}
                  />
                </td>
                <td>
                  <input
                    className="ui-input"
                    value={p.type}
                    onChange={(e) => updateParam(p.id, "type", e.target.value)}
                    placeholder="uuid"
                    style={{ width: "100%" }}
                  />
                </td>
                <td>
                  <button type="button" className="btn" onClick={() => removeParam(p.id)} style={{ padding: "0.2rem 0.4rem" }}>
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p style={{ fontSize: "0.8rem", opacity: 0.55, marginBottom: "0.75rem" }}>No parameters. Click "Add Parameter" to add arguments.</p>
      )}

      <div style={{ marginBottom: "0.75rem" }}>
        <label style={LABEL_STYLE}>Function Body</label>
        <textarea
          className="ui-input"
          value={body}
          onChange={(e) => { setBody(e.target.value); setSuccess(""); }}
          placeholder={language === "plpgsql" ? "BEGIN\n  -- your code here\n  RETURN NULL;\nEND;" : "SELECT $1::text;"}
          rows={6}
          style={{ width: "100%", fontFamily: "var(--font-mono)", fontSize: "0.8rem", resize: "vertical" }}
        />
      </div>

      <SqlPreview sql={sql} />
    </section>
  );
}

// ---------------------------------------------------------------------------
// View Builder
// ---------------------------------------------------------------------------

function ViewBuilder({ base }: { base: string }) {
  const [schema, setSchema] = React.useState("public");
  const [viewName, setViewName] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [success, setSuccess] = React.useState("");
  const [error, setError] = React.useState("");

  const sql = buildViewSqlPreview(schema, viewName, query);

  const handleGenerate = async () => {
    if (!viewName) {
      setError("View name is required");
      return;
    }
    if (!query.trim()) {
      setError("SELECT query is required");
      return;
    }
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const result = await requestJson<{ filename: string }>(`${base}/api/studio/scaffold/create-view`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schema, name: viewName, query }),
      });
      setSuccess(`Written: ${result.filename}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Create View</h2>
          <p>Define a SELECT query and generate a CREATE OR REPLACE VIEW migration.</p>
        </div>
        <div className="cluster-row">
          {success ? <SuccessBadge message={success} /> : null}
          <button type="button" className="btn btn-primary" onClick={handleGenerate} disabled={busy || !viewName || !query.trim()}>
            {busy ? "Generating…" : "Generate Migration"}
          </button>
        </div>
      </div>

      {error ? <ErrorLine message={error} /> : null}

      <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
        <div>
          <label style={LABEL_STYLE}>Schema</label>
          <input
            className="ui-input"
            value={schema}
            onChange={(e) => { setSchema(e.target.value); setSuccess(""); }}
            placeholder="public"
            style={{ width: "100%" }}
          />
        </div>
        <div>
          <label style={LABEL_STYLE}>View Name</label>
          <input
            className="ui-input"
            value={viewName}
            onChange={(e) => { setViewName(e.target.value); setSuccess(""); }}
            placeholder="active_users"
            style={{ width: "100%" }}
          />
        </div>
      </div>

      <div style={{ marginBottom: "0.75rem" }}>
        <label style={LABEL_STYLE}>SELECT Query</label>
        <textarea
          className="ui-input"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSuccess(""); }}
          placeholder={"SELECT id, email, full_name\nFROM users\nWHERE active = true\nORDER BY created_at DESC"}
          rows={5}
          style={{ width: "100%", fontFamily: "var(--font-mono)", fontSize: "0.8rem", resize: "vertical" }}
        />
      </div>

      <SqlPreview sql={sql} />
    </section>
  );
}

// ---------------------------------------------------------------------------
// Project Setup panel
// ---------------------------------------------------------------------------

interface GraphStatus {
  mode: "greenfield" | "brownfield-managed" | "brownfield-assisted" | null;
  entities: number;
}

function ProjectSetup({ base, onInit }: { base: string; onInit: () => void }) {
  const [status, setStatus] = React.useState<GraphStatus | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  const fetchStatus = React.useCallback(async () => {
    try {
      const data = await requestJson<{ entities?: unknown[]; mode?: string } | null>(
        `${base}/api/studio/intent-graph`
      );
      if (data?.mode) {
        setStatus({ mode: data.mode as GraphStatus["mode"], entities: Array.isArray(data.entities) ? data.entities.length : 0 });
      } else {
        setStatus({ mode: null, entities: 0 });
      }
    } catch {
      setStatus({ mode: null, entities: 0 });
    } finally {
      setLoading(false);
    }
  }, [base]);

  React.useEffect(() => {
    fetchStatus().catch(() => setLoading(false));
  }, [fetchStatus]);

  const handleInit = async () => {
    setBusy(true);
    setError("");
    try {
      await requestJson(`${base}/api/studio/greenfield-init`, { method: "POST" });
      await fetchStatus();
      onInit();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <section className="panel">
        <p className="empty-state">
          <Loader2 size={14} className="studio-spin" style={{ display: "inline", marginRight: 6 }} />
          Checking intent graph…
        </p>
      </section>
    );
  }

  const modeLabel =
    status?.mode === "greenfield"
      ? "Greenfield"
      : status?.mode === "brownfield-managed"
      ? "Brownfield (managed)"
      : status?.mode === "brownfield-assisted"
      ? "Brownfield (assisted)"
      : null;

  return (
    <section className="panel panel-accent">
      <div className="panel-head">
        <div>
          <h2>Project Setup</h2>
          <p>
            {modeLabel
              ? `Intent graph active — ${modeLabel} · ${status?.entities ?? 0} entities`
              : "No intent graph found. Initialize a greenfield project or run studio-adopt for brownfield projects."}
          </p>
        </div>
        <div className="cluster-row">
          {modeLabel ? (
            <span className="timestamp-pill">
              <CheckCircle2 size={12} style={{ display: "inline", marginRight: 4 }} />
              {modeLabel}
            </span>
          ) : (
            <button type="button" className="btn btn-primary" onClick={handleInit} disabled={busy}>
              {busy ? (
                <>
                  <Loader2 size={13} className="studio-spin" /> Initializing…
                </>
              ) : (
                "Initialize Greenfield Project"
              )}
            </button>
          )}
        </div>
      </div>
      {error ? <ErrorLine message={error} /> : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Release Gate panel
// ---------------------------------------------------------------------------

interface GateBlocking {
  code: string;
  severity: string;
  message: string;
}

interface GateState {
  status: "pass" | "fail";
  blocking: GateBlocking[];
  warnings: Array<{ code: string; message: string }>;
  evidence: Array<{ id: string }>;
}

function ReleaseGatePanel({ base }: { base: string }) {
  const [gate, setGate] = React.useState<GateState | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  const runGate = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await requestJson<GateState>(`${base}/api/studio/release-gate`, { method: "POST" });
      setGate(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setLoading(false);
    }
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Release Gate</h2>
          <p>Aggregate validation results before applying migrations.</p>
        </div>
        <div className="cluster-row">
          {gate ? (
            <span
              className="timestamp-pill"
              style={{ color: gate.status === "pass" ? "var(--success, #22c55e)" : "var(--danger, #ef4444)" }}
            >
              {gate.status === "pass" ? (
                <CheckCircle2 size={12} style={{ display: "inline", marginRight: 4 }} />
              ) : (
                <ShieldAlert size={12} style={{ display: "inline", marginRight: 4 }} />
              )}
              {gate.status === "pass" ? "PASS" : "FAIL"}
            </span>
          ) : null}
          <button type="button" className="btn" onClick={runGate} disabled={busy || loading}>
            {busy ? (
              <>
                <Loader2 size={13} className="studio-spin" /> Running…
              </>
            ) : (
              "Run Gate"
            )}
          </button>
        </div>
      </div>

      {error ? <ErrorLine message={error} /> : null}

      {gate ? (
        <div>
          {gate.blocking.length > 0 ? (
            <div style={{ marginBottom: "0.75rem" }}>
              <p style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem", color: "var(--danger, #ef4444)" }}>
                Blocking issues ({gate.blocking.length})
              </p>
              {gate.blocking.map((b, i) => (
                <p key={i} className="studio-error-line">
                  <XCircle size={13} /> [{b.code}] {b.message}
                </p>
              ))}
            </div>
          ) : null}

          {gate.warnings.length > 0 ? (
            <div style={{ marginBottom: "0.75rem" }}>
              <p style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem" }}>
                Warnings ({gate.warnings.length})
              </p>
              {gate.warnings.map((w, i) => (
                <p key={i} style={{ fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <AlertTriangle size={13} style={{ flexShrink: 0 }} /> [{w.code}] {w.message}
                </p>
              ))}
            </div>
          ) : null}

          {gate.status === "pass" && gate.blocking.length === 0 ? (
            <p style={{ fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.4rem", color: "var(--success, #22c55e)" }}>
              <CheckCircle2 size={13} /> Gate passed — {gate.evidence.length} evidence artifact(s) checked.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="empty-state">Click "Run Gate" to validate before applying.</p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function SchemaBuilderPage() {
  const base = studioBase();
  const [refreshKey, setRefreshKey] = React.useState(0);

  return (
    <div className="content-stack">
      <ProjectSetup base={base} onInit={() => setRefreshKey((k) => k + 1)} />
      <TableBuilder base={base} key={`table-${refreshKey}`} />
      <PolicyBuilder base={base} />
      <FunctionBuilder base={base} />
      <FunctionBuilder base={base} rpcMode />
      <ViewBuilder base={base} />
      <ReleaseGatePanel base={base} />
    </div>
  );
}
