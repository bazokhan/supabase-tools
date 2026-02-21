---
"@sbtools/core": minor
"@sbtools/plugin-typegen": minor
---

Default all generated output paths to `.sbt/` (git-ignored)

Previously, `snapshot` defaulted to `supabase/current` and `docsOutput` to `docs`, causing
generated files to be tracked by git unless users explicitly overrode them.

Both now default to `.sbt/snapshot` and `.sbt/docs` respectively — already inside the
git-ignored `.sbt/` directory. `migrations` and `functions` are unchanged (user-authored files
that should be committed).

`plugin-typegen` type output now defaults to `.sbt/types/supabase.ts` instead of
`src/integrations/supabase/types.ts`.

Users with explicit path overrides in `supabase-tools.config.json` are unaffected.
