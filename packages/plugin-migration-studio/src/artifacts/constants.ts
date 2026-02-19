/**
 * Stable artifact ID and version constants for all Migration Studio artifacts.
 *
 * Each artifact ID corresponds to one tool's output contract.
 * Increment the major version when the `data` shape changes in a breaking way.
 */
export const STUDIO_ARTIFACTS = {
  /** Live schema snapshot from studio-introspect (entities, policies, functions, etc.). */
  SCHEMA_SNAPSHOT: { id: "studio.schema.snapshot", version: "1.0.0" },
  /** Parsed SQL AST for migration files from studio-sql-parse. */
  SQL_AST: { id: "studio.sql.ast", version: "1.0.0" },
  /** Intent graph: design/control representation of the backend schema. */
  INTENT_GRAPH: { id: "studio.intent.graph", version: "1.0.0" },
  /** Sync report comparing DB reality + parsed SQL against the intent graph. */
  INTENT_SYNC: { id: "studio.intent.sync-report", version: "1.0.0" },
  /** RLS policy plan generated from intent graph entity + policy nodes. */
  RLS_PLAN: { id: "studio.rls.plan", version: "1.0.0" },
  /** RLS verification report: coverage gaps, inconsistencies, definer warnings. */
  RLS_REPORT: { id: "studio.rls.report", version: "1.0.0" },
  /** Function security plan: input validation, authz checks, search_path. */
  RPC_PLAN: { id: "studio.rpc.plan", version: "1.0.0" },
  /** Migration plan: ordered SQL changes with change-class annotations. */
  MIGRATION_PLAN: { id: "studio.migration.plan", version: "1.0.0" },
  /** Migration lint result: risk flags, naming violations, lock-safety checks. */
  MIGRATION_LINT: { id: "studio.migration.lint", version: "1.0.0" },
  /** Release gate: aggregated pass/fail with blocking reasons and evidence. */
  RELEASE_GATE: { id: "studio.release.gate", version: "1.0.0" },
  /** Workflow run state: step status, timestamps, artifact refs. */
  WORKFLOW_RUN: { id: "studio.workflow.run", version: "1.0.0" },
} as const;
