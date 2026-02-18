---
"@sbtools/core": minor
"@sbtools/ui-web": minor
---

Improve first-run onboarding experience

**`@sbtools/core`**

- feat: global preflight check — every command except `init` and `help` now exits immediately with a clear `❌` error and `💡` tip if `supabase-tools.config.json` is missing, instead of crashing with an opaque internal error
- fix: `sbt init` now creates `supabase/migrations` and `supabase/current` directories so `sbt migrate` preflight passes immediately after init
- feat: `sbt init` prints a "Next steps" guide after creating a new config
- feat: `sbt help` shows a warning banner and Quick Start sequence when no config file is present
- feat: new `sbt plugin` command with subcommands `list`, `add`, `remove`, `enable`, `disable` for managing plugins without manually editing JSON
- feat: `sbt start` prints a note explaining that the `db-init` container exiting with code 0 is normal

**`@sbtools/ui-web`**

- fix: dashboard Getting Started guide now correctly triggers on a 404 response (was checking for "not found" but the error message contains the status code)
