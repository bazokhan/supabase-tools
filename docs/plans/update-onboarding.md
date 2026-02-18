# Onboarding & First-Run UX Improvements

## Context

When a new user runs `supabase-tools` for the first time in an empty folder, several pain points were discovered:

1. **`db-init` container appears to "fail"** — it is a one-shot bootstrapper that exits normally (code 0), but Docker Compose shows it as "Exited" which looks alarming.
2. **`sbt init` doesn't create `supabase/migrations`** — so running `sbt migrate` after `sbt init` immediately fails preflight even though init was supposed to set things up. The preflight error tells users to "run `sbt init`" but they just did.
3. **Dashboard shows a bare "Data Error"** — when no atlas data exists (first run), a sparse error message is shown with no guidance on what to do next.
4. **No CLI for plugin management** — users must manually open and edit `supabase-tools.config.json` in nano/editor to add plugins. Zero discoverability.
5. **`sbt help` gives no onboarding hint** — when run without a config file, no indicator that `sbt init` is needed or what the correct first-run workflow is.
6. **`sbt init` prints no next steps** — after creation succeeds, the user is left wondering what to do.

---

## Changes

### 1. Fix `ensureDirs()` — create missing directories (critical bug)
**File:** `packages/core/src/commands/init.ts`

Add two `mkdirSync` calls to `ensureDirs()`:
```typescript
fs.mkdirSync(resolve(config.paths.migrations), { recursive: true }); // supabase/migrations
fs.mkdirSync(resolve(config.paths.snapshot), { recursive: true });   // supabase/current
```
These directories are referenced in preflight checks and their absence causes confusing failures immediately after `sbt init`.

### 2. Print next steps after `sbt init`
**File:** `packages/core/src/commands/init.ts`

At the end of `init()`, after all setup completes, print a "Next steps" block:
```
Next steps:
  1. sbt start           — Start local Supabase services (Docker)
  2. sbt snapshot        — Export DB schema to filesystem
  3. sbt generate-atlas  — Build dashboard data
  4. sbt dashboard       — Open the development dashboard

  To add plugins: sbt plugin list
```

### 3. Show config-missing banner in `sbt help`
**File:** `packages/core/src/commands/help.ts`

At the top of `showHelp()`, check for the config file. If absent, emit a prominent warning before the command list:
```
⚠  No supabase-tools.config.json found.
   Run `sbt init` to create one and set up your project.
```
Also add a "Quick Start" section just above the categorized commands:
```
Quick Start (first time):
  sbt init → sbt start → sbt snapshot → sbt generate-atlas → sbt dashboard
```

### 4. Explain `db-init` one-shot container after `sbt start`
**File:** `packages/core/src/commands/docker.ts`

After the `docker compose up -d` call in `runStart()`, add a `ui.detail()` note:
```
  Note: The 'db-init' container is a one-shot DB bootstrapper —
  if it shows as 'Exited (0)' that is normal and expected.
```

### 5. New `sbt plugin` command
**New file:** `packages/core/src/commands/plugin.ts`
**Register in:** `packages/core/src/commands/register-core.ts`

Subcommands dispatched via `args[0]`:

#### `sbt plugin list`
Lists all well-known `@sbtools/` plugins with their current config status, plus any custom plugins already in config. Example output:
```
Available @sbtools plugins:
  @sbtools/plugin-erd              ERD diagram generator           [not configured]
  @sbtools/plugin-migration-audit  Migration drift detection        [configured ✓]
  @sbtools/plugin-depgraph         TS function/table dep graph      [not configured]
  @sbtools/plugin-typegen          Generate TS types from Supabase  [not configured]
  @sbtools/plugin-db-test          pgTAP runner via PGlite          [not configured]
  @sbtools/plugin-logs             Docker logs + pg_stat viewer     [not configured]
  @sbtools/plugin-deno-functions   Scan Edge Functions              [not configured]
  @sbtools/plugin-frontend-usage   Scan frontend Supabase usage     [not configured]
  @sbtools/plugin-scaffold         Generate plugin boilerplate      [not configured]

To add a plugin:    sbt plugin add @sbtools/plugin-erd
Then install it:    npm install @sbtools/plugin-erd
```

#### `sbt plugin add <path>`
1. Read and parse `supabase-tools.config.json`
2. Check if plugin already exists (skip with message if so)
3. Append `{ "path": "<name>", "enabled": true, "config": {} }` to the plugins array
4. Write back the config with `JSON.stringify(config, null, 2)`
5. Print install hint: `"npm install <name>"` (if it looks like an npm package)

#### `sbt plugin remove <path>`
Remove the matching plugin entry from config and write back.

#### `sbt plugin enable <path>` / `sbt plugin disable <path>`
Toggle `enabled` on the matching entry and write back.

All subcommands read the config file directly from disk (not through the loaded `config` singleton) so changes are written correctly.

**Register:**
```typescript
registerCommand({
  name: "plugin",
  description: "Manage plugins (list, add, remove, enable, disable)",
  category: "Setup",
  run: async (args) => runPlugin(args),
});
```

### 6. Dashboard getting-started screen
**File:** `packages/ui-web/src/dashboard/App.tsx`

Replace the bare "Data Error" panel (lines 387–391) with a proper onboarding panel. Only show this styled guide when the error is the expected "atlas not found" 404; otherwise fall back to the existing plain error display.

```tsx
atlas.error ? (
  <section className="panel">
    {atlas.error.includes("not found") ? (
      <>
        <h2>Getting Started</h2>
        <p>No dashboard data found. Run these commands in your terminal:</p>
        <ol style={{ lineHeight: "2", paddingLeft: "1.5em" }}>
          <li><code>sbt start</code> — Start local Supabase services</li>
          <li><code>sbt snapshot</code> — Export DB schema to files</li>
          <li><code>sbt generate-atlas</code> — Build dashboard data</li>
          <li>Refresh this page</li>
        </ol>
        <p className="empty-state" style={{ marginTop: "1em", fontSize: "0.85em" }}>
          {atlas.error}
        </p>
      </>
    ) : (
      <>
        <h2>Data Error</h2>
        <p className="empty-state">{atlas.error}</p>
      </>
    )}
  </section>
)
```

### 7. Update CLAUDE.md
Add the new `sbt plugin` command to the Dashboard API Routes section and note the new `plugin.ts` command file.

---

## Critical Files

| File | Change |
|------|--------|
| `packages/core/src/commands/init.ts` | Add migrations+snapshot dir creation; add next-steps output |
| `packages/core/src/commands/help.ts` | Config-missing banner; Quick Start section |
| `packages/core/src/commands/docker.ts` | db-init explanation note after start |
| `packages/core/src/commands/plugin.ts` | **NEW** — list/add/remove/enable/disable subcommands |
| `packages/core/src/commands/register-core.ts` | Register `plugin` command |
| `packages/ui-web/src/dashboard/App.tsx` | Replace bare error with getting-started guide |
| `CLAUDE.md` | Update Codebase Architecture section |

---

## Reusable Patterns

- Config file path: `path.join(config.projectRoot, "supabase-tools.config.json")` — same pattern as `init.ts`
- `resolve()` from `"../config.js"` for turning relative paths to absolute
- `ui.success()`, `ui.info()`, `ui.warn()`, `ui.detail()`, `ui.heading()` from `@sbtools/sdk`
- `sanitizeContainerPrefix()` from `@sbtools/sdk`

---

## Verification

1. **`sbt init` in empty folder** → creates `supabase/migrations`, `supabase/current`, `supabase/functions`, `docs`, `.sbt/` → prints next steps
2. **`sbt migrate` after `sbt init`** → preflight passes (migrations dir exists) → "No migration files found."
3. **`sbt help` in folder without config** → shows warning banner + Quick Start
4. **`sbt start`** → docker compose runs → after startup, note about db-init container printed
5. **`sbt plugin list`** → shows all known plugins with status
6. **`sbt plugin add @sbtools/plugin-erd`** → updates config JSON, prints npm install hint
7. **Dashboard with no atlas data** → shows step-by-step getting-started guide instead of bare error
