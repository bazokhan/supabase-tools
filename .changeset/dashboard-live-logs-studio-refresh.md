---
"@sbtools/core": minor
"@sbtools/ui-web": minor
"@sbtools/plugin-migration-studio": minor
---

Refresh dashboard UX and Studio integration with live operations workflows.

**@sbtools/ui-web**
- Redesign dashboard shell with improved dark theme, icon-driven navigation, richer search UI, and clearer detail actions.
- Add embedded Migration Studio mode directly inside Migrations page.
- Add live logs tab in dashboard (service filters, stream status, inline search).
- Improve large dependency graph performance with focused neighborhood rendering and pagination/chunking behavior.
- Improve details layout for wide content and add quick-open links to related files/snapshots.

**@sbtools/core**
- Extend `sbt dashboard` server with live log stream APIs:
  - `GET /api/logs/stream`
  - `GET /api/logs/services`
- Add safe file browser/open APIs for project artifacts and snapshots:
  - `GET /api/fs/list`
  - `GET /api/fs/file`
- Keep SPA dashboard endpoints and static serving behavior intact.

**@sbtools/plugin-migration-studio**
- Refresh Studio styling to match the modern dark visual language used by dashboard.
- Improve Studio surface styling (panels, controls, chips, context tabs, editor shell) for better readability and consistency.
