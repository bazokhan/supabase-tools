/**
 * Adoption page — brownfield adoption workflow, intent graph, validation, and business metrics.
 * Tabbed layout: Readiness | Progress | Risk | API Surface | Overview | Entities | Graph | Endpoints | Policies | Opaque | Tools
 */
import React from "react";
import {
  IconAlert,
  IconCheck,
  IconLoader,
  IconMap,
  IconPlay,
  IconPolicy,
  IconRefresh,
  IconX,
} from "../components/Icons";
import { MiniBarChart } from "../components/MiniBarChart";
import { MiniDonutChart } from "../components/MiniDonutChart";
import { MermaidRenderer } from "../components/MermaidRenderer";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkflowStep {
  stepId: string;
  status: "completed" | "failed" | "skipped";
  error?: string;
  startedAt: string;
  completedAt: string;
}

interface WorkflowRun {
  id: string;
  workflowId: string;
  status: "running" | "waiting_checkpoint" | "failed" | "completed";
  currentStep: number;
  steps: WorkflowStep[];
  createdAt: string;
  updatedAt: string;
}

interface IntentEntity {
  id: string;
  schema: string;
  name: string;
  managedStatus: string;
  confidence: number;
  columns?: { name: string; type: string }[];
  constraints?: { type: string; references?: { schema: string; table: string } }[];
}

interface PolicyNode {
  id: string;
  entity: string;
  name: string;
  command: string;
  roles: string[];
  managedStatus: string;
}

interface FunctionNode {
  id: string;
  schema: string;
  name: string;
  managedStatus: string;
  security?: string;
}

interface TriggerNode {
  id: string;
  entity: string;
  name: string;
  function: string;
  managedStatus: string;
}

interface EndpointNode {
  id: string;
  type: string;
  entity: string;
  exposedVia: string;
  allowedRoles: string[];
  operations: string[];
}

interface OpaqueBlock {
  id: string;
  rawSql: string;
  sourceSpan: { file: string; startLine: number; endLine: number };
  touchedObjects: string[];
  reason: string;
  astAvailable: boolean;
}

interface IntentGraph {
  version?: string;
  mode?: string;
  entities: IntentEntity[];
  views?: { id: string; schema: string; name: string; managedStatus: string }[];
  functions?: FunctionNode[];
  triggers?: TriggerNode[];
  policies?: PolicyNode[];
  endpoints?: EndpointNode[];
  opaqueBlocks?: OpaqueBlock[];
}

interface ReleaseGate {
  status: "pass" | "fail";
  blocking: { code: string; message: string; remediation?: string }[];
  warnings: { code: string; message: string }[];
  evidence: { id: string }[];
  generatedAt?: string;
}

interface RlsReportData {
  checkedAt: string;
  status: "pass" | "fail";
  gaps: { entityId: string; missingCommands: string[]; reason: string }[];
  entitiesChecked: number;
  tablesWithRls: number;
  tablesWithoutRls: number;
}

interface MigrationLintData {
  lintedAt: string;
  status: "pass" | "fail";
  findings: { code: string; severity: string; message: string }[];
  errorCount: number;
  warningCount: number;
}

interface RpcPlanData {
  generatedAt: string;
  functions: { functionId: string; lintWarnings: string[] }[];
  securityDefinerCount: number;
  missingSearchPathCount: number;
}

interface MigrationPlanData {
  generatedAt: string;
  changes: { objectId: string; changeClass: string; description: string }[];
  totalChanges: number;
  destructiveCount: number;
  expandContractCount: number;
}

const STEPS = [
  { id: "introspect", label: "introspect", artifact: "studio.schema.snapshot" },
  { id: "sql-parse", label: "sql-parse", artifact: "studio.sql.ast" },
  { id: "intent-sync", label: "intent-sync", artifact: "studio.intent.sync-report" },
  { id: "intent-init", label: "intent-init", artifact: "studio.intent.graph" },
];

const STATUS_COLORS: Record<string, string> = {
  managed: "var(--color-success, #22c55e)",
  assisted: "var(--color-warn, #f59e0b)",
  opaque: "var(--color-muted, #6b7280)",
  excluded: "var(--color-danger, #ef4444)",
};

const TABS = [
  { id: "readiness", label: "Readiness" },
  { id: "progress", label: "Progress" },
  { id: "risk", label: "Risk" },
  { id: "api", label: "API Surface" },
  { id: "overview", label: "Overview" },
  { id: "entities", label: "Entities" },
  { id: "graph", label: "Graph" },
  { id: "endpoints", label: "Endpoints" },
  { id: "policies", label: "Policies" },
  { id: "opaque", label: "Opaque" },
  { id: "tools", label: "Tools" },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ---------------------------------------------------------------------------
// Helpers
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

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "1px 7px",
        borderRadius: 10,
        fontSize: "0.75rem",
        fontWeight: 600,
        color: "#fff",
        background: STATUS_COLORS[status] ?? "var(--color-muted, #6b7280)",
      }}
    >
      {status}
    </span>
  );
}

function buildIntentMermaidEr(entities: IntentEntity[]): string {
  if (entities.length === 0) return "";
  const lines: string[] = ["erDiagram"];
  const seen = new Set<string>();
  for (const e of entities) {
    const tableName = e.name.replace(/-/g, "_");
    if (seen.has(tableName)) continue;
    seen.add(tableName);
    lines.push(`    ${tableName} {`);
    for (const col of e.columns ?? []) {
      const t = (col.type || "text").replace(/-/g, "_");
      lines.push(`        ${col.name} ${t}`);
    }
    lines.push("    }");
  }
  for (const e of entities) {
    const refs = e.constraints?.filter((c) => c.type === "foreign_key" && c.references) ?? [];
    for (const r of refs) {
      if (!r.references) continue;
      const src = e.name.replace(/-/g, "_");
      const tgt = r.references.table.replace(/-/g, "_");
      lines.push(`    ${src} ||--o{ ${tgt} : "fk"`);
    }
  }
  return lines.join("\n");
}

function buildAdoptionWorkflowMermaid(run: WorkflowRun | null): string {
  const checkpoints = [
    { after: "sql-parse", id: "ck_review", label: "review" },
    { after: "intent-sync", id: "ck_approve", label: "approve" },
  ];
  const lines = ["flowchart LR"];
  for (let i = 0; i < STEPS.length; i++) {
    const s = STEPS[i];
    const nodeId = s.id.replace(/-/g, "_");
    lines.push(`    ${nodeId}["${s.label}"]`);
  }
  for (const cp of checkpoints) {
    lines.push(`    ${cp.id}["${cp.label}"]`);
  }
  // Edges: introspect -> sql_parse -> ck_review -> intent_sync -> ck_approve -> intent_init
  let prev = "introspect";
  for (let i = 1; i < STEPS.length; i++) {
    const cp = checkpoints.find((c) => c.after === STEPS[i - 1].id);
    const nextStep = STEPS[i];
    const nextId = nextStep.id.replace(/-/g, "_");
    const prevId = prev.replace(/-/g, "_");
    if (cp) {
      lines.push(`    ${prevId} --> ${cp.id}`);
      lines.push(`    ${cp.id} --> ${nextId}`);
      prev = nextStep.id;
    } else {
      lines.push(`    ${prevId} --> ${nextId}`);
      prev = nextStep.id;
    }
  }
  return lines.join("\n");
}

function buildValidationPipelineMermaid(evidence: { id: string }[]): string {
  const ids = ["rls", "rpc", "lint", "gate"];
  const hasRls = evidence.some((e) => e.id?.includes("rls"));
  const hasRpc = evidence.some((e) => e.id?.includes("rpc"));
  const hasLint = evidence.some((e) => e.id?.includes("migration"));
  const lines = ["flowchart LR"];
  lines.push(`    rls["rls-check"]`);
  lines.push(`    rpc["rpc-lint"]`);
  lines.push(`    lint["migration-lint"]`);
  lines.push(`    gate["release-gate"]`);
  lines.push(`    rls --> gate`);
  lines.push(`    rpc --> gate`);
  lines.push(`    lint --> gate`);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Adoption Page
// ---------------------------------------------------------------------------

export function AdoptionPage() {
  const [run, setRun] = React.useState<WorkflowRun | { status: "not_started" } | null>(null);
  const [graph, setGraph] = React.useState<IntentGraph | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string>("");
  const [busy, setBusy] = React.useState(false);
  const [patching, setPatching] = React.useState<Set<string>>(new Set());
  const [mappingEndpoints, setMappingEndpoints] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<TabId>("readiness");
  const [gate, setGate] = React.useState<ReleaseGate | null>(null);
  const [gateBusy, setGateBusy] = React.useState(false);
  const [rlsReport, setRlsReport] = React.useState<{ report: RlsReportData } | null>(null);
  const [lintData, setLintData] = React.useState<MigrationLintData | null>(null);
  const [rpcData, setRpcData] = React.useState<RpcPlanData | null>(null);
  const [planData, setPlanData] = React.useState<MigrationPlanData | null>(null);
  const [riskBusy, setRiskBusy] = React.useState(false);
  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const isDark = document.documentElement.classList.contains("dark");
  const base = studioBase();

  const fetchStatus = React.useCallback(async () => {
    try {
      const data = await requestJson<WorkflowRun | { status: "not_started" }>(`${base}/api/studio/adopt/status`);
      setRun(data);
    } catch (e) {
      setError((e as Error).message);
      setRun({ status: "not_started" });
    }
  }, [base]);

  const fetchIntentGraph = React.useCallback(async () => {
    try {
      const data = await requestJson<IntentGraph | null>(`${base}/api/studio/intent-graph`);
      setGraph(data ?? null);
    } catch {
      setGraph(null);
    }
  }, [base]);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError("");
    await Promise.all([fetchStatus(), fetchIntentGraph()]);
    setLoading(false);
  }, [fetchStatus, fetchIntentGraph]);

  React.useEffect(() => {
    refresh().catch(() => setLoading(false));
  }, [refresh]);

  React.useEffect(() => {
    if (run && "status" in run && run.status === "running") {
      pollRef.current = setInterval(fetchStatus, 3000);
    } else {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [run, fetchStatus]);

  const handleStart = async () => {
    setBusy(true);
    setError("");
    try {
      const data = await requestJson<WorkflowRun>(`${base}/api/studio/adopt/start`, { method: "POST" });
      setRun(data);
      await fetchIntentGraph();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleResume = async () => {
    setBusy(true);
    setError("");
    try {
      const data = await requestJson<WorkflowRun>(`${base}/api/studio/adopt/resume`, { method: "POST" });
      setRun(data);
      await fetchIntentGraph();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handlePatchEntity = async (entityId: string, action: "exclude" | "set-status", status?: string) => {
    setPatching((prev) => new Set(prev).add(entityId));
    try {
      await requestJson(`${base}/api/studio/intent-graph/entity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId, action, status }),
      });
      await fetchIntentGraph();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPatching((prev) => {
        const next = new Set(prev);
        next.delete(entityId);
        return next;
      });
    }
  };

  const handleMapEndpoints = async () => {
    setMappingEndpoints(true);
    setError("");
    try {
      await requestJson(`${base}/api/studio/endpoint-map`, { method: "POST" });
      await fetchIntentGraph();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setMappingEndpoints(false);
    }
  };

  const handleRunGate = async () => {
    setGateBusy(true);
    setError("");
    try {
      const result = await requestJson<ReleaseGate>(`${base}/api/studio/release-gate`, { method: "POST" });
      setGate(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGateBusy(false);
    }
  };

  const handleRunRiskValidation = async () => {
    setRiskBusy(true);
    setError("");
    try {
      const [rls, lint, rpc, plan] = await Promise.all([
        requestJson<{ report: RlsReportData }>(`${base}/api/studio/rls-check`, { method: "POST" }).catch(() => null),
        requestJson<MigrationLintData>(`${base}/api/studio/migration-lint`, { method: "POST" }).catch(() => null),
        requestJson<RpcPlanData>(`${base}/api/studio/rpc-lint`, { method: "POST" }).catch(() => null),
        requestJson<MigrationPlanData>(`${base}/api/studio/migration-plan`, { method: "POST" }).catch(() => null),
      ]);
      setRlsReport(rls ?? null);
      setLintData(lint ?? null);
      setRpcData(rpc ?? null);
      setPlanData(plan ?? null);
      await handleRunGate();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRiskBusy(false);
    }
  };

  // All hooks must run unconditionally (before any early return)
  const status = run && "status" in run ? run.status : "not_started";
  const workflowRun = run && "steps" in run ? run : null;
  const entities = graph?.entities ?? [];
  const policies = graph?.policies ?? [];
  const triggers = graph?.triggers ?? [];
  const endpoints = graph?.endpoints ?? [];
  const opaqueBlocks = graph?.opaqueBlocks ?? [];

  const managedByStatus = React.useMemo(() => {
    const counts: Record<string, number> = { managed: 0, assisted: 0, opaque: 0, excluded: 0 };
    for (const e of entities) {
      counts[e.managedStatus] = (counts[e.managedStatus] ?? 0) + 1;
    }
    return Object.entries(counts).filter(([, v]) => v > 0).map(([k, v]) => ({ label: k, value: v }));
  }, [entities]);

  const entitiesBySchema = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entities) {
      m.set(e.schema, (m.get(e.schema) ?? 0) + 1);
    }
    return Array.from(m.entries()).map(([k, v]) => ({ label: k, value: v })).sort((a, b) => b.value - a.value);
  }, [entities]);

  const confidenceBuckets = React.useMemo(() => {
    const b = { low: 0, mid: 0, high: 0 };
    for (const e of entities) {
      if (e.confidence < 0.5) b.low++;
      else if (e.confidence < 0.8) b.mid++;
      else b.high++;
    }
    return [
      { label: "0–0.5", value: b.low },
      { label: "0.5–0.8", value: b.mid },
      { label: "0.8–1.0", value: b.high },
    ].filter((x) => x.value > 0);
  }, [entities]);

  const workflowProgress =
    workflowRun && workflowRun.steps
      ? Math.round((workflowRun.steps.filter((s) => s.status === "completed").length / STEPS.length) * 100)
      : 0;

  const endpointTypeBreakdown = React.useMemo(() => {
    const table = endpoints.filter((e) => e.type === "table-crud").length;
    const rpc = endpoints.filter((e) => e.type === "rpc").length;
    const view = endpoints.filter((e) => e.type === "view").length;
    return [
      { label: "table-crud", value: table, color: "var(--success)" },
      { label: "rpc", value: rpc, color: "var(--accent)" },
      { label: "view", value: view, color: "var(--warning)" },
    ].filter((x) => x.value > 0);
  }, [endpoints]);

  const policyCommandBreakdown = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const p of policies) {
      m.set(p.command, (m.get(p.command) ?? 0) + 1);
    }
    return Array.from(m.entries()).map(([k, v]) => ({ label: k, value: v })).sort((a, b) => b.value - a.value);
  }, [policies]);

  const policiesPerEntity = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const p of policies) {
      m.set(p.entity, (m.get(p.entity) ?? 0) + 1);
    }
    return Array.from(m.entries()).map(([k, v]) => ({ label: k, value: v })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [policies]);

  const opaqueReasonBreakdown = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const o of opaqueBlocks) {
      m.set(o.reason, (m.get(o.reason) ?? 0) + 1);
    }
    return Array.from(m.entries()).map(([k, v]) => ({ label: k, value: v }));
  }, [opaqueBlocks]);

  const entityPolicyCount = (entityId: string) => policies.filter((p) => p.entity === entityId).length;
  const entityTriggerCount = (entityId: string) => triggers.filter((t) => t.entity === entityId).length;

  const managedCount = entities.filter((e) => e.managedStatus === "managed").length;
  const endpointCoverage = managedCount > 0 ? Math.round((endpoints.filter((e) => e.type === "table-crud").length / managedCount) * 100) : 0;

  const isWaiting = status === "waiting_checkpoint";
  const isFailed = status === "failed";

  if (loading) {
    return (
      <section className="panel">
        <p className="empty-state">
          <IconLoader size={14} className="studio-spin" style={{ display: "inline", marginRight: 6 }} />
          Connecting to Migration Studio...
        </p>
      </section>
    );
  }

  return (
    <div className="content-stack">
      <section className="panel panel-accent">
        <div className="panel-head">
          <div>
            <h2>Adoption Workflow</h2>
            <p>Brownfield adoption: introspect DB, parse migrations, sync intent, build graph.</p>
          </div>
          <div className="cluster-row">
            <span className="timestamp-pill" aria-live="polite">
              Status: {status}
            </span>
            {endpoints.length > 0 && (
              <span className="timestamp-pill">
                {endpoints.length} endpoint(s) ({endpoints.filter((e) => e.type === "table-crud").length} table-crud, {endpoints.filter((e) => e.type === "rpc").length} rpc)
              </span>
            )}
            {status === "not_started" && (
              <button type="button" className="btn btn-primary" onClick={handleStart} disabled={busy}>
                <IconPlay size={14} /> Start Adoption
              </button>
            )}
            {isWaiting && (
              <button type="button" className="btn btn-primary" onClick={handleResume} disabled={busy}>
                <IconRefresh size={14} /> Resume
              </button>
            )}
            {isFailed && (
              <button type="button" className="btn" onClick={handleStart} disabled={busy}>
                <IconRefresh size={14} /> Restart
              </button>
            )}
            {entities.length > 0 && (
              <button type="button" className="btn" onClick={handleMapEndpoints} disabled={mappingEndpoints}>
                {mappingEndpoints ? <IconLoader size={14} className="studio-spin" /> : <IconMap size={14} />} Map Endpoints
              </button>
            )}
          </div>
        </div>
        {error ? (
          <p className="studio-error-line">
            <IconX size={13} /> {error}
          </p>
        ) : null}
      </section>

      {/* Tabs */}
      <section className="panel">
        <div className="adoption-tabs" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`adoption-tab ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="adoption-tab-content">
          {activeTab === "readiness" && (
            <ReadinessTab gate={gate} gateBusy={gateBusy} onRunGate={handleRunGate} />
          )}
          {activeTab === "progress" && (
            <ProgressTab
              workflowRun={workflowRun}
              workflowProgress={workflowProgress}
              managedByStatus={managedByStatus}
              entities={entities}
            />
          )}
          {activeTab === "risk" && (
            <RiskTab
              gate={gate}
              rlsReport={rlsReport}
              lintData={lintData}
              rpcData={rpcData}
              planData={planData}
              opaqueBlocks={opaqueBlocks}
              riskBusy={riskBusy}
              onRunValidation={handleRunRiskValidation}
            />
          )}
          {activeTab === "api" && (
            <ApiSurfaceTab endpoints={endpoints} entities={entities} endpointCoverage={endpointCoverage} managedCount={managedCount} />
          )}
          {activeTab === "overview" && (
            <OverviewTab
              entities={entities}
              managedByStatus={managedByStatus}
              entitiesBySchema={entitiesBySchema}
              confidenceBuckets={confidenceBuckets}
              policies={policies}
              endpoints={endpoints}
              opaqueBlocks={opaqueBlocks}
            />
          )}
          {activeTab === "entities" && (
            <EntitiesTab
              entities={entities}
              entityPolicyCount={entityPolicyCount}
              entityTriggerCount={entityTriggerCount}
              patching={patching}
              onPatch={handlePatchEntity}
            />
          )}
          {activeTab === "graph" && <GraphTab entities={entities} isDark={isDark} />}
          {activeTab === "endpoints" && (
            <EndpointsTab endpoints={endpoints} endpointTypeBreakdown={endpointTypeBreakdown} entitiesBySchema={entitiesBySchema} />
          )}
          {activeTab === "policies" && (
            <PoliciesTab policies={policies} policiesPerEntity={policiesPerEntity} policyCommandBreakdown={policyCommandBreakdown} />
          )}
          {activeTab === "opaque" && opaqueBlocks.length > 0 && (
            <OpaqueTab opaqueBlocks={opaqueBlocks} opaqueReasonBreakdown={opaqueReasonBreakdown} />
          )}
          {activeTab === "opaque" && opaqueBlocks.length === 0 && (
            <p className="empty-state">No opaque blocks. All SQL regions were modeled in the intent graph.</p>
          )}
          {activeTab === "tools" && (
            <ToolsTab workflowRun={workflowRun} gate={gate} buildAdoptionWorkflowMermaid={buildAdoptionWorkflowMermaid} buildValidationPipelineMermaid={buildValidationPipelineMermaid} isDark={isDark} />
          )}
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab Components
// ---------------------------------------------------------------------------

function parseRlsGapMessage(message: string): { entityId: string; commands: string[] } | null {
  const entityMatch = message.match(/^([^:]+):\s*missing RLS policies/);
  const bracketMatch = message.match(/\[([^\]]+)\]/);
  if (!entityMatch || !bracketMatch) return null;
  const commands = bracketMatch[1].split(",").map((c) => c.trim()).filter(Boolean);
  return { entityId: entityMatch[1].trim(), commands };
}

function ReadinessTab({
  gate,
  gateBusy,
  onRunGate,
}: {
  gate: ReleaseGate | null;
  gateBusy: boolean;
  onRunGate: () => void;
}) {
  return (
    <div className="adoption-tab-body">
      <h3>Release Readiness</h3>
      <p style={{ fontSize: "0.9rem", marginBottom: "1rem", color: "var(--text-muted)" }}>
        Aggregate validation results before applying migrations. Blocking issues must be resolved.
      </p>
      <div className="cluster-row" style={{ marginBottom: "1rem" }}>
        <button type="button" className="btn btn-primary" onClick={onRunGate} disabled={gateBusy}>
          {gateBusy ? <IconLoader size={14} className="studio-spin" /> : <IconPolicy size={14} />} Run Gate
        </button>
      </div>
      {gate ? (
        <div>
          <div className="readiness-badge" style={{ background: gate.status === "pass" ? "var(--success)" : "var(--danger)", color: "#fff", padding: "0.5rem 1rem", borderRadius: 8, display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 600, marginBottom: "1rem" }}>
            {gate.status === "pass" ? <IconCheck size={18} /> : <IconAlert size={18} />}
            {gate.status === "pass" ? "PASS — Ready to apply" : "FAIL — Fix blocking issues"}
          </div>
          {gate.blocking.length > 0 && (
            <div style={{ marginBottom: "1rem" }}>
              <p style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem", color: "var(--danger)" }}>
                Blocking issues ({gate.blocking.length}) — fix in{" "}
                <a href="/schema-builder" style={{ color: "var(--accent)", textDecoration: "underline" }}>
                  Schema Builder → Add RLS Policy
                </a>
              </p>
              <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
                {gate.blocking.map((b, i) => {
                  const rlsGap = b.code === "RLS_GAP" ? parseRlsGapMessage(b.message) : null;
                  const fixHref = rlsGap
                    ? `/schema-builder?entity=${encodeURIComponent(rlsGap.entityId)}&command=${encodeURIComponent(rlsGap.commands[0] ?? "SELECT")}`
                    : "/schema-builder";
                  return (
                    <li key={i} className="studio-error-line" style={{ marginBottom: "0.25rem" }}>
                      [<code>{b.code}</code>] {b.message}
                      {b.code === "RLS_GAP" && rlsGap ? (
                        <span style={{ display: "block", marginTop: "0.25rem" }}>
                          <a href={fixHref} className="btn" style={{ padding: "2px 8px", fontSize: "0.75rem" }}>
                            Add policy for {rlsGap.entityId} ({rlsGap.commands.join(", ")})
                          </a>
                        </span>
                      ) : b.remediation ? (
                        <span style={{ display: "block", fontSize: "0.8rem", color: "var(--text-muted)" }}>→ {b.remediation}</span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {gate.warnings.length > 0 && (
            <div style={{ marginBottom: "1rem" }}>
              <p style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem" }}>Warnings ({gate.warnings.length})</p>
              <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
                {gate.warnings.map((w, i) => (
                  <li key={i} style={{ fontSize: "0.85rem", marginBottom: "0.25rem", display: "flex", alignItems: "flex-start", gap: 6 }}>
                    <IconAlert size={14} style={{ flexShrink: 0, color: "var(--warning)" }} /> [<code>{w.code}</code>] {w.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {gate.status === "pass" && gate.blocking.length === 0 && (
            <p style={{ fontSize: "0.9rem", color: "var(--success)", display: "flex", alignItems: "center", gap: 6 }}>
              <IconCheck size={16} /> {gate.evidence.length} evidence artifact(s) checked. Safe to apply.
            </p>
          )}
        </div>
      ) : (
        <p className="empty-state">Click "Run Gate" to validate before applying migrations.</p>
      )}
    </div>
  );
}

function ProgressTab({
  workflowRun,
  workflowProgress,
  managedByStatus,
  entities,
}: {
  workflowRun: WorkflowRun | null;
  workflowProgress: number;
  managedByStatus: { label: string; value: number }[];
  entities: IntentEntity[];
}) {
  const managedSegments = managedByStatus.map((s) => ({ label: s.label, value: s.value }));
  return (
    <div className="adoption-tab-body">
      <h3>Adoption Progress</h3>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem", alignItems: "flex-start" }}>
        <div style={{ minWidth: 200 }}>
          <p style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}>Workflow completion</p>
          <div style={{ height: 24, background: "var(--surface-soft)", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ width: `${workflowProgress}%`, height: "100%", background: "var(--success)", transition: "width 0.3s" }} />
          </div>
          <p style={{ fontSize: "0.8rem", marginTop: "0.25rem", color: "var(--text-muted)" }}>
            {workflowProgress}% complete {workflowRun?.steps?.filter((s) => s.status === "completed").length ?? 0}/{STEPS.length} steps
          </p>
        </div>
        <div>
          <p style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}>Managed scope</p>
          <MiniDonutChart segments={managedSegments} size={100} />
        </div>
        <div>
          <p style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}>Summary</p>
          <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.9rem" }}>
            <li>{entities.length} entities in intent graph</li>
            <li>{entities.filter((e) => e.managedStatus === "managed").length} fully managed</li>
            <li>{entities.filter((e) => e.managedStatus === "assisted").length} assisted</li>
            <li>{entities.filter((e) => e.managedStatus === "opaque").length} opaque</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function RiskTab({
  gate,
  rlsReport,
  lintData,
  rpcData,
  planData,
  opaqueBlocks,
  riskBusy,
  onRunValidation,
}: {
  gate: ReleaseGate | null;
  rlsReport: { report: RlsReportData } | null;
  lintData: MigrationLintData | null;
  rpcData: RpcPlanData | null;
  planData: MigrationPlanData | null;
  opaqueBlocks: OpaqueBlock[];
  riskBusy: boolean;
  onRunValidation: () => void;
}) {
  const rlsGaps = rlsReport?.report?.gaps ?? [];
  const riskItems = [
    { label: "RLS gaps", value: rlsGaps.length, severity: rlsGaps.length > 0 ? "error" : "ok", detail: rlsGaps.length > 0 ? `${rlsGaps.length} tables may expose data` : null },
    { label: "Destructive changes", value: planData?.destructiveCount ?? 0, severity: (planData?.destructiveCount ?? 0) > 0 ? "warn" : "ok", detail: planData ? `${planData.destructiveCount} pending` : null },
    { label: "Migration lint errors", value: lintData?.errorCount ?? 0, severity: (lintData?.errorCount ?? 0) > 0 ? "error" : "ok", detail: null },
    { label: "RPC security (definer)", value: rpcData?.securityDefinerCount ?? 0, severity: (rpcData?.securityDefinerCount ?? 0) > 0 ? "warn" : "ok", detail: null },
    { label: "RPC missing search_path", value: rpcData?.missingSearchPathCount ?? 0, severity: (rpcData?.missingSearchPathCount ?? 0) > 0 ? "warn" : "ok", detail: null },
    { label: "Opaque blocks", value: opaqueBlocks.length, severity: opaqueBlocks.length > 0 ? "warn" : "ok", detail: opaqueBlocks.length > 0 ? "Unmodeled SQL regions" : null },
  ];
  return (
    <div className="adoption-tab-body">
      <h3>Risk Overview</h3>
      <p style={{ fontSize: "0.9rem", marginBottom: "1rem", color: "var(--text-muted)" }}>
        Security and migration risks. Run validation to refresh.
      </p>
      <button type="button" className="btn btn-primary" onClick={onRunValidation} disabled={riskBusy} style={{ marginBottom: "1rem" }}>
        {riskBusy ? <IconLoader size={14} className="studio-spin" /> : <IconAlert size={14} />} Run Validation
      </button>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "0.75rem" }}>
        {riskItems.map((r) => (
          <div
            key={r.label}
            style={{
              padding: "0.75rem",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: r.severity === "error" ? "rgba(239,68,68,0.1)" : r.severity === "warn" ? "rgba(245,158,11,0.1)" : "var(--surface-soft)",
            }}
          >
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{r.label}</div>
            <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>{r.value}</div>
            {r.detail && <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{r.detail}</div>}
          </div>
        ))}
      </div>
      {gate?.blocking && gate.blocking.length > 0 && (
        <div style={{ marginTop: "1rem" }}>
          <h4>Blocking (from gate)</h4>
          <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
            {gate.blocking.map((b, i) => (
              <li key={i} style={{ marginBottom: "0.25rem" }}>
                <code>{b.code}</code> {b.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ApiSurfaceTab({
  endpoints,
  entities,
  endpointCoverage,
  managedCount,
}: {
  endpoints: EndpointNode[];
  entities: IntentEntity[];
  endpointCoverage: number;
  managedCount: number;
}) {
  const tableCrud = endpoints.filter((e) => e.type === "table-crud").length;
  const rpc = endpoints.filter((e) => e.type === "rpc").length;
  const view = endpoints.filter((e) => e.type === "view").length;
  return (
    <div className="adoption-tab-body">
      <h3>API Surface</h3>
      <p style={{ fontSize: "0.9rem", marginBottom: "1rem", color: "var(--text-muted)" }}>
        Your backend exposes these endpoints to the frontend. Run "Map Endpoints" to refresh.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
        <div className="stat-card" style={{ padding: "1rem", borderRadius: 8, border: "1px solid var(--border)", minWidth: 140 }}>
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Total endpoints</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{endpoints.length}</div>
        </div>
        <div className="stat-card" style={{ padding: "1rem", borderRadius: 8, border: "1px solid var(--border)", minWidth: 140 }}>
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Table CRUD (REST)</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{tableCrud}</div>
        </div>
        <div className="stat-card" style={{ padding: "1rem", borderRadius: 8, border: "1px solid var(--border)", minWidth: 140 }}>
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>RPC</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{rpc}</div>
        </div>
        <div className="stat-card" style={{ padding: "1rem", borderRadius: 8, border: "1px solid var(--border)", minWidth: 140 }}>
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Coverage</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{managedCount > 0 ? `${endpointCoverage}%` : "—"}</div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>of managed tables exposed</div>
        </div>
      </div>
      {endpoints.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Endpoint</th>
              <th>Type</th>
              <th>Entity</th>
              <th>Exposed via</th>
              <th>Operations</th>
            </tr>
          </thead>
          <tbody>
            {endpoints.slice(0, 30).map((ep) => (
              <tr key={ep.id}>
                <td style={{ fontFamily: "monospace", fontSize: "0.85em" }}>{ep.id}</td>
                <td>{ep.type}</td>
                <td>{ep.entity}</td>
                <td>{ep.exposedVia}</td>
                <td>{ep.operations.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {endpoints.length === 0 && entities.length > 0 && <p className="empty-state">No endpoints mapped yet. Click "Map Endpoints" in the header.</p>}
      {entities.length === 0 && <p className="empty-state">Run adoption first to build the intent graph.</p>}
    </div>
  );
}

function OverviewTab({
  entities,
  managedByStatus,
  entitiesBySchema,
  confidenceBuckets,
  policies,
  endpoints,
  opaqueBlocks,
}: {
  entities: IntentEntity[];
  managedByStatus: { label: string; value: number }[];
  entitiesBySchema: { label: string; value: number }[];
  confidenceBuckets: { label: string; value: number }[];
  policies: PolicyNode[];
  endpoints: EndpointNode[];
  opaqueBlocks: OpaqueBlock[];
}) {
  const barData = entitiesBySchema.map((s) => ({ label: s.label, value: s.value }));
  const confData = confidenceBuckets.map((s) => ({ label: s.label, value: s.value }));
  const managedSegments = managedByStatus.map((s) => ({ label: s.label, value: s.value }));
  return (
    <div className="adoption-tab-body">
      <h3>Overview</h3>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem", marginBottom: "1.5rem" }}>
        <div>
          <p style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}>Managed status</p>
          <MiniDonutChart segments={managedSegments} size={120} />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <p style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}>Entities per schema</p>
          <MiniBarChart data={barData} maxBars={8} height={140} />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <p style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}>Confidence</p>
          <MiniBarChart data={confData} maxBars={8} height={140} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "0.5rem" }}>
        <div style={{ padding: "0.5rem", background: "var(--surface-soft)", borderRadius: 6, textAlign: "center" }}>
          <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>{entities.length}</div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>entities</div>
        </div>
        <div style={{ padding: "0.5rem", background: "var(--surface-soft)", borderRadius: 6, textAlign: "center" }}>
          <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>{policies.length}</div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>policies</div>
        </div>
        <div style={{ padding: "0.5rem", background: "var(--surface-soft)", borderRadius: 6, textAlign: "center" }}>
          <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>{endpoints.length}</div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>endpoints</div>
        </div>
        <div style={{ padding: "0.5rem", background: "var(--surface-soft)", borderRadius: 6, textAlign: "center" }}>
          <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>{opaqueBlocks.length}</div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>opaque blocks</div>
        </div>
      </div>
    </div>
  );
}

function EntitiesTab({
  entities,
  entityPolicyCount,
  entityTriggerCount,
  patching,
  onPatch,
}: {
  entities: IntentEntity[];
  entityPolicyCount: (id: string) => number;
  entityTriggerCount: (id: string) => number;
  patching: Set<string>;
  onPatch: (id: string, action: "exclude" | "set-status", status?: string) => void;
}) {
  return (
    <div className="adoption-tab-body">
      <h3>Entities ({entities.length})</h3>
      {entities.length > 0 ? (
        <table className="data-table">
          <thead>
            <tr>
              <th>Entity</th>
              <th>Schema</th>
              <th>Status</th>
              <th>Confidence</th>
              <th>Policies</th>
              <th>Triggers</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {entities.map((entity) => {
              const isPending = patching.has(entity.id);
              const isExcluded = entity.managedStatus === "excluded";
              const isManaged = entity.managedStatus === "managed";
              return (
                <tr key={entity.id}>
                  <td style={{ fontFamily: "monospace", fontSize: "0.85em" }}>{entity.id}</td>
                  <td>{entity.schema}</td>
                  <td>
                    <StatusBadge status={entity.managedStatus} />
                  </td>
                  <td>{entity.confidence.toFixed(2)}</td>
                  <td>{entityPolicyCount(entity.id)}</td>
                  <td>{entityTriggerCount(entity.id)}</td>
                  <td>
                    <div className="cluster-row" style={{ gap: 4 }}>
                      {isPending ? (
                        <IconLoader size={13} className="studio-spin" />
                      ) : (
                        <>
                          {!isManaged && (
                            <button type="button" className="btn" style={{ padding: "1px 8px", fontSize: "0.75rem" }} onClick={() => onPatch(entity.id, "set-status", "managed")}>
                              Manage
                            </button>
                          )}
                          {!isExcluded && (
                            <button type="button" className="btn" style={{ padding: "1px 8px", fontSize: "0.75rem" }} onClick={() => onPatch(entity.id, "exclude")}>
                              Exclude
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className="empty-state">No entities. Run adoption to build the intent graph.</p>
      )}
    </div>
  );
}

function GraphTab({ entities, isDark }: { entities: IntentEntity[]; isDark: boolean }) {
  const mermaid = buildIntentMermaidEr(entities);
  return (
    <div className="adoption-tab-body">
      <h3>Entity Relationship Diagram</h3>
      <p style={{ fontSize: "0.9rem", marginBottom: "1rem", color: "var(--text-muted)" }}>Generated from intent graph entities and foreign key constraints.</p>
      {mermaid ? (
        <div className="mermaid-wrap" style={{ minHeight: 200 }}>
          <MermaidRenderer code={mermaid} id="adoption-erd" dark={isDark} />
        </div>
      ) : (
        <p className="empty-state">No entities or no FK relationships to diagram.</p>
      )}
    </div>
  );
}

function EndpointsTab({
  endpoints,
  endpointTypeBreakdown,
  entitiesBySchema,
}: {
  endpoints: EndpointNode[];
  endpointTypeBreakdown: { label: string; value: number; color?: string }[];
  entitiesBySchema: { label: string; value: number }[];
}) {
  const segments = endpointTypeBreakdown.map((s) => ({ label: s.label, value: s.value, color: s.color }));
  return (
    <div className="adoption-tab-body">
      <h3>Endpoints</h3>
      <div style={{ display: "flex", gap: "1.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        {segments.length > 0 && (
          <div>
            <p style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}>By type</p>
            <MiniDonutChart segments={segments} size={100} />
          </div>
        )}
      </div>
      {endpoints.length > 0 ? (
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Type</th>
              <th>Entity</th>
              <th>Exposed via</th>
              <th>Operations</th>
              <th>Roles</th>
            </tr>
          </thead>
          <tbody>
            {endpoints.map((ep) => (
              <tr key={ep.id}>
                <td style={{ fontFamily: "monospace", fontSize: "0.85em" }}>{ep.id}</td>
                <td>{ep.type}</td>
                <td>{ep.entity}</td>
                <td>{ep.exposedVia}</td>
                <td>{ep.operations.join(", ")}</td>
                <td>{ep.allowedRoles?.join(", ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="empty-state">No endpoints. Run "Map Endpoints" to derive from the intent graph.</p>
      )}
    </div>
  );
}

function PoliciesTab({
  policies,
  policiesPerEntity,
  policyCommandBreakdown,
}: {
  policies: PolicyNode[];
  policiesPerEntity: { label: string; value: number }[];
  policyCommandBreakdown: { label: string; value: number }[];
}) {
  const barData = policiesPerEntity.map((s) => ({ label: s.label, value: s.value }));
  const cmdSegments = policyCommandBreakdown.map((s) => ({ label: s.label, value: s.value }));
  return (
    <div className="adoption-tab-body">
      <h3>Policies ({policies.length})</h3>
      <div style={{ display: "flex", gap: "1.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        {cmdSegments.length > 0 && (
          <div>
            <p style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}>By command</p>
            <MiniDonutChart segments={cmdSegments} size={100} />
          </div>
        )}
        {barData.length > 0 && (
          <div style={{ flex: 1, minWidth: 200 }}>
            <p style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}>Policies per entity (top 10)</p>
            <MiniBarChart data={barData} maxBars={10} height={160} />
          </div>
        )}
      </div>
      {policies.length > 0 ? (
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Entity</th>
              <th>Command</th>
              <th>Roles</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {policies.slice(0, 50).map((p) => (
              <tr key={p.id}>
                <td style={{ fontFamily: "monospace", fontSize: "0.85em" }}>{p.id}</td>
                <td>{p.entity}</td>
                <td>{p.command}</td>
                <td>{p.roles.join(", ")}</td>
                <td>
                  <StatusBadge status={p.managedStatus} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="empty-state">No policies in the intent graph.</p>
      )}
    </div>
  );
}

function OpaqueTab({ opaqueBlocks, opaqueReasonBreakdown }: { opaqueBlocks: OpaqueBlock[]; opaqueReasonBreakdown: { label: string; value: number }[] }) {
  const segments = opaqueReasonBreakdown.map((s) => ({ label: s.label, value: s.value }));
  return (
    <div className="adoption-tab-body">
      <h3>Opaque Blocks ({opaqueBlocks.length})</h3>
      <p style={{ fontSize: "0.9rem", marginBottom: "1rem", color: "var(--text-muted)" }}>SQL regions that could not be modeled structurally. Manual review recommended.</p>
      {segments.length > 0 && (
        <div style={{ marginBottom: "1rem" }}>
          <p style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}>By reason</p>
          <MiniDonutChart segments={segments} size={100} />
        </div>
      )}
      <table className="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Source</th>
            <th>Reason</th>
            <th>Touched objects</th>
          </tr>
        </thead>
        <tbody>
          {opaqueBlocks.map((o) => (
            <tr key={o.id}>
              <td style={{ fontFamily: "monospace", fontSize: "0.85em" }}>{o.id}</td>
              <td>
                {o.sourceSpan.file}:{o.sourceSpan.startLine}-{o.sourceSpan.endLine}
              </td>
              <td>{o.reason}</td>
              <td>{o.touchedObjects?.slice(0, 5).join(", ") || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ToolsTab({
  workflowRun,
  gate,
  buildAdoptionWorkflowMermaid,
  buildValidationPipelineMermaid,
  isDark,
}: {
  workflowRun: WorkflowRun | null;
  gate: ReleaseGate | null;
  buildAdoptionWorkflowMermaid: (r: WorkflowRun | null) => string;
  buildValidationPipelineMermaid: (e: { id: string }[]) => string;
  isDark: boolean;
}) {
  const adoptionMermaid = buildAdoptionWorkflowMermaid(workflowRun);
  const validationMermaid = buildValidationPipelineMermaid(gate?.evidence ?? []);
  return (
    <div className="adoption-tab-body">
      <h3>Tools & Workflows</h3>
      <div style={{ display: "grid", gap: "1.5rem" }}>
        <div>
          <h4>Adoption workflow</h4>
          <p style={{ fontSize: "0.85rem", marginBottom: "0.5rem", color: "var(--text-muted)" }}>introspect → sql-parse → review → intent-sync → approve → intent-init</p>
          {adoptionMermaid ? (
            <div className="mermaid-wrap" style={{ minHeight: 120 }}>
              <MermaidRenderer code={adoptionMermaid} id="adoption-workflow" dark={isDark} />
            </div>
          ) : null}
        </div>
        <div>
          <h4>Validation pipeline</h4>
          <p style={{ fontSize: "0.85rem", marginBottom: "0.5rem", color: "var(--text-muted)" }}>rls-check, rpc-lint, migration-lint → release-gate</p>
          {validationMermaid ? (
            <div className="mermaid-wrap" style={{ minHeight: 120 }}>
              <MermaidRenderer code={validationMermaid} id="validation-pipeline" dark={isDark} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
