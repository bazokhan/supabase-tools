---
"@sbtools/plugin-migration-studio": patch
"@sbtools/ui-web": patch
---

Move Migration Studio to a server-only plugin + React dashboard page architecture.

- Refactor `@sbtools/plugin-migration-studio` to server-only mode and remove bundled studio UI dependency on `@sbtools/ui-web`.
- Add CORS and `GET /api/health` to the studio server to support browser clients from dashboard origin.
- Add a first-class React `Migration Studio` dashboard page in `@sbtools/ui-web` with server URL config, connectivity status, templates, migration list/schema tabs, SQL actions (analyze/save/apply), and live refresh via SSE.
- Wire dashboard navigation and plugin availability gating using plugin-contributed dashboard section metadata.
