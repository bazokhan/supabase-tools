import React from "react";
import { CheckCircle2, Loader2, Play, RefreshCw, XCircle, Map } from "lucide-react";

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

function studioBase(): string {
  return `${window.location.protocol}//${window.location.hostname}:3335`;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export function AdoptionPage() {
  const [run, setRun] = React.useState<WorkflowRun | { status: "not_started" } | null>(null);
  const [entities, setEntities] = React.useState<IntentEntity[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string>("");
  const [busy, setBusy] = React.useState(false);
  const [patching, setPatching] = React.useState<Set<string>>(new Set());
  const [endpointResult, setEndpointResult] = React.useState<{ total: number; entityEndpoints: number; rpcEndpoints: number } | null>(null);
  const [mappingEndpoints, setMappingEndpoints] = React.useState(false);
  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

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
      const data = await requestJson<{ entities?: IntentEntity[] } | null>(`${base}/api/studio/intent-graph`);
      setEntities(Array.isArray(data?.entities) ? data.entities : []);
    } catch {
      setEntities([]);
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
      const result = await requestJson<{ total: number; entityEndpoints: number; rpcEndpoints: number }>(
        `${base}/api/studio/endpoint-map`,
        { method: "POST" }
      );
      setEndpointResult(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setMappingEndpoints(false);
    }
  };

  if (loading) {
    return (
      <section className="panel">
        <p className="empty-state">
          <Loader2 size={14} className="studio-spin" style={{ display: "inline", marginRight: 6 }} />
          Connecting to Migration Studio...
        </p>
      </section>
    );
  }

  const status = run && "status" in run ? run.status : "not_started";
  const isWaiting = status === "waiting_checkpoint";
  const isFailed = status === "failed";
  const isRunning = status === "running";
  const workflowRun = run && "steps" in run ? run : null;

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
            {status === "not_started" && (
              <button type="button" className="btn btn-primary" onClick={handleStart} disabled={busy}>
                <Play size={14} /> Start Adoption
              </button>
            )}
            {isWaiting && (
              <button type="button" className="btn btn-primary" onClick={handleResume} disabled={busy}>
                <RefreshCw size={14} /> Resume
              </button>
            )}
            {isFailed && (
              <button type="button" className="btn" onClick={handleStart} disabled={busy}>
                <RefreshCw size={14} /> Restart
              </button>
            )}
          </div>
        </div>
        {error ? (
          <p className="studio-error-line">
            <XCircle size={13} /> {error}
          </p>
        ) : null}
      </section>

      {workflowRun ? (
        <section className="panel">
          <h3>Steps</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Step</th>
                <th>Status</th>
                <th>Artifact</th>
              </tr>
            </thead>
            <tbody>
              {STEPS.map((step, i) => {
                const result = workflowRun.steps[i];
                const sym =
                  result?.status === "completed" ? (
                    <CheckCircle2 size={14} className="text-good" />
                  ) : result?.status === "failed" ? (
                    <XCircle size={14} className="text-bad" />
                  ) : isRunning && i === workflowRun.currentStep ? (
                    <Loader2 size={14} className="studio-spin" />
                  ) : (
                    <span aria-hidden>–</span>
                  );
                return (
                  <tr key={step.id}>
                    <td>{step.label}</td>
                    <td>{sym}</td>
                    <td>{result?.status === "completed" ? step.artifact : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ) : null}

      {entities.length > 0 ? (
        <section className="panel">
          <div className="panel-head">
            <h3>Intent Graph ({entities.length} entities)</h3>
            <div className="cluster-row">
              {endpointResult != null && (
                <span className="timestamp-pill">
                  {endpointResult.total} endpoint(s) mapped ({endpointResult.entityEndpoints} table-crud, {endpointResult.rpcEndpoints} rpc)
                </span>
              )}
              <button type="button" className="btn" onClick={handleMapEndpoints} disabled={mappingEndpoints}>
                {mappingEndpoints ? <Loader2 size={14} className="studio-spin" /> : <Map size={14} />} Map Endpoints
              </button>
            </div>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Entity</th>
                <th>Schema</th>
                <th>Status</th>
                <th>Confidence</th>
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
                    <td>
                      <div className="cluster-row" style={{ gap: 4 }}>
                        {isPending ? (
                          <Loader2 size={13} className="studio-spin" />
                        ) : (
                          <>
                            {!isManaged && (
                              <button
                                type="button"
                                className="btn"
                                style={{ padding: "1px 8px", fontSize: "0.75rem" }}
                                onClick={() => handlePatchEntity(entity.id, "set-status", "managed")}
                              >
                                Manage
                              </button>
                            )}
                            {!isExcluded && (
                              <button
                                type="button"
                                className="btn"
                                style={{ padding: "1px 8px", fontSize: "0.75rem" }}
                                onClick={() => handlePatchEntity(entity.id, "exclude")}
                              >
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
        </section>
      ) : status === "completed" ? (
        <section className="panel">
          <p className="empty-state">Intent graph built. Run introspect and sql-parse if entities are stale.</p>
        </section>
      ) : null}
    </div>
  );
}
