# Plan: CLI Runner Dashboard Page

## Goal

A "Commands" page in the dashboard (`/runner`) from which the user can invoke any `sbt` command — core or plugin — and see its live output and final exit status. No new packages. No plugin coupling in `ui-web`.

---

## Architecture answer: existing server, new routes

The dashboard HTTP server (already running on `:3400`) gets two new routes:

| Route | Purpose |
|---|---|
| `GET /api/commands` | Returns all available commands (core + plugin), their descriptions and categories |
| `GET /api/run/stream?command=<name>` | SSE stream: spawns `sbt <command>` as a child process, pipes stdout/stderr, sends exit event |

The React SPA calls these exactly like it calls `/api/dashboard-config` or `/api/logs/stream` today. No new server process. No websockets. SSE is already used for the log stream, so the pattern is established.

---

## Command discovery

### Core commands
`command-registry.ts` already has every core command with `name`, `description`, and `category`. The dashboard already imports from this module — we can call `allCommands()` directly in the handler.

### Plugin commands
`ctx.siblingPlugins` (available in every dashboard handler via closure) carries all loaded plugins. Each plugin's `commands` array has `name` and `description`. The source is `plugin.name`.

### API shape
```ts
// GET /api/commands
{
  commands: Array<{
    name: string;        // "snapshot", "generate-erd", etc.
    description: string;
    category: string;    // "Database", "Code Generation", "@sbtools/plugin-erd", etc.
    source: "core" | string; // "core" or plugin name
  }>
}
```

---

## Child process invocation

### Finding the binary
The dashboard process is already running because the user executed `sbt dashboard`. We resolve the same `sbt` binary used to start it:

```ts
function findSbtBin(projectRoot: string): string {
  // 1. Local workspace install (most reliable in monorepo)
  const local = path.join(projectRoot, "node_modules/.bin/sbt");
  if (fs.existsSync(local)) return local;
  // 2. Fall back to PATH (global install)
  return "sbt";
}
```

### Spawning
```ts
const bin = findSbtBin(ctx.projectRoot);
const child = spawn(bin, [command], {
  cwd: ctx.projectRoot,
  shell: !path.isAbsolute(bin), // shell only when falling back to PATH
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, FORCE_COLOR: "0" }, // no ANSI codes in logs
});
```

`cwd: projectRoot` ensures the child finds `supabase-tools.config.json` identically to a manual CLI invocation.

---

## SSE stream protocol

```
GET /api/run/stream?command=snapshot
```

Events sent to client:
```
data: {"type":"start","command":"snapshot","pid":12345}

data: {"type":"stdout","line":"Connecting to database..."}
data: {"type":"stdout","line":"Snapshot complete: 14 functions, 3 views"}
data: {"type":"stderr","line":"Warning: pg_stat_statements not enabled"}

data: {"type":"exit","code":0,"success":true}
```

Client closing the SSE connection (`req.on("close")`) sends `SIGTERM` to the child — same cleanup pattern as `handleLogStream`.

### Command allowlist
Server rejects any `command` value not present in the discovered command list (prevents injection). Additionally, `dashboard` and `docs` are blocked server-side — they are server processes themselves and make no sense to invoke from within the dashboard:

```ts
const BLOCKED = new Set(["dashboard", "docs"]);
if (BLOCKED.has(command) || !knownCommands.has(command)) {
  sendJson(res, 400, { error: `Command '${command}' cannot be invoked from the dashboard.` });
  return;
}
```

`watch`, `migrate`, and all plugin commands are allowed — the UI handles the UX concerns.

---

## UI: `Runner.tsx`

### Layout
- Header: "Commands" title, subtitle "Run any sbt command and stream its output"
- Command list grouped by category, rendered as cards:
  ```
  ┌─────────────────────────────────────────────┐
  │ snapshot                          [Run ▶]   │
  │ Export DB objects to filesystem             │
  └─────────────────────────────────────────────┘
  ```
- `migrate` and any command containing "apply" gets a warning badge: `⚠ Modifies DB`
- `watch` gets an info badge: `∞ Runs until cancelled`

### Run flow
1. User clicks **Run** → button becomes **Cancel**, log panel opens below the card
2. `EventSource` connects to `/api/run/stream?command=<name>`
3. `stdout` lines → appended to log panel with no colour prefix
4. `stderr` lines → appended with a muted warning prefix
5. On `exit` event → button resets, panel footer shows ✓ Exit 0 (green) or ✗ Exit 1 (red)
6. User clicks **Cancel** → `eventSource.close()` (server sends SIGTERM to child)

### One active run at a time per command
State: `Map<commandName, RunState>` where `RunState = { lines: string[], status: "running"|"success"|"error"|"idle", exitCode?: number }`. Multiple commands can run concurrently (separate EventSources).

---

## Nav integration

`model.ts`:
- Add `"runner"` to `RouteName`
- Add `"runner"` to `NavItem.icon` union
- Add `{ route: "runner", prefix: "/runner" }` to `ROUTE_PREFIXES`
- `getNavItems()` always includes runner as enabled (no plugin dependency)

`Icons.tsx`:
- Add `IconTerminal` — a `<svg>` terminal/prompt icon (consistent with other icons in the file)

`App.tsx`:
- Import `RunnerPage` and `IconTerminal`
- Add `runner` case to `NavIcon` switch
- Add `route === "runner"` branch in the render tree

---

## File changes

| File | Change |
|---|---|
| `packages/core/src/commands/dashboard.ts` | Add `collectCommands(ctx)` helper; add `/api/commands` handler; add `/api/run/stream` handler with `findSbtBin`, spawn, SSE |
| `packages/ui-web/src/dashboard/pages/Runner.tsx` | **New** — command list, run/cancel controls, live log panel, exit status |
| `packages/ui-web/src/dashboard/hooks/useCommands.ts` | **New** — `GET /api/commands` fetch hook (same pattern as `useAtlasData`) |
| `packages/ui-web/src/dashboard/components/Icons.tsx` | Add `IconTerminal` |
| `packages/ui-web/src/dashboard/lib/model.ts` | Add `"runner"` to `RouteName`, icon union, `ROUTE_PREFIXES`, `getNavItems` |
| `packages/ui-web/src/dashboard/App.tsx` | Import `RunnerPage`; add nav icon case; add route branch |
| `packages/ui-web/src/styles/tokens.css` | Add `.run-log-surface` (scrollable pre-like area), `.run-card` styles if needed |

---

## What is NOT in scope

- Passing custom args from the UI (free-text arg input could be added later; for now each command runs with no extra args)
- Command output persistence across page navigations (in-memory only, lost on navigate)
- Auth / access control (dashboard is already localhost-only)
- `init` command (modifies the config file — block it alongside `dashboard`/`docs`)

---

## Changeset impact

- `@sbtools/core` — patch (new API routes, no contract change)
- `@sbtools/ui-web` — patch (new page, new hook, new icon, nav update)
