---
"@sbtools/plugin-migration-studio": minor
"@sbtools/ui-web": minor
---

Migration Studio Platform Phase 11: full vision complete

**New tool — `generate-create-view`:**
- `src/tools/generate-create-view.ts` — generates `CREATE OR REPLACE VIEW schema.name AS <query>;` migration files; no intent graph required

**New CLI command:**
- `sbt studio-create-view --schema public --name <name> --query "SELECT ..."`

**New HTTP route:**
- `POST /api/studio/scaffold/create-view` — calls `runCreateView`

**Apply improvements (Layer 5 — Apply):**
- Audit log: after a successful `POST /api/apply`, writes a `studio.apply.log` artifact (`appliedAt`, `output`, `success`) so there is always a record of the most recent apply
- Snapshot staleness check: if a `studio.migration.plan` artifact exists at apply time, recomputes the current snapshot hash and includes `snapshotStale: true` in the response when the snapshot has changed since the plan was generated — warns without blocking

**Schema Builder UI (Layer 2 — Design):**
- `FunctionBuilder` component — schema, name, params (add/remove rows), return type, language (sql/plpgsql), security (invoker/definer), inline body textarea, live SQL preview; calls `POST /api/studio/scaffold/add-function`
- `RpcBuilder` component — same as FunctionBuilder but forces `schema: public` and calls `POST /api/studio/scaffold/create-rpc`
- `ViewBuilder` component — schema, name, SELECT query textarea, live SQL preview; calls `POST /api/studio/scaffold/create-view`

All three builders appear in the Schema Builder page below the existing Table and Policy builders.

**New artifact constant:**
- `STUDIO_ARTIFACTS.APPLY_LOG` — `studio.apply.log` artifact for apply audit records

This completes the full platform vision: all five layers (Understand → Design → Generate → Validate → Apply) are now fully implemented.
