---
"@sbtools/plugin-migration-studio": minor
---

Add `GET /api/studio/llm-context` endpoint, `sbt studio-release-check` one-shot command, and fix RLS check access expression generation.

- `GET /api/studio/llm-context` — single-call project orientation for AI agents: returns intent graph summary, artifact freshness, full tool catalog with descriptions, and migration count
- `sbt studio-release-check` — runs the full release-check workflow (rls-check → rpc-lint → migration-lint → release-gate) without requiring a running server; exits 0 on pass, 1 on fail; supports `--json` for CI pipelines
- Fix `studio-rls-check`: suggested USING/WITH CHECK expressions now infer `auth.uid() = <col>` from common ownership columns (`user_id`, `owner_id`, `created_by`, etc.) instead of emitting placeholder TODO comments; falls back to `auth.uid() IS NOT NULL` when no ownership column is found
