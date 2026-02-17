---
"@sbtools/core": minor
"@sbtools/plugin-migration-studio": minor
---

Add phase-1 real-time refresh for migration workflows.

**core**:
- Add `sbt watch` command to orchestrate migration refresh in near real time.
- Watch migration files and listen to PostgreSQL `LISTEN/NOTIFY` events (`sbt_watch_events`).
- Auto-install DB helper hooks for notifications (with graceful fallback for limited privileges).
- Add debounced single-flight scheduling for refresh runs.
- Write watch event stamp at `.sbt/watch/last-event.json`.
- Fix watch self-loop by ignoring artifact file writes as watch triggers.

**plugin-migration-studio**:
- Add SSE endpoint (`GET /api/events`) for live refresh notifications.
- Invalidate schema/migration caches on watch/artifact/file change bridge events.
- Refresh schema/migration context in UI without full page reload.
