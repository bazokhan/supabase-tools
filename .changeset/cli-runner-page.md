---
"@sbtools/core": patch
"@sbtools/ui-web": patch
---

Add CLI runner page: invoke any sbt command from the dashboard and stream live output.

**@sbtools/core**
- `/api/commands`: returns all registered core + plugin commands (name, description, category, source)
- `/api/run/stream`: SSE endpoint that spawns the `sbt` binary with the requested command, streams stdout/stderr line-by-line, and sends an exit event with the final code; kills the child process when the client disconnects
- `findSbtBin()`: resolves `node_modules/.bin/sbt` locally before falling back to PATH
- `collectCommands()`: merges core registry commands with plugin-contributed commands; filters blocked commands (`dashboard`, `docs`, `init`)

**@sbtools/ui-web**
- `Runner.tsx`: commands page grouped by category; run/cancel per command; live scrolling log surface with stdout/stderr coloring; ✓/✗ exit status pill; "Modifies DB" and "Runs until cancelled" badges
- `useCommands` hook: fetches `/api/commands`, returns `{ commands, loading, error }`
- `IconTerminal`: new terminal window icon
- Nav: "Commands" entry with `IconTerminal`, always enabled, works without atlas data
- CSS: `.runner-page`, `.run-card`, `.run-log-surface`, `.run-status-*`, `.btn-primary-sm`, `.btn-danger-sm`, `@keyframes blink` cursor
