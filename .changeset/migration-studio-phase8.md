---
"@sbtools/ui-web": minor
"@sbtools/plugin-migration-studio": patch
---

Phase 8 — Schema Builder: visual dashboard page for designing tables and RLS policies.

**New dashboard page** at `/schema-builder` (nav: "Schema Builder", icon: wrench, visible when migration-studio plugin is active):

**New Table builder:**
- Schema + table name inputs
- Column editor table with add/remove rows; per-column: name, type (12 common PG types), nullable, primary key, default
- Enable RLS checkbox (default: on)
- Live SQL preview updated on every keystroke (client-side, no HTTP call)
- "Generate Migration" → `POST /api/studio/scaffold/create-table` → writes timestamped `.sql` file to `supabase/migrations/`; success badge shows filename

**Add RLS Policy builder:**
- Table input (e.g. `public.users`), policy name, command (SELECT/INSERT/UPDATE/DELETE/ALL), roles (comma-separated), permissive toggle
- USING / WITH CHECK expression inputs shown/hidden based on command (INSERT never shows USING; SELECT/DELETE never show WITH CHECK)
- Live SQL preview
- "Generate Migration" → `POST /api/studio/scaffold/add-rls-policy` → same file-write flow

**Model + routing changes (`packages/ui-web`):**
- `RouteName` extended with `"builder"`
- `PluginAvailability` extended with `builder: boolean` (true when studio plugin active)
- `NavItem.icon` extended with `"builder"`
- New route prefix `/schema-builder` → `builder`
- Nav item: "Schema Builder" / "Design tables and RLS policies visually"
- `Wrench` icon from lucide-react

Layer 2 (Design) now at ~40%.
