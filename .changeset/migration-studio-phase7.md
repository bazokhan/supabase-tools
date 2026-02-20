---
"@sbtools/plugin-migration-studio": minor
---

Phase 7 — Validation Chain: five new analysis tools that read artifacts and produce structured findings.

**New tools (all with CLI commands + HTTP routes):**

- `studio-rls-check` / `POST /api/studio/rls-check` — audits RLS policy coverage for every managed entity in the intent graph; flags gaps (missing SELECT/INSERT/UPDATE/DELETE policies) as blocking issues; warns on SECURITY DEFINER functions without `search_path`; produces `studio.rls.plan` + `studio.rls.report`

- `studio-lint` / `POST /api/studio/migration-lint` — lints SQL migration files via the AST artifact; rules: TRUNCATE_DETECTED (error), DROP_DETECTED (warning), DESTRUCTIVE_NO_TRANSACTION (warning), LOW_PARSE_CONFIDENCE (info), NAMING_VIOLATION (non-timestamped filename); produces `studio.migration.lint`

- `studio-rpc-lint` / `POST /api/studio/rpc-lint` — lints function/RPC definitions in the intent graph; checks DEFINER_NO_SEARCH_PATH, DEFINER_PUBLIC_EXPOSURE (SECURITY DEFINER in public schema), EMPTY_FUNCTION_BODY; skips opaque functions; produces `studio.rpc.plan`

- `studio-migration-plan` / `POST /api/studio/migration-plan` — diffs intent graph vs schema snapshot; classifies each change as `additive_safe`, `additive_with_default`, `type_change_narrowing`, `drop`, `policy_change`, or `constraint_change`; sorts additive changes before destructive; produces `studio.migration.plan` with a `snapshotHash`

- `studio-release-gate` / `POST /api/studio/release-gate` — aggregates findings from RLS report, RPC plan, and migration lint into a single pass/fail decision; NO_VALIDATION blocking error when no evidence artifacts exist; produces `studio.release.gate`

**Test coverage:** 46 new tests across 5 test files (165 total passing).

Layer 4 (Validate) is now 100% implemented.
